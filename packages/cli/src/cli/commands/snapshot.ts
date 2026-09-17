import type {
  CrawlError,
  ProjectCrawlConfig,
  SnapshotConfig,
  SnapshotResult,
} from "@cleaver/breakcheck-core";
import { createSnapshotFromConfig } from "@cleaver/breakcheck-core";
import { InteractiveCommand } from "interactive-commander";
import path from "node:path";
import {
  addConfigOptions,
  hasCliOption,
  resolveCliProjectConfig,
} from "../config.js";
import { parseUrlManifest, readUrlManifest } from "../url-manifest.js";
import { configureLogger } from "../utils.js";

export interface SnapshotCommandOptions {
  url?: string;
  name?: string;
  depth?: string;
  concurrency?: string;
  include?: string[] | false;
  exclude?: string[] | false;
  noInclude?: boolean;
  noExclude?: boolean;
  type?: string;
  writeUrls?: string;
  urlFile?: string;
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}

const DEFAULT_CRAWLER_TYPE = "cheerio" as const;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_CONCURRENCY = 5;

function parseInteger(
  value: string | undefined,
  fallback: number,
  field: string,
  minimum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(
      `${field} must be an integer greater than or equal to ${minimum}.`,
    );
  }
  return parsed;
}

function requireHttpUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new Error(
      "A base URL is required. Provide --url <url> or set baseUrl in breakcheck.config.json.",
    );
  }
  // Preserve the existing API-level failure response for an explicitly empty
  // CLI value while still making an omitted URL actionable at the CLI layer.
  if (value.trim().length === 0) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error("Base URL must be a valid HTTP(S) URL.", { cause: error });
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname
  ) {
    throw new Error("Base URL must be a valid HTTP(S) URL.");
  }
  return value;
}

function resolveCrawlerType(
  value: string | undefined,
  configured: ProjectCrawlConfig["crawlerType"],
): "cheerio" | "playwright" {
  const crawlerType = value ?? configured ?? DEFAULT_CRAWLER_TYPE;
  if (crawlerType !== "cheerio" && crawlerType !== "playwright") {
    throw new Error('Crawler type must be either "cheerio" or "playwright".');
  }
  return crawlerType;
}

export async function buildSnapshotInvocation(
  options: SnapshotCommandOptions,
  args: readonly string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
): Promise<{ config: SnapshotConfig; storageDir: string }> {
  const projectConfig = await resolveCliProjectConfig(args, cwd);
  const crawl = projectConfig.crawl;
  const baseUrl = requireHttpUrl(options.url ?? projectConfig.baseUrl);
  const positiveInclude = Array.isArray(options.include);
  const positiveExclude = Array.isArray(options.exclude);
  const noInclude = options.noInclude === true || options.include === false;
  const noExclude = options.noExclude === true || options.exclude === false;
  if (noInclude && (positiveInclude || hasCliOption(args, "--include"))) {
    throw new Error("--include and --no-include cannot be used together.");
  }
  if (noExclude && (positiveExclude || hasCliOption(args, "--exclude"))) {
    throw new Error("--exclude and --no-exclude cannot be used together.");
  }

  const includePatterns = noInclude
    ? []
    : Array.isArray(options.include)
      ? options.include
      : crawl.includePatterns;
  const excludePatterns = noExclude
    ? []
    : Array.isArray(options.exclude)
      ? options.exclude
      : crawl.excludePatterns;
  if (
    options.urlFile !== undefined &&
    ((includePatterns?.length ?? 0) > 0 || (excludePatterns?.length ?? 0) > 0)
  ) {
    throw new Error(
      "--include and --exclude cannot be used with --url-file because the manifest is exact; configured URL filters are active. Use --no-include and --no-exclude to clear them.",
    );
  }

  const urlPaths =
    options.urlFile === undefined
      ? undefined
      : parseUrlManifest(
          await readUrlManifest(
            options.urlFile === "-"
              ? options.urlFile
              : path.resolve(cwd, options.urlFile),
          ),
          baseUrl,
          options.urlFile === "-"
            ? "stdin"
            : path.resolve(cwd, options.urlFile),
        );

  if (urlPaths?.issues.length) {
    throw new Error(formatManifestIssues(urlPaths.issues));
  }

  const maxDepth = parseInteger(
    options.depth,
    crawl.maxDepth ?? DEFAULT_MAX_DEPTH,
    "Depth",
    0,
  );
  const maxConcurrency = parseInteger(
    options.concurrency,
    crawl.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
    "Concurrency",
    1,
  );

  const config: SnapshotConfig = {
    baseUrl,
    name:
      options.name ??
      `snapshot_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace(/T/, "_")
        .replace(/Z$/, "Z")}`,
    crawlSettings: {
      baseUrl,
      crawlerType: resolveCrawlerType(options.type, crawl.crawlerType),
      maxDepth,
      maxConcurrency,
      includePatterns,
      excludePatterns,
    },
    urlPaths: urlPaths?.paths,
    urlListPath:
      options.writeUrls === undefined
        ? undefined
        : path.resolve(cwd, options.writeUrls),
  };

  return { config, storageDir: projectConfig.storageDir };
}

export const snapshotCommand = addConfigOptions(
  new InteractiveCommand("snapshot")
    .description("Create a snapshot of a website")
    .option("-u, --url <url>", "Base URL to crawl")
    .option("-n, --name <name>", "Name for the snapshot")
    .option("-d, --depth <number>", "Maximum crawl depth")
    .option("-c, --concurrency <number>", "Number of concurrent requests")
    .option("-i, --include <patterns...>", "URL patterns to include")
    .option("-e, --exclude <patterns...>", "URL patterns to exclude")
    .option("--no-include", "Clear configured include patterns")
    .option("--no-exclude", "Clear configured exclude patterns")
    .option("-t, --type <type>", "Crawler type (cheerio or playwright)")
    .option(
      "-w, --write-urls <path>",
      "Generate a URL list file at the specified path",
    )
    .option(
      "--url-file <path>",
      "Read an exact root-relative URL manifest from a file, or '-' for stdin",
    )
    .option("--json-logs", "Output logs in JSON format")
    .option("--no-json-logs", "Output logs in pretty format (default)")
    .action(async (options) => {
      // Configure logger based on options
      const logger = configureLogger(options);

      try {
        const invocation = await buildSnapshotInvocation(options);

        // Call API to create snapshot
        const result: SnapshotResult = await createSnapshotFromConfig(
          invocation.config,
          { storageDir: invocation.storageDir },
        );

        // Display results
        if (result.status === "success") {
          logger.info(`✅ Snapshot created successfully: ${result.snapshotId}`);
          logger.info(`📊 Pages crawled: ${result.pageCount}`);
          logger.info(`⏱️ Duration: ${result.metadata.durationMs}ms`);

          if (result.errors.length > 0) {
            logger.warn("\n⚠️ Some pages had errors:");
            (result.errors as CrawlError[]).forEach((error) => {
              logger.warn(`  - ${error.url}: ${error.message}`);
            });
          }

          if (result.urlListPath) {
            logger.info(`\n📝 URL list generated: ${result.urlListPath}`);
          }
        } else {
          logger.error("❌ Failed to create snapshot");
          result.errors.forEach(
            (error: { statusCode?: number; message: string }) => {
              logger.error(`  - ${error.message}`);
            },
          );
        }
      } catch (error) {
        logger.error({ err: error }, "❌ Error creating snapshot");
        process.exit(1);
      }
    }),
);

function formatManifestIssues(
  issues: ReturnType<typeof parseUrlManifest>["issues"],
): string {
  return issues
    .map((issue) => {
      if (issue.type === "entry") {
        return `${issue.source}:${issue.line}: ${issue.message} (${issue.value})`;
      }

      return `${issue.source}: ${issue.message}`;
    })
    .join("\n");
}
