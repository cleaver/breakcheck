import { runComparison } from "@api/index";
import type { ComparisonConfig } from "@project-types/api";
import { InteractiveCommand } from "interactive-commander";
import pino from "pino";
const logger = pino({ transport: { target: "pino-pretty" } });

export const compareCommand = new InteractiveCommand("compare")
  .description("Compare two snapshots and save the results to disk")
  .requiredOption("-b, --before <name>", 'Name of the "before" snapshot')
  .requiredOption("-a, --after <name>", 'Name of the "after" snapshot')
  .option(
    "-o, --output <name>",
    "Name for the comparison output directory",
    "compare_default"
  )
  .option(
    "-r, --rules <path>",
    "Path to rules file (feature to be implemented)"
  )
  .action(async (options) => {
    try {
      const comparisonName =
        options.output || `compare_${options.before}_vs_${options.after}`;

      const config: ComparisonConfig = {
        beforeSnapshotId: options.before,
        afterSnapshotId: options.after,
        comparisonName, // Pass the name to the config
        ruleset: options.rules,
      };

      logger.info(
        `🚀 Starting comparison: ${options.before} vs ${options.after}`
      );
      const summary = await runComparison(config); // API call

      if (summary.status === "completed") {
        logger.info("✅ Comparison complete!");
        logger.info(`   - Results saved to: ${summary.resultsPath}`);
        logger.info(`   - Total pages compared: ${summary.totalPagesCompared}`);
        logger.info(
          `   - Pages with differences: ${summary.pagesWithDifferences}`
        );
        logger.info(`   - New URLs: ${summary.newUrls.length}`);
        logger.info(`   - Removed URLs: ${summary.removedUrls.length}`);
        logger.info(
          `   - Overall result: ${summary.overallResult.toUpperCase()}`
        );
      } else {
        logger.error(
          "❌ Comparison failed:",
          summary.comparisonProcessErrors.map((error) => error.message)
        );
      }
    } catch (error) {
      logger.error(
        "❌ Error:",
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      process.exit(1);
    }
  });
