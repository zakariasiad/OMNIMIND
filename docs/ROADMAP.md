# OMNIMIND AI — Implementation Roadmap

This roadmap describes intended work, not completed features. Verify each phase before moving forward. Keep all repository documentation, code comments, and product-facing UI text in English.

## Phase 0 — Product and dependency audit

- [x] Inspect OMNIMIND default branch and foundation documentation.
- [x] Confirm the current OMNIMIND branch is documentation-only.
- [x] Inspect the existing OpenFallback Vercel project and latest deployment.
- [x] Record the current deployment error: `STATIC_BUILD_NO_OUT_DIR`.
- [x] Inspect the Framework-MCPs repository tree; no obvious OpenFallback source directory was found.
- [ ] Locate the actual gateway source and identify ownership/build boundaries.
- [ ] Decide whether the gateway can be safely repaired or direct provider adapters are the better desktop MVP path.
- [ ] Confirm secure-storage implementation and first provider API contracts.

**Exit criteria:** Evidence-based architecture choice, no assumed healthy gateway, no duplicated cloud resources.

## Phase 1 — Desktop application foundation

- [ ] Scaffold Tauri 2 + React + TypeScript + Vite with a reproducible Windows build.
- [ ] Add navigation, app settings, first-run setup, and a skip-for-now path.
- [ ] Add lint, typecheck, unit test, and build scripts.
- [ ] Define portable typed contracts for provider connections, models, tasks, runs, and events.
- [ ] Validate the selected OS credential vault integration before storing real credentials.
- [ ] Add local SQLite migrations and a safe reset/export policy.

**Exit criteria:** The app opens on Windows, passes automated checks, and stores only non-secret settings in ordinary local storage.

## Phase 2 — Model Hub and secure connections

- [ ] Add provider registry and explicit capability metadata.
- [ ] Implement API-key entry with secret handling through a privileged command.
- [ ] Implement connection test, safe errors, and model discovery or curated model lists.
- [ ] Add connected/degraded/auth-required/disabled/error states.
- [ ] Implement enable, disable, refresh, edit, and remove flows.
- [ ] Add official OAuth only where provider support is verified.
- [ ] Add tests proving secrets are not logged or written to SQLite.
- [ ] Implement at least one provider adapter, then add another based on verified official docs.

**Exit criteria:** A user can add and test a provider, select allowed models, disable it, and remove its credential safely.

## Phase 3 — First useful AI workspace

- [ ] Build a unified request workspace.
- [ ] Implement a single-provider execution path first.
- [ ] Persist runs, tasks, artifacts, and progress events.
- [ ] Show model attribution and request failures.
- [ ] Add cancellation, timeouts, and bounded output sizes.

**Exit criteria:** A user can submit a task, receive a result, inspect status, and resume history after restart.

## Phase 4 — Multi-model orchestration

- [ ] Implement planner output schema and DAG validation.
- [ ] Add dependency-aware scheduler and bounded parallelism.
- [ ] Implement planner, executor, reviewer, tester, and synthesizer roles.
- [ ] Add capability-aware routing and compatible fallback.
- [ ] Add deterministic checks, bounded retries, and conflict handling.
- [ ] Report incomplete or unverified outputs honestly.

**Exit criteria:** A request uses multiple distinct model calls for separate tasks and returns one coherent result with traceable progress.

## Phase 5 — UX, diagnostics, and beta hardening

- [ ] Finish Model Hub, Workspace, Run Monitor, and Settings screens.
- [ ] Add redacted diagnostic export and local history management.
- [ ] Test app interruption, credential-vault errors, rate limits, and unavailable providers.
- [ ] Run dependency and security checks.
- [ ] Package Windows installer and test clean install, update, and uninstall.
- [ ] Document limitations, data flows, and provider terms.

**Exit criteria:** Controlled beta package with reproducible build/test evidence and no known critical credential-handling defect.

## Phase 6 — Mobile and optional hosted services

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
