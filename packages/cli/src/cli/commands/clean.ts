import {
  deleteAllComparisons,
  deleteAllSnapshots,
  deleteComparison,
  deleteSnapshot,
} from "@cleaver/breakcheck-core";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { InteractiveCommand } from "interactive-commander";
import { addConfigOptions, resolveCliProjectConfig } from "../config.js";
import { configureLogger } from "../utils.js";

export type CleanTarget = "snapshot" | "comparison";

export interface CleanOptions {
  all?: boolean;
  force?: boolean;
  jsonLogs?: boolean;
  name?: string;
  noJsonLogs?: boolean;
}

export interface CleanResult {
  cancelled: boolean;
  deletedNames: string[];
  target: CleanTarget;
}

export interface CleanOperations {
  deleteAll: () => Promise<string[]>;
  deleteOne: (name: string) => Promise<boolean>;
}

export interface CleanPrompts {
  confirm: (question: string) => Promise<boolean>;
  isInteractive: boolean;
  promptName: (target: CleanTarget) => Promise<string>;
}

function createCleanOperations(
  storageDir?: string,
): Record<CleanTarget, CleanOperations> {
  const options = { storageDir };
  return {
    snapshot: {
      deleteAll: () => deleteAllSnapshots(options),
      deleteOne: (name) => deleteSnapshot(name, options),
    },
    comparison: {
      deleteAll: () => deleteAllComparisons(options),
      deleteOne: (name) => deleteComparison(name, options),
    },
  };
}

const cleanOperations = createCleanOperations();

function targetLabel(target: CleanTarget): string {
  return target === "snapshot" ? "snapshot" : "comparison";
}

function targetPluralLabel(target: CleanTarget): string {
  return `${targetLabel(target)}s`;
}

function createDefaultPrompts(): CleanPrompts {
  const isInteractive = Boolean(stdin.isTTY && stdout.isTTY);

  async function ask(question: string): Promise<string> {
    const readline = createInterface({ input: stdin, output: stdout });
    try {
      return await readline.question(question);
    } finally {
      readline.close();
    }
  }

  return {
    isInteractive,
    promptName: async (target) =>
      ask(`Name of the ${targetLabel(target)} to delete: `),
    confirm: async (question) => {
      const answer = (await ask(`${question} [y/N] `)).trim().toLowerCase();
      return answer === "y" || answer === "yes";
    },
  };
}

export async function executeClean(
  target: CleanTarget,
  options: CleanOptions,
  operations: CleanOperations = cleanOperations[target],
  prompts: CleanPrompts = createDefaultPrompts(),
): Promise<CleanResult> {
  const hasName = options.name !== undefined;
  const hasAll = options.all === true;

  if (hasName && options.name?.trim().length === 0) {
    throw new Error("--name must not be empty.");
  }
  if (hasName && hasAll) {
    throw new Error("--name and --all cannot be used together.");
  }
  if (!hasName && !hasAll) {
    if (options.force || !prompts.isInteractive) {
      throw new Error(
        "Provide --name <name> or --all; interactive prompting requires a terminal.",
      );
    }

    const promptedName = (await prompts.promptName(target)).trim();
    if (promptedName.length === 0) {
      throw new Error("A name is required to clean a single artifact.");
    }
    options = { ...options, name: promptedName };
  }

  if (!options.force && !prompts.isInteractive) {
    throw new Error(
      "Confirmation requires a terminal; rerun with --force for non-interactive use.",
    );
  }

  const name = options.name?.trim();
  const subject = hasAll
    ? `all ${targetPluralLabel(target)}`
    : `${targetLabel(target)} "${name}"`;

  if (!options.force && !(await prompts.confirm(`Delete ${subject}?`))) {
    return { cancelled: true, deletedNames: [], target };
  }

  if (hasAll) {
    return {
      cancelled: false,
      deletedNames: await operations.deleteAll(),
      target,
    };
  }

  if (name === undefined) {
    throw new Error("A name is required to clean a single artifact.");
  }

  if (!(await operations.deleteOne(name))) {
    throw new Error(`No ${targetLabel(target)} named "${name}" was found.`);
  }

  return { cancelled: false, deletedNames: [name], target };
}

function createCleanSubcommand(target: CleanTarget): InteractiveCommand {
  return addConfigOptions(
    new InteractiveCommand(target)
      .description(`Delete stored ${targetPluralLabel(target)}`)
      .option("--name <name>", `Name of the ${targetLabel(target)} to delete`)
      .option("--all", `Delete all stored ${targetPluralLabel(target)}`)
      .option("--force", "Skip confirmation; required for non-interactive use")
      .option("--json-logs", "Output logs in JSON format")
      .option("--no-json-logs", "Output logs in pretty format (default)")
      .action(async (options: CleanOptions) => {
        const logger = configureLogger(options);

        try {
          const projectConfig = await resolveCliProjectConfig();
          const result = await executeClean(
            target,
            options,
            createCleanOperations(projectConfig.storageDir)[target],
          );
          if (result.cancelled) {
            logger.info(`Cleaning ${targetPluralLabel(target)} cancelled.`);
            return;
          }

          if (result.deletedNames.length === 0) {
            logger.info(`No ${targetPluralLabel(target)} found.`);
            return;
          }

          logger.info(
            `✅ Deleted ${result.deletedNames.length} ${targetPluralLabel(target)}: ${result.deletedNames.join(", ")}`,
          );
        } catch (error) {
          logger.error(
            { err: error },
            `❌ Error cleaning ${targetPluralLabel(target)}`,
          );
          process.exit(1);
        }
      }),
  );
}

export const cleanCommand = addConfigOptions(
  new InteractiveCommand("clean").description(
    "Delete stored snapshots or comparisons",
  ),
);

cleanCommand.addCommand(createCleanSubcommand("snapshot"));
cleanCommand.addCommand(createCleanSubcommand("comparison"));
