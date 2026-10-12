import { EventEmitter } from "node:events";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCheckEnvironment } from "../cli/site-environment.js";
import type { ResolvedProjectCheckConfig } from "@cleaver/breakcheck-core";

const check: ResolvedProjectCheckConfig = {
  configDirectory: process.cwd(),
  routesFile: path.join(process.cwd(), "routes.txt"),
  baselineSnapshot: "baseline",
  reportDir: path.join(process.cwd(), "reports"),
  server: {
    start: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
    cwd: process.cwd(),
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withCheckEnvironment", () => {
  it("waits for an interrupted operation to settle before returning", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const signals = new EventEmitter();
    let operationSettled = false;

    const result = withCheckEnvironment(
      check,
      "http://127.0.0.1:4000",
      false,
      async (signal) => {
        const aborted = new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        setTimeout(() => signals.emit("SIGINT"), 25);
        await aborted;
        operationSettled = true;
      },
      { signals },
    );

    await expect(result).rejects.toThrow(/interrupted by SIGINT/i);
    expect(operationSettled).toBe(true);
  });
});
