import type { SnapshotSummary } from "breakcheck-core";
import { listSnapshots } from "breakcheck-core";
import { InteractiveCommand } from "interactive-commander";
import { configureLogger } from "../utils.js";

export const listSnapshotsCommand = new InteractiveCommand("list-snapshots")
  .description("List all available snapshots")
  .alias("lss")
  .option("--json-logs", "Output logs in JSON format")
  .option("--no-json-logs", "Output logs in pretty format (default)")
  .action(async (options) => {
    // Configure logger based on options
    const logger = configureLogger(options);

    try {
      // Get snapshots
      const snapshots: SnapshotSummary[] = await listSnapshots();

      // Display results
      if (snapshots.length === 0) {
        logger.info("No snapshots found");
        return;
      }

      // Calculate column widths
      const nameWidth = Math.max(
        "Name".length,
        ...snapshots.map((s) => s.name.length)
      );
      const dateWidth = Math.max(
        "Date".length,
        ...snapshots.map((s) => s.date.length)
      );
      const pageCountWidth = Math.max(
        "Pages".length,
        ...snapshots.map((s) => s.pageCount.toString().length)
      );
      const errorCountWidth = Math.max(
        "Errors".length,
        ...snapshots.map((s) => s.errorCount.toString().length)
      );

      // Print header
      logger.info(
        `${"Name".padEnd(nameWidth)} | ${"Date".padEnd(
          dateWidth
        )} | ${"Pages".padEnd(pageCountWidth)} | ${"Errors".padEnd(
          errorCountWidth
        )}`
      );
      logger.info(
        `${"-".repeat(nameWidth)}-+-${"-".repeat(dateWidth)}-+-${"-".repeat(
          pageCountWidth
        )}-+-${"-".repeat(errorCountWidth)}`
      );

      // Print snapshots
      snapshots.forEach((snapshot) => {
        logger.info(
          `${snapshot.name.padEnd(nameWidth)} | ${snapshot.date.padEnd(
            dateWidth
          )} | ${snapshot.pageCount
            .toString()
            .padEnd(pageCountWidth)} | ${snapshot.errorCount
            .toString()
            .padEnd(errorCountWidth)}`
        );
      });
    } catch (error) {
      logger.error({ err: error }, "❌ Error listing snapshots");
      process.exit(1);
    }
  });
