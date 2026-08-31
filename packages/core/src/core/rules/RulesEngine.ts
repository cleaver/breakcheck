import * as cheerio from "cheerio";
import { Action, REGION_NAME_PATTERN, Ruleset } from "../../types/rules.js";
import { processRulesDsl } from "./RulesDsl.js";

type CompiledAction =
  | { action: "include" | "exclude"; contentRegex?: RegExp }
  | { action: "remove_attr"; attr: string }
  | { action: "rewrite_attr"; attr: string; regex: RegExp; replace: string }
  | { action: "rewrite_content"; regex: RegExp; replace: string };
interface CompiledRule {
  selector: string;
  actions: CompiledAction[];
}
interface CompiledRegion {
  selector: string;
  name: string;
}
interface CompiledRuleset {
  rules: CompiledRule[];
  regions: CompiledRegion[];
}

function objectValue(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${context} must be an object.`);
  return value as Record<string, unknown>;
}

function keysAre(
  modifiers: Record<string, unknown>,
  allowed: readonly string[],
  context: string,
): void {
  const extra = Object.keys(modifiers).find((key) => !allowed.includes(key));
  if (extra) throw new Error(`${context} has unsupported modifier "${extra}".`);
}

function requiredString(
  modifiers: Record<string, unknown>,
  key: string,
  context: string,
  nonEmpty = false,
): string {
  const value = modifiers[key];
  if (typeof value !== "string" || (nonEmpty && value.length === 0))
    throw new Error(
      `${context} requires ${nonEmpty ? "a non-empty" : "a string"} "${key}" modifier.`,
    );
  return value;
}

function compileRegex(
  pattern: string,
  context: string,
  modifier: string,
): RegExp {
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new Error(
      `${context} has invalid ${modifier} regex: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function compileAction(
  value: unknown,
  selector: string,
  ruleIndex: number,
  actionIndex: number,
): CompiledAction {
  const action = objectValue(value, `Rule ${ruleIndex} action ${actionIndex}`);
  const actionName = action.action;
  const context = `Rule ${ruleIndex} selector "${selector}" action ${actionIndex}`;
  const modifiers =
    action.modifiers === undefined
      ? {}
      : objectValue(action.modifiers, `${context} modifiers`);

  switch (actionName) {
    case "include":
    case "exclude": {
      keysAre(modifiers, ["content_regex"], context);
      const contentPattern = modifiers.content_regex;
      if (contentPattern !== undefined && typeof contentPattern !== "string")
        throw new Error(
          `${context} modifier "content_regex" must be a string.`,
        );
      return {
        action: actionName,
        ...(typeof contentPattern === "string"
          ? {
              contentRegex: compileRegex(
                contentPattern,
                context,
                "content_regex",
              ),
            }
          : {}),
      };
    }
    case "remove_attr":
      keysAre(modifiers, ["attr"], context);
      return {
        action: "remove_attr",
        attr: requiredString(modifiers, "attr", context, true),
      };
    case "rewrite_attr": {
      keysAre(modifiers, ["attr", "regex", "replace"], context);
      const attr = requiredString(modifiers, "attr", context, true);
      const pattern = requiredString(modifiers, "regex", context);
      return {
        action: "rewrite_attr",
        attr,
        regex: compileRegex(pattern, context, "regex"),
        replace: requiredString(modifiers, "replace", context),
      };
    }
    case "rewrite_content": {
      keysAre(modifiers, ["regex", "replace"], context);
      const pattern = requiredString(modifiers, "regex", context);
      return {
        action: "rewrite_content",
        regex: compileRegex(pattern, context, "regex"),
        replace: requiredString(modifiers, "replace", context),
      };
    }
    default:
      throw new Error(
        `${context} has unsupported action "${String(actionName)}".`,
      );
  }
}

function validateSelector(selector: unknown, context: string): string {
  if (typeof selector !== "string" || selector.trim().length === 0)
    throw new Error(`${context} requires a non-empty selector.`);
  const cloned = selector.slice();
  try {
    cheerio.load("", {}, false)(cloned);
  } catch (error) {
    throw new Error(
      `${context} has invalid selector "${cloned}": ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return cloned;
}

function compileRuleset(value: Ruleset): CompiledRuleset {
  const input = objectValue(value, "Ruleset");
  if (!Array.isArray(input.rules))
    throw new Error("Ruleset rules must be an array.");
  const rules = input.rules.map((candidate, ruleIndex) => {
    const rule = objectValue(candidate, `Rule ${ruleIndex}`);
    const selector = validateSelector(rule.selector, `Rule ${ruleIndex}`);
    if (!Array.isArray(rule.actions) || rule.actions.length === 0)
      throw new Error(
        `Rule ${ruleIndex} selector "${selector}" requires at least one action.`,
      );
    return {
      selector,
      actions: rule.actions.map((action, actionIndex) =>
        compileAction(action, selector, ruleIndex, actionIndex),
      ),
    };
  });

  const regionsValue = input.regions ?? [];
  if (!Array.isArray(regionsValue))
    throw new Error("Ruleset regions must be an array.");
  const names = new Set<string>();
  const regions = regionsValue.map((candidate, regionIndex) => {
    const region = objectValue(candidate, `Region ${regionIndex}`);
    const selector = validateSelector(region.selector, `Region ${regionIndex}`);
    if (
      typeof region.name !== "string" ||
      !REGION_NAME_PATTERN.test(region.name)
    )
      throw new Error(
        `Invalid region name "${String(region.name)}". Region names must match [A-Za-z_][A-Za-z0-9_]*.`,
      );
    if (names.has(region.name))
      throw new Error(`Duplicate region name: ${region.name}`);
    names.add(region.name);
    return { selector, name: region.name.slice() };
  });
  return { rules, regions };
}

export class RulesEngine {
  private constructor(private readonly ruleset: CompiledRuleset) {}

  public static async create(
    rulesDirectoryOrRuleset?: string | Ruleset,
  ): Promise<RulesEngine> {
    const ruleset =
      typeof rulesDirectoryOrRuleset === "string"
        ? await processRulesDsl(rulesDirectoryOrRuleset)
        : (rulesDirectoryOrRuleset ?? { name: "none", rules: [] });
    return new RulesEngine(compileRuleset(ruleset));
  }

  public process(html: string): string {
    const $ = cheerio.load(html);
    for (const rule of this.ruleset.rules) {
      $(rule.selector).each((_, element) => {
        if (element.type === "tag")
          for (const action of rule.actions)
            this.applyAction($, element, action);
      });
    }
    return this.ruleset.regions.length ? this.serializeRegions($) : $.html();
  }

  private serializeRegions($: cheerio.CheerioAPI): string {
    const output = cheerio.load(
      "<breakcheck-regions></breakcheck-regions>",
      {},
      false,
    );
    const root = output("breakcheck-regions");
    const regions = [...this.ruleset.regions].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const region of regions) {
      const fragments: string[] = [];
      $(region.selector).each((_, element) => {
        if (element.type === "tag") fragments.push($.html(element));
      });
      if (fragments.length)
        root.append(
          output("<region></region>")
            .attr("name", region.name)
            .append(fragments.join("")),
        );
    }
    return output.html();
  }

  private applyAction(
    $: cheerio.CheerioAPI,
    element: cheerio.Element,
    action: CompiledAction,
  ): void {
    const selected = $(element);
    if (
      "contentRegex" in action &&
      action.contentRegex &&
      !action.contentRegex.test(selected.text())
    )
      return;
    switch (action.action) {
      case "include":
        return;
      case "exclude":
        selected.remove();
        return;
      case "remove_attr":
        selected.removeAttr(action.attr);
        return;
      case "rewrite_attr": {
        const current = selected.attr(action.attr);
        if (current !== undefined)
          selected.attr(
            action.attr,
            current.replace(action.regex, action.replace),
          );
        return;
      }
      case "rewrite_content":
        this.rewriteTextNodes($, element, action.regex, action.replace);
    }
  }

  private rewriteTextNodes(
    $: cheerio.CheerioAPI,
    element: cheerio.Element,
    regex: RegExp,
    replace: string,
  ): void {
    $(element)
      .contents()
      .each((_, child) => {
        if (child.type === "text")
          child.data = child.data.replace(regex, replace);
        else if (child.type === "tag")
          this.rewriteTextNodes($, child, regex, replace);
      });
  }
}
