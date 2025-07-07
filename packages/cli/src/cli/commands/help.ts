import { InteractiveCommand } from "interactive-commander";
import { configureLogger } from "../utils.js";

export const helpCommand = new InteractiveCommand("help")
  .description("Show detailed help for a specific command")
  .argument("[command]", "The command to show help for")
  .option("--json-logs", "Output logs in JSON format")
  .option("--no-json-logs", "Output logs in pretty format (default)")
  .action(async (commandName, options) => {
    // Configure logger based on options
    const logger = configureLogger(options);

    try {
      if (!commandName) {
        showGeneralHelp(logger);
        return;
      }

      switch (commandName.toLowerCase()) {
        case "snapshot":
          showSnapshotHelp(logger);
          break;
        case "compare":
          showCompareHelp(logger);
          break;
        case "view":
          showViewHelp(logger);
          break;
        case "list-snapshots":
        case "lss":
          showListSnapshotsHelp(logger);
          break;
        default:
          logger.error(`Unknown command: ${commandName}`);
          logger.info(
            "Available commands: snapshot, compare, view, list-snapshots"
          );
          process.exit(1);
      }
    } catch (error) {
      logger.error({ err: error }, "❌ Error showing help");
      process.exit(1);
    }
  });

function showGeneralHelp(logger: any) {
  logger.info(
    "Breakcheck - A tool for comparing website states before and after changes"
  );
  logger.info("");
  logger.info("Core Workflow:");
  logger.info(
    "  1. 📸 Take a 'before' snapshot: breakcheck snapshot --url <url> --name <name>"
  );
  logger.info("  2. ⚙️ Make your changes (deploy, migrate, etc.)");
  logger.info(
    "  3. 📸 Take an 'after' snapshot: breakcheck snapshot --url <url> --name <name>"
  );
  logger.info(
    "  4. 🔍 Compare the snapshots: breakcheck compare --before <name> --after <name>"
  );
  logger.info("  5. 📊 View the results: breakcheck view <comparison-name>");
  logger.info("");
  logger.info("Available Commands:");
  logger.info("  snapshot        Create a snapshot of a website");
  logger.info("  compare         Compare two snapshots and save the results");
  logger.info(
    "  view            View the results of a comparison in your browser"
  );
  logger.info("  list-snapshots  List all available snapshots");
  logger.info("  help            Show detailed help for a specific command");
  logger.info("");
  logger.info("Global Options:");
  logger.info(
    "  --json-logs     Output logs in JSON format (useful for automation)"
  );
  logger.info(
    "  --no-json-logs  Output logs in pretty format (default, user-friendly)"
  );
  logger.info("");
  logger.info("Examples:");
  logger.info("  breakcheck help snapshot");
  logger.info("  breakcheck help compare");
  logger.info("  breakcheck help view");
  logger.info("");
  logger.info(
    "For more information, visit: https://github.com/your-repo/breakcheck"
  );
}

function showSnapshotHelp(logger: any) {
  logger.info("📸 SNAPSHOT COMMAND");
  logger.info("===================");
  logger.info("");
  logger.info(
    "Crawls a website and saves its HTML content and structure to a named snapshot."
  );
  logger.info("");
  logger.info("Usage:");
  logger.info("  breakcheck snapshot [options]");
  logger.info("");
  logger.info("Required Options:");
  logger.info(
    "  -u, --url <url>             The base URL to start crawling from"
  );
  logger.info("");
  logger.info("Optional Options:");
  logger.info("  -n, --name <name>           A unique name for the snapshot");
  logger.info(
    "                               Default: snapshot_YYYY-MM-DD_HH-mm-ssZ"
  );
  logger.info("  -d, --depth <number>        Maximum crawl depth (default: 3)");
  logger.info(
    "  -c, --concurrency <number>  Number of concurrent requests (default: 5)"
  );
  logger.info(
    "  -i, --include <patterns...> Glob patterns for URLs to include"
  );
  logger.info(
    "  -e, --exclude <patterns...> Glob patterns for URLs to exclude"
  );
  logger.info(
    "  -t, --type <type>           The crawler to use: cheerio or playwright (default: cheerio)"
  );
  logger.info(
    "  -w, --write-urls <path>     Generate a plain text file of all crawled URLs"
  );
  logger.info("  --json-logs                Output logs in JSON format");
  logger.info(
    "  --no-json-logs             Output logs in pretty format (default)"
  );
  logger.info("");
  logger.info("Examples:");
  logger.info("  # Basic snapshot");
  logger.info("  breakcheck snapshot --url https://my-website.com");
  logger.info("");
  logger.info("  # Named snapshot with custom settings");
  logger.info(
    "  breakcheck snapshot --url https://my-website.com --name production-live --depth 5 --concurrency 10"
  );
  logger.info("");
  logger.info("  # Snapshot with URL filtering");
  logger.info(
    "  breakcheck snapshot --url https://my-website.com --include '**/blog/**' --exclude '**/admin/**'"
  );
  logger.info("");
  logger.info("  # Use Playwright crawler for JavaScript-heavy sites");
  logger.info(
    "  breakcheck snapshot --url https://my-website.com --type playwright"
  );
  logger.info("");
  logger.info("  # Generate a URL list file");
  logger.info(
    "  breakcheck snapshot --url https://my-website.com --write-urls ./crawled-urls.txt"
  );
  logger.info("");
  logger.info("  # Use JSON logging for automation");
  logger.info("  breakcheck snapshot --url https://my-website.com --json-logs");
}

function showCompareHelp(logger: any) {
  logger.info("🔍 COMPARE COMMAND");
  logger.info("==================");
  logger.info("");
  logger.info(
    "Compares two snapshots, applies rules, and saves the results to disk."
  );
  logger.info("");
  logger.info("Usage:");
  logger.info("  breakcheck compare [options]");
  logger.info("");
  logger.info("Required Options:");
  logger.info(
    "  -b, --before <name>         The name of the 'before' snapshot"
  );
  logger.info("  -a, --after <name>          The name of the 'after' snapshot");
  logger.info("");
  logger.info("Optional Options:");
  logger.info(
    "  -o, --output <name>         A name for the comparison output directory (default: compare_default)"
  );
  logger.info(
    "  -r, --rules <path>          Path to the directory containing the rules.breakcheck file (default: default)"
  );
  logger.info("  --json-logs                Output logs in JSON format");
  logger.info(
    "  --no-json-logs             Output logs in pretty format (default)"
  );
  logger.info("");
  logger.info("Examples:");
  logger.info("  # Basic comparison");
  logger.info(
    "  breakcheck compare --before production-live --after after-deployment"
  );
  logger.info("");
  logger.info("  # Comparison with custom output name");
  logger.info(
    "  breakcheck compare --before production-live --after after-deployment --output my-comparison"
  );
  logger.info("");
  logger.info("  # Comparison with custom rules");
  logger.info(
    "  breakcheck compare --before production-live --after after-deployment --rules ./my-rules"
  );
  logger.info("");
  logger.info("  # Use JSON logging for automation");
  logger.info(
    "  breakcheck compare --before production-live --after after-deployment --json-logs"
  );
  logger.info("");
  logger.info("Rules File:");
  logger.info(
    "  The rules file (rules.breakcheck) contains DSL rules to ignore dynamic content."
  );
  logger.info("  Example rules:");
  logger.info("    css:.ad-container do: exclude");
  logger.info('    css:img do: remove_attr attr:"srcset"');
  logger.info(
    '    css:.timestamp do: rewrite_content regex:"\\d{2}/\\d{2}/\\d{4}" replace:"DATE_STAMP"'
  );
}

function showViewHelp(logger: any) {
  logger.info("📊 VIEW COMMAND");
  logger.info("===============");
  logger.info("");
  logger.info(
    "Starts a local web server to display the results of a comparison in a user-friendly interface."
  );
  logger.info("");
  logger.info("Usage:");
  logger.info("  breakcheck view [comparison-name] [options]");
  logger.info("");
  logger.info("Arguments:");
  logger.info(
    "  comparison-name              The name of the comparison to view (default: compare_default)"
  );
  logger.info("");
  logger.info("Options:");
  logger.info(
    "  -p, --port <number>          The port to run the view server on (default: 8080)"
  );
  logger.info("  --json-logs                Output logs in JSON format");
  logger.info(
    "  --no-json-logs             Output logs in pretty format (default)"
  );
  logger.info("");
  logger.info("Examples:");
  logger.info("  # View default comparison");
  logger.info("  breakcheck view");
  logger.info("");
  logger.info("  # View specific comparison");
  logger.info("  breakcheck view my-comparison");
  logger.info("");
  logger.info("  # View on custom port");
  logger.info("  breakcheck view my-comparison --port 3000");
  logger.info("");
  logger.info("  # Use JSON logging for automation");
  logger.info("  breakcheck view my-comparison --json-logs");
  logger.info("");
  logger.info("After running this command:");
  logger.info("  1. A local web server will start");
  logger.info("  2. Your default browser will open automatically");
  logger.info("  3. You'll see a detailed diff report with all changes");
  logger.info("  4. Press Ctrl+C to stop the server");
}

function showListSnapshotsHelp(logger: any) {
  logger.info("📋 LIST-SNAPSHOTS COMMAND");
  logger.info("=========================");
  logger.info("");
  logger.info("Lists all snapshots that have been saved locally.");
  logger.info("");
  logger.info("Usage:");
  logger.info("  breakcheck list-snapshots");
  logger.info("  breakcheck lss");
  logger.info("");
  logger.info("Aliases:");
  logger.info("  lss                          Short alias for list-snapshots");
  logger.info("");
  logger.info("Options:");
  logger.info("  --json-logs                  Output logs in JSON format");
  logger.info(
    "  --no-json-logs               Output logs in pretty format (default)"
  );
  logger.info("");
  logger.info("Output Format:");
  logger.info("  The command outputs a table showing:");
  logger.info("  - Name: The snapshot name");
  logger.info("  - Date: When the snapshot was created");
  logger.info("  - Pages: Number of pages crawled");
  logger.info("  - Errors: Number of pages with errors");
  logger.info("");
  logger.info("Example Output:");
  logger.info(
    "  Name                | Date                      | Pages | Errors"
  );
  logger.info(
    "  --------------------|---------------------------|-------|-------"
  );
  logger.info("  production-live     | 2025-06-10T16:05:40.123Z  | 152   | 0");
  logger.info("  after-deployment    | 2025-06-10T17:10:15.456Z  | 153   | 1");
  logger.info("");
  logger.info("Examples:");
  logger.info("  # List all snapshots");
  logger.info("  breakcheck list-snapshots");
  logger.info("");
  logger.info("  # Using the short alias");
  logger.info("  breakcheck lss");
  logger.info("");
  logger.info("  # Use JSON logging for automation");
  logger.info("  breakcheck list-snapshots --json-logs");
}
