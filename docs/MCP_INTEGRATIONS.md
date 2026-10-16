# OMNIMIND AI — MCP Integration Plan

## Current status

OMNIMIND does not yet ship a runtime MCP client or connect external MCP servers from the desktop UI. The GitHub MCP connector is available to the development workflow for repository inspection, code changes, and CI verification; that is not the same as an MCP server connection inside OMNIMIND.

Do not display MCP as implemented until a runtime client, configuration UX, permissions, and end-to-end tests exist.

## Recommended integration order

1. **MCP client foundation (desktop-local)** — implement the official Model Context Protocol client SDK behind a narrow TypeScript service boundary. Pin a reviewed SDK version and support one transport at a time.
2. **Local stdio servers** — start only user-configured executables, with explicit executable path and argument list. Never run shell command strings or silently download/install a server.
3. **Streamable HTTP servers** — support only after origin/URL validation, HTTPS by default, explicit trust confirmation, authentication handling, and SSRF/private-network protections are tested.
4. **Tools and resources registry** — list server identity, tool/resource names, schemas, required permissions, and connection health. Treat all returned content as untrusted input.
5. **Human approval and audit trail** — ask before destructive, external, financial, publishing, file-write, or other consequential tool actions; display arguments and target, and record redacted outcomes locally.
6. **Optional integrations** — add specific connectors only when there is a validated user workflow. Avoid requiring cloud infrastructure for the local-first MVP.

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

- [ ] Official SDK and transport versions pinned and reviewed.
- [ ] Add, test, disable, reconnect, and remove server flows work.
- [ ] Server/tool metadata is validated and displayed safely.
- [ ] User consent and per-tool authorization are enforced in native host code.
- [ ] Local stdio process lifecycle, timeouts, cancellation, and shutdown are tested.
- [ ] HTTP URL validation and private-network/SSRF defenses have automated tests.
- [ ] Secrets and sensitive tool output are redacted from logs and exports.
- [ ] Prompt-injection tests cover tool descriptions, resources, and returned content.
- [ ] No server is auto-installed, auto-trusted, or auto-enabled.
- [ ] Documentation accurately distinguishes connected developer MCPs from runtime MCP support.
