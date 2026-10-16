# OMNIMIND AI — Technical Specification

- **Version:** 0.2
- **Status:** Foundation specification; implementation not yet verified
- **Product:** Desktop-first multi-model AI collaboration workspace
- **Initial platform:** Windows desktop
- **Future platform:** Mobile companion
- **Provider policy:** Free-cloud-first, extensible to user-authorized paid providers
- **Gateway status:** Existing Vercel project found, but deployment failed and source location is unverified

## 1. Product objective

Turn a user's high-level request into one coherent deliverable by coordinating compatible models and logical agent roles through a bounded, observable, resumable workflow. Users should not have to manually orchestrate several model websites.

OMNIMIND is not merely a multi-chat window or a fan-out prompt tool. It must plan work, track dependencies, route tasks by capability and policy, preserve relevant context, review intermediate outputs, recover from compatible failures, and accurately report what was and was not verified.

## 2. Product and platform decisions

- Build the desktop app first, targeting Windows.
- Use a standard installer as the primary setup experience; offer CMD commands for advanced setup, diagnostics, and maintenance.
- Let users skip provider setup and complete it later.
- Keep the orchestration and provider contracts portable for a future mobile client.
- Start with cloud providers and avoid requiring a local model or large local runtime.
- Do not require an account password for a provider when an official API credential or supported OAuth flow is available.
- Keep the application useful with one configured provider; collaboration improves as compatible providers are added.
- Never promise unlimited free inference.

## 3. MVP scope

1. First-run setup and local application settings.
2. Model Hub to add, test, enable, disable, refresh, and remove provider connections.
3. API-key connections for a small, verified initial set of providers.
4. Official OAuth connection only when supported and reviewed.
5. Discovery or curated selection of model IDs and capabilities.
6. A unified prompt/workspace.
7. Structured planning into a directed acyclic task graph (DAG).
8. Dependency-aware scheduling with bounded concurrency.
9. Task and run persistence, progress events, cancellation, timeouts, and bounded retries.
10. Reviewer/tester roles and a final synthesizer.
11. Clear model attribution, error details, and verification status.
12. Secure credential storage and a diagnostics screen.
13. Reproducible build, automated tests, and a Windows packaging workflow.

### Out of scope for the first release

- Training foundation models.
- Guaranteeing free access, unlimited quotas, or continuous provider availability.
- Logging into arbitrary provider websites with email/password.
- Extracting cookies, browser sessions, or private access tokens from other apps.
- Bypassing CAPTCHAs, paywalls, 2FA, access controls, or provider terms.
- Unrestricted shell, browser, or filesystem access by agents.
- Unbounded agent loops or hidden model calls.
- A production mobile app before desktop workflows and security are validated.

## 4. Desktop application architecture

### Desktop shell and UI

Use Tauri 2 with React, TypeScript, and Vite as the current proposed stack. The UI owns navigation, forms, connection cards, run progress, settings, and presentation. Privileged operations are exposed through narrowly scoped Tauri commands rather than unrestricted UI access to the operating system.

### Application core

Portable TypeScript modules define provider interfaces, planning contracts, DAG validation, scheduling policy, run/task state transitions, retry classification, and synthesis preconditions. The core must be testable without a graphical UI or live provider credentials.

### Provider adapters

Each provider adapter implements only the capabilities it truly supports: text generation, streaming, structured output, tool calls, model discovery, and usage metadata. Capabilities must be explicit rather than inferred from provider names.

### Persistence

Use local SQLite initially for projects, runs, task state, provider metadata, and event history. Do not place raw API keys in SQLite, app settings, logs, backups, or exported diagnostics. Store credentials through an OS-backed secret vault integration. Validate the chosen Tauri secure-storage plugin or native bridge before shipping.

### Gateway decision

Do not depend on OpenFallback until its actual source and deployment are located, its build configuration is repaired, and its API contract passes tests. If it is not recoverable or does not fit desktop-side credential security, use direct provider adapters behind the same internal interface for the desktop MVP. Avoid maintaining two competing model gateways.

## 5. Model Hub and provider connection lifecycle

A provider connection is distinct from a model. One connection can expose several models.

Connection states:
- `NOT_CONFIGURED`
- `CONNECTING`
- `CONNECTED`
- `DEGRADED`
- `DISABLED`
- `AUTH_REQUIRED`
- `RATE_LIMITED`
- `ERROR`

Required operations:
- Add a provider connection using API key, official OAuth, or a documented compatible endpoint.
- Validate and test credentials without displaying them again.
- Discover models where a supported endpoint exists; otherwise offer a clearly labeled curated list.
- Select which models are enabled for routing.
- Enable/disable a connection without deleting credentials.
- Refresh model metadata and test connection.
- Remove a connection, revoke OAuth grants when supported, and delete its stored secret.
- Show the last check time and safe, actionable error summaries.

Never mark a provider connected merely because credentials were saved. The connection test must call an approved health/model endpoint or a low-cost test request, with clear notice if the provider charges for the test.

## 6. Orchestration components

Logical roles, not necessarily separate model instances:
- **Planner:** produces a plan, dependencies, and acceptance criteria.
- **Researcher:** gathers evidence through authorized sources.
- **Analyst:** compares data and derives findings.
- **Executor:** produces requested outputs.
- **Reviewer:** evaluates completeness, consistency, and criteria.
- **Tester:** runs deterministic checks where possible.
- **Synthesizer:** assembles the final coherent deliverable.

The scheduler may reuse one model for several roles or run independent roles on different models. Extra calls must respect latency, quota, privacy, and budget policies.

## 7. Task lifecycle and scheduler

Suggested lifecycle:
`PENDING -> READY -> RUNNING -> REVIEW -> SUCCEEDED`

Additional states: `RETRYING`, `BLOCKED`, `FAILED`, `CANCELLED`, `NEEDS_APPROVAL`.

Each task records a stable ID, run ID, description, success criteria, dependency IDs, role, provider/model assignment, attempt count, output references, validation results, timestamps, usage metadata when available, and error category.

Only tasks with successful dependencies become ready. Reject cyclic DAGs. Enforce concurrency, request, token/output, time, and retry limits. A run must not be reported successful if a required task failed or remains unverified.

## 8. Routing and fallback

Route using required capability, task type, privacy policy, observed reliability and latency, rate limits, available free quota when known, user-selected preferences, and reported cost.

Fallback rules:
1. Classify the error.
2. Retry only transient and safe failures within limits.
3. Select a compatible provider if policy allows.
4. Record the original failure and fallback decision.
5. Stop with a useful explanation when no eligible provider remains.

Never assume model IDs, prices, free tiers, or provider limits are stable. Never blindly replay external side effects.

## 9. Proposed local data model

- `projects`: local project metadata and preferences
- `runs`: user request, state, policy snapshot, budget, timestamps
- `tasks`: task contract, dependencies, assignment, attempts, state
- `provider_connections`: provider ID, label, connection method, enabled state, safe metadata
- `provider_models`: model ID, capabilities, availability observation, user-enabled flag
- `model_calls`: request metadata, latency, error category, reported usage
- `artifacts`: output references, metadata, content hashes, access policy
- `run_events`: append-oriented state and progress events
- `evaluations`: criteria, deterministic test outcomes, reviewer assessment
- `approvals`: action, decision, timestamp, and audit metadata

Credentials are stored separately from these tables. If a hosted multi-device account service is added later, define user identity, encryption, authorization, retention, and sync conflict rules before migrating local data.

## 10. Security requirements

- Keep API keys in OS-backed secure storage and never log them.
- Do not ask for provider website passwords or session cookies.
- Support official OAuth only with documented redirect, scope, token storage, expiry, and revocation behavior.
- Redact credentials from exceptions and diagnostic bundles.
- Use TLS for remote connections and validate endpoints.
- Prevent arbitrary endpoint abuse, local-network SSRF, and unapproved custom URLs.
- Treat prompts, model outputs, files, and retrieved content as untrusted.
- Apply least privilege to every tool and agent.
- Require approval for sensitive or irreversible external actions.
- Apply request budgets, concurrency caps, timeouts, output limits, and cancellation.
- Provide a safe way to remove a connection and its credential.
- Do not transmit user data to a hosted service without an explicit, documented data-flow decision.

## 11. Test strategy

### Unit tests
Provider contract validation, state transitions, DAG cycle detection, scheduler limits, retry classification, routing eligibility, secret redaction, cancellation, and synthesis preconditions.

### Adapter contract tests
Mocked successful responses, malformed responses, unauthorized credentials, rate limits, timeouts, unsupported capabilities, and model discovery failures.

### Integration and end-to-end tests
1. Add and test a provider using a mock server.
2. Disable a provider and confirm it is not selected.
3. Remove a provider and confirm its credential is removed from the vault.
4. Execute dependent and parallel tasks within configured limits.
5. Recover from a transient failure with bounded retry.
6. Fall back only to a compatible, enabled provider.
7. Keep required failures from becoming false success.
8. Cancel an active run.
9. Restart the app and recover persisted run state.
10. Confirm diagnostic logs contain no test secrets.
11. Build and package the Windows app reproducibly.

Live provider smoke tests must be opt-in, clearly labeled, and mindful of quotas and charges.

## 12. Acceptance criteria

The MVP is ready for controlled testing only when:
- A Windows desktop build launches and can be packaged.
- A user can skip initial setup and later add a provider.
- At least one verified provider adapter works; two or more are used for collaboration when available.
- Model Hub lifecycle operations are functional and tested.
- Credentials are stored outside ordinary app data.
- A task DAG executes and persists progress.
- Review and retry behavior is bounded and tested.
- One coherent final result reports limitations accurately.
- Build, tests, and package results are recorded.

## 13. Open decisions and blockers

- Locate and audit the actual OpenFallback source; the currently inspected Vercel deployment fails with `STATIC_BUILD_NO_OUT_DIR`.
- Confirm whether the existing gateway is suitable for direct desktop use or whether direct adapters are safer for MVP.
- Validate the exact Tauri secure-storage implementation and supported Windows version.
- Select the first provider adapters based on current official API documentation and availability.
- Define local data export, retention, backup, and reset behavior.
- Define mobile synchronization only after desktop use cases and security boundaries are validated.
