import yargs from "yargs";
import { hideBin } from "yargs/helpers";

export function setupCLI() {
  return yargs(hideBin(process.argv))
    .command("snapshot <url>", "Take a snapshot of a website", (yargs) => {
      return yargs
        .positional("url", {
          describe: "The URL to snapshot",
          type: "string",
          demandOption: true,
        })
        .option("name", {
          alias: "n",
          describe: "Name for the snapshot",
          type: "string",
        })
        .option("depth", {
          alias: "d",
          describe: "Maximum crawl depth",
          type: "number",
          default: 3,
        });
    })
    .command("compare <before> <after>", "Compare two snapshots", (yargs) => {
      return yargs
        .positional("before", {
          describe: "Name of the before snapshot",
          type: "string",
          demandOption: true,
        })
        .positional("after", {
          describe: "Name of the after snapshot",
          type: "string",
          demandOption: true,
        })
        .option("rules", {
          alias: "r",
          describe: "Path to rules file",
          type: "string",
        })
        .option("output", {
          alias: "o",
          describe: "Output format (console, json, html)",
          type: "string",
          default: "console",
        });
    })
    .help()
    .alias("help", "h")
    .version()
    .alias("version", "v")
    .demandCommand(1, "You need to specify a command")
    .strict();
}
