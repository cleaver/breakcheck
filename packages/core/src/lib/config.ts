import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findRootDir } from "./root.js";
import type {
  LoadedProjectConfig,
  ProjectComparisonConfig,
  ProjectConfig,
  ProjectConfigLoadOptions,
  ProjectCrawlConfig,
  ResolvedProjectConfig,
} from "../types/config.js";

export const PROJECT_CONFIG_FILENAME = "breakcheck.config.json";
export const PROJECT_CONFIG_VERSION = 1 as const;

type ConfigObject = Record<string, unknown>;

function isRecord(value: unknown): value is ConfigObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sourceLabel(sourcePath: string | undefined): string {
  return sourcePath ? ` in ${sourcePath}` : "";
}

function invalidConfig(
  message: string,
  sourcePath?: string,
  cause?: unknown,
): Error {
  return new Error(
    `Invalid Breakcheck configuration${sourceLabel(sourcePath)}: ${message}`,
    {
      cause,
    },
  );
}

function assertKnownKeys(
  value: ConfigObject,
  allowed: readonly string[],
  context: string,
  sourcePath?: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw invalidConfig(
      `${context} contains unsupported field(s): ${unknown.join(", ")}.`,
      sourcePath,
    );
  }
}

function requiredString(
  value: unknown,
  field: string,
  sourcePath?: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidConfig(`${field} must be a non-empty string.`, sourcePath);
  }
  return value;
}

function optionalString(
  value: unknown,
  field: string,
  sourcePath?: string,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field, sourcePath);
}

function validateBaseUrl(value: unknown, sourcePath?: string): string {
  const baseUrl = requiredString(value, "baseUrl", sourcePath);
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch (error) {
    throw invalidConfig(
      `baseUrl must be a valid HTTP(S) URL.`,
      sourcePath,
      error,
    );
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname
  ) {
    throw invalidConfig(`baseUrl must be a valid HTTP(S) URL.`, sourcePath);
  }

  return baseUrl;
}

function validateInteger(
  value: unknown,
  field: string,
  minimum: number,
  sourcePath?: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum
  ) {
    throw invalidConfig(
      `${field} must be an integer greater than or equal to ${minimum}.`,
      sourcePath,
    );
  }
  return value;
}

function validateStringArray(
  value: unknown,
  field: string,
  sourcePath?: string,
): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw invalidConfig(`${field} must be an array of strings.`, sourcePath);
  }
  return [...value];
}

function validateCrawlConfig(
  value: unknown,
  sourcePath?: string,
): ProjectCrawlConfig | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw invalidConfig("crawl must be an object.", sourcePath);
  }
  assertKnownKeys(
    value,
    [
      "crawlerType",
      "maxDepth",
      "maxConcurrency",
      "includePatterns",
      "excludePatterns",
    ],
    "crawl",
    sourcePath,
  );

  const crawlerType = value.crawlerType;
  if (
    crawlerType !== undefined &&
    crawlerType !== "cheerio" &&
    crawlerType !== "playwright"
  ) {
    throw invalidConfig(
      `crawl.crawlerType must be either "cheerio" or "playwright".`,
      sourcePath,
    );
  }

  return {
    ...(crawlerType === undefined ? {} : { crawlerType }),
    ...(value.maxDepth === undefined
      ? {}
      : {
          maxDepth: validateInteger(
            value.maxDepth,
            "crawl.maxDepth",
            0,
            sourcePath,
          ),
        }),
    ...(value.maxConcurrency === undefined
      ? {}
      : {
          maxConcurrency: validateInteger(
            value.maxConcurrency,
            "crawl.maxConcurrency",
            1,
            sourcePath,
          ),
        }),
    ...(value.includePatterns === undefined
      ? {}
      : {
          includePatterns: validateStringArray(
            value.includePatterns,
            "crawl.includePatterns",
            sourcePath,
          ),
        }),
    ...(value.excludePatterns === undefined
      ? {}
      : {
          excludePatterns: validateStringArray(
            value.excludePatterns,
            "crawl.excludePatterns",
            sourcePath,
          ),
        }),
  };
}

function validateComparisonConfig(
  value: unknown,
  sourcePath?: string,
): ProjectComparisonConfig | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw invalidConfig("comparison must be an object.", sourcePath);
  }
  assertKnownKeys(value, ["rulesDir"], "comparison", sourcePath);

  const rulesDir = optionalString(
    value.rulesDir,
    "comparison.rulesDir",
    sourcePath,
  );
  return rulesDir === undefined ? {} : { rulesDir };
}

/** Validates and normalizes an in-memory project configuration. */
export function validateProjectConfig(
  value: unknown,
  sourcePath?: string,
): ProjectConfig {
  if (!isRecord(value)) {
    throw invalidConfig("the root value must be an object.", sourcePath);
  }
  assertKnownKeys(
    value,
    ["version", "baseUrl", "storageDir", "crawl", "comparison"],
    "the root object",
    sourcePath,
  );

  if (value.version !== PROJECT_CONFIG_VERSION) {
    throw invalidConfig(
      `version must be ${PROJECT_CONFIG_VERSION}.`,
      sourcePath,
    );
  }

  const config: ProjectConfig = { version: PROJECT_CONFIG_VERSION };
  if (value.baseUrl !== undefined) {
    config.baseUrl = validateBaseUrl(value.baseUrl, sourcePath);
  }
  if (value.storageDir !== undefined) {
    config.storageDir = requiredString(
      value.storageDir,
      "storageDir",
      sourcePath,
    );
  }

  const crawl = validateCrawlConfig(value.crawl, sourcePath);
  if (crawl !== undefined) config.crawl = crawl;

  const comparison = validateComparisonConfig(value.comparison, sourcePath);
  if (comparison !== undefined) config.comparison = comparison;

  return config;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/** Finds the nearest project configuration at or above `cwd`. */
export async function findProjectConfig(
  cwd: string = process.cwd(),
): Promise<string | undefined> {
  let directory = path.resolve(cwd);
  while (true) {
    const candidate = path.join(directory, PROJECT_CONFIG_FILENAME);
    if (await pathExists(candidate)) return candidate;

    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/** Loads exactly one selected or discovered project configuration. */
export async function loadProjectConfig(
  options: ProjectConfigLoadOptions = {},
): Promise<LoadedProjectConfig | undefined> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (options.configPath !== undefined && options.noConfig) {
    throw new Error("--config and --no-config cannot be used together.");
  }
  if (options.noConfig) return undefined;

  if (
    options.configPath !== undefined &&
    options.configPath.trim().length === 0
  ) {
    throw new Error("--config requires a file path.");
  }

  const configPath =
    options.configPath !== undefined
      ? path.resolve(cwd, options.configPath)
      : await findProjectConfig(cwd);
  if (configPath === undefined) return undefined;

  let content: string;
  try {
    content = await readFile(configPath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read Breakcheck configuration ${configPath}.`, {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    throw invalidConfig("file is not valid JSON.", configPath, error);
  }

  return {
    configPath,
    config: validateProjectConfig(parsed, configPath),
  };
}

/**
 * Loads configuration and resolves all configured filesystem paths. When no
 * storage directory is configured, the legacy project-root behavior remains.
 */
export async function resolveProjectConfig(
  options: ProjectConfigLoadOptions = {},
): Promise<ResolvedProjectConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const loaded = await loadProjectConfig({ ...options, cwd });
  const config = loaded?.config;
  const configDirectory = loaded ? path.dirname(loaded.configPath) : cwd;
  const storageDir =
    config?.storageDir === undefined
      ? await findRootDir(cwd)
      : path.resolve(configDirectory, config.storageDir);

  return {
    ...(loaded ? { configPath: loaded.configPath } : {}),
    storageDir: path.resolve(storageDir),
    ...(config?.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
    crawl: { ...(config?.crawl ?? {}) },
    ...(config?.comparison?.rulesDir === undefined
      ? {}
      : {
          rulesDir: path.resolve(configDirectory, config.comparison.rulesDir),
        }),
  };
}

/** Serializes a validated project configuration with stable formatting. */
export function serializeProjectConfig(config: ProjectConfig): string {
  return `${JSON.stringify(validateProjectConfig(config), null, 2)}\n`;
}

/** Creates a project configuration without overwriting an existing path. */
export async function writeProjectConfig(
  configPath: string,
  config: ProjectConfig,
): Promise<void> {
  const absolutePath = path.resolve(configPath);
  await writeFile(absolutePath, serializeProjectConfig(config), {
    encoding: "utf8",
    flag: "wx",
  });
}
