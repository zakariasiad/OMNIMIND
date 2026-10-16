import { invoke, isTauri } from "@tauri-apps/api/core";
import type { ProviderId, ProviderModel } from "./providers";

export interface ConnectionTestResult {
  ok: boolean;
  models: ProviderModel[];
  message: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  model: string;
}

export async function listSavedProviderIds(): Promise<ProviderId[]> {
  if (!isTauri()) return [];
  return invoke<ProviderId[]>("list_saved_provider_ids");
}

export async function saveProviderKey(providerId: ProviderId, apiKey: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("Secure provider connections are available in the installed desktop app, not the browser preview.");
  }
  await invoke("save_provider_key", { providerId, apiKey });
}

export async function removeProviderKey(providerId: ProviderId): Promise<void> {
  if (!isTauri()) {
    throw new Error("Credential removal is available in the installed desktop app.");
  }
  await invoke("remove_provider_key", { providerId });
}

export async function testProvider(providerId: ProviderId): Promise<ConnectionTestResult> {
  if (!isTauri()) {
    throw new Error("Provider tests require the installed desktop app and its secure credential vault.");
  }
  return invoke<ConnectionTestResult>("test_provider_connection", { providerId });
}

export async function chatCompletion(
  providerId: ProviderId,
  model: string,
  messages: ChatMessage[],
): Promise<ChatResult> {
  if (!isTauri()) {
    throw new Error("Model requests require the installed desktop app.");
  }
  return invoke<ChatResult>("chat_completion", { providerId, model, messages });
}