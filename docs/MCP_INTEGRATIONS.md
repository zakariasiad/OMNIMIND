# OMNIMIND AI — MCP Integration Plan

## Current status

OMNIMIND now has an initial native remote MCP inspection path in the desktop branch: the MCP Hub accepts an HTTPS endpoint, performs a bounded legacy-protocol initialization handshake, and lists declared tools. The native layer rejects non-HTTPS endpoints, blocks resolved private/local addresses, pins the resolved addresses for the request, disables redirects, applies timeouts and response/tool limits, and stores only endpoint/tool metadata locally.

This is a limited discovery slice, not beta-ready MCP support. It does not execute tools, support server OAuth, start local stdio processes, or yet enforce per-tool permissions. The GitHub MCP connector used for repository work is separate from this runtime connection.

## Recommended integration order

1. **Remote HTTP client hardening** — complete protocol compatibility tests, validate response IDs and session lifecycle, and pin the SDK/protocol strategy. Current native implementation targets legacy Streamable HTTP-compatible servers.
2. **Server registry and lifecycle** — add persistent enable/disable, reconnect, health, and safe removal behavior.
3. **Tool execution gate** — implement host-side per-tool permissions, JSON Schema validation, explicit user confirmation for consequential actions, and redacted audit records before any tool can run.
4. **Local stdio servers** — only start user-configured executables with explicit argument arrays, environment allowlists, process timeouts, and no shell-string execution.
5. **Resources and prompts** — add bounded discovery/read flows, with returned content treated as untrusted data.
6. **Authentication and optional integrations** — add supported OAuth or GitHub/filesystem/research integrations only after secure credential storage and permissions are complete.

## Security requirements

- MCP server definitions are configuration, not trusted executable code.
- Never accept account passwords, browser cookies, or session-token extraction as a connection method.
- Store access tokens and API keys in the operating-system credential vault; do not store them in localStorage, SQLite, run history, model prompts, logs, or diagnostic exports.
- Use an allowlist for executable paths and environment variables. Do not inherit the full parent environment by default.
- Apply timeouts, cancellation, output-size limits, tool-call concurrency limits, and schema validation.
- Validate server URLs and resolved addresses; block loopback, link-local, private-network, and cloud metadata targets unless a clearly scoped local-server policy explicitly permits them.
- Treat tool descriptions, resource contents, server output, and model-generated tool arguments as untrusted. They must not override system policy or permission decisions.
- Request only the permissions needed for each server; make connections disableable and removable.
- Never execute a tool solely because a model requested it. Enforce authorization in the host application.
- Redact secrets from errors and traces; require explicit consent before transmitting user content to an external server.
- Keep server capabilities disabled by default until the user reviews and enables them.

## Suggested first useful MCP servers

These are candidates, not connected integrations:

- **GitHub** — repository issues, pull requests, code review, and project context. Use a dedicated authorization scope; do not expose write actions without confirmation.
- **Filesystem** — only a user-selected workspace root, with path traversal and symlink protections; read-only by default.
- **Fetch / web research** — isolated retrieval with domain controls; retrieved text remains untrusted.
- **Notion** — optional knowledge-base retrieval and documentation workflows, only if the user connects their workspace.
- **Supabase / Vercel** — developer-only integrations for projects that explicitly need backend or deployment services. They are not dependencies for the desktop MVP and must not create resources automatically.

## Acceptance criteria before calling MCP support beta-ready

- [ ] Official SDK/protocol compatibility strategy is pinned and reviewed; initial native legacy HTTP discovery exists.
- [ ] Add, test, disable, reconnect, and remove server flows are complete; add and inspect exist, lifecycle controls remain partial.
- [x] Server/tool metadata is bounded and displayed as untrusted data.
- [ ] User consent and per-tool authorization are enforced in native host code.
- [ ] Local stdio process lifecycle, timeouts, cancellation, and shutdown are tested.
- [x] HTTP URL validation, private-network blocking, DNS address pinning, redirect blocking, timeouts, and response-size limits are implemented; expand automated coverage and perform integration tests.
- [ ] Secrets and sensitive tool output are redacted from logs and exports.
- [ ] Prompt-injection tests cover tool descriptions, resources, and returned content.
- [ ] No server is auto-installed, auto-trusted, or auto-enabled.
- [x] Documentation distinguishes developer workflow MCP connectors from the limited runtime discovery implementation.
