import { InteractiveCommand } from "interactive-commander";
import {
  createRuleScaffold,
  type RuleScaffoldOptions,
  type RuleScaffoldResult,
} from "../rules.js";
import { configureLogger } from "../utils.js";

export interface NewRuleOptions extends RuleScaffoldOptions {
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}

export async function runNewRule(
  name: string,
  options: NewRuleOptions = {},
  cwd: string = process.cwd(),
): Promise<RuleScaffoldResult> {
  return createRuleScaffold(name, options, cwd);
}

export const ruleCommand = new InteractiveCommand("rule")
  .description("Create a new ruleset scaffold")
  .argument("<name>", "Name of the new ruleset directory")
  .option(
    "-d, --directory <parent>",
    "Parent directory for the new ruleset (relative to the current directory)",
  )
  .option("--json-logs", "Output logs in JSON format")
  .option("--no-json-logs", "Output logs in pretty format (default)")
  .action(async (name: string, options: NewRuleOptions) => {
    const logger = configureLogger(options);
    try {
      const result = await runNewRule(name, options);
      logger.info(`✅ Created rules file: ${result.filePath}`);
      logger.info(`Next: breakcheck compare --rules ${result.directory}`);
    } catch (error) {
      logger.error({ err: error }, "❌ Error creating rules file");
      process.exit(1);
    }
  });

export const newCommand = new InteractiveCommand("new").description(
  "Create project files",
);

newCommand.addCommand(ruleCommand);
