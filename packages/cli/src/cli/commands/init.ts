import {
  resolveProjectConfig,
  writeProjectConfig,
  type ProjectConfig,
  type ProjectCrawlConfig,
} from "@cleaver/breakcheck-core";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { InteractiveCommand } from "interactive-commander";
import { configureLogger } from "../utils.js";

export interface InitCommandOptions {
  config?: string;
  url?: string;
  storageDir?: string;
  rules?: string;
  interactive?: boolean;
  type?: string;
  depth?: string;
  concurrency?: string;
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}

export interface InitPromptAdapter {
  isInteractive: boolean;
  ask: (question: string) => Promise<string>;
}

export interface InitResult {
  configPath: string;
  storageDir: string;
  config: ProjectConfig;
}

const DEFAULT_CRAWLER_TYPE = "cheerio" as const;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_CONCURRENCY = 5;

function createDefaultPrompts(): InitPromptAdapter {
  const isInteractive = Boolean(stdin.isTTY && stdout.isTTY);

  return {
    isInteractive,
    ask: async (question) => {
      const readline = createInterface({ input: stdin, output: stdout });
      try {
        return await readline.question(question);
      } finally {
        readline.close();
      }
    },
  };
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  field: string,
  minimum: number,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(
      `${field} must be an integer greater than or equal to ${minimum}.`,
    );
  }
  return parsed;
}

function validateCrawlerType(
  value: string | undefined,
): "cheerio" | "playwright" {
  const crawlerType = value ?? DEFAULT_CRAWLER_TYPE;
  if (crawlerType !== "cheerio" && crawlerType !== "playwright") {
    throw new Error('Crawler type must be either "cheerio" or "playwright".');
  }
  return crawlerType;
}

function validateBaseUrl(value: string | undefined): void {
  if (value === undefined) return;
  const parsed = new URL(value);
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !parsed.hostname
  ) {
    throw new Error("Base URL must be a valid HTTP(S) URL.");
  }
}

function relativeConfigPath(destination: string, target: string): string {
  const relative = path.relative(
    path.dirname(destination),
    path.resolve(target),
  );
  return relative === "" ? "." : relative;
}

function validateOptionalPath(value: string | undefined, field: string): void {
  if (value !== undefined && value.trim().length === 0) {
    throw new Error(`${field} must not be empty.`);
  }
}

function optionFromArgs(
  args: readonly string[],
  option: string,
): string | undefined {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === option) return args[index + 1];
    if (argument.startsWith(`${option}=`)) {
      return argument.slice(option.length + 1);
    }
  }
  return undefined;
}

async function collectInteractiveOptions(
  options: InitCommandOptions,
  prompts: InitPromptAdapter,
): Promise<InitCommandOptions> {
  if (!prompts.isInteractive) {
    throw new Error("--interactive requires a terminal.");
  }

  const askOptional = async (
    value: string | undefined,
    question: string,
  ): Promise<string | undefined> => {
    if (value !== undefined) return value;
    const answer = (await prompts.ask(question)).trim();
    return answer === "" ? undefined : answer;
  };

  const askDefault = async (
    value: string | undefined,
    question: string,
    fallback: string,
  ): Promise<string> => {
    if (value !== undefined) return value;
    const answer = (await prompts.ask(question)).trim();
    return answer === "" ? fallback : answer;
  };

  let url = await askOptional(
    options.url,
    "Base URL (optional; press Enter to skip): ",
  );
  if (options.url !== undefined) {
    validateBaseUrl(url);
  } else {
    while (url !== undefined) {
      try {
        validateBaseUrl(url);
        break;
      } catch {
        url = await askOptional(
          undefined,
          "Invalid URL. Base URL (optional; press Enter to skip): ",
        );
      }
    }
  }

  const storageDir = await askOptional(
    options.storageDir,
    "Storage directory (optional; press Enter to keep legacy storage): ",
  );
  const rules = await askOptional(
    options.rules,
    "Rules directory (optional; press Enter to skip): ",
  );

  let type = await askDefault(
    options.type,
    "Crawler type (cheerio or playwright) [cheerio]: ",
    DEFAULT_CRAWLER_TYPE,
  );
  if (options.type !== undefined) {
    validateCrawlerType(type);
  } else {
    while (true) {
      try {
        validateCrawlerType(type);
        break;
      } catch {
        type = await askDefault(
          undefined,
          "Invalid crawler type. Crawler type (cheerio or playwright) [cheerio]: ",
          DEFAULT_CRAWLER_TYPE,
        );
      }
    }
  }

  let depth = await askDefault(options.depth, "Maximum crawl depth [3]: ", "3");
  if (options.depth !== undefined) {
    parseInteger(depth, DEFAULT_MAX_DEPTH, "Depth", 0);
  } else {
    while (true) {
      try {
        parseInteger(depth, DEFAULT_MAX_DEPTH, "Depth", 0);
        break;
      } catch {
        depth = await askDefault(
          undefined,
          "Invalid depth. Maximum crawl depth [3]: ",
          "3",
        );
      }
    }
  }

  let concurrency = await askDefault(
    options.concurrency,
    "Maximum concurrency [5]: ",
    "5",
  );
  if (options.concurrency !== undefined) {
    parseInteger(concurrency, DEFAULT_MAX_CONCURRENCY, "Concurrency", 1);
  } else {
    while (true) {
      try {
        parseInteger(concurrency, DEFAULT_MAX_CONCURRENCY, "Concurrency", 1);
        break;
      } catch {
        concurrency = await askDefault(
          undefined,
          "Invalid concurrency. Maximum concurrency [5]: ",
          "5",
        );
      }
    }
  }

  return {
    ...options,
    url,
    storageDir,
    rules,
    type,
    depth,
    concurrency,
  };
}

/** Builds and writes a new project configuration. */
export async function runInit(
  options: InitCommandOptions,
  cwd: string = process.cwd(),
  prompts: InitPromptAdapter = createDefaultPrompts(),
  args: readonly string[] = process.argv.slice(2),
): Promise<InitResult> {
  const effectiveOptions = options.interactive
    ? await collectInteractiveOptions(options, prompts)
    : options;
  const absoluteCwd = path.resolve(cwd);
  const destination = path.resolve(
    absoluteCwd,
    effectiveOptions.config ??
      optionFromArgs(args, "--config") ??
      "breakcheck.config.json",
  );

  const legacyConfig = await resolveProjectConfig({
    cwd: absoluteCwd,
    noConfig: true,
  });
  validateOptionalPath(effectiveOptions.storageDir, "--storage-dir");
  validateOptionalPath(effectiveOptions.rules, "--rules");
  const storageDir = path.resolve(
    absoluteCwd,
    effectiveOptions.storageDir ?? legacyConfig.storageDir,
  );
  const crawl: ProjectCrawlConfig = {
    crawlerType: validateCrawlerType(effectiveOptions.type),
    maxDepth: parseInteger(
      effectiveOptions.depth,
      DEFAULT_MAX_DEPTH,
      "Depth",
      0,
    ),
    maxConcurrency: parseInteger(
      effectiveOptions.concurrency,
      DEFAULT_MAX_CONCURRENCY,
      "Concurrency",
      1,
    ),
    includePatterns: [],
    excludePatterns: [],
  };

  const config: ProjectConfig = {
    version: 1,
    ...(effectiveOptions.url === undefined
      ? {}
      : { baseUrl: effectiveOptions.url }),
    storageDir: relativeConfigPath(destination, storageDir),
    crawl,
    ...(effectiveOptions.rules === undefined
      ? {}
      : {
          comparison: {
            rulesDir: relativeConfigPath(
              destination,
              path.resolve(absoluteCwd, effectiveOptions.rules),
            ),
          },
        }),
  };

  await writeProjectConfig(destination, config);
  return { configPath: destination, storageDir, config };
}

export const initCommand = new InteractiveCommand("init")
  .description("Create a breakcheck.config.json project configuration")
  .option("-u, --url <url>", "Default base URL to crawl")
  .option(
    "--storage-dir <directory>",
    "Artifact directory for snapshots and comparisons",
  )
  .option(
    "-r, --rules <directory>",
    "Default directory containing rules.breakcheck",
  )
  .option("--config <destination-file>", "Destination configuration file")
  .option("--interactive", "Prompt for omitted configuration values")
  .option("-d, --depth <number>", "Default maximum crawl depth")
  .option("-c, --concurrency <number>", "Default concurrent requests")
  .option("-t, --type <type>", "Default crawler type (cheerio or playwright)")
  .option("--json-logs", "Output logs in JSON format")
  .option("--no-json-logs", "Output logs in pretty format (default)")
  .action(async (options: InitCommandOptions) => {
    const logger = configureLogger(options);
    try {
      const result = await runInit(options);
      logger.info(`✅ Created configuration: ${result.configPath}`);
      logger.info(`📦 Artifact storage: ${result.storageDir}`);
      logger.info(
        `Next: breakcheck snapshot${result.config.baseUrl ? "" : " --url <url>"}`,
      );
    } catch (error) {
      logger.error({ err: error }, "❌ Error creating configuration");
      process.exit(1);
    }
  });
