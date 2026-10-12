import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ComparisonSummary,
  SiteCheckResult,
} from "@cleaver/breakcheck-core";

const mocks = vi.hoisted(() => ({
  runSiteCheck: vi.fn(),
  updateSnapshotRoutesFromConfig: vi.fn(),
  configureLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
}));

vi.mock("@cleaver/breakcheck-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@cleaver/breakcheck-core")>();
  return {
    ...actual,
    runSiteCheck: mocks.runSiteCheck,
    updateSnapshotRoutesFromConfig: mocks.updateSnapshotRoutesFromConfig,
  };
});

vi.mock("../cli/utils.js", () => ({
  configureLogger: mocks.configureLogger,
}));

import { executeCheck } from "../cli/commands/check.js";
import { executeBaselineUpdate } from "../cli/commands/baseline.js";

const baseUrl = "http://127.0.0.1:4000";
let tempDirectory: string;
let configPath: string;
let previousExitCode: typeof process.exitCode;

function summary(): ComparisonSummary {
  return {
    comparisonId: "check",
    status: "completed",
    overallResult: "pass",
    beforeSnapshotId: "baseline",
    afterSnapshotId: "after",
    timestamp: "2026-10-12T00:00:00.000Z",
    durationMs: 1,
    totalPagesCompared: 1,
    pagesWithDifferences: 0,
    pagesWithErrors: 0,
    newUrls: [],
    removedUrls: [],
    comparisonProcessErrors: [],
    summaryFilePath: "/tmp/summary.json",
    resultsPath: "/tmp/results.json",
  };
}

function siteResult(status: SiteCheckResult["status"]): SiteCheckResult {
  return {
    status,
    baseUrl,
    baselineSnapshotId: "baseline",
    snapshotId: "after",
    routes: ["/"],
    crawlErrors: [],
    errors: status === "failed" ? ["site check failed"] : [],
    ...(status === "failed" ? {} : { comparison: summary() }),
  };
}

async function writeConfig(): Promise<void> {
  configPath = path.join(tempDirectory, "breakcheck.config.json");
  await fs.writeFile(
    configPath,
    JSON.stringify({
      version: 2,
      baseUrl,
      storageDir: "./artifacts",
      check: {
        routesFile: "./routes.txt",
        baselineSnapshot: "baseline",
      },
    }),
  );
  await fs.writeFile(path.join(tempDirectory, "routes.txt"), "/\n");
}

beforeEach(async () => {
  tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "breakcheck-cli-check-"),
  );
  previousExitCode = process.exitCode;
  await writeConfig();
});

afterEach(async () => {
  process.exitCode = previousExitCode;
  vi.clearAllMocks();
  await fs.rm(tempDirectory, { recursive: true, force: true });
});

describe("check command results", () => {
  it.each([
    ["passed", 0],
    ["differences", 1],
    ["failed", 2],
  ] as const)("maps %s to exit code %i", async (status, exitCode) => {
    mocks.runSiteCheck.mockResolvedValue(siteResult(status));

    const report = await executeCheck(
      {},
      ["check", "--config", configPath],
      tempDirectory,
    );

    expect(report).toMatchObject({ status, exitCode, routes: ["/"] });
    expect(process.exitCode).toBe(exitCode);
  });

  it("writes a failed report when the core call rejects", async () => {
    mocks.runSiteCheck.mockRejectedValue(new Error("baseline not found"));

    const report = await executeCheck(
      {},
      ["check", "--config", configPath],
      tempDirectory,
    );

    expect(report).toMatchObject({
      status: "failed",
      exitCode: 2,
      errors: [expect.stringContaining("baseline not found")],
    });
    if (report.reportPath === undefined) {
      throw new Error("Expected a persisted check report");
    }
    const saved = JSON.parse(await fs.readFile(report.reportPath, "utf8"));
    expect(saved).toMatchObject({ status: "failed", exitCode: 2 });
  });

  it("returns baseline update failures with exit code 2", async () => {
    mocks.updateSnapshotRoutesFromConfig.mockRejectedValue(
      new Error("incomplete capture"),
    );

    const result = await executeBaselineUpdate(
      { route: ["/"] },
      ["baseline", "update", "--config", configPath],
      tempDirectory,
    );

    expect(result).toMatchObject({
      status: "failed",
      updatedRoutes: [],
      errors: [expect.stringContaining("incomplete capture")],
    });
    expect(process.exitCode).toBe(2);
  });
});
