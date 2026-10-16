# OMNIMIND AI — Desktop Product Specification

## Purpose

Deliver a focused desktop workspace where a user configures model providers once, submits a single request, observes a coordinated workflow, and receives one coherent result.

## Primary user journeys

### First launch
1. Welcome screen explains that provider connections are optional and can be configured later.
2. User chooses **Set up providers** or **Skip for now**.
3. User reaches the workspace; an empty Model Hub explains how to connect a provider.

### Add a provider
1. Open **Model Hub** and choose **Add provider**.
2. Select a provider from a reviewed catalog or choose a compatible endpoint only if custom endpoints are supported safely.
3. Select an officially supported method: API key or OAuth when explicitly available.
4. Enter the key in a masked field. Never ask for website account passwords or cookies.
5. Test the connection and show safe status details.
6. Discover available models or display a curated list if discovery is unavailable.
7. Enable one or more models for routing.

### Manage providers
- Enable or disable a connection.
- Refresh models and retest the connection.
- Edit a label or replace a key.
- Remove a connection after confirmation; delete the locally stored credential and revoke OAuth grant where supported.
- Show status, last check, capabilities, and safe errors.

### Run a task
1. User writes a request and selects a mode: **Fast**, **Balanced**, or **Deep**.
2. OMNIMIND estimates the plan and potential model-call count when feasible.
3. User starts the run.
4. Run Monitor shows plan, active tasks, assigned models, retries, and failures.
5. Final view shows one deliverable plus a concise verification summary, artifacts, and unresolved limitations.

## Navigation

- **Workspace:** new requests and recent work.
- **Model Hub:** provider connections and model selection.
- **Run Monitor:** live progress and run history.
- **Settings:** privacy, concurrency, budgets, retention, diagnostics, and app updates.

## Model Hub card requirements

Each provider card shows:
- Provider name and optional user-defined label
- Connection method (API or official OAuth)
- Current status and last tested time
- Number of available and enabled models
- Supported capabilities
- Non-secret error summary
- Actions: Test, Refresh models, Enable/Disable, Edit, Remove

Do not display the full API key after save. A masked suffix may be shown only if it is safe and useful. Never claim quota, cost, or free-tier availability unless verified from provider metadata or clearly marked as unknown.

## Interaction and accessibility

- Keyboard navigable and screen-reader labels for all controls.
- Confirm destructive actions.
- Provide clear loading, empty, offline, error, and success states.
- Do not block first launch on credentials.
- Avoid a giant configuration wizard; make provider setup progressive and recoverable.
- Make privacy-relevant data flows explicit.

## CMD setup and diagnostics

The standard installer is the default path. Optional command-line commands may support diagnostics, log collection with redaction, app version, cache reset, and safe repair. Never require users to put API keys in shell command arguments, because command histories and process listings can expose them.

## Non-functional goals

- Lightweight Windows app suitable for ordinary desktop hardware.
- No required local LLM download for MVP.
- Predictable resource use and bounded concurrency.
- Local run history by default.
- No silent cloud sync or prompt upload to OMNIMIND-operated servers.
- Clear separation between local app data and provider-side data handling.
