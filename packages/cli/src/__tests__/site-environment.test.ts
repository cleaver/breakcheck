import { EventEmitter } from "node:events";
import { watch } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withCheckEnvironment } from "../cli/site-environment.js";
import type { ResolvedProjectCheckConfig } from "@cleaver/breakcheck-core";

const serverSettings: NonNullable<ResolvedProjectCheckConfig["server"]> = {
  start: [process.execPath, "-e", "setInterval(() => {}, 1000)"],
  cwd: process.cwd(),
};

const check: ResolvedProjectCheckConfig = {
  configDirectory: process.cwd(),
  routesFile: path.join(process.cwd(), "routes.txt"),
  baselineSnapshot: "baseline",
  reportDir: path.join(process.cwd(), "reports"),
  server: serverSettings,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function checkWith(
  overrides: Partial<ResolvedProjectCheckConfig["server"]> = {},
  prepare: ResolvedProjectCheckConfig["prepare"] = [],
): ResolvedProjectCheckConfig {
  return {
    ...check,
    prepare,
    server: { ...serverSettings, ...overrides },
  };
}

function response(status: number): Response {
  return new Response(null, { status });
}

function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

function idleCommand(): string[] {
  return [process.execPath, "-e", "setInterval(() => {}, 1000)"];
}

describe("withCheckEnvironment", () => {
  it("runs preparation, waits for readiness, then stops the server", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetch);
    const temp = await mkdtemp(path.join(os.tmpdir(), "breakcheck-env-"));
    const marker = path.join(temp, "prepared");
    try {
      await expect(
        withCheckEnvironment(
          checkWith({ start: idleCommand(), cwd: temp }, [
            [
              process.execPath,
              "-e",
              `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'yes')`,
            ],
          ]),
          "http://127.0.0.1:4000",
          false,
          async () => "ready",
        ),
      ).resolves.toBe("ready");
      await expect(access(marker)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("reports a readiness timeout and cleans up the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(503)),
    );
    const config = checkWith({ start: idleCommand(), timeoutMs: 275 });

    await expect(
      withCheckEnvironment(
        config,
        "http://127.0.0.1:4000",
        false,
        async () => undefined,
      ),
    ).rejects.toThrow(/did not become ready.*HTTP 503/i);
  });

  it("stops a readiness request and reports SIGTERM during readiness", async () => {
    const signals = new EventEmitter();
    let requestStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      requestStarted = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestStarted?.();
        const signal = init?.signal;
        return await new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      }),
    );
    const result = withCheckEnvironment(
      checkWith({ start: idleCommand() }),
      "http://127.0.0.1:4000",
      false,
      async () => undefined,
      { signals },
    );
    await started;
    signals.emit("SIGTERM");

    await expect(result).rejects.toThrow(/interrupted by SIGTERM/i);
    expect(signals.listenerCount("SIGINT")).toBe(0);
    expect(signals.listenerCount("SIGTERM")).toBe(0);
  });

  it("reports preparation failure without launching the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(200)),
    );
    await expect(
      withCheckEnvironment(
        checkWith({ start: idleCommand() }, [
          [process.execPath, "-e", "process.exit(7)"],
        ]),
        "http://127.0.0.1:4000",
        false,
        async () => undefined,
      ),
    ).rejects.toThrow(/Command failed \(7\)/);
  });

  it("rejects an empty preparation command and skips preparation for an existing server", async () => {
    await expect(
      withCheckEnvironment(
        checkWith({ start: idleCommand() }, [[]]),
        "http://127.0.0.1:4000",
        false,
        async () => undefined,
      ),
    ).rejects.toThrow(/must include an executable/i);

    await expect(
      withCheckEnvironment(
        checkWith({ start: idleCommand() }, [
          [process.execPath, "-e", "process.exit(8)"],
        ]),
        "http://127.0.0.1:4000",
        true,
        async () => "already running",
      ),
    ).resolves.toBe("already running");
  });

  it("reports spawn failures and server exits before readiness", async () => {
    await expect(
      withCheckEnvironment(
        checkWith({ start: [path.join(os.tmpdir(), `missing-${Date.now()}`)] }),
        "http://127.0.0.1:4000",
        false,
        async () => undefined,
      ),
    ).rejects.toThrow();

    await expect(
      withCheckEnvironment(
        checkWith({
          start: [process.execPath, "-e", "process.exit(4)"],
        }),
        "http://127.0.0.1:4000",
        false,
        async () => undefined,
      ),
    ).rejects.toThrow(/exited \(4\) before the site became ready/);
  });

  it.each(["SIGINT", "SIGTERM"] as const)(
    "waits for operation settlement after %s",
    async (signalName) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response(200)),
      );
      const signals = new EventEmitter();
      let operationStarted: (() => void) | undefined;
      const started = new Promise<void>((resolve) => {
        operationStarted = resolve;
      });
      let operationSettled = false;
      const result = withCheckEnvironment(
        checkWith({ start: idleCommand() }),
        "http://127.0.0.1:4000",
        false,
        async (signal) => {
          operationStarted?.();
          await waitForAbort(signal);
          operationSettled = true;
        },
        { signals },
      );
      await started;
      signals.emit(signalName);
      signals.emit(signalName === "SIGINT" ? "SIGTERM" : "SIGINT");

      await expect(result).rejects.toThrow(`interrupted by ${signalName}`);
      expect(operationSettled).toBe(true);
      expect(signals.listenerCount("SIGINT")).toBe(0);
      expect(signals.listenerCount("SIGTERM")).toBe(0);
    },
  );

  it("forwards external cancellation to the operation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(200)),
    );
    const controller = new AbortController();
    let operationStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      operationStarted = resolve;
    });
    const result = withCheckEnvironment(
      check,
      "http://127.0.0.1:4000",
      true,
      async (signal) => {
        operationStarted?.();
        await waitForAbort(signal);
      },
      { signal: controller.signal },
    );
    await started;
    controller.abort();

    await expect(result).rejects.toThrow(/external cancellation/i);
  });

  it("forwards cancellation received before server launch", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn(async () => response(200));
    vi.stubGlobal("fetch", fetch);

    await expect(
      withCheckEnvironment(
        checkWith({ start: idleCommand() }),
        "http://127.0.0.1:4000",
        false,
        async () => undefined,
        { signal: controller.signal },
      ),
    ).rejects.toThrow(/external cancellation/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("escalates to SIGKILL when the managed server ignores SIGTERM", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "breakcheck-sigkill-"));
    const readyFile = path.join(temp, "ready");
    const watcher = watch(temp);
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Managed child did not become ready.")),
        5_000,
      );
      watcher.on("change", (_event, filename) => {
        if (filename?.toString() !== "ready") return;
        clearTimeout(timeout);
        watcher.close();
        resolve();
      });
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await ready;
        return response(200);
      }),
    );
    const childCode = `process.on('SIGTERM', () => {}); require('node:fs').writeFileSync(${JSON.stringify(readyFile)}, 'ready'); setInterval(() => {}, 1000)`;
    const kill = vi.spyOn(process, "kill");
    try {
      await expect(
        withCheckEnvironment(
          checkWith({
            start: [process.execPath, "-e", childCode],
            cwd: temp,
          }),
          "http://127.0.0.1:4000",
          false,
          async () => undefined,
          { stopGracePeriodMs: 20 },
        ),
      ).resolves.toBeUndefined();
      if (process.platform !== "win32") {
        expect(kill).toHaveBeenCalledWith(expect.any(Number), "SIGKILL");
      }
    } finally {
      watcher.close();
      kill.mockRestore();
      await rm(temp, { recursive: true, force: true });
    }
  }, 10_000);

  it("reports configured stop-command failure and removes signal listeners", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(200)),
    );
    const signals = new EventEmitter();
    const stopPath = process.execPath;
    await expect(
      withCheckEnvironment(
        checkWith({
          start: idleCommand(),
          stop: [stopPath, "-e", "process.exit(9)"],
        }),
        "http://127.0.0.1:4000",
        false,
        async () => "finished",
        { signals },
      ),
    ).rejects.toThrow(/Command failed \(9\)/);
    expect(signals.listenerCount("SIGINT")).toBe(0);
    expect(signals.listenerCount("SIGTERM")).toBe(0);
  });

  it("combines operation and cleanup failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(200)),
    );

    const result = withCheckEnvironment(
      checkWith({
        start: idleCommand(),
        stop: [process.execPath, "-e", "process.exit(9)"],
      }),
      "http://127.0.0.1:4000",
      false,
      async () => {
        throw new Error("operation failed");
      },
    );
    await expect(result).rejects.toMatchObject({
      message: "Site check failed and server cleanup also failed.",
      errors: expect.arrayContaining([
        expect.objectContaining({ message: "operation failed" }),
        expect.objectContaining({
          message: expect.stringMatching(/Command failed \(9\)/),
        }),
      ]),
    });
  });

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
