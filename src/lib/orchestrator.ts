export type TaskStatus =
  | "pending"
  | "ready"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled";

export interface TaskDefinition<TInput = unknown> {
  id: string;
  title: string;
  input: TInput;
  dependsOn: string[];
  required?: boolean;
}

export interface TaskExecutionContext {
  task: TaskDefinition;
  dependencyResults: Record<string, unknown>;
  attempt: number;
  signal?: AbortSignal;
}

export interface TaskExecutionOptions {
  concurrency?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onEvent?: (event: TaskEvent) => void;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export interface TaskEvent {
  type: "task_ready" | "task_started" | "task_retrying" | "task_succeeded" | "task_failed" | "task_blocked" | "task_cancelled";
  taskId: string;
  title: string;
  attempt?: number;
  message?: string;
  timestamp: string;
}

export interface TaskRecord {
  task: TaskDefinition;
  status: TaskStatus;
  attempts: number;
  output?: unknown;
  error?: string;
}

export interface TaskGraphResult {
  status: "succeeded" | "partial" | "failed" | "cancelled";
  tasks: TaskRecord[];
  events: TaskEvent[];
}

type SettledTask = { taskId: string; ok: true; output: unknown; attempts: number }
  | { taskId: string; ok: false; error: string; attempts: number };

export function validateTaskGraph(tasks: TaskDefinition[]): void {
  const byId = new Map<string, TaskDefinition>();
  for (const task of tasks) {
    if (!task.id.trim()) throw new Error("Task IDs must not be empty.");
    if (byId.has(task.id)) throw new Error(`Duplicate task ID: ${task.id}`);
    byId.set(task.id, task);
  }
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency)) throw new Error(`Task "${task.id}" depends on unknown task "${dependency}".`);
      if (dependency === task.id) throw new Error(`Task "${task.id}" cannot depend on itself.`);
    }
  }

  const indegree = new Map(tasks.map((task) => [task.id, task.dependsOn.length]));
  const dependents = new Map<string, string[]>();
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      dependents.set(dependency, [...(dependents.get(dependency) ?? []), task.id]);
    }
  }
  const queue = [...indegree.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }
  if (visited !== tasks.length) throw new Error("Task dependencies contain a cycle.");
}

export async function executeTaskGraph(
  tasks: TaskDefinition[],
  executor: (context: TaskExecutionContext) => Promise<unknown>,
  options: TaskExecutionOptions = {},
): Promise<TaskGraphResult> {
  validateTaskGraph(tasks);
  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? 3)));
  const maxAttempts = Math.max(1, Math.min(4, Math.floor(options.maxAttempts ?? 2)));
  const records = new Map<string, TaskRecord>(
    tasks.map((task) => [task.id, { task, status: "pending", attempts: 0 }]),
  );
  const outputs = new Map<string, unknown>();
  const events: TaskEvent[] = [];
  const running = new Map<string, Promise<SettledTask>>();

  const emit = (event: Omit<TaskEvent, "timestamp">) => {
    const fullEvent: TaskEvent = { ...event, timestamp: new Date().toISOString() };
    events.push(fullEvent);
    options.onEvent?.(fullEvent);
  };

  const settle = (taskId: string, status: TaskStatus, fields: Partial<TaskRecord> = {}) => {
    const record = records.get(taskId)!;
    records.set(taskId, { ...record, status, ...fields });
  };

  async function runWithRetry(task: TaskDefinition): Promise<SettledTask> {
    let lastError = "Task failed without a diagnostic.";
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (options.signal?.aborted) {
        return { taskId: task.id, ok: false, error: "Run cancelled.", attempts: attempt - 1 };
      }
      settle(task.id, attempt > 1 ? "retrying" : "running", { attempts: attempt });
      if (attempt === 1) emit({ type: "task_started", taskId: task.id, title: task.title, attempt });
      else emit({ type: "task_retrying", taskId: task.id, title: task.title, attempt, message: lastError });

      const dependencyResults = Object.fromEntries(
        task.dependsOn.map((id) => [id, outputs.get(id)]),
      );
      try {
        const output = await executor({ task, dependencyResults, attempt, signal: options.signal });
        return { taskId: task.id, ok: true, output, attempts: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown task error.";
        const retryable = options.shouldRetry
          ? options.shouldRetry(error, attempt)
          : /timeout|timed out|temporar|rate.?limit|\\b429\\b|\\b502\\b|\\b503\\b|\\b504\\b|network|connection|unavailable/i.test(lastError);
        if (options.signal?.aborted || attempt === maxAttempts || !retryable) break;
      }
    }
    return { taskId: task.id, ok: false, error: lastError, attempts: records.get(task.id)?.attempts ?? 0 };
  }

  while ([...records.values()].some((record) => ["pending", "ready", "running", "retrying"].includes(record.status))) {
    let madeProgress = false;

    for (const record of records.values()) {
      if (record.status !== "pending" && record.status !== "ready") continue;
      if (options.signal?.aborted) {
        settle(record.task.id, "cancelled");
        emit({ type: "task_cancelled", taskId: record.task.id, title: record.task.title });
        madeProgress = true;
        continue;
      }
      const dependencies = record.task.dependsOn.map((id) => records.get(id)!);
      if (dependencies.some((dependency) => ["failed", "blocked", "cancelled"].includes(dependency.status))) {
        settle(record.task.id, "blocked", { error: "A required dependency did not succeed." });
        emit({ type: "task_blocked", taskId: record.task.id, title: record.task.title, message: "A dependency did not succeed." });
        madeProgress = true;
        continue;
      }
      if (dependencies.every((dependency) => dependency.status === "succeeded") && running.size < concurrency) {
        settle(record.task.id, "ready");
        emit({ type: "task_ready", taskId: record.task.id, title: record.task.title });
        settle(record.task.id, "running");
        const promise = runWithRetry(record.task).then((settled) => settled);
        running.set(record.task.id, promise);
        madeProgress = true;
      }
    }

    if (running.size === 0) {
      if (!madeProgress) break;
      continue;
    }

    const settled = await Promise.race(running.values());
    running.delete(settled.taskId);
    const record = records.get(settled.taskId)!;
    if (settled.ok) {
      outputs.set(settled.taskId, settled.output);
      settle(settled.taskId, "succeeded", { output: settled.output, attempts: settled.attempts, error: undefined });
      emit({ type: "task_succeeded", taskId: settled.taskId, title: record.task.title, attempt: settled.attempts });
    } else {
      const cancelled = options.signal?.aborted || settled.error === "Run cancelled.";
      settle(settled.taskId, cancelled ? "cancelled" : "failed", { error: settled.error, attempts: settled.attempts });
      emit({
        type: cancelled ? "task_cancelled" : "task_failed",
        taskId: settled.taskId,
        title: record.task.title,
        attempt: settled.attempts,
        message: settled.error,
      });
    }
  }

  const taskRecords = tasks.map((task) => records.get(task.id)!);
  const required = taskRecords.filter((record) => record.task.required !== false);
  const allRequiredSucceeded = required.every((record) => record.status === "succeeded");
  const hasSuccess = taskRecords.some((record) => record.status === "succeeded");
  const hasFailedTask = taskRecords.some((record) => ["failed", "blocked"].includes(record.status));
  const status = options.signal?.aborted
    ? "cancelled"
    : allRequiredSucceeded && !hasFailedTask
      ? "succeeded"
      : hasSuccess
        ? "partial"
        : "failed";
  return { status, tasks: taskRecords, events };
}
