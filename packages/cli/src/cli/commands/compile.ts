import {
  compileRulesDsl,
  logger,
  type RulesDocument,
} from "@cleaver/breakcheck-core";
import { InteractiveCommand } from "interactive-commander";
import { resolve } from "node:path";

export async function runCompile(
  rulesDirectory: string,
  cwd: string = process.cwd(),
): Promise<RulesDocument> {
  return compileRulesDsl(resolve(cwd, rulesDirectory));
}

export function formatCompiledRules(document: RulesDocument): string {
  return JSON.stringify(document, null, 2) + "\n";
}

export const compileCommand = new InteractiveCommand("compile")
  .description("Compile a rules.breakcheck DSL file to JSON")
  .argument(
    "<rules-directory>",
    "Directory containing rules.breakcheck (relative to the current directory)",
  )
  .action(async (rulesDirectory: string) => {
    try {
      const document = await runCompile(rulesDirectory);
      process.stdout.write(formatCompiledRules(document));
    } catch (error) {
      logger.error({ err: error }, "❌ Error compiling rules");
      process.exit(1);
    }
  });
