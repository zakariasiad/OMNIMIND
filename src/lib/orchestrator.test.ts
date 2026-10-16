import { describe, expect, it } from "vitest";
import { executeTaskGraph, validateTaskGraph, type TaskDefinition } from "./orchestrator";

describe("task graph validation", () => {
  it("rejects duplicate IDs and unknown dependencies", () => {
    expect(() => validateTaskGraph([
      { id: "a", title: "A", input: null, dependsOn: [] },
      { id: "a", title: "Duplicate", input: null, dependsOn: [] },
    ])).toThrow(/Duplicate task ID/);
    expect(() => validateTaskGraph([
      { id: "a", title: "A", input: null, dependsOn: ["missing"] },
    ])).toThrow(/unknown task/);
  });

  it("rejects dependency cycles", () => {
    const cyclic: TaskDefinition[] = [
      { id: "a", title: "A", input: null, dependsOn: ["b"] },
      { id: "b", title: "B", input: null, dependsOn: ["a"] },
    ];
    expect(() => validateTaskGraph(cyclic)).toThrow(/cycle/);
  });
});

describe("task graph execution", () => {
  it("passes dependency outputs to downstream tasks and returns one run result", async () => {
    const tasks: TaskDefinition[] = [
      { id: "draft", title: "Draft", input: { prompt: "demo" }, dependsOn: [] },
      { id: "review", title: "Review", input: null, dependsOn: ["draft"] },
      { id: "synthesis", title: "Synthesis", input: null, dependsOn: ["draft", "review"] },
    ];
    const result = await executeTaskGraph(tasks, async ({ task, dependencyResults }) => {
      if (task.id === "draft") return "draft output";
      if (task.id === "review") {
        expect(dependencyResults.draft).toBe("draft output");
        return "review notes";
      }
      expect(dependencyResults.draft).toBe("draft output");
      expect(dependencyResults.review).toBe("review notes");
      return "final result";
    });
    expect(result.status).toBe("succeeded");
    expect(result.tasks.map((task) => task.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(result.tasks[2].output).toBe("final result");
  });

  it("blocks dependent tasks after a required task fails", async () => {
    const tasks: TaskDefinition[] = [
      { id: "first", title: "First", input: null, dependsOn: [] },
      { id: "second", title: "Second", input: null, dependsOn: ["first"] },
    ];
    const result = await executeTaskGraph(tasks, async () => { throw new Error("controlled failure"); }, { maxAttempts: 1 });
    expect(result.status).toBe("failed");
    expect(result.tasks[0].status).toBe("failed");
    expect(result.tasks[1].status).toBe("blocked");
  });
});
