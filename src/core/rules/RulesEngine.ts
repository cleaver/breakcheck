import { Action, Ruleset } from "@project-types/rules";
import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";
import { logger } from "@/lib/logger";

export class RulesEngine {
  private ruleset: Ruleset;

  private constructor(ruleset: Ruleset) {
    this.ruleset = ruleset;
  }

  public static async create(
    rulesetOrName: string | Ruleset
  ): Promise<RulesEngine> {
    let ruleset: Ruleset;

    if (typeof rulesetOrName === "string") {
      const rulesetPath = path.join(
        process.cwd(),
        "rules",
        rulesetOrName,
        "rules.json"
      );
      try {
        const rulesetContent = await fs.readFile(rulesetPath, "utf-8");
        ruleset = JSON.parse(rulesetContent);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          logger.warn(
            { rulesetPath },
            `⚠️  Ruleset file not found at '${rulesetOrName}'. Using empty ruleset.`
          );
          ruleset = {
            name: rulesetOrName,
            rules: [],
          };
        } else {
          logger.error(
            { rulesetPath, error },
            "Failed to load ruleset due to an error"
          );
          process.exit(1);
        }
      }
    } else {
      ruleset = rulesetOrName;
    }

    return new RulesEngine(ruleset);
  }

  public process(html: string): string {
    const $ = cheerio.load(html);

    // Apply each rule in sequence
    for (const rule of this.ruleset.rules) {
      const elements = $(rule.selector);
      elements.each((_, element) => {
        if (element.type === "tag") {
          for (const action of rule.actions) {
            this.applyAction($, element, action);
          }
        }
      });
    }

    return $.html();
  }

  private applyAction(
    $: cheerio.CheerioAPI,
    element: cheerio.Element,
    action: Action
  ): void {
    const $element = $(element);

    // Check content regex if specified
    if (action.modifiers?.content_regex) {
      const content = $element.text();
      const regex = new RegExp(action.modifiers.content_regex);
      if (!regex.test(content)) {
        return;
      }
    }

    switch (action.action) {
      case "exclude":
        $element.remove();
        break;

      case "include":
        // No action needed for include
        break;

      case "remove_attr":
        if (action.modifiers && "attr" in action.modifiers) {
          $element.removeAttr(action.modifiers.attr);
        }
        break;

      case "rewrite_attr":
        if (
          action.modifiers &&
          "attr" in action.modifiers &&
          "regex" in action.modifiers &&
          "replace" in action.modifiers
        ) {
          const currentValue = $element.attr(action.modifiers.attr);
          if (currentValue) {
            const regex = new RegExp(action.modifiers.regex);
            const newValue = currentValue.replace(
              regex,
              action.modifiers.replace
            );
            $element.attr(action.modifiers.attr, newValue);
          }
        }
        break;

      case "rewrite_content":
        if (
          action.modifiers &&
          "regex" in action.modifiers &&
          "replace" in action.modifiers
        ) {
          const content = $element.text();
          const regex = new RegExp(action.modifiers.regex);
          const newContent = content.replace(regex, action.modifiers.replace);
          $element.text(newContent);
        }
        break;
    }
  }
}
