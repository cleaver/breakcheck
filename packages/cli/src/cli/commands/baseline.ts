import {
  resolveUrlPaths,
  updateSnapshotRoutesFromConfig,
  type SnapshotConfig,
} from "@cleaver/breakcheck-core";
import { randomUUID } from "node:crypto";
import { InteractiveCommand } from "interactive-commander";
import { addConfigOptions, resolveCliProjectConfig } from "../config.js";
import { parseUrlManifest, readUrlManifest } from "../url-manifest.js";
import { withCheckEnvironment } from "../site-environment.js";
import { configureLogger } from "../utils.js";

interface BaselineUpdateOptions {
  all?: boolean;
  route?: string[];
  url?: string;
  json?: boolean;
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}

export interface BaselineUpdateReport {
  status: "updated" | "failed";
  baselineSnapshotId?: string;
  updatedRoutes: string[];
  errors: string[];
}

function messageOf(error: unknown): string {
  if (error instanceof AggregateError) {
    return [...error.errors].map(messageOf).join("; ");
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

async function readConfiguredRoutes(
  routesFile: string,
  baseUrl: string,
): Promise<string[]> {
  const content = await readUrlManifest(routesFile);
  const manifest = parseUrlManifest(content, baseUrl, routesFile);
  if (manifest.issues.length > 0) {
    throw new Error(
      manifest.issues
        .map((issue) =>
          issue.type === "entry"
            ? `${issue.source}:${issue.line}: ${issue.message} (${issue.value})`
            : `${issue.source}: ${issue.message}`,
        )
        .join("\n"),
    );
  }
  return manifest.paths;
}

export async function executeBaselineUpdate(
  options: BaselineUpdateOptions,
  args: readonly string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
): Promise<BaselineUpdateReport> {
  const logger = configureLogger({
    jsonLogs: options.jsonLogs,
    noJsonLogs: options.noJsonLogs,
    silent: options.json,
  });
  const result: BaselineUpdateReport = {
    status: "failed",
    updatedRoutes: [],
    errors: [],
  };

  try {
    if (options.all && options.route !== undefined) {
      throw new Error("Use either --all or --route, not both.");
    }
    if (
      !options.all &&
      (options.route === undefined || options.route.length === 0)
    ) {
      throw new Error("Provide --route <path...> or --all.");
    }

    const project = await resolveCliProjectConfig(args, cwd);
    const check = project.check;
    if (!check) {
      throw new Error(
        "No check settings found. Add a version-2 check section to breakcheck.config.json.",
      );
    }
    const baseUrl = requireHttpUrl(options.url ?? project.baseUrl);
    let routes: string[];
    if (options.all) {
      routes = await readConfiguredRoutes(check.routesFile, baseUrl);
    } else {
      const resolution = resolveUrlPaths(baseUrl, options.route ?? []);
      if (resolution.issues.length > 0) {
        throw new Error(
          resolution.issues.map((issue) => issue.message).join("; "),
        );
      }
      routes = resolution.paths;
    }
    const baselineSnapshotId = check.baselineSnapshot;
    result.baselineSnapshotId = baselineSnapshotId;

    const crawlSettings = {
      baseUrl,
      crawlerType: project.crawl.crawlerType ?? "cheerio",
      maxDepth: project.crawl.maxDepth ?? 3,
      maxConcurrency: project.crawl.maxConcurrency ?? 5,
      includePatterns: [],
      excludePatterns: [],
    };
    const snapshotConfig: SnapshotConfig = {
      baseUrl,
      name: `baseline_update_${randomUUID().slice(0, 12)}`,
      urlPaths: routes,
      crawlSettings,
    };

    const update = await withCheckEnvironment(
      check,
      baseUrl,
      options.url !== undefined,
      (signal) =>
        updateSnapshotRoutesFromConfig(snapshotConfig, baselineSnapshotId, {
          storageDir: project.storageDir,
          signal,
        }),
    );
    result.status = "updated";
    result.updatedRoutes = update.updatedRoutes;
  } catch (error) {
    result.errors.push(messageOf(error));
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (result.status === "updated") {
    logger.info(
      `✅ Updated ${result.updatedRoutes.length} route(s) in baseline "${result.baselineSnapshotId}": ${result.updatedRoutes.join(", ")}`,
    );
  } else {
    logger.error("❌ Baseline update failed.");
    result.errors.forEach((message) => logger.error(`  - ${message}`));
  }

  process.exitCode = result.status === "updated" ? 0 : 2;
  return result;
}

export const baselineUpdateCommand = addConfigOptions(
  new InteractiveCommand("update")
    .description("Update selected routes in the configured baseline snapshot")
    .option("--route <path...>", "Update only these root-relative routes")
    .option("--all", "Update every route in check.routesFile")
    .option("-u, --url <url>", "Use an already-running site URL")
    .option("--json", "Write a machine-readable result to stdout")
    .option("--json-logs", "Output logs in JSON format")
    .option("--no-json-logs", "Output logs in pretty format (default)")
    .action(async (options: BaselineUpdateOptions) => {
      await executeBaselineUpdate(options);
    }),
);

export const baselineCommand = addConfigOptions(
  new InteractiveCommand("baseline").description(
    "Manage the checked-in route baseline",
  ),
);

baselineCommand.addCommand(baselineUpdateCommand);
