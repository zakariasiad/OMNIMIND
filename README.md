# OMNIMIND AI

**One request. Multiple AI models. One coherent result.**

OMNIMIND AI is a desktop-first, general-purpose AI workspace that coordinates compatible AI models and specialized agent roles. It plans work, delegates tasks, shares scoped context, reviews outputs, handles recoverable failures, and synthesizes one deliverable with clear verification status.

> **Project status:** Early desktop scaffold on a draft pull request. A Tauri/React UI, initial API-key connections, provider adapters, a bounded task-graph engine, unit tests, and Windows CI have been added. This is not a release: native packaging and live provider connections still require verification.

## Product direction

- **Desktop first:** Windows is the initial target, with a straightforward installer and optional command-line setup and diagnostics.
- **Mobile later:** Keep orchestration contracts and provider abstractions portable so a mobile companion can be built without redesigning the core.
- **Model-agnostic:** Support multiple providers through a normalized adapter interface.
- **Free-cloud-first:** Prioritize legitimately available free tiers while allowing users to add paid providers and their own credentials.
- **User-controlled connections:** Add, test, enable, disable, refresh, and remove provider connections from a Model Hub.
- **Secure credentials:** Prefer OS-backed secure storage; never ask users to paste account passwords or session cookies into OMNIMIND.
- **One coherent deliverable:** A bounded orchestration workflow plans tasks, runs independent work concurrently, reviews results, and synthesizes one answer.
- **Honest status:** Show completed, failed, skipped, and unverified work; never claim unlimited free inference or guaranteed correctness.

## Connection methods

1. **API key** for providers that officially expose an API.
2. **Official OAuth** only where the provider supports an approved OAuth integration.
3. **Compatible API endpoints and MCP connectors** after validation and explicit user authorization.
4. **Future local-model connectors** as an optional extension; local models are not required for the first release.

Email/password automation, cookie extraction, and unofficial session reuse are out of scope. A website subscription does not automatically grant API access.

## Proposed initial stack

- **Desktop shell:** Tauri 2 + React + TypeScript + Vite.
- **Core logic:** TypeScript modules with provider-neutral contracts and deterministic tests.
- **Secret storage:** OS credential vault through a reviewed native integration; secrets must not be stored in ordinary app settings or source control.
- **Local persistence:** The current scaffold stores up to 100 completed-run summaries in local app storage; SQLite persistence for projects, task state, and detailed run events remains planned. Secrets are stored separately.
- **Provider transport:** Native desktop-side requests so browser CORS limitations do not become a false provider failure.
- **Live progress:** Typed local events first; use a hosted orchestration service only when a concrete requirement justifies it.
- **Future mobile client:** Reuse portable TypeScript contracts where practical; implement platform-appropriate secure storage and permissions.

The desktop shell, React UI, initial provider adapters, native credential-vault commands, task-graph engine, basic draft-review-synthesis workflow, bounded local run-history storage, and CI workflow now exist on the working branch. Durable SQLite persistence for detailed run state, official OAuth, a generalized planner, full MCP tool execution/permissions, local stdio MCP servers, and a production-ready mobile client remain planned. The MCP Hub currently supports limited HTTPS server inspection and tool discovery only. Confirm dependency versions and platform compatibility during implementation.

## Planned core screens

- **Workspace:** one prompt, execution mode, files/context, and final deliverable.
- **Model Hub:** providers, configured models, connection status, capability metadata, and connection actions.
- **Run Monitor:** task progress, model assignments, retries, failures, and verification status.
- **Settings:** concurrency, privacy, history, budgets, and diagnostics.

## Documentation

- [Technical specification](docs/TECHNICAL_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)
- [Desktop product specification](docs/DESKTOP_PRODUCT_SPEC.md)
- [Provider connections and credential security](docs/PROVIDER_CONNECTIONS.md)
- [MCP integration plan and security requirements](docs/MCP_INTEGRATIONS.md)

## Existing gateway

An existing Vercel project named `openfallback-ai-gateway` was found, but its latest inspected deployment failed with `STATIC_BUILD_NO_OUT_DIR`. The deployment points to the `Framework-MCPs` repository, where no clear gateway source directory was found in the inspected repository tree. The gateway must not be treated as available until its actual source, build configuration, API contract, provider adapters, and health are located and verified.

## Development status

The `docs/foundation-specification` branch contains the early desktop scaffold and its implementation plan. Frontend checks and unit tests passed in a recent GitHub Actions run; Windows installer jobs were still running at the last check. Native provider calls have not been validated with live credentials. The collaboration workflow is a basic draft → review → synthesis path, not a general autonomous planner. The initial MCP Hub supports native HTTPS endpoint inspection and bounded tool discovery; tool execution, OAuth, local stdio, and per-tool authorization are not enabled yet. The draft PR has not been merged.

## License

MIT. See [LICENSE](LICENSE).
