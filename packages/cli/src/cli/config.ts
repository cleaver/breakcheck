import {
  resolveProjectConfig,
  type ProjectCrawlConfig,
  type ResolvedProjectConfig,
} from "@cleaver/breakcheck-core";
import type { InteractiveCommand } from "interactive-commander";

export interface ConfigSelection {
  configPath?: string;
  noConfig?: boolean;
}

export function hasCliFlag(args: readonly string[], flag: string): boolean {
  return args.some((argument) => argument === flag);
}

export function hasCliOption(args: readonly string[], option: string): boolean {
  return args.some(
    (argument) => argument === option || argument.startsWith(`${option}=`),
  );
}

/** Adds configuration-selection flags to a CLI command. */
export function addConfigOptions<T extends InteractiveCommand>(command: T): T {
  command
    .option(
      "--config <file>",
      "Use this configuration file instead of discovering one",
    )
    .option("--no-config", "Disable project configuration discovery");
  return command;
}

/** Reads shared config flags regardless of whether they precede or follow a command. */
export function parseConfigSelection(
  args: readonly string[] = process.argv.slice(2),
): ConfigSelection {
  let configPath: string | undefined;
  let noConfig = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--no-config") {
      noConfig = true;
      continue;
    }
    if (argument === "--config") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("--config requires a file path.");
      }
      configPath = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("--config=")) {
      const value = argument.slice("--config=".length);
      if (value.length === 0) throw new Error("--config requires a file path.");
      configPath = value;
    }
  }

  if (configPath !== undefined && noConfig) {
    throw new Error("--config and --no-config cannot be used together.");
  }

  return {
    ...(configPath === undefined ? {} : { configPath }),
    ...(noConfig ? { noConfig: true } : {}),
  };
}

export async function resolveCliProjectConfig(
  args: readonly string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
): Promise<ResolvedProjectConfig> {
  return resolveProjectConfig({ ...parseConfigSelection(args), cwd });
}

export function mergeCrawlConfig(
  config: ResolvedProjectConfig,
  overrides: Partial<ProjectCrawlConfig>,
): ProjectCrawlConfig {
  return {
    ...config.crawl,
    ...overrides,
  };
}
