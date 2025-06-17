import * as cheerio from "cheerio";
import { logger } from "../../lib/logger";
import { Action, Ruleset } from "../../types/rules";
import { processRulesDsl } from "./RulesDsl";

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
      try {
        ruleset = processRulesDsl(rulesetOrName);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(
            { error, rulesetName: rulesetOrName },
            "Failed to process ruleset DSL"
          );
          process.exit(1);
        }
        throw error;
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
