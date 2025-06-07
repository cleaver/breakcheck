import { logger } from "@lib/logger";
import { Action, Rule, Ruleset } from "@project-types/rules";
import { createToken, CstNode, CstParser, Lexer } from "chevrotain";
import { readFileSync } from "fs";
import { join } from "path";

// --- LEXER ---
const Css = createToken({ name: "Css", pattern: /css:/i });
const Do = createToken({ name: "Do", pattern: /do:/i });
const DoBlock = createToken({ name: "DoBlock", pattern: /do/i });
const End = createToken({ name: "End", pattern: /end/i });
const Include = createToken({ name: "Include", pattern: /include/i });
const Exclude = createToken({ name: "Exclude", pattern: /exclude/i });
const RemoveAttr = createToken({ name: "RemoveAttr", pattern: /remove_attr/i });
const RewriteAttr = createToken({
  name: "RewriteAttr",
  pattern: /rewrite_attr/i,
});
const RewriteContent = createToken({
  name: "RewriteContent",
  pattern: /rewrite_content/i,
});
const Attr = createToken({ name: "Attr", pattern: /attr:/i });
const Regex = createToken({ name: "Regex", pattern: /regex:/i });
const Replace = createToken({ name: "Replace", pattern: /replace:/i });
const ContentRegex = createToken({
  name: "ContentRegex",
  pattern: /content_regex:/i,
});
const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"[^"]*"/,
});
const Selector = createToken({
  name: "Selector",
  pattern: /[\w.#\[\]*='"-]+/,
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

const allTokens = [
  WhiteSpace,
  Comment,
  Css,
  Do,
  DoBlock,
  End,
  Include,
  Exclude,
  RemoveAttr,
  RewriteAttr,
  RewriteContent,
  Attr,
  Regex,
  Replace,
  ContentRegex,
  StringLiteral,
  Selector,
];
const RulesLexer = new Lexer(allTokens, {
  // Longer matches should be preferred over shorter ones
  ensureOptimizations: true,
});

// --- PARSER ---
class RulesParser extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  public ruleset = this.RULE("ruleset", () => {
    this.MANY(() => {
      this.SUBRULE(this.rule);
    });
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
    this.SUBRULE(this.action);
  });

  private actionBlock = this.RULE("actionBlock", () => {
    this.CONSUME(DoBlock);
    this.MANY(() => {
      this.SUBRULE(this.action);
    });
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

// --- VISITOR ---
class CstToAstVisitor extends parser.getBaseCstVisitorConstructor() {
  constructor() {
    super();
    this.validateVisitor();
  }

  ruleset(ctx: { rule?: CstNode[] }): Ruleset {
    const rules = ctx.rule?.map((r) => this.visit(r)) || [];
    return { name: "ruleset", rules };
  }

  rule(ctx: {
    Selector: any[];
    singleAction?: CstNode[];
    actionBlock?: CstNode[];
  }): Rule {
    const selector = ctx.Selector[0].image.trim();
    const actionNode = ctx.singleAction || ctx.actionBlock;
    if (!actionNode) {
      throw new Error("Invalid 'rule' node in CST: No action node found.");
    }
    const actions = this.visit(actionNode[0]);
    return { selector, actions };
  }

  singleAction(ctx: { action: CstNode[] }): Action[] {
    return [this.visit(ctx.action[0])];
  }

  actionBlock(ctx: { action?: CstNode[] }): Action[] {
    return ctx.action?.map((a) => this.visit(a)) || [];
  }

  action(ctx: {
    includeAction?: CstNode[];
    excludeAction?: CstNode[];
    removeAttrAction?: CstNode[];
    rewriteAttrAction?: CstNode[];
    rewriteContentAction?: CstNode[];
  }): Action {
    // Find which specific action was parsed (e.g., includeAction, excludeAction)
    const actionAlternative =
      ctx.includeAction ||
      ctx.excludeAction ||
      ctx.removeAttrAction ||
      ctx.rewriteAttrAction ||
      ctx.rewriteContentAction;

    if (!actionAlternative) {
      logger.error(
        { context: ctx },
        "Invalid 'action' node in CST: No action alternative found"
      );
      throw new Error(
        "Invalid 'action' node in CST: No action alternative found."
      );
    }

    const actionNode = actionAlternative[0];
    // Visit that specific action's node
    return this.visit(actionNode);
  }

  includeAction(ctx: { contentRegexModifier?: CstNode[] }): Action {
    const modifiers = ctx.contentRegexModifier
      ? this.visit(ctx.contentRegexModifier[0])
      : {};
    return { action: "include", modifiers };
  }

  excludeAction(ctx: { contentRegexModifier?: CstNode[] }): Action {
    const modifiers = ctx.contentRegexModifier
      ? this.visit(ctx.contentRegexModifier[0])
      : {};
    return { action: "exclude", modifiers };
  }

  removeAttrAction(ctx: { StringLiteral: any[] }): Action {
    const attr = ctx.StringLiteral[0].image.slice(1, -1);
    return { action: "remove_attr", modifiers: { attr } };
  }

  rewriteAttrAction(ctx: {
    attr: any[];
    regex: any[];
    replace: any[];
  }): Action {
    const attr = ctx.attr[0].image.slice(1, -1);
    const regex = ctx.regex[0].image.slice(1, -1);
    const replace = ctx.replace[0].image.slice(1, -1);
    return { action: "rewrite_attr", modifiers: { attr, regex, replace } };
  }

  rewriteContentAction(ctx: { regex: any[]; replace: any[] }): Action {
    const regex = ctx.regex[0].image.slice(1, -1);
    const replace = ctx.replace[0].image.slice(1, -1);
    return { action: "rewrite_content", modifiers: { regex, replace } };
  }

  contentRegexModifier(ctx: { StringLiteral: any[] }): {
    content_regex: string;
  } {
    const content_regex = ctx.StringLiteral[0].image.slice(1, -1);
    return { content_regex };
  }
}

const visitor = new CstToAstVisitor();

// --- Main processing function ---
export function processRulesDsl(rulesetName: string): Ruleset {
  const rulesPath = join(
    process.cwd(),
    "rules",
    rulesetName,
    "rules.breakcheck"
  );
  let rulesContent: string;
  try {
    rulesContent = readFileSync(rulesPath, "utf-8");
  } catch (error) {
    const shortPath = rulesPath.replace(process.cwd(), "").replace(/^\//, "");
    logger.error({ error, rulesPath: shortPath }, "Rules file not found");
    throw new Error(`Rules file not found: ${shortPath}`);
  }

  const lexResult = RulesLexer.tokenize(rulesContent);
  if (lexResult.errors.length > 0) {
    const errors = lexResult.errors
      .map(
        (err) =>
          `Lexical error at line ${err.line}, column ${err.column}: ${err.message}`
      )
      .join("\n");
    logger.error(
      { errors: lexResult.errors, rulesetName },
      "Lexical errors in rules file"
    );
    throw new Error(`Lexical errors in rules file:\n${errors}`);
  }

  parser.input = lexResult.tokens;
  const cst = parser.ruleset();
  if (parser.errors.length > 0) {
    const errors = parser.errors
      .map(
        (err) =>
          `Syntax error at line ${err.token.startLine}, column ${err.token.startColumn}: ${err.message}`
      )
      .join("\n");
    logger.error(
      { errors: parser.errors, rulesetName },
      "Syntax errors in rules file"
    );
    throw new Error(`Syntax errors in rules file:\n${errors}`);
  }

  // Use the visitor to transform the CST to the final AST
  const result = visitor.visit(cst) as Ruleset;
  return { ...result, name: rulesetName };
}
