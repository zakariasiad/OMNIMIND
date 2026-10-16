# OMNIMIND AI — Provider Connections and Credential Security

## Principles

1. Use official APIs and documented authentication flows.
2. Prefer API keys for server/API products where supported.
3. Use OAuth only when the provider explicitly supports a suitable third-party integration.
4. Never collect provider website passwords, session cookies, browser profiles, or extracted tokens.
5. Never assume a consumer chat subscription includes API access.
6. Store secrets in an OS-backed credential vault; store only a credential reference and safe metadata in app databases.
7. Test a connection before marking it connected.
8. Treat provider availability, free-tier limits, model IDs, and costs as changing external facts.

## Supported connection methods

### API key
- User selects a provider and enters a key in a masked field.
- A privileged Tauri command stores the key in the OS credential vault.
- The app persists only a non-secret reference, provider ID, and connection metadata.
- Adapter uses the credential for approved HTTPS requests.
- The UI never displays the saved secret again.
- Replacing/removing a key updates the vault and local metadata safely.

### Official OAuth
Use only when the provider has a documented flow appropriate for third-party desktop applications. Review:
- Authorization Code + PKCE where applicable
- Exact scopes and least privilege
- Redirect URI validation
- State/nonce validation where applicable
- Token storage in the credential vault
- Refresh, expiry, revocation, and logout
- Provider terms and whether model inference is permitted through that grant

Do not infer support from a website's ordinary sign-in page.

### Compatible API endpoint
Custom OpenAI-compatible endpoints may be supported later. If implemented:
- Require HTTPS except explicitly documented local development cases.
- Validate hostname and resolved address to prevent loopback/private-network SSRF.
- Reject redirects to unapproved destinations or revalidate every redirect.
- Use strict timeouts, response-size limits, and supported route allowlists.
- Warn users that the endpoint operator receives prompts and associated data.
- Never send a provider's secret to a different configured origin.

### MCP connector
MCP tools are separate from model-provider connections. Require explicit per-server trust, tool permissions, timeouts, output limits, and approval rules. Do not expose credentials as model-visible tool arguments.

## Connection state machine

`NOT_CONFIGURED -> CONNECTING -> CONNECTED`

Possible alternative outcomes: `DEGRADED`, `DISABLED`, `AUTH_REQUIRED`, `RATE_LIMITED`, `ERROR`.

Saved credentials do not equal a successful connection. Use a supported model-list endpoint or a minimal safe request. Where a test request could incur charges, tell the user first or use a non-billable endpoint when available.

## Secret lifecycle

- Create: store through OS credential vault integration.
- Read: retrieve only within the adapter invocation and avoid unnecessary copies.
- Update: replace atomically where possible; never echo secrets to logs or UI.
- Disable: exclude the connection from routing while retaining the credential.
- Remove: delete the credential and connection record; revoke remote grants when supported.
- Export/backup: exclude secrets by default.
- Diagnostics: redact authorization headers, keys, tokens, and known secret values.
- Vault unavailable: fail closed; do not fall back to plaintext JSON, SQLite, or logs.

## Data handling

Before sending data to a provider, the UI should make clear that the provider may receive the prompt, attached context, and task outputs required for that model call. Support user-defined exclusions or redaction in a later iteration. Do not transmit run history to an OMNIMIND-hosted service unless a separately approved sync/orchestration feature is enabled.

## Provider adapter contract

Each adapter declares:
- Stable provider identifier and display label
- Connection methods and credential type
- Supported capabilities
- Model discovery support and metadata freshness
- Request/response schema mapping
- Streaming support
- Error classification and retry guidance
- Rate-limit and usage metadata when available
- Data region/retention notes when known and sourced
- Contract-test fixtures

Do not advertise unsupported capabilities. Normalize common errors without losing provider-specific diagnostic codes.

## Minimum security tests

- Secret never appears in app database, logs, thrown error text, or exported diagnostics.
- Invalid credential yields `AUTH_REQUIRED` or a safe error.
- Disabled provider is never selected by the router.
- Removed connection no longer resolves a credential.
- A request cannot send a credential to a different origin.
- Redirect and custom endpoint validation prevent unapproved local/private destinations.
- Timeouts and response limits are enforced.
- OAuth state and redirect validation are tested before shipping an OAuth adapter.
