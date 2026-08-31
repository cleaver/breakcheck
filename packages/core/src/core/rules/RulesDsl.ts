import {
  createToken,
  CstNode,
  CstParser,
  EOF,
  IToken,
  Lexer,
} from "chevrotain";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { logger } from "../../lib/logger.js";
import { Action, Region, Rule, Ruleset } from "../../types/rules.js";

interface RegionDeclaration {
  kind: "region";
  name: string;
}
type ParsedAction = Action | RegionDeclaration;

function isRegion(value: unknown): value is RegionDeclaration {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "region" &&
    "name" in value &&
    typeof value.name === "string"
  );
}
function isAction(value: unknown): value is Action {
  return (
    typeof value === "object" &&
    value !== null &&
    "action" in value &&
    typeof value.action === "string"
  );
}
function isRule(value: unknown): value is Rule {
  return (
    typeof value === "object" &&
    value !== null &&
    "selector" in value &&
    typeof value.selector === "string" &&
    "actions" in value &&
    Array.isArray(value.actions)
  );
}
function isNamedRegion(value: unknown): value is Region {
  return (
    typeof value === "object" &&
    value !== null &&
    "selector" in value &&
    typeof value.selector === "string" &&
    "name" in value &&
    typeof value.name === "string"
  );
}
function isRuleset(value: unknown): value is Ruleset {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "rules" in value &&
    Array.isArray(value.rules) &&
    (!("regions" in value) ||
      value.regions === undefined ||
      Array.isArray(value.regions))
  );
}

const Css = createToken({
  name: "Css",
  pattern: /css:/i,
  push_mode: "selector",
});

function matchSelector(text: string, offset: number): RegExpExecArray | null {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  let brackets = 0;
  let parentheses = 0;
  const endings = [
    text.indexOf("\n", offset),
    text.indexOf("\r", offset),
  ].filter((value) => value >= 0);
  const lineEnd = endings.length === 0 ? text.length : Math.min(...endings);

  for (let index = offset; index < lineEnd; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") brackets += 1;
    else if (character === "]" && brackets > 0) brackets -= 1;
    else if (character === "(") parentheses += 1;
    else if (character === ")" && parentheses > 0) parentheses -= 1;
    if (
      brackets ||
      parentheses ||
      index === offset ||
      !/\s/.test(text[index - 1] ?? "")
    )
      continue;

    const remainder = text.slice(index, lineEnd);
    if (
      /^do:/i.test(remainder) ||
      /^do(?=[ \t]*(?:--[^\r\n]*)?(?![\s\S]))/i.test(remainder)
    ) {
      const image = text.slice(offset, index).trimEnd();
      if (!image) return null;
      const match = [image] as unknown as RegExpExecArray;
      match.index = offset;
      match.input = text;
      return match;
    }
  }
  return null;
}

const Selector = createToken({
  name: "Selector",
  pattern: matchSelector,
  line_breaks: false,
});
const SelectorWhitespace = createToken({
  name: "SelectorWhitespace",
  pattern: /[ \t]+/,
  group: Lexer.SKIPPED,
});
const Do = createToken({ name: "Do", pattern: /do:/i, pop_mode: true });
const DoBlock = createToken({
  name: "DoBlock",
  pattern: /do(?=[ \t]*(?:--[^\r\n]*)?(?:\r?\n|(?![\s\S])))/i,
  pop_mode: true,
});
const End = createToken({ name: "End", pattern: /end\b/i });
const Include = createToken({ name: "Include", pattern: /include\b/i });
const Exclude = createToken({ name: "Exclude", pattern: /exclude\b/i });
const RemoveAttr = createToken({
  name: "RemoveAttr",
  pattern: /remove_attr\b/i,
});
const RewriteAttr = createToken({
  name: "RewriteAttr",
  pattern: /rewrite_attr\b/i,
});
const RewriteContent = createToken({
  name: "RewriteContent",
  pattern: /rewrite_content\b/i,
});
const RegionKeyword = createToken({ name: "Region", pattern: /region\b/i });
const ContentRegex = createToken({
  name: "ContentRegex",
  pattern: /content_regex:/i,
});
const Attr = createToken({ name: "Attr", pattern: /attr:/i });
const RegionName = createToken({ name: "RegionName", pattern: /name:/i });
const Regex = createToken({ name: "Regex", pattern: /regex:/i });
const Replace = createToken({ name: "Replace", pattern: /replace:/i });
const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:\\.|[^"\\\r\n])*"/,
});
const Comment = createToken({
  name: "Comment",
  pattern: /--[^\n\r]*/,
  group: Lexer.SKIPPED,
});
const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

const normalTokens = [
  WhiteSpace,
  Comment,
  Css,
  ContentRegex,
  RemoveAttr,
  RewriteAttr,
  RewriteContent,
  Include,
  Exclude,
  RegionKeyword,
  End,
  Attr,
  RegionName,
  Regex,
  Replace,
  StringLiteral,
];
const selectorTokens = [SelectorWhitespace, Selector, Do, DoBlock];
const allTokens = [...normalTokens, ...selectorTokens];
const RulesLexer = new Lexer({
  defaultMode: "normal",
  modes: { normal: normalTokens, selector: selectorTokens },
});

class RulesParser extends CstParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    this.performSelfAnalysis();
  }
  public ruleset = this.RULE("ruleset", () => {
    this.MANY(() => this.SUBRULE(this.rule));
    this.CONSUME(EOF);
  });
  private rule = this.RULE("rule", () => {
    this.CONSUME(Css);
    this.CONSUME(Selector);
    this.OR([
      { ALT: () => this.SUBRULE(this.singleAction) },
      { ALT: () => this.SUBRULE(this.actionBlock) },
    ]);
  });
  private singleAction = this.RULE("singleAction", () => {
    this.CONSUME(Do);
    this.OR([
      { ALT: () => this.SUBRULE(this.action) },
      { ALT: () => this.SUBRULE(this.regionAction) },
    ]);
  });
  private actionBlock = this.RULE("actionBlock", () => {
    this.CONSUME(DoBlock);
    this.AT_LEAST_ONE(() => this.SUBRULE(this.action));
    this.CONSUME(End);
  });
  private action = this.RULE("action", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.includeAction) },
      { ALT: () => this.SUBRULE(this.excludeAction) },
      { ALT: () => this.SUBRULE(this.removeAttrAction) },
      { ALT: () => this.SUBRULE(this.rewriteAttrAction) },
      { ALT: () => this.SUBRULE(this.rewriteContentAction) },
    ]);
  });
  private regionAction = this.RULE("regionAction", () => {
    this.CONSUME(RegionKeyword);
    this.CONSUME(RegionName);
    this.CONSUME(StringLiteral);
  });
  private includeAction = this.RULE("includeAction", () => {
    this.CONSUME(Include);
    this.OPTION(() => this.SUBRULE(this.contentRegexModifier));
  });
  private excludeAction = this.RULE("excludeAction", () => {
    this.CONSUME(Exclude);
    this.OPTION(() => this.SUBRULE(this.contentRegexModifier));
  });
  private removeAttrAction = this.RULE("removeAttrAction", () => {
    this.CONSUME(RemoveAttr);
    this.CONSUME(Attr);
    this.CONSUME(StringLiteral);
  });
  private rewriteAttrAction = this.RULE("rewriteAttrAction", () => {
    this.CONSUME(RewriteAttr);
    this.CONSUME(Attr);
    this.CONSUME1(StringLiteral, { LABEL: "attr" });
    this.CONSUME(Regex);
    this.CONSUME2(StringLiteral, { LABEL: "regex" });
    this.CONSUME(Replace);
    this.CONSUME3(StringLiteral, { LABEL: "replace" });
  });
  private rewriteContentAction = this.RULE("rewriteContentAction", () => {
    this.CONSUME(RewriteContent);
    this.CONSUME(Regex);
    this.CONSUME1(StringLiteral, { LABEL: "regex" });
    this.CONSUME(Replace);
    this.CONSUME2(StringLiteral, { LABEL: "replace" });
  });
  private contentRegexModifier = this.RULE("contentRegexModifier", () => {
    this.CONSUME(ContentRegex);
    this.CONSUME(StringLiteral);
  });
}
const parser = new RulesParser();

interface RulesetContext {
  rule?: CstNode[];
}
interface RuleContext {
  Selector: IToken[];
  singleAction?: CstNode[];
  actionBlock?: CstNode[];
}
interface SingleContext {
  action?: CstNode[];
  regionAction?: CstNode[];
}
interface BlockContext {
  action: CstNode[];
}
interface ActionContext {
  includeAction?: CstNode[];
  excludeAction?: CstNode[];
  removeAttrAction?: CstNode[];
  rewriteAttrAction?: CstNode[];
  rewriteContentAction?: CstNode[];
}
interface LiteralContext {
  StringLiteral: IToken[];
}
interface OptionalModifierContext {
  contentRegexModifier?: CstNode[];
}
interface RewriteAttrContext {
  attr: IToken[];
  regex: IToken[];
  replace: IToken[];
}
interface RewriteContentContext {
  regex: IToken[];
  replace: IToken[];
}

function decodeString(token: IToken): string {
  const value = token.image.slice(1, -1);
  return value.replace(/\\([\\"])/g, "$1");
}
function parsedAction(value: unknown): ParsedAction {
  if (isAction(value) || isRegion(value)) return value;
  throw new Error("Invalid action visitor result.");
}

class CstToAstVisitor extends parser.getBaseCstVisitorConstructor() {
  constructor() {
    super();
    this.validateVisitor();
  }
  ruleset(ctx: RulesetContext): Ruleset {
    const rules: Rule[] = [];
    const regions: Region[] = [];
    for (const node of ctx.rule ?? []) {
      const value: unknown = this.visit(node);
      if (isRule(value)) rules.push(value);
      else if (isNamedRegion(value)) regions.push(value);
      else throw new Error("Invalid rule visitor result.");
    }
    return { name: "ruleset", rules, regions };
  }
  rule(ctx: RuleContext): Rule | Region {
    const node = ctx.singleAction?.[0] ?? ctx.actionBlock?.[0];
    if (!node) throw new Error("Invalid rule action.");
    const value: unknown = this.visit(node);
    if (!Array.isArray(value)) throw new Error("Invalid rule action result.");
    const actions = value.map(parsedAction);
    const region = actions.find(isRegion);
    if (region && actions.length === 1)
      return { selector: ctx.Selector[0].image.trim(), name: region.name };
    if (region)
      throw new Error(
        "A named region must be declared as the only action for a selector.",
      );
    return {
      selector: ctx.Selector[0].image.trim(),
      actions: actions.filter(isAction),
    };
  }
  singleAction(ctx: SingleContext): ParsedAction[] {
    const node = ctx.action?.[0] ?? ctx.regionAction?.[0];
    if (!node) throw new Error("Invalid single action.");
    return [parsedAction(this.visit(node))];
  }
  actionBlock(ctx: BlockContext): Action[] {
    return ctx.action.map((node) => {
      const value = parsedAction(this.visit(node));
      if (!isAction(value)) throw new Error("Invalid block action.");
      return value;
    });
  }
  action(ctx: ActionContext): Action {
    const nodes =
      ctx.includeAction ??
      ctx.excludeAction ??
      ctx.removeAttrAction ??
      ctx.rewriteAttrAction ??
      ctx.rewriteContentAction;
    if (!nodes?.[0]) throw new Error("Invalid action.");
    const value = parsedAction(this.visit(nodes[0]));
    if (!isAction(value)) throw new Error("Invalid action.");
    return value;
  }
  regionAction(ctx: LiteralContext): RegionDeclaration {
    return { kind: "region", name: decodeString(ctx.StringLiteral[0]) };
  }
  includeAction(ctx: OptionalModifierContext): Action {
    return { action: "include", modifiers: this.optionalContentRegex(ctx) };
  }
  excludeAction(ctx: OptionalModifierContext): Action {
    return { action: "exclude", modifiers: this.optionalContentRegex(ctx) };
  }
  removeAttrAction(ctx: LiteralContext): Action {
    return {
      action: "remove_attr",
      modifiers: { attr: decodeString(ctx.StringLiteral[0]) },
    };
  }
  rewriteAttrAction(ctx: RewriteAttrContext): Action {
    return {
      action: "rewrite_attr",
      modifiers: {
        attr: decodeString(ctx.attr[0]),
        regex: decodeString(ctx.regex[0]),
        replace: decodeString(ctx.replace[0]),
      },
    };
  }
  rewriteContentAction(ctx: RewriteContentContext): Action {
    return {
      action: "rewrite_content",
      modifiers: {
        regex: decodeString(ctx.regex[0]),
        replace: decodeString(ctx.replace[0]),
      },
    };
  }
  contentRegexModifier(ctx: LiteralContext): { content_regex: string } {
    return { content_regex: decodeString(ctx.StringLiteral[0]) };
  }
  private optionalContentRegex(ctx: OptionalModifierContext): {
    content_regex?: string;
  } {
    if (!ctx.contentRegexModifier) return {};
    const value: unknown = this.visit(ctx.contentRegexModifier[0]);
    if (
      typeof value !== "object" ||
      value === null ||
      !("content_regex" in value) ||
      typeof value.content_regex !== "string"
    )
      throw new Error("Invalid content regex result.");
    return { content_regex: value.content_regex };
  }
}
const visitor = new CstToAstVisitor();

function isFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export async function processRulesDsl(
  rulesDirectory: string,
): Promise<Ruleset> {
  const rulesPath = resolve(process.cwd(), rulesDirectory, "rules.breakcheck");
  let content: string;
  try {
    content = await readFile(rulesPath, "utf8");
  } catch (error) {
    if (isFileError(error) && error.code === "ENOENT") {
      logger.error({ error, rulesPath }, "Rules file not found");
      throw new Error(`Rules file not found: ${rulesPath}`, { cause: error });
    }
    logger.error({ error, rulesPath }, "Failed to read rules file");
    throw new Error(`Failed to read rules file: ${rulesPath}`, {
      cause: error,
    });
  }
  const lexed = RulesLexer.tokenize(content);
  if (lexed.errors.length)
    throw new Error(
      `Lexical errors in rules file:\n${lexed.errors.map((error) => `Lexical error at line ${error.line}, column ${error.column}: ${error.message}`).join("\n")}`,
    );
  parser.input = lexed.tokens;
  const cst = parser.ruleset();
  if (parser.errors.length)
    throw new Error(
      `Syntax errors in rules file:\n${parser.errors.map((error) => `Syntax error at line ${error.token.startLine}, column ${error.token.startColumn}: ${error.message}`).join("\n")}`,
    );
  const result: unknown = visitor.visit(cst);
  if (!isRuleset(result)) throw new Error("Invalid ruleset visitor result.");
  return { ...result, name: rulesDirectory };
}
