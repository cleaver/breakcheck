import type { ComparisonConfig } from "@cleaver/breakcheck-core";
import { runComparison } from "@cleaver/breakcheck-core";
import { InteractiveCommand } from "interactive-commander";
import path from "node:path";
import {
  addConfigOptions,
  hasCliFlag,
  hasCliOption,
  resolveCliProjectConfig,
} from "../config.js";
import { configureLogger } from "../utils.js";

interface CompareCommandOptions {
  before: string;
  after: string;
  output?: string;
  rules?: string | false;
  noRules?: boolean;
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}

export const compareCommand = addConfigOptions(
  new InteractiveCommand("compare")
    .description("Compare two snapshots and save the results to disk")
    .requiredOption("-b, --before <name>", 'Name of the "before" snapshot')
    .requiredOption("-a, --after <name>", 'Name of the "after" snapshot')
    .option("-o, --output <name>", "Name for the comparison output directory")
    .option(
      "-r, --rules <directory>",
      "Directory containing rules.breakcheck (relative to the current working directory)",
    )
    .option("--no-rules", "Clear configured comparison rules")
    .option("--json-logs", "Output logs in JSON format")
    .option("--no-json-logs", "Output logs in pretty format (default)")
    .action(async (options: CompareCommandOptions) => {
      // Configure logger based on options
      const logger = configureLogger(options);

      try {
        const projectConfig = await resolveCliProjectConfig();
        const noRules = options.noRules === true || options.rules === false;
        const hasRules =
          typeof options.rules === "string" ||
          hasCliOption(process.argv.slice(2), "--rules");
        if (
          noRules &&
          (hasRules || hasCliFlag(process.argv.slice(2), "--rules"))
        ) {
          throw new Error("--rules and --no-rules cannot be used together.");
        }
        const comparisonName = options.output || "compare_default";

        const ruleset = noRules
          ? undefined
          : options.rules === undefined || options.rules === false
            ? projectConfig.rulesDir
            : path.resolve(process.cwd(), options.rules);

        const config: ComparisonConfig = {
          beforeSnapshotId: options.before,
          afterSnapshotId: options.after,
          comparisonName, // Pass the name to the config
          ruleset,
        };

        logger.info(
          `🚀 Starting comparison: ${options.before} vs ${options.after}`,
        );
        const summary = await runComparison(config, {
          storageDir: projectConfig.storageDir,
        }); // API call

        if (summary.status === "completed") {
          logger.info("✅ Comparison complete!");
          logger.info(`   - Results saved to: ${summary.resultsPath}`);
          logger.info(
            `   - Total pages compared: ${summary.totalPagesCompared}`,
          );
          logger.info(
            `   - Pages with differences: ${summary.pagesWithDifferences}`,
          );
          logger.info(`   - New URLs: ${summary.newUrls.length}`);
          logger.info(`   - Removed URLs: ${summary.removedUrls.length}`);
          logger.info(
            `   - Overall result: ${summary.overallResult.toUpperCase()}`,
          );
        } else {
          logger.error(
            { errors: summary.comparisonProcessErrors },
            "❌ Comparison failed",
          );
        }
      } catch (error) {
        logger.error({ err: error }, "❌ Error running comparison");
        process.exit(1);
      }
    }),
);
