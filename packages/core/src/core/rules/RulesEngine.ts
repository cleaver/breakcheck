import * as cheerio from "cheerio";
import {
  Action,
  REGION_NAME_PATTERN,
  Region,
  Ruleset,
} from "../../types/rules.js";
import { processRulesDsl } from "./RulesDsl.js";

export class RulesEngine {
  private ruleset: Ruleset;

  private constructor(ruleset: Ruleset) {
    const regions = ruleset.regions ?? [];
    this.validateRegions(regions);
    this.ruleset = { ...ruleset, regions };
  }

  public static async create(
    rulesDirectoryOrRuleset?: string | Ruleset
  ): Promise<RulesEngine> {
    const ruleset =
      typeof rulesDirectoryOrRuleset === "string"
        ? await processRulesDsl(rulesDirectoryOrRuleset)
        : rulesDirectoryOrRuleset ?? { name: "none", rules: [] };

    return new RulesEngine(ruleset);
  }

  public process(html: string): string {
    const $ = cheerio.load(html);

    // Apply ordinary rules in declaration order before selecting regions.
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

    const regions = this.ruleset.regions ?? [];
    if (regions.length > 0) {
      return this.serializeRegions($, regions);
    }

    return $.html();
  }

  private validateRegions(regions: Region[]): void {
    const names = new Set<string>();
    for (const region of regions) {
      if (!REGION_NAME_PATTERN.test(region.name)) {
        throw new Error(
          `Invalid region name "${region.name}". Region names must match [A-Za-z_][A-Za-z0-9_]*.`
        );
      }
      if (names.has(region.name)) {
        throw new Error(`Duplicate region name: ${region.name}`);
      }
      names.add(region.name);
    }
  }

  private serializeRegions(
    $: cheerio.CheerioAPI,
    regions: Region[]
  ): string {
    const output = cheerio.load(
      "<breakcheck-regions></breakcheck-regions>",
      {},
      false
    );
    const root = output("breakcheck-regions");
    const sortedRegions = [...regions].sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    );

    for (const region of sortedRegions) {
      const fragments: string[] = [];
      $(region.selector).each((_, element) => {
        if (element.type === "tag") {
          fragments.push($.html(element));
        }
      });

      if (fragments.length === 0) {
        continue;
      }

      const wrapper = output("<region></region>").attr("name", region.name);
      wrapper.append(fragments.join(""));
      root.append(wrapper);
    }

    return output.html();
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
