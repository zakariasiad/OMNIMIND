use keyring::Entry;
use reqwest::{header, Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

mod mcp;

const SERVICE_NAME: &str = "OMNIMIND_AI_PROVIDER";

#[derive(Clone, Copy)]
struct ProviderConfig {
    id: &'static str,
    base_url: &'static str,
    label: &'static str,
}

fn provider_config(provider_id: &str) -> Result<ProviderConfig, String> {
    match provider_id {
        "groq" => Ok(ProviderConfig {
            id: "groq",
            base_url: "https://api.groq.com/openai/v1",
            label: "Groq",
        }),
        "openrouter" => Ok(ProviderConfig {
            id: "openrouter",
            base_url: "https://openrouter.ai/api/v1",
            label: "OpenRouter",
        }),
        "gemini" => Ok(ProviderConfig {
            id: "gemini",
            base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
            label: "Google Gemini",
        }),
        _ => Err("Unsupported provider. Choose a provider from the built-in catalog.".to_string()),
    }
}

fn credential_entry(provider_id: &str) -> Result<Entry, String> {
    let provider = provider_config(provider_id)?;
    Entry::new(SERVICE_NAME, provider.id).map_err(|_| "The operating system credential vault is unavailable.".to_string())
}

fn load_secret(provider_id: &str) -> Result<String, String> {
    let entry = credential_entry(provider_id)?;
    entry.get_password().map_err(|error| match error {
        keyring::Error::NoEntry => "No saved API key was found for this provider.".to_string(),
        _ => "Could not read the API key from the operating system credential vault.".to_string(),
    })
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(35))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("OMNIMIND-AI/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "Could not initialize the secure network client.".to_string())
}

fn safe_status_error(status: StatusCode, provider: &ProviderConfig) -> String {
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN =>
            format!("{} rejected this API key. Check the key and provider API permissions.", provider.label),
        StatusCode::TOO_MANY_REQUESTS =>
            format!("{} rate limit reached. Wait before trying again.", provider.label),
        StatusCode::NOT_FOUND =>
            format!("{} did not recognize the requested API endpoint.", provider.label),
        _ if status.is_server_error() =>
            format!("{} is temporarily unavailable (HTTP {}).", provider.label, status.as_u16()),
        _ => format!("{} returned HTTP {}. Check the provider configuration and try again.", provider.label, status.as_u16()),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelInfo {
    id: String,
    name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionTestResult {
    ok: bool,
    models: Vec<ModelInfo>,
    message: String,
}

#[tauri::command]
fn list_saved_provider_ids() -> Vec<String> {
    ["groq", "openrouter", "gemini"]
        .iter()
        .filter_map(|provider_id| {
            let entry = Entry::new(SERVICE_NAME, provider_id).ok()?;
            entry.get_password().ok().map(|_| (*provider_id).to_string())
        })
        .collect()
}

#[tauri::command]
fn save_provider_key(provider_id: String, api_key: String) -> Result<(), String> {
    provider_config(&provider_id)?;
    let cleaned = api_key.trim();
    if cleaned.len() < 8 || cleaned.len() > 4096 || cleaned.chars().any(char::is_control) {
        return Err("The API key format is invalid. Check the value and try again.".to_string());
    }
    let entry = credential_entry(&provider_id)?;
    entry.set_password(cleaned).map_err(|_| {
        "Could not save this key to the operating system credential vault. No plaintext fallback was used.".to_string()
    })
}

#[tauri::command]
fn remove_provider_key(provider_id: String) -> Result<(), String> {
    let entry = credential_entry(&provider_id)?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not remove the credential from the operating system vault.".to_string()),
    }
}

const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;

async fn read_limited_json(
    mut response: reqwest::Response,
    provider: &ProviderConfig,
    description: &str,
) -> Result<Value, String> {
    if response.content_length().is_some_and(|size| size > MAX_RESPONSE_BYTES as u64) {
        return Err(format!("{} returned an oversized {} response.", provider.label, description));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| {
        format!("Could not read the {} response from {}.", description, provider.label)
    })? {
        if body.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err(format!("{} returned an oversized {} response.", provider.label, description));
        }
        body.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&body)
        .map_err(|_| format!("{} returned an unreadable {} response.", provider.label, description))
}

async fn fetch_models(provider_id: &str) -> Result<Vec<ModelInfo>, String> {
    let provider = provider_config(provider_id)?;
    let secret = load_secret(provider_id)?;
    let client = http_client()?;
    let response = client
        .get(format!("{}/models", provider.base_url))
        .bearer_auth(secret)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                format!("{} connection timed out. Check your connection and try again.", provider.label)
            } else {
                format!("Could not reach {}. Check your internet connection.", provider.label)
            }
        })?;
    if !response.status().is_success() {
        return Err(safe_status_error(response.status(), &provider));
    }
    let payload = read_limited_json(response, &provider, "model-list").await?;
    let entries = payload.get("data").and_then(Value::as_array)
        .ok_or_else(|| format!("{} returned an unexpected model-list response.", provider.label))?;
    let mut models: Vec<ModelInfo> = entries.iter()
        .filter_map(|item| {
            let id = item.get("id")?.as_str()?.trim();
            if id.is_empty() { return None; }
            Some(ModelInfo { id: id.to_string(), name: id.to_string() })
        })
        .collect();
    models.sort_by(|a, b| a.id.to_lowercase().cmp(&b.id.to_lowercase()));
    models.dedup_by(|a, b| a.id == b.id);
    if models.is_empty() {
        return Err(format!("{} returned no models for this API key.", provider.label));
    }
    Ok(models)
}

#[tauri::command]
async fn test_provider_connection(provider_id: String) -> Result<ConnectionTestResult, String> {
    let provider = provider_config(&provider_id)?;
    let models = fetch_models(&provider_id).await?;
    Ok(ConnectionTestResult {
        ok: true,
        message: format!("Connected to {}. Found {} available models.", provider.label, models.len()),
        models,
    })
}

#[derive(Debug, Deserialize, Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatRequest {
    provider_id: String,
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatResult {
    content: String,
    model: String,
}

const MAX_INPUT_CHARS: usize = 200_000;
const MAX_OUTPUT_TOKENS: u32 = 2_048;

fn validate_chat_input(model: &str, messages: &[ChatMessage]) -> Result<(), String> {
    if model.trim().is_empty() || model.len() > 300 || model.chars().any(char::is_control) {
        return Err("Choose a valid model from the provider's available model list.".to_string());
    }
    if messages.is_empty() || messages.len() > 50 {
        return Err("The request must contain between 1 and 50 messages.".to_string());
    }
    let mut total_chars = 0usize;
    for message in messages {
        if !matches!(message.role.as_str(), "system" | "user" | "assistant") {
            return Err("The request contains an unsupported message role.".to_string());
        }
        if message.content.len() > 100_000 {
            return Err("A message is too large. Shorten the prompt or context and try again.".to_string());
        }
        total_chars = total_chars.saturating_add(message.content.chars().count());
        if total_chars > MAX_INPUT_CHARS {
            return Err("The total request is too large. Shorten the prompt or context and try again.".to_string());
        }
    }
    Ok(())
}

#[tauri::command]
async fn chat_completion(
    provider_id: String,
    model: String,
    messages: Vec<ChatMessage>,
) -> Result<ChatResult, String> {
    let provider = provider_config(&provider_id)?;
    validate_chat_input(&model, &messages)?;

    let secret = load_secret(&provider_id)?;
    let client = http_client()?;
    let body = json!({
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "stream": false
    });
    let response = client
        .post(format!("{}/chat/completions", provider.base_url))
        .bearer_auth(secret)
        .header(header::CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                format!("{} request timed out. Try again or select another model.", provider.label)
            } else {
                format!("Could not reach {}. Check your connection and try again.", provider.label)
            }
        })?;
    if !response.status().is_success() {
        return Err(safe_status_error(response.status(), &provider));
    }
    let payload = read_limited_json(response, &provider, "completion").await?;
    let content = payload.pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{} returned no text content for this request.", provider.label))?;
    if content.chars().count() > MAX_INPUT_CHARS {
        return Err(format!("{} returned an unexpectedly large response. Try a shorter request.", provider.label));
    }
    let used_model = payload.get("model").and_then(Value::as_str).unwrap_or(&model).to_string();
    Ok(ChatResult { content: content.to_string(), model: used_model })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_saved_provider_ids,
            save_provider_key,
            remove_provider_key,
            test_provider_connection,
            chat_completion,
            mcp::inspect_mcp_server
        ])
        .run(tauri::generate_context!())
        .expect("error while running OMNIMIND AI");
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_catalog_uses_fixed_https_origins() {
        for id in ["groq", "openrouter", "gemini"] {
            let provider = provider_config(id).expect("known provider");
            assert!(provider.base_url.starts_with("https://"));
            assert!(!provider.base_url.contains('?'));
        }
    }

    #[test]
    fn unknown_provider_is_rejected() {
        assert!(provider_config("unknown").is_err());
        assert!(provider_config("https://example.com").is_err());
    }

    #[test]
    fn chat_input_rejects_invalid_roles_and_oversized_context() {
        let invalid_role = vec![ChatMessage { role: "tool".into(), content: "x".into() }];
        assert!(validate_chat_input("model-id", &invalid_role).is_err());

        let oversized = vec![ChatMessage { role: "user".into(), content: "x".repeat(MAX_INPUT_CHARS + 1) }];
        assert!(validate_chat_input("model-id", &oversized).is_err());
    }

    #[test]
    fn chat_input_rejects_control_characters_in_model_id() {
        let messages = vec![ChatMessage { role: "user".into(), content: "hello".into() }];
        assert!(validate_chat_input("model\nmalicious", &messages).is_err());
    }

    #[test]
    fn error_messages_do_not_include_credentials() {
        let provider = provider_config("groq").expect("known provider");
        let message = safe_status_error(StatusCode::UNAUTHORIZED, &provider);
        assert!(message.contains("rejected this API key"));
        assert!(!message.contains("Bearer"));
        assert!(!message.contains("secret-value"));
    }
}
