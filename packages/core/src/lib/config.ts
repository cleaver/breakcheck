import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findRootDir } from "./root.js";
import type {
  LoadedProjectConfig,
  ProjectComparisonConfig,
  ProjectCheckConfig,
  ProjectCheckServerConfig,
  ProjectCommand,
  ProjectConfig,
  ProjectConfigLoadOptions,
  ProjectCrawlConfig,
  ResolvedProjectConfig,
  ResolvedProjectCheckConfig,
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

function validateCommand(
  value: unknown,
  field: string,
  sourcePath?: string,
): ProjectCommand {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((argument) => typeof argument !== "string") ||
    typeof value[0] !== "string" ||
    value[0].trim().length === 0
  ) {
    throw invalidConfig(
      `${field} must be a non-empty array of strings.`,
      sourcePath,
    );
  }
  const command: string[] = [];
  for (const argument of value) {
    if (typeof argument !== "string") {
      throw invalidConfig(
        `${field} must be a non-empty array of strings.`,
        sourcePath,
      );
    }
    command.push(argument);
  }
  return command;
}

function validateCommandList(
  value: unknown,
  field: string,
  sourcePath?: string,
): ProjectCommand[] {
  if (!Array.isArray(value)) {
    throw invalidConfig(
      `${field} must be an array of command arrays.`,
      sourcePath,
    );
  }
  return value.map((command, index) =>
    validateCommand(command, `${field}[${index}]`, sourcePath),
  );
}

function validateEnvironment(
  value: unknown,
  sourcePath?: string,
): Record<string, string> {
  if (!isRecord(value)) {
    throw invalidConfig(
      "check.server.env must be an object of strings.",
      sourcePath,
    );
  }
  const environment: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof entry !== "string") {
      throw invalidConfig(
        "check.server.env keys must be environment variable names and values must be strings.",
        sourcePath,
      );
    }
    environment[key] = entry;
  }
  return environment;
}

function validateCheckServerConfig(
  value: unknown,
  sourcePath?: string,
): ProjectCheckServerConfig {
  if (!isRecord(value)) {
    throw invalidConfig("check.server must be an object.", sourcePath);
  }
  assertKnownKeys(
    value,
    ["start", "stop", "cwd", "env", "readyPath", "timeoutMs"],
    "check.server",
    sourcePath,
  );
  const readyPath = optionalString(
    value.readyPath,
    "check.server.readyPath",
    sourcePath,
  );
  if (
    readyPath !== undefined &&
    (!readyPath.startsWith("/") || readyPath.startsWith("//"))
  ) {
    throw invalidConfig(
      "check.server.readyPath must be a root-relative path beginning with one slash.",
      sourcePath,
    );
  }
  return {
    start: validateCommand(value.start, "check.server.start", sourcePath),
    ...(value.stop === undefined
      ? {}
      : { stop: validateCommand(value.stop, "check.server.stop", sourcePath) }),
    ...(value.cwd === undefined
      ? {}
      : { cwd: requiredString(value.cwd, "check.server.cwd", sourcePath) }),
    ...(value.env === undefined
      ? {}
      : { env: validateEnvironment(value.env, sourcePath) }),
    ...(readyPath === undefined ? {} : { readyPath }),
    ...(value.timeoutMs === undefined
      ? {}
      : {
          timeoutMs: validateInteger(
            value.timeoutMs,
            "check.server.timeoutMs",
            1,
            sourcePath,
          ),
        }),
  };
}

function validateCheckConfig(
  value: unknown,
  sourcePath?: string,
): ProjectCheckConfig | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw invalidConfig("check must be an object.", sourcePath);
  }
  assertKnownKeys(
    value,
    ["routesFile", "baselineSnapshot", "prepare", "server", "reportDir"],
    "check",
    sourcePath,
  );
  const prepare =
    value.prepare === undefined
      ? undefined
      : validateCommandList(value.prepare, "check.prepare", sourcePath);
  const server =
    value.server === undefined
      ? undefined
      : validateCheckServerConfig(value.server, sourcePath);
  const reportDir = optionalString(
    value.reportDir,
    "check.reportDir",
    sourcePath,
  );
  return {
    routesFile: requiredString(
      value.routesFile,
      "check.routesFile",
      sourcePath,
    ),
    baselineSnapshot: requiredString(
      value.baselineSnapshot,
      "check.baselineSnapshot",
      sourcePath,
    ),
    ...(prepare === undefined ? {} : { prepare }),
    ...(server === undefined ? {} : { server }),
    ...(reportDir === undefined ? {} : { reportDir }),
  };
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
  if (value.version !== 1 && value.version !== 2) {
    throw invalidConfig("version must be 1 or 2.", sourcePath);
  }
  assertKnownKeys(
    value,
    value.version === 1
      ? ["version", "baseUrl", "storageDir", "crawl", "comparison"]
      : ["version", "baseUrl", "storageDir", "crawl", "comparison", "check"],
    "the root object",
    sourcePath,
  );

  const config: ProjectConfig = { version: value.version };
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

  const check = validateCheckConfig(value.check, sourcePath);
  if (check !== undefined) {
    if (value.version !== 2) {
      throw invalidConfig(
        "check settings require configuration version 2.",
        sourcePath,
      );
    }
    config.check = check;
  }

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

  let check: ResolvedProjectCheckConfig | undefined;
  if (config?.check) {
    const server = config.check.server;
    check = {
      configDirectory,
      routesFile: path.resolve(configDirectory, config.check.routesFile),
      baselineSnapshot: config.check.baselineSnapshot,
      prepare: config.check.prepare,
      reportDir: path.resolve(
        configDirectory,
        config.check.reportDir ?? path.join(storageDir, "reports"),
      ),
      ...(server === undefined
        ? {}
        : {
            server: {
              start: server.start,
              ...(server.stop === undefined ? {} : { stop: server.stop }),
              ...(server.env === undefined ? {} : { env: server.env }),
              ...(server.readyPath === undefined
                ? {}
                : { readyPath: server.readyPath }),
              ...(server.timeoutMs === undefined
                ? {}
                : { timeoutMs: server.timeoutMs }),
              cwd: path.resolve(configDirectory, server.cwd ?? "."),
            },
          }),
    };
  }

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
    ...(check === undefined ? {} : { check }),
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
