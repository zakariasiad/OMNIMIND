export type ProviderId = "groq" | "openrouter" | "gemini";

export type ConnectionStatus =
  | "not_configured"
  | "connecting"
  | "connected"
  | "disabled"
  | "auth_required"
  | "rate_limited"
  | "error";

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  description: string;
  connectionHint: string;
  badge: string;
}

export interface ProviderState {
  id: ProviderId;
  status: ConnectionStatus;
  models: ProviderModel[];
  enabledModels: string[];
  lastChecked?: string;
  error?: string;
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "groq",
    name: "Groq",
    description: "Fast inference for compatible open models.",
    connectionHint: "Groq Cloud API key",
    badge: "Fast inference",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One API connection for a broad model catalog.",
    connectionHint: "OpenRouter API key",
    badge: "Multi-provider",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Google AI models through the documented compatible API.",
    connectionHint: "Google AI Studio API key",
    badge: "Google AI",
  },
];

export function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.some((provider) => provider.id === value);
}

export function getInitialProviderStates(): Record<ProviderId, ProviderState> {
  return Object.fromEntries(
    PROVIDERS.map((provider) => [
      provider.id,
      {
        id: provider.id,
        status: "not_configured",
        models: [],
        enabledModels: [],
      } satisfies ProviderState,
    ]),
  ) as Record<ProviderId, ProviderState>;
}