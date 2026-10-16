use reqwest::{header, Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::time::Duration;
use url::Url;

const MAX_MCP_RESPONSE_BYTES: usize = 1024 * 1024;
const MAX_MCP_TOOLS: usize = 200;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolSummary {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerInspection {
    pub endpoint: String,
    pub server_name: String,
    pub server_version: String,
    pub protocol_version: String,
    pub tools: Vec<McpToolSummary>,
}

fn is_public_address(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, c, _] = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_unspecified()
                || ip.is_multicast()
                || a == 0
                || (a == 100 && (64..=127).contains(&b))
                || (a == 192 && b == 0 && c == 0)
                || (a == 192 && b == 0 && c == 2)
                || (a == 198 && (b == 18 || b == 19))
                || (a == 198 && b == 51 && c == 100)
                || (a == 203 && b == 0 && c == 113))
        }
        IpAddr::V6(ip) => {
            let segments = ip.segments();
            !(ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_multicast()
                || (segments[0] & 0xfe00) == 0xfc00
                || (segments[0] & 0xffc0) == 0xfe80
                || ip.to_ipv4_mapped().is_some_and(|mapped| is_public_address(IpAddr::V4(mapped))))
        }
    }
}

fn validated_endpoint(endpoint: &str) -> Result<(Url, Vec<SocketAddr>), String> {
    if endpoint.len() > 2048 || endpoint.chars().any(char::is_control) {
        return Err("The MCP endpoint is too long or contains invalid characters.".into());
    }
    let url = Url::parse(endpoint).map_err(|_| "Enter a valid MCP endpoint URL.".to_string())?;
    if url.scheme() != "https" {
        return Err("Remote MCP endpoints must use HTTPS. Local HTTP and stdio servers are not supported in this build.".into());
    }
    if !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return Err("MCP endpoint URLs must not contain credentials, query parameters, or fragments.".into());
    }
    let host = url.host_str().ok_or_else(|| "The MCP endpoint must include a hostname.".to_string())?;
    let port = url.port_or_known_default().ok_or_else(|| "The MCP endpoint has an invalid port.".to_string())?;
    let addresses: Vec<SocketAddr> = (host, port).to_socket_addrs()
        .map_err(|_| "Could not resolve the MCP endpoint hostname.".to_string())?
        .collect();
    if addresses.is_empty() || addresses.len() > 32 || addresses.iter().any(|address| !is_public_address(address.ip())) {
        return Err("The MCP endpoint resolves to a private, local, or otherwise restricted network address.".into());
    }
    Ok((url, addresses))
}

fn build_client(host: &str, addresses: &[SocketAddr]) -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("OMNIMIND-AI/", env!("CARGO_PKG_VERSION")))
        .resolve_to_addrs(host, addresses)
        .build()
        .map_err(|_| "Could not initialize the MCP network client.".to_string())
}

async fn read_mcp_payload(mut response: reqwest::Response) -> Result<(Value, Option<String>), String> {
    let session = response.headers().get("mcp-session-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    if response.content_length().is_some_and(|size| size > MAX_MCP_RESPONSE_BYTES as u64) {
        return Err("The MCP server returned an oversized response.".into());
    }
    let content_type = response.headers().get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok()).unwrap_or("").to_ascii_lowercase();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "Could not read the MCP server response.".to_string())? {
        if bytes.len().saturating_add(chunk.len()) > MAX_MCP_RESPONSE_BYTES {
            return Err("The MCP server returned an oversized response.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body = std::str::from_utf8(&bytes).map_err(|_| "The MCP server returned invalid text.".to_string())?;
    let json_text = if content_type.contains("text/event-stream") {
        body.lines().filter_map(|line| line.strip_prefix("data:"))
            .map(str::trim).find(|line| !line.is_empty())
            .ok_or_else(|| "The MCP server returned no JSON-RPC data event.".to_string())?
    } else {
        body
    };
    let payload: Value = serde_json::from_str(json_text)
        .map_err(|_| "The MCP server returned an invalid JSON-RPC response.".to_string())?;
    if payload.get("error").is_some() {
        return Err("The MCP server rejected the protocol request.".into());
    }
    Ok((payload, session))
}

async fn send_notification(
    client: &Client,
    endpoint: &Url,
    session: Option<&str>,
    body: Value,
    protocol_version: Option<&str>,
) -> Result<(), String> {
    let mut request = client.post(endpoint.clone())
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json, text/event-stream")
        .json(&body);
    if let Some(version) = protocol_version {
        request = request.header("MCP-Protocol-Version", version);
    }
    if let Some(session_id) = session {
        if session_id.len() > 256 || session_id.chars().any(char::is_control) {
            return Err("The MCP server returned an invalid session identifier.".into());
        }
        request = request.header("mcp-session-id", session_id);
    }
    let response = request.send().await.map_err(|_| "Could not send MCP initialization notification.".to_string())?;
    if response.status().is_success() || response.status() == StatusCode::ACCEPTED {
        Ok(())
    } else {
        Err(format!("The MCP server rejected initialization notification (HTTP {}).", response.status().as_u16()))
    }
}

async fn post_rpc(
    client: &Client,
    endpoint: &Url,
    session: Option<&str>,
    body: Value,
    protocol_version: Option<&str>,
) -> Result<(Value, Option<String>), String> {
    let mut request = client.post(endpoint.clone())
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ACCEPT, "application/json, text/event-stream")
        .json(&body);
    if let Some(version) = protocol_version {
        request = request.header("MCP-Protocol-Version", version);
    }
    if let Some(session_id) = session {
        if session_id.len() > 256 || session_id.chars().any(char::is_control) {
            return Err("The MCP server returned an invalid session identifier.".into());
        }
        request = request.header("mcp-session-id", session_id);
    }
    let expected_id = body.get("id").cloned();
    let response = request.send().await.map_err(|error| {
        if error.is_timeout() { "The MCP server request timed out.".to_string() }
        else { "Could not connect to the MCP server. Check the endpoint and network.".to_string() }
    })?;
    if !response.status().is_success() {
        let status = response.status();
        return Err(match status {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => "The MCP server requires authentication, which is not supported yet.".into(),
            StatusCode::NOT_FOUND => "The MCP endpoint was not found. Check the server's MCP path.".into(),
            StatusCode::TOO_MANY_REQUESTS => "The MCP server rate limit was reached. Try again later.".into(),
            _ => format!("The MCP server returned HTTP {}.", status.as_u16()),
        });
    }
    let (payload, next_session) = read_mcp_payload(response).await?;
    if payload.get("id") != expected_id.as_ref() {
        return Err("The MCP server returned a mismatched JSON-RPC response ID.".into());
    }
    Ok((payload, next_session))
}

#[tauri::command]
pub async fn inspect_mcp_server(endpoint: String) -> Result<McpServerInspection, String> {
    let (url, addresses) = validated_endpoint(&endpoint)?;
    let host = url.host_str().ok_or_else(|| "The MCP endpoint must include a hostname.".to_string())?;
    let client = build_client(host, &addresses)?;
    let (initialized, session) = post_rpc(&client, &url, None, json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": { "name": "OMNIMIND AI", "version": env!("CARGO_PKG_VERSION") }
        }
    }), None).await?;
    let result = initialized.get("result").ok_or_else(|| "The MCP server returned no initialization result.".to_string())?;
    let protocol_version = result.get("protocolVersion").and_then(Value::as_str)
        .ok_or_else(|| "The MCP server did not provide a protocol version.".to_string())?;
    if protocol_version != "2025-11-25" {
        return Err("This build supports MCP protocol version 2025-11-25 only. The server selected an incompatible version.".into());
    }
    let server_info = result.get("serverInfo").ok_or_else(|| "The MCP server did not identify itself.".to_string())?;
    let server_name = server_info.get("name").and_then(Value::as_str).unwrap_or("Unknown MCP server");
    let server_version = server_info.get("version").and_then(Value::as_str).unwrap_or("Unknown version");
    if server_name.len() > 200 || server_version.len() > 100 || protocol_version.len() > 100 {
        return Err("The MCP server returned invalid identification metadata.".into());
    }

    send_notification(&client, &url, session.as_deref(), json!({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    }), Some(protocol_version)).await?;
    let (listed, next_session) = post_rpc(&client, &url, session.as_deref(), json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    }), Some(protocol_version)).await?;
    let result = listed.get("result").ok_or_else(|| "The MCP server returned no tools-list result.".to_string())?;
    let entries = result.get("tools").and_then(Value::as_array)
        .ok_or_else(|| "The MCP server returned an invalid tools list.".to_string())?;
    if entries.len() > MAX_MCP_TOOLS {
        return Err(format!("The MCP server exposes more than {} tools. This exceeds the current safety limit.", MAX_MCP_TOOLS));
    }
    let mut tools = Vec::with_capacity(entries.len());
    for entry in entries {
        let name = entry.get("name").and_then(Value::as_str)
            .ok_or_else(|| "The MCP server returned a tool without a valid name.".to_string())?;
        let description = entry.get("description").and_then(Value::as_str).unwrap_or("");
        if name.is_empty() || name.len() > 200 || name.chars().any(char::is_control) || description.len() > 4000 {
            return Err("The MCP server returned invalid tool metadata.".into());
        }
        let input_schema = entry.get("inputSchema").cloned().unwrap_or_else(|| json!({"type":"object"}));
        if serde_json::to_vec(&input_schema).map(|bytes| bytes.len() > 64 * 1024).unwrap_or(true) {
            return Err("The MCP server returned an oversized tool schema.".into());
        }
        tools.push(McpToolSummary { name: name.to_owned(), description: description.to_owned(), input_schema });
    }
    let active_session = next_session.or(session);
    if let Some(session_id) = active_session {
        // Best-effort session termination; do not expose server-supplied identifiers to UI logs.
        let _ = client.delete(url.clone()).header("mcp-session-id", session_id).send().await;
    }
    Ok(McpServerInspection {
        endpoint: url.to_string(),
        server_name: server_name.to_owned(),
        server_version: server_version.to_owned(),
        protocol_version: protocol_version.to_owned(),
        tools,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_https_and_embedded_credentials() {
        assert!(validated_endpoint("http://example.com/mcp").is_err());
        assert!(validated_endpoint("https://user:pass@example.com/mcp").is_err());
        assert!(validated_endpoint("https://example.com/mcp?token=secret").is_err());
        assert!(validated_endpoint("https://localhost/mcp").is_err());
    }

    #[test]
    fn rejects_private_and_local_addresses() {
        for value in ["127.0.0.1", "10.1.2.3", "192.168.1.5", "169.254.169.254", "::1", "fc00::1"] {
            let ip: IpAddr = value.parse().expect("valid IP");
            assert!(!is_public_address(ip), "{value} must be restricted");
        }
        assert!(is_public_address("8.8.8.8".parse().unwrap()));
    }

    #[test]
    fn tool_metadata_is_bounded_by_constants() {
        assert_eq!(MAX_MCP_TOOLS, 200);
        assert_eq!(MAX_MCP_RESPONSE_BYTES, 1024 * 1024);
    }
}
