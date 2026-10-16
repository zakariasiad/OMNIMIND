import { describe, expect, it } from "vitest";
import { getInitialProviderStates, isProviderId, PROVIDERS } from "./providers";

describe("provider catalog", () => {
  it("contains unique stable provider identifiers", () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects unknown provider identifiers", () => {
    expect(isProviderId("groq")).toBe(true);
    expect(isProviderId("unknown-provider")).toBe(false);
  });

  it("starts with no configured or enabled provider", () => {
    const states = getInitialProviderStates();
    expect(Object.values(states).every((state) => state.status === "not_configured")).toBe(true);
    expect(Object.values(states).every((state) => state.enabledModels.length === 0)).toBe(true);
  });
});