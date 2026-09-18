# Findings

## Repository state

- The working tree is clean and `main` is synchronized with
  `origin/main` at `d9e18d0` (the plan-archive commit).
- The published workspace versions are currently `0.2.5`.
- No root planning files existed when this plan started; prior plans are archived
  under `docs/plans/`.

## Existing rule pipeline

- `packages/core/src/core/rules/RulesDsl.ts` owns the Chevrotain lexer,
  parser, visitor, and filesystem loading. `processRulesDsl(directory)`
  resolves `<directory>/rules.breakcheck` from `process.cwd()`.
- The parser returns a ruleset with `name`, ordered `rules`, and
  `regions`. It preserves source order and decodes only quoted
  backslashes and quotes.
- The parser accepts comments and an empty ruleset. It rejects malformed
  delimiters, missing modifiers, unterminated blocks, and lexical failures with
  line/column diagnostics.
- Parser output intentionally leaves selector syntax, regular-expression syntax,
  action modifier combinations, region names, and duplicate regions for the
  `RulesEngine` validation boundary.
- `RulesEngine.create(ruleset)` validates those semantic constraints
  eagerly and compiles regexes for runtime use. Its compiled representation is
  not the JSON output and must not leak `RegExp` instances into it.

## JSON/API contract

- `system-docs/json-rules-spec.md` defines the intermediate document as
  `rules` plus optional `regions`, with no `name` field.
- `packages/core/src/types/rules.ts` currently requires
  `Ruleset.name`, because comparison metadata uses a ruleset name. This
  is an internal/API metadata concern and differs from the documented serialized
  shape.
- The public core root exports rule types and API functions, but not the parser
  module or `RulesEngine`. A CLI implementation must therefore add a
  small public seam or duplicate logic; the plan selects the public seam.
- The safest compatibility approach is an additive `RulesDocument` type
  for the serialized shape while retaining `Ruleset` for named runtime
  rulesets.

## CLI conventions

- CLI commands are registered directly in `packages/cli/src/index.ts` and
  use `InteractiveCommand`.
- Existing compare rules use a directory containing `rules.breakcheck`,
  with relative paths resolved from the invocation directory. The compile plan
  reuses that contract as a required positional directory.
- Existing commands route user-facing failures through the logger and exit
  non-zero. Compile output must be the exception: stdout needs to remain pure
  JSON so shell pipelines and CI can consume it.
- Existing integration and packaging scripts already exercise the compiled
  executable and a clean installed consumer, so both are appropriate coverage
  points.

## Scope decisions

- Recommended v1 is stdout-only. Users can create a file with normal shell
  redirection, avoiding a new overwrite/atomic-write policy.
- Recommended v1 does not discover `breakcheck.config.json`; requiring the
  input directory makes the command deterministic and avoids ambiguity between
  explicit and configured rules.
- The compiler should validate before serializing so invalid selectors or regular
  expressions cannot produce apparently valid JSON.
- The emitted document should include `regions: []` for deterministic
  output even though the specification marks regions optional.

## Resolved implementation notes

- The public entry point is `compileRulesDsl`, exported through the core root;
  it returns `RulesDocument` while preserving `Ruleset.name` for runtime
  consumers.
- Compiled CLI stdout is parsed as JSON in both integration and packaging tests,
  proving successful output is not contaminated by logger messages.
- The JSON spec, root/CLI/core READMEs, public type surface, and backlog were
  updated together.
- Build output remains ignored/generated and was not added to the change set.
