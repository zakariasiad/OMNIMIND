# OMNIMIND AI

**A coordinated multi-model AI workspace that turns one request into one verified result.**

OMNIMIND AI is a general-purpose platform for orchestrating multiple AI models and specialized agents. It plans work, delegates tasks, shares relevant context, runs independent tasks concurrently, validates outputs, retries recoverable failures, and synthesizes the work into one coherent deliverable.

> **Project status:** Foundation and architecture planning. The repository is being prepared for implementation; features described in the specification are goals until implemented and tested.

## Vision

Users should describe the outcome they want—not choose models, manually coordinate agents, or reconcile conflicting answers. OMNIMIND AI handles the workflow and reports what was completed, what was validated, and what remains uncertain.

## Core principles

- **One request, one coherent deliverable.**
- **Model-agnostic orchestration:** select models by task fit, availability, quality, latency, and cost.
- **Free-cloud-first:** prefer available free-tier providers while supporting future paid providers.
- **Resilient execution:** persist task state, retry safely, and fall back when compatible providers fail.
- **Evidence-aware validation:** do not treat model consensus as proof of correctness.
- **Human control:** require approval for sensitive, irreversible, or externally impactful actions.
- **Security by design:** isolate project data, protect credentials, and apply least-privilege tool access.

## Planned capabilities

- Project and run management
- Dynamic planning and dependency-aware task graphs
- Specialized logical agent roles
- Parallel execution of independent tasks
- Shared, permission-scoped context and artifacts
- Output review, test execution, and bounded retries
- Unified final-answer synthesis
- Live progress events and execution history
- Provider health, quotas, budgets, and fallback policies
- Tool and MCP integrations with explicit permissions

## Architecture direction

- **Web UI:** Next.js + TypeScript
- **Application API and orchestration:** Python + FastAPI
- **Model access:** reuse and validate the existing OpenFallback AI Gateway before extending it
- **Persistence:** PostgreSQL; Supabase is an option if it fits the verified existing environment
- **Live updates:** Server-Sent Events initially, with WebSockets if product needs justify them
- **Execution:** durable task state and bounded asynchronous workers

These are proposed choices, not claims that the components have already been implemented or deployed.

## Documentation

- [Technical specification](docs/TECHNICAL_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation roadmap](docs/ROADMAP.md)

## Important gateway note

OpenFallback AI Gateway is intended to be the model-access layer, not a competing second gateway. Its source, configuration, provider adapters, deployment settings, and health must be inspected and tested before relying on it. Do not assume a provider is available, free, or operational without runtime verification.

## Development status

The repository currently contains the initial project README and license. The current work establishes the English-language project foundation and implementation plan. Application features, provider integrations, tests, and deployments must be added and verified in subsequent steps.

## License

MIT. See [LICENSE](LICENSE).
