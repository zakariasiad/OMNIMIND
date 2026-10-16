# OMNIMIND AI — Technical Specification

- **Version:** 0.1
- **Status:** Foundational specification; implementation not yet verified
- **Product scope:** General-purpose multi-model AI work orchestration
- **Provider policy:** Free-cloud-first, extensible to paid providers
- **Existing dependency:** OpenFallback AI Gateway, subject to audit and verification

## 1. Product objective

Turn a user's high-level request into a coherent deliverable by coordinating multiple models and tools through a bounded, observable, resumable workflow.

The product is not a fan-out chat interface. It must plan tasks, track dependencies, share relevant context, validate intermediate outputs, recover from compatible failures, and synthesize a single final result with transparent status.

## 2. Scope

### MVP

1. Create projects and execution runs.
2. Convert a request into a structured task plan with success criteria.
3. Represent task dependencies as a directed acyclic graph (DAG).
4. Execute independent ready tasks concurrently within configured limits.
5. Route each task through a provider/model abstraction.
6. Persist task state, outputs, errors, and run events.
7. Review outputs against explicit criteria and retry within strict limits.
8. Synthesize one final deliverable and report incomplete or unverified work.
9. Stream progress to the UI.
10. Enforce authentication, authorization, budgets, timeouts, and cancellation.

### Out of scope for the first release

- Training foundation models.
- Guaranteeing unlimited free inference.
- Unrestricted autonomous computer or shell access.
- Unbounded agent loops.
- Treating agreement among models as definitive evidence.
- Production claims before tests and deployment checks pass.

## 3. System components

### Web application
Next.js and TypeScript UI for projects, runs, progress, artifacts, approvals, and final deliverables.

### Application API
Python/FastAPI endpoints for project and run management, authentication integration, validation, event streaming, and orchestration requests.

### Orchestrator
Owns planning, dependency resolution, scheduling, task lifecycle, retry policy, budgets, cancellation, and final synthesis. Model outputs are untrusted data and must not directly override system policy.

### Model gateway
Reuse OpenFallback AI Gateway after source and deployment inspection. Keep the orchestration layer provider-agnostic through a normalized internal interface. Avoid creating a competing gateway without a demonstrated need.

### Persistence and artifacts
PostgreSQL is the proposed source of truth for projects, runs, tasks, model calls, evaluations, and events. Store large artifacts in object storage if required; retain metadata and access controls in the database.

### Worker execution
Begin with bounded asynchronous workers and persisted state. Introduce a durable workflow engine or external queue only when recovery and workload requirements justify the added infrastructure.

## 4. Agent roles

Roles are logical responsibilities, not necessarily separate models:

- **Planner:** produces a task graph, dependencies, and success criteria.
- **Researcher:** gathers and records evidence using authorized tools.
- **Analyst:** compares inputs and derives findings.
- **Executor:** produces the requested artifact or result.
- **Reviewer:** checks completeness, consistency, and criteria.
- **Tester:** runs available tests or verification procedures.
- **Synthesizer:** creates the final coherent deliverable.

The scheduler may assign multiple roles to one model or use multiple models for independent review when the value justifies the extra latency and quota usage.

## 5. Task lifecycle and contracts

Recommended lifecycle:

`PENDING -> READY -> RUNNING -> REVIEW -> SUCCEEDED`

Additional states: `RETRYING`, `BLOCKED`, `FAILED`, `CANCELLED`, `NEEDS_APPROVAL`.

A task record should include:
- Stable task and run identifiers
- Description and success criteria
- Input references and dependency IDs
- Assigned role, provider, and model
- Current state and attempt count
- Output/artifact references
- Validation result and reviewer notes
- Start/end timestamps and duration
- Usage/cost metadata when supplied by the provider
- Error category and retry eligibility

Only tasks whose dependencies succeeded may become ready. The scheduler must reject dependency cycles. A run cannot be marked successful while a required task remains failed, blocked, or unverified.

## 6. Planning, scheduling, and synthesis

1. Validate the user request and execution policy.
2. Generate a structured plan with measurable acceptance criteria.
3. Validate the plan, dependency graph, and budget.
4. Schedule ready tasks up to the configured concurrency limit.
5. Save results and events after each meaningful state transition.
6. Review outputs and run deterministic tests where possible.
7. Retry recoverable failures within attempt and time limits.
8. Re-plan only when a result materially changes downstream requirements.
9. Resolve conflicts using evidence, tests, explicit criteria, or a human decision—not model voting alone.
10. Synthesize the final deliverable and clearly label limitations.

## 7. Provider abstraction and routing

Use a normalized internal adapter interface for capabilities such as text generation, structured output, tool calling, streaming, and model metadata. A provider may support only a subset.

Route tasks using:
- Required capabilities
- Task category and quality requirements
- Observed latency and reliability
- Provider availability and rate limits
- Free-tier quota where observable
- Cost policy
- Data handling and privacy requirements
- Recent measured outcomes for comparable tasks

Treat provider names, model IDs, quotas, prices, and free-tier terms as dynamic data. Do not hard-code assumptions that a model is always available or free.

### Fallback policy

1. Classify the error (rate limit, timeout, unavailable, invalid request, authentication, or unknown).
2. Retry only when safe and appropriate.
3. Select a compatible fallback provider if policy permits.
4. Preserve the original error and fallback decision in the run log.
5. Stop and report the limitation when no suitable provider is available.

Never blindly replay an external side effect. Use idempotency keys or human approval for actions that could be duplicated or irreversible.

## 8. Proposed data model

- `users`: identity reference and account status
- `projects`: owner, configuration, and project metadata
- `runs`: request, status, policy snapshot, budget, and timestamps
- `tasks`: task contracts, dependencies, assignments, state, attempts
- `agents`: logical role definitions and versioned instructions
- `provider_configs`: non-secret provider configuration
- `provider_models`: model capabilities and observed availability
- `model_calls`: request metadata, latency, errors, and reported usage
- `artifacts`: output references, content metadata, and access policy
- `run_events`: append-oriented progress and state-transition records
- `evaluations`: criteria, test outcomes, and reviewer assessments
- `approvals`: action requiring approval, requester, decision, timestamp

Apply row-level or equivalent authorization so users can access only their own permitted projects. Secrets belong in a secret manager or protected runtime environment, never in source control or ordinary configuration rows.

## 9. API direction

Application API proposals:
- `POST /api/v1/projects`
- `GET /api/v1/projects`
- `POST /api/v1/projects/{project_id}/runs`
- `GET /api/v1/runs/{run_id}`
- `POST /api/v1/runs/{run_id}/cancel`
- `GET /api/v1/runs/{run_id}/events`
- `GET /api/v1/runs/{run_id}/artifacts`
- `POST /api/v1/runs/{run_id}/approvals`

These are proposed endpoints, not implemented endpoints.

The existing gateway was previously expected to expose `POST /v1/chat/completions`, `GET /v1/models`, and a health endpoint. Verify the actual source and behavior before depending on these routes or changing them.

All APIs must validate inputs, authenticate and authorize callers, rate-limit requests, return structured errors, support trace IDs, and prevent accidental duplicate run creation.

## 10. Observability and live progress

Record structured events for run creation, plan acceptance, task transitions, model calls, retries, fallback decisions, reviews, approvals, and finalization.

Expose a live event stream to the UI. Start with Server-Sent Events if one-way progress is sufficient; use WebSockets only if bidirectional real-time interaction requires them.

Never log API keys or unnecessary sensitive prompt content. Make retention and redaction policies configurable.

## 11. Security and safety

- Authenticate users and authorize every project/run/artifact access.
- Store provider credentials in protected environment secrets or a secret manager.
- Apply least privilege to each tool and agent.
- Treat model output, retrieved pages, and uploaded files as untrusted content.
- Defend against prompt injection and tool-output instruction spoofing.
- Restrict filesystem, network, and shell capabilities if later introduced.
- Require explicit approval for sensitive or irreversible actions.
- Enforce budgets, timeouts, maximum attempts, token/output limits, and concurrency caps.
- Validate file type and size and isolate uploaded content.
- Add audit events for privileged operations.
- Do not send sensitive information to third-party providers without an approved data policy.

## 12. Reliability and testing

### Unit tests
Task state transitions, DAG validation, scheduling, retry classification, routing policy, budget checks, cancellation, and synthesis preconditions.

### Integration tests
Gateway health, provider adapter behavior, rate-limit handling, compatible fallback, persistence, event streaming, and authorization boundaries.

### End-to-end acceptance tests
1. One request creates multiple dependent tasks.
2. Independent tasks run concurrently within configured limits.
3. Outputs are passed to downstream tasks through explicit references.
4. A recoverable error triggers a bounded retry.
5. An unavailable provider triggers a compatible fallback when configured.
6. A required failed task prevents false success.
7. The final deliverable includes accurate completion and verification status.
8. Cancellation stops cancellable work.
9. Cross-user access is denied.
10. A run can resume without repeating completed side effects.

## 13. MVP acceptance criteria

The MVP is ready for controlled testing only when:
- The gateway's actual interfaces are verified and tested.
- At least two compatible models can be used when providers are available.
- A task graph executes with dependency-aware scheduling.
- State and artifacts persist across application restarts.
- Review and bounded retry behavior are covered by tests.
- Final synthesis produces one coherent result.
- Failures and unverified outputs are disclosed.
- Authorization and resource limits pass tests.
- Build and deployment results are reproducible and recorded.

## 14. Open decisions

- Confirm actual OpenFallback source location and current deployment configuration.
- Confirm whether an existing database or storage resource should be reused.
- Select the first authentication mechanism after reviewing available infrastructure.
- Select worker/queue technology based on measured durability requirements.
- Define retention limits and user-data policy.
- Establish performance and quality baselines using representative tasks.
