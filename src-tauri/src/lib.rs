use keyring::Entry;
use reqwest::{header, Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

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
    let payload: Value = response.json().await
        .map_err(|_| format!("{} returned an unreadable model list.", provider.label))?;
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

#[tauri::command]
async fn chat_completion(
    provider_id: String,
    model: String,
    messages: Vec<ChatMessage>,
) -> Result<ChatResult, String> {
    let provider = provider_config(&provider_id)?;
    if model.trim().is_empty() || model.len() > 300 {
        return Err("Choose a valid model from the provider's available model list.".to_string());
    }
    if messages.is_empty() || messages.len() > 50 {
        return Err("The request must contain between 1 and 50 messages.".to_string());
    }
    if messages.iter().any(|message| {
        !matches!(message.role.as_str(), "system" | "user" | "assistant") || message.content.len() > 100_000
    }) {
        return Err("The request contains an unsupported message role or an oversized message.".to_string());
    }

    let secret = load_secret(&provider_id)?;
    let client = http_client()?;
    let body = json!({
        "model": model,
        "messages": messages,
        "temperature": 0.2,
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
    let payload: Value = response.json().await
        .map_err(|_| format!("{} returned an unreadable response.", provider.label))?;
    let content = payload.pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("{} returned no text content for this request.", provider.label))?;
    let used_model = payload.get("model").and_then(Value::as_str).unwrap_or(&model).to_string();
    Ok(ChatResult { content: content.to_string(), model: used_model })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_saved_provider_ids,\n            save_provider_key,
            remove_provider_key,
            test_provider_connection,
            chat_completion
        ])
        .run(tauri::generate_context!())
        .expect("error while running OMNIMIND AI");
}
