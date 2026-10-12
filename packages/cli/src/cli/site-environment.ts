import { spawn, type ChildProcess } from "node:child_process";
import type {
  ProjectCommand,
  ResolvedProjectCheckConfig,
} from "@cleaver/breakcheck-core";

interface ProcessResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

interface LaunchedProcess {
  child: ChildProcess;
  closed: Promise<ProcessResult>;
  getResult: () => ProcessResult | undefined;
}

interface SignalEventSource {
  on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  removeListener(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
}

function launchCommand(
  command: ProjectCommand,
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<LaunchedProcess> {
  const [executable, ...arguments_] = command;
  if (executable === undefined || executable.trim().length === 0) {
    throw new Error("A configured command must include an executable.");
  }

  const child = spawn(executable, arguments_, {
    cwd,
    env: environment,
    detached: process.platform !== "win32",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk: Buffer | string) => {
    process.stderr.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    process.stderr.write(chunk);
  });

  let result: ProcessResult | undefined;
  const closed = new Promise<ProcessResult>((resolve) => {
    child.once("close", (code, signal) => {
      result = { code, signal };
      resolve(result);
    });
  });
  const started = new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });

  return started.then(() => ({
    child,
    closed,
    getResult: () => result,
  }));
}

function formatCommand(command: ProjectCommand): string {
  return command.map((argument) => JSON.stringify(argument)).join(" ");
}

async function runCommand(
  command: ProjectCommand,
  cwd: string,
  environment: NodeJS.ProcessEnv,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const processHandle = await launchCommand(command, cwd, environment);
  let result: ProcessResult;
  let onAbort: (() => void) | undefined;
  try {
    if (signal === undefined) {
      result = await processHandle.closed;
    } else {
      const aborted = new Promise<undefined>((resolve) => {
        onAbort = () => resolve(undefined);
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
      const completed = await Promise.race([processHandle.closed, aborted]);
      if (completed === undefined) {
        await stopForegroundProcess(processHandle);
        signal.throwIfAborted();
        throw new Error("Command was interrupted.");
      }
      result = completed;
    }
  } finally {
    if (signal !== undefined && onAbort !== undefined) {
      signal.removeEventListener("abort", onAbort);
    }
  }
  if (result.code !== 0) {
    throw new Error(
      `Command failed (${result.code ?? result.signal}): ${formatCommand(command)}`,
    );
  }
}

function sendSignal(handle: LaunchedProcess, signal: NodeJS.Signals): void {
  const processId = handle.child.pid;
  if (processId === undefined || handle.getResult() !== undefined) return;
  try {
    if (process.platform !== "win32") {
      process.kill(-processId, signal);
    } else {
      handle.child.kill(signal);
    }
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ESRCH"
    )) {
      throw error;
    }
  }
}

async function stopForegroundProcess(handle: LaunchedProcess): Promise<void> {
  if (handle.getResult() !== undefined) return;
  sendSignal(handle, "SIGTERM");
  const graceful = await Promise.race([
    handle.closed.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);
  if (graceful) return;

  sendSignal(handle, "SIGKILL");
  await handle.closed;
}

async function waitUntilReady(
  server: NonNullable<ResolvedProjectCheckConfig["server"]>,
  baseUrl: string,
  processHandle: LaunchedProcess,
  signal: AbortSignal,
): Promise<void> {
  const target = new URL(server.readyPath ?? "/", baseUrl).href;
  const deadline = Date.now() + (server.timeoutMs ?? 30_000);
  let lastError = "no HTTP response";

  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const result = processHandle.getResult();
    if (result && result.code !== 0) {
      throw new Error(
        `Server start command exited (${result.code ?? result.signal}) before the site became ready.`,
      );
    }

    try {
      const response = await fetch(target, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(1_000)]),
      });
      if (response.status < 500) {
        await response.body?.cancel();
        return;
      }
      lastError = `HTTP ${response.status}`;
      await response.body?.cancel();
    } catch (error) {
      signal.throwIfAborted();
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Site did not become ready at ${target} within ${server.timeoutMs ?? 30_000}ms (${lastError}).`,
  );
}

/** Runs configured preparation and server commands around a site operation. */
export async function withCheckEnvironment<T>(
  check: ResolvedProjectCheckConfig,
  baseUrl: string,
  useExistingServer: boolean,
  operation: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal; signals?: SignalEventSource } = {},
): Promise<T> {
  const server = check.server;
  const cwd = server?.cwd ?? check.configDirectory;
  const environment = {
    ...process.env,
    ...(server?.env ?? {}),
  };
  const controller = new AbortController();
  let processHandle: LaunchedProcess | undefined;
  let startAttempted = false;
  let interruptError: Error | undefined;
  let childSignal: NodeJS.Signals = "SIGTERM";
  let workFinished = false;
  const interrupt = (label: string) => {
    if (interruptError !== undefined || workFinished) return;
    childSignal = label === "SIGINT" || label === "SIGTERM" ? label : "SIGTERM";
    interruptError = new Error(`Site check interrupted by ${label}.`);
    controller.abort(interruptError);
    if (processHandle !== undefined) {
      sendSignal(processHandle, childSignal);
    }
  };
  const onInterrupt = () => interrupt("SIGINT");
  const onTerminate = () => interrupt("SIGTERM");
  const onExternalAbort = () => interrupt("external cancellation");
  const signals = options.signals ?? process;
  signals.on("SIGINT", onInterrupt);
  signals.on("SIGTERM", onTerminate);
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    if (options.signal?.aborted) interrupt("external cancellation");
    if (!useExistingServer) {
      for (const command of check.prepare ?? []) {
        await runCommand(command, cwd, environment, controller.signal);
      }
    }

    if (!useExistingServer && server !== undefined) {
      const launched = await launchCommand(server.start, cwd, environment);
      processHandle = launched;
      startAttempted = true;
      if (interruptError !== undefined) sendSignal(launched, childSignal);
      await waitUntilReady(server, baseUrl, launched, controller.signal);
    }

    controller.signal.throwIfAborted();
    const value = await operation(controller.signal);
    controller.signal.throwIfAborted();
    outcome = { ok: true, value };
  } catch (error) {
    outcome = { ok: false, error: interruptError ?? error };
  } finally {
    workFinished = true;
  }

  let cleanupError: unknown;
  if (processHandle !== undefined) {
    try {
      await stopForegroundProcess(processHandle);
    } catch (error) {
      cleanupError = error;
    }
  }
  if (startAttempted && server?.stop !== undefined) {
    try {
      await runCommand(server.stop, cwd, environment);
    } catch (error) {
      cleanupError =
        cleanupError === undefined
          ? error
          : new AggregateError([cleanupError, error], "Server cleanup failed.");
    }
  }
  signals.removeListener("SIGINT", onInterrupt);
  signals.removeListener("SIGTERM", onTerminate);
  options.signal?.removeEventListener("abort", onExternalAbort);

  if (cleanupError !== undefined) {
    if (!outcome.ok) {
      throw new AggregateError(
        [outcome.error, cleanupError],
        "Site check failed and server cleanup also failed.",
      );
    }
    throw cleanupError;
  }
  if (!outcome.ok) {
    if (interruptError !== undefined) throw interruptError;
    throw outcome.error;
  }
  return outcome.value;
}
