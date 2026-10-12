import {
  runSiteCheck,
  type CrawlError,
  type SiteCheckResult,
} from "@cleaver/breakcheck-core";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { InteractiveCommand } from "interactive-commander";
import { addConfigOptions, resolveCliProjectConfig } from "../config.js";
import { parseUrlManifest, readUrlManifest } from "../url-manifest.js";
import { withCheckEnvironment } from "../site-environment.js";
import { configureLogger } from "../utils.js";

interface CheckCommandOptions {
  url?: string;
  json?: boolean;
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}

export interface CheckReport {
  schemaVersion: 1;
  runId: string;
  status: "passed" | "differences" | "failed";
  exitCode: 0 | 1 | 2;
  startedAt: string;
  completedAt: string;
  reportPath?: string;
  baseUrl?: string;
  baselineSnapshotId?: string;
  snapshotId?: string;
  routes: string[];
  crawlErrors: CrawlError[];
  errors: string[];
  comparison?: SiteCheckResult["comparison"];
}

function errorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    return [...error.errors].map(errorMessage).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

function requireHttpUrl(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      "A site URL is required. Set baseUrl in breakcheck.config.json or pass --url.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error("The site URL must be a valid HTTP(S) URL.", {
      cause: error,
    });
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname
  ) {
    throw new Error("The site URL must be a valid HTTP(S) URL.");
  }
  return value;
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `check_${timestamp}_${randomUUID().slice(0, 8)}`;
}

function exitCodeFor(status: CheckReport["status"]): CheckReport["exitCode"] {
  switch (status) {
    case "passed":
      return 0;
    case "differences":
      return 1;
    case "failed":
      return 2;
  }
}

async function saveReport(
  report: CheckReport,
  reportDir: string,
): Promise<CheckReport> {
  await mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${report.runId}.json`);
  const savedReport = { ...report, reportPath };
  await writeFile(reportPath, `${JSON.stringify(savedReport, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return savedReport;
}

export async function executeCheck(
  options: CheckCommandOptions,
  args: readonly string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
): Promise<CheckReport> {
  const logger = configureLogger({
    jsonLogs: options.jsonLogs,
    noJsonLogs: options.noJsonLogs,
    silent: options.json,
  });
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  let reportDir: string | undefined;
  let baseUrl: string | undefined;
  let baselineSnapshotId: string | undefined;
  let routes: string[] = [];
  let result: SiteCheckResult | undefined;
  let lifecycleResult: SiteCheckResult | undefined;
  const errors: string[] = [];

  try {
    const project = await resolveCliProjectConfig(args, cwd);
    const check = project.check;
    if (!check) {
      throw new Error(
        "No check settings found. Add a version-2 check section to breakcheck.config.json.",
      );
    }
    reportDir = check.reportDir;
    baselineSnapshotId = check.baselineSnapshot;
    baseUrl = requireHttpUrl(options.url ?? project.baseUrl);

    const manifestText = await readUrlManifest(check.routesFile);
    const manifest = parseUrlManifest(manifestText, baseUrl, check.routesFile);
    if (manifest.issues.length > 0) {
      throw new Error(
        manifest.issues
          .map((issue) => {
            if (issue.type === "entry") {
              return `${issue.source}:${issue.line}: ${issue.message} (${issue.value})`;
            }
            return `${issue.source}: ${issue.message}`;
          })
          .join("\n"),
      );
    }
    routes = manifest.paths;

    const crawlSettings = {
      baseUrl,
      crawlerType: project.crawl.crawlerType ?? "cheerio",
      maxDepth: project.crawl.maxDepth ?? 3,
      maxConcurrency: project.crawl.maxConcurrency ?? 5,
      includePatterns: [],
      excludePatterns: [],
    };
    const checkConfig = {
      baseUrl,
      name: runId,
      baselineSnapshotId: check.baselineSnapshot,
      routes,
      crawlSettings,
      ruleset: project.rulesDir,
    };
    result = await withCheckEnvironment(
      check,
      baseUrl,
      options.url !== undefined,
      async (signal) => {
        const siteResult = await runSiteCheck(checkConfig, {
          storageDir: project.storageDir,
          signal,
        });
        lifecycleResult = siteResult;
        return siteResult;
      },
    );
  } catch (error) {
    const message = errorMessage(error);
    if (lifecycleResult !== undefined) {
      result = {
        ...lifecycleResult,
        status: "failed",
        errors: [...lifecycleResult.errors, message],
      };
    } else {
      errors.push(message);
    }
  }

  errors.push(...(result?.errors ?? []));

  const status = result?.status ?? "failed";
  let report: CheckReport = {
    schemaVersion: 1,
    runId,
    status,
    exitCode: exitCodeFor(status),
    startedAt,
    completedAt: new Date().toISOString(),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    ...(baselineSnapshotId === undefined ? {} : { baselineSnapshotId }),
    ...(result?.snapshotId === undefined
      ? {}
      : { snapshotId: result.snapshotId }),
    routes,
    crawlErrors: result?.crawlErrors ?? [],
    errors,
    ...(result?.comparison === undefined
      ? {}
      : { comparison: result.comparison }),
  };

  if (reportDir !== undefined) {
    try {
      report = await saveReport(report, reportDir);
    } catch (error) {
      report = {
        ...report,
        status: "failed",
        exitCode: 2,
        errors: [
          ...report.errors,
          `Unable to save check report: ${errorMessage(error)}`,
        ],
      };
    }
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } else {
    if (report.status === "passed") {
      logger.info(
        `✅ No differences found across ${report.routes.length} route(s).`,
      );
    } else if (report.status === "differences") {
      const summary = report.comparison;
      logger.error(
        `❌ Differences found: ${summary?.pagesWithDifferences ?? 0} changed page(s), ${summary?.newUrls.length ?? 0} added route(s), ${summary?.removedUrls.length ?? 0} removed route(s).`,
      );
    } else {
      logger.error("❌ Check could not complete.");
      report.errors.forEach((message) => logger.error(`  - ${message}`));
    }
    if (report.reportPath) logger.info(`Report: ${report.reportPath}`);
    if (report.comparison?.resultsPath) {
      logger.info(`Comparison details: ${report.comparison.resultsPath}`);
    }
  }

  process.exitCode = report.exitCode;
  return report;
}

export const checkCommand = addConfigOptions(
  new InteractiveCommand("check")
    .description("Check exact site routes against a stored baseline")
    .option("-u, --url <url>", "Use an already-running site URL")
    .option("--json", "Write one machine-readable check result to stdout")
    .option("--json-logs", "Output logs in JSON format")
    .option("--no-json-logs", "Output logs in pretty format (default)")
    .action(async (options: CheckCommandOptions) => {
      await executeCheck(options);
    }),
);
