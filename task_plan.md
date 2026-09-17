# Plan: `breakcheck new rule <name>`

Status: implementation complete; `<name>` is the ruleset directory name (Option A).

## Objective

Add a CLI workflow that scaffolds a valid `rules.breakcheck` file for a new
ruleset, reports the generated path and next command, and never overwrites an
existing file or follows an unsafe path.

## Existing contract to preserve

- The CLI uses nested `InteractiveCommand` instances (`clean snapshot` and
  `clean comparison`) and registers top-level commands from `packages/cli/src/index.ts`.
- A rules value is a directory, not a file: `--rules <directory>` and
  `comparison.rulesDir` both resolve to `<directory>/rules.breakcheck`.
- The DSL is line-oriented. Comments begin with `--`; ordinary rules use
  `css:<selector> do: <action>`; blocks use `do`/`end`; modifier values are
  double-quoted.
- The parser and `RulesEngine` accept an empty ruleset, so a comments-only
  scaffold can be valid without inventing a behavior-changing selector.
- Project configuration is loaded explicitly by CLI commands. Existing core
  APIs should not gain implicit configuration loading for this feature.

## Recommended contract (Option A)

Treat `<name>` as the name of a new ruleset directory, because the current
engine has one fixed file per rules directory. For example:

```text
breakcheck new rule my-rules
```

creates:

```text
./my-rules/rules.breakcheck
```

Recommended details:

- `<name>` is a single safe relative path segment (`[A-Za-z0-9][A-Za-z0-9._-]*`)
  rather than a DSL rule identifier or arbitrary path. Reject empty names,
  absolute paths, separators, `.`/`..`, and control characters.
- Add `--directory <parent>` as an optional cwd-relative parent for users who
  want `rules/<name>/rules.breakcheck`; otherwise use the invocation cwd.
- Create missing parent and ruleset directories. Refuse a symlink at any
  existing destination-directory component and use exclusive creation (`wx`)
  for the final `rules.breakcheck` file.
- Generate a comments-only, parser-valid file with the requested name in a
  heading and commented examples for `exclude`, `remove_attr`, and
  `rewrite_content`. Do not add a fake active rule.
- Keep the command independent of `comparison.rulesDir`; print the generated
  directory so the user can pass it to `compare --rules` or configure it
  explicitly. Shared `--config`/`--no-config` flags are unnecessary unless the
  contract is changed to target the configured rules directory.

Two alternatives need explicit rejection or acceptance before coding:

1. `<name>` labels a scaffold written to the configured
   `comparison.rulesDir/rules.breakcheck`. This integrates with config but gives
   the name no machine-readable meaning and only supports first-file creation.
2. `<name>` is a rule-file basename or DSL rule identifier. This would require
   changing the fixed `rules.breakcheck` loader and/or adding DSL naming
   semantics, which is a larger feature than the quoted request.

## Implementation phases

### 1. Inventory — complete

- Confirmed the command is absent and the backlog entry is in
  `system-docs/future.md`.
- Confirmed rules are directories containing `rules.breakcheck` and that the
  current parser accepts an empty/comment-only file.
- Confirmed CLI tests use exported helpers, injected cwd, and temporary
  directories; compiled CLI behavior is covered by integration and packaging
  scripts.

### 2. Lock the command contract — complete

- `<name>` identifies a safe single-segment ruleset directory.
- `--directory <parent>` is an optional cwd-relative parent; the default parent
  is the invocation cwd.
- The command creates missing directories, writes a comments-only valid
  `rules.breakcheck`, refuses symlink destinations, and uses exclusive creation.
- The command does not discover or modify project configuration; it prints the
  generated directory for use with `compare --rules`.
- The generated file contains a heading and commented DSL examples, but no
  active placeholder rule.

### 3. Implement the CLI scaffold — complete

- Tracer test is in place for creating a named ruleset scaffold; implementation
  now proceeds in vertical test-to-code slices.
- The first creation slice is green: `rules.ts` writes an exclusive scaffold
  and `new.ts` registers the nested CLI command.
- Unit parser coverage will use the internal DSL parser; no public `RulesEngine`
  export is added just for scaffolding tests.
- The scaffold helper now enforces cwd-bound parent paths and rejects symlinked
  directory components before writing.
- Focused coverage now includes parser validity, symlink refusal, existing-file
  preservation, and unsafe-name rejection.
- Registered the nested `new rule` command, added detailed help, and updated the
  compiled integration workflow to scaffold and consume generated rules.

### 4. Test behavior first — complete

- Add a focused helper (likely `packages/cli/src/cli/rules.ts`) for safe name
  validation, destination resolution, template generation, and exclusive file
  creation. Keep filesystem operations promise-based and typed.
- Add `packages/cli/src/cli/commands/new.ts` (or an equivalently named module)
  with a `new` parent and `rule` subcommand, then register it in `index.ts`.
- Use the existing logger/error conventions and return non-zero on invalid
  names, symlink destinations, missing/unusable parents, or existing files.
- Update detailed help for the general command list and `help new` / `help rule`.
- Keep the core package unchanged unless implementation proves a reusable,
  public rule-file writer is necessary.

- Unit-test the helper for valid names, traversal/absolute/control-character
  rejection, cwd/parent resolution, template contents, missing-directory
  creation, exclusive existing-file refusal, and symlink refusal.
- Parse the generated file through the real DSL/`RulesEngine` path and assert
  it creates an empty, valid ruleset with no behavior-changing rules.
- Test CLI command registration, required `<name>`, success output, repeated
  invocation, and error exit behavior.
- Extend temporary-workspace integration coverage: scaffold a ruleset with the
  compiled CLI, compare using the generated directory, and assert a failed
  second scaffold leaves the original bytes unchanged.
- Extend fresh-install packaging coverage to invoke `new rule` from a clean
  consumer and verify the generated file is present and parseable.

### 5. Document and verify — complete

- Add the command reference and examples to `README.md` and
  `packages/cli/README.md`, including the fixed `rules.breakcheck` layout,
  name restrictions, overwrite behavior, and how to use the generated
  directory with `compare`.
- Mark the matching item complete in `system-docs/future.md`; update DSL or
  architecture/API docs only if the selected contract changes those public
  surfaces. No release/version bump is expected.
- Run focused Vitest tests first, then `npm run build`, `npm run typecheck`,
  `npm test`, `npm run test:cli-bin`, `npm run test:integration`,
  `npm run test:packaging`, `npm run format:check`, and `git diff --check`.

## Acceptance criteria

- `breakcheck new rule <name>` creates exactly one valid
  `<destination>/rules.breakcheck` scaffold and explains how to use it.
- Existing files and symlinks are never overwritten; unsafe names cannot escape
  the intended destination.
- The generated file is accepted by the real DSL parser and does not change a
  comparison until the user adds an active rule.
- Existing snapshot, compare, config, and core API behavior remains unchanged.
- The command is documented, tested from source and from a fresh package
  install, and the standard checks are green.

## Non-goals

- Editing or appending to an existing rules file.
- Adding rule identifiers, imports, URL conditions, a rule editor, or new DSL
  actions.
- Migrating existing rules or automatically modifying `breakcheck.config.json`.

## Working constraints

- Preserve unrelated working-tree changes, including the pending plan archive.
- Use focused red-green-refactor tests before implementation changes.
- Do not commit generated `dist`, coverage, or TypeScript build-info files.
