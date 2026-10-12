# Plan: `breakcheck compile`

Status: implementation complete.

## Goal

Add a `breakcheck compile` CLI command that reads an existing
`rules.breakcheck` DSL file, validates it through the same rules
boundary used by comparisons, and emits the canonical intermediate JSON
document described in `system-docs/json-rules-spec.md`.

The feature must be useful in shell pipelines and CI without changing
snapshot, comparison, or existing rules behavior.

## Recommended contract

### Command shape

Use the existing rules-directory contract:

```bash
breakcheck compile <rules-directory> > rules.json
```

- `<rules-directory>` is a required path to a directory containing
  the fixed `rules.breakcheck` file.
- Relative paths resolve from the invocation working directory, matching
  `compare --rules` and the core DSL loader.
- Absolute paths are accepted. Direct file paths, stdin input, and project
  configuration discovery are out of scope for v1.
- The command writes only JSON data to stdout, formatted with two-space
  indentation and a trailing newline. Diagnostics go through the normal error
  path and produce a non-zero exit code.
- The emitted top-level document is canonical and spec-shaped:
  ```json
  {
    "rules": [],
    "regions": []
  }
  ```
  The internal ruleset `name` metadata is not emitted because it is
  not part of the documented JSON format. A future output-file option can
  build on stdout redirection rather than being required for v1.

### Parsing and validation

- Reuse the existing Chevrotain DSL parser; do not duplicate grammar logic in
  the CLI.
- Preserve rule order, action order, selectors, decoded modifier values,
  comments-as-no-ops, action blocks, and named regions.
- Parse first, then run the existing RulesEngine validation boundary so invalid
  selectors, regular expressions, action modifiers, region names, and duplicate
  regions fail before JSON is emitted.
- Empty or comments-only files compile to empty arrays and remain valid.
- Do not compile regular expressions into JSON; retain their source strings for
  the documented intermediate representation.

### Core/API boundary

Keep the existing internal `Ruleset.name` metadata used by comparison
bookkeeping, but introduce an explicit JSON-document shape (for example,
`RulesDocument`) so the public type and the CLI output agree with
`system-docs/json-rules-spec.md`.

Expose one small typed core entry point (recommended name:
`compileRulesDsl`) backed by the existing parser and validation
logic. The CLI should consume that entry point and serialize the document
without importing core implementation files or duplicating validation.

## Existing contract to preserve

- `rules.breakcheck` is a single file inside a rules directory.
- The DSL is line-oriented, uses `css:<selector> do: ...` rules and
  `do/end` blocks, and requires quoted modifier values.
- Existing comparison calls may use either a rules directory or an inline
  typed ruleset.
- The public core package exports API functions and rule types from its root;
  deep imports are not a supported consumer contract.
- CLI commands use the nested `InteractiveCommand` pattern and return
  non-zero on operational or validation errors.
- No release/version bump is part of implementing the feature.

## Implementation phases

### 1. Inventory and contract — complete

- Confirmed the backlog item is still unchecked in
  `system-docs/future.md`.
- Confirmed the parser already produces the complete rule/region AST and accepts
  empty rulesets.
- Confirmed the engine performs semantic validation that the parser intentionally
  leaves for the runtime boundary.
- Confirmed the JSON specification omits internal `name` metadata.
- Confirmed the branch is clean and synchronized with `origin/main`.

### 2. Core parse/validation/serialization seam — complete

- Add the explicit JSON-document type without weakening existing `Ruleset`
  consumers.
- Refactor only as needed so parsing, semantic validation, and conversion to
  the document shape are reusable and typed.
- Export the compiler entry point through `packages/core/src/index.ts`
  and the API layer.
- Keep file/path error messages clear and preserve the original error cause
  where the existing loader does so.
- Add focused core tests for successful parsing, empty/comment-only files,
  blocks, regions, escaped values, missing files, syntax failures, and semantic
  validation failures.

### 3. CLI command and help — complete

- Add `packages/cli/src/cli/commands/compile.ts` with an exported
  runner/helper that accepts an injected working directory or output writer
  where useful for tests.
- Register the command in `packages/cli/src/index.ts`.
- Add general and detailed help with the directory contract and stdout example.
- Keep stdout machine-readable; avoid informational logger lines around the JSON
  payload.
- Ensure malformed input and filesystem failures exit non-zero without emitting
  partial JSON.

### 4. Integration and packaging coverage — complete

- Add CLI unit coverage for successful JSON output, stable formatting, empty
  rules, path resolution, and error behavior.
- Extend compiled integration coverage to invoke `compile` and parse its
  stdout with `JSON.parse`.
- Extend fresh-install packaging coverage to prove the published CLI can compile
  a ruleset without source-only dependencies or `tsx`.
- Verify that the generated JSON preserves all DSL constructs represented in the
  JSON specification.

### 5. Documentation and backlog — complete

- Document the command in the root and CLI READMEs.
- Clarify the distinction between internal `Ruleset.name` metadata and
  the emitted JSON document in the JSON rules specification and core API docs.
- Mark `breakcheck compile` complete in `system-docs/future.md`.
- Do not modify unrelated stale backlog items as part of this feature.

### 6. Verification — complete

Run the focused tests first, then:

```bash
npm run build
npm run typecheck
npm test
npm run test:cli-bin
npm run test:integration
npm run test:packaging
npm run format:check
git diff --check
```

## Acceptance criteria

- `breakcheck compile <rules-directory>` emits valid, deterministic
  JSON matching the documented `rules`/`regions` shape.
- The output preserves rule/action/region ordering and all supported modifier
  values.
- Parser and engine validation errors prevent output and return a failure status.
- Empty and comments-only rules files compile successfully.
- The command uses the same directory/path semantics as existing comparison
  rules and does not discover or modify project configuration.
- The core API remains strict and typed; no duplicated parser or unsafe casts are
  introduced.
- Source, compiled CLI, and fresh-install packaging paths are covered.
- Existing snapshot, comparison, config, and public API behavior remains green.

## Non-goals

- Compiling JSON back into DSL.
- Accepting JSON as a new comparison input format.
- Reading a standalone rules file, stdin, or multiple files.
- Writing a managed artifact or adding an output-file/overwrite policy in v1.
- Adding URL-conditional rules, variables/imports, or new DSL actions.
- Changing the rules engine's comparison semantics.

## Final decisions

- Proceed with a required rules-directory positional argument and stdout-only
  output for v1.
- Emit the documented JSON shape without internal `name` metadata.
- Add a small public core compiler entry point rather than duplicating parser
  logic in the CLI.
