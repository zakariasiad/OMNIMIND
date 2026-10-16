# OMNIMIND AI — Implementation Roadmap

This roadmap describes intended work, not completed features. Verify each phase before moving forward. Keep all repository documentation, code comments, and product-facing UI text in English.

## Phase 0 — Product and dependency audit

- [x] Inspect OMNIMIND default branch and foundation documentation.
- [x] Confirm the working branch contains an early desktop scaffold; the default branch remains unchanged.
- [x] Inspect the existing OpenFallback Vercel project and latest deployment.
- [x] Record the current deployment error: `STATIC_BUILD_NO_OUT_DIR`.
- [x] Inspect the Framework-MCPs repository tree; no obvious OpenFallback source directory was found.
- [ ] Locate the actual gateway source and identify ownership/build boundaries.
- [ ] Decide whether the gateway can be safely repaired or direct provider adapters are the better desktop MVP path.
- [ ] Confirm secure-storage implementation and first provider API contracts.

**Exit criteria:** Evidence-based architecture choice, no assumed healthy gateway, no duplicated cloud resources.

## Phase 1 — Desktop application foundation

- [x] Scaffold Tauri 2 + React + TypeScript + Vite and configure a Windows installer workflow.
- [x] Add primary navigation for Workspace, Model Hub, Run History, and Settings.
- [x] Add typecheck, unit-test, and frontend build scripts; a recent frontend CI run passed.
- [x] Define initial typed contracts for provider connections, models, tasks, and task events.
- [x] Add Windows-native credential-vault commands and fail closed if the vault cannot store a secret.
- [ ] Add local SQLite migrations and a safe reset/export policy.
- [ ] Verify the Windows installer job and test clean install/uninstall.

**Exit criteria:** The app opens on Windows, passes automated checks, and stores only non-secret settings in ordinary local storage.

## Phase 2 — Model Hub and secure connections

- [x] Add an initial provider registry for Groq, OpenRouter, and Google Gemini's compatible API.
- [x] Implement API-key entry through a privileged command and OS credential vault.
- [x] Implement connection testing and model-list discovery with safe error messages.
- [x] Add connected/disabled/error and related UI states.
- [x] Implement enable/disable, refresh, and remove flows.
- [ ] Add official OAuth only after provider support is verified.
- [ ] Expand automated tests for secret lifecycle, provider errors, and redaction.
- [ ] Review and verify each initial provider's current official API contract and free-tier limitations.

**Exit criteria:** A user can add and test a provider, select allowed models, disable it, and remove its credential safely.

## Phase 3 — First useful AI workspace

- [x] Build a unified request workspace and single-provider execution path.
- [x] Show basic model attribution, run status, and request failures.
- [ ] Persist runs, tasks, artifacts, and progress events across restarts.
- [x] Add request timeouts, input-size validation, bounded retry behavior, and a default output-token limit.
- [ ] Add user-configurable per-run budgets and cancellation controls.

**Exit criteria:** A user can submit a task, receive a result, inspect status, and resume history after restart.

## Phase 4 — Multi-model orchestration

- [x] Add task-graph validation and a dependency-aware scheduler with bounded parallelism.
- [x] Add a basic executor → independent review → synthesis workflow when a second model is available.
- [ ] Implement a structured planner, tester role, and general task decomposition.
- [ ] Add capability-aware routing and compatible provider fallback.
- [x] Add bounded retries and dependency-failure handling in the task engine.
- [ ] Add persisted run traces, richer deterministic checks, and conflict handling.
- [x] Report run completion limitations rather than claiming general autonomous planning.

**Exit criteria:** A request uses multiple distinct model calls for separate tasks and returns one coherent result with traceable progress.

## Phase 5 — MCP client and tool security

- [x] Document the difference between developer-workflow MCP connectors and runtime MCP support.
- [x] Define the initial integration order, trust boundaries, security requirements, and acceptance criteria in [MCP Integrations](MCP_INTEGRATIONS.md).
- [ ] Select and pin the official MCP TypeScript SDK and supported protocol version.
- [x] Add a narrow native MCP inspection command and MCP Hub UI for HTTPS server discovery.
- [ ] Add local stdio server configuration with executable/argument validation and process limits.
- [x] Add initial HTTPS endpoint validation, DNS address pinning, private-network blocking, redirect blocking, timeouts, and bounded response/tool sizes.
- [x] Add tool discovery and local metadata storage.\n- [ ] Complete server health, enable/disable, reconnect, and removal lifecycle states.
- [ ] Add explicit per-tool permissions, user approval for consequential actions, and redacted audit events.
- [ ] Add automated tests for timeouts, cancellation, malicious server output, prompt injection, path traversal, and private-network access.
- [ ] Add GitHub, filesystem, or research integrations only after the runtime client and permission system are ready; do not auto-install or auto-trust servers.

**Exit criteria:** User-configured MCP servers work end-to-end under explicit, testable permissions; untrusted server output cannot authorize actions or override application policy.

## Phase 6 — UX, diagnostics, and beta hardening

- [x] Add initial Model Hub, Workspace, Run History, and Settings screens.
- [ ] Add redacted diagnostic export and persistent local history management.
- [ ] Test app interruption, credential-vault errors, rate limits, and unavailable providers.
- [ ] Run and review dependency/security checks and resolve relevant findings.
- [ ] Confirm Windows installer build and test clean install, update, and uninstall.
- [x] Document known limitations, credential boundaries, and intended provider connection policy.

**Exit criteria:** Controlled beta package with reproducible build/test evidence and no known critical credential-handling defect.

## Phase 7 — Mobile and optional hosted services

- [ ] Gather mobile use cases and decide which actions need remote access.
- [ ] Define identity, encryption, sync, retention, and conflict rules before cloud sync.
- [ ] Build a mobile companion with platform-native secure storage.
- [ ] Add hosted orchestration only if desktop/mobile collaboration requires it.
- [ ] Reassess queues, observability, and scaling based on measured usage.

**Exit criteria:** Mobile support does not weaken local credential isolation or silently transmit private data.

## Release discipline

- Never report a documented feature as implemented.
- Never report a connection as healthy based only on saved credentials.
- Never report deployment success without checking the actual deployment.
- Never create duplicate gateways or cloud resources before auditing existing assets.
- Ask for approval before paid resources, irreversible actions, or changing public production behavior.
