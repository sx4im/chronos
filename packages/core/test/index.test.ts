import { describe, it, expect } from "vitest";
import { CHRONOS_VERSION } from "../src/index.js";

describe("@sx4im/chronos-core placeholder", () => {
  it("exports a version string", () => {
    expect(CHRONOS_VERSION).toBe("0.0.0");
  });
});
