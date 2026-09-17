# Progress

## 2026-09-17

- Started a file-based plan for `breakcheck new rule <name>`.
- Created `task_plan.md`, `findings.md`, and `progress.md` in the project root.
- No product code has been changed.
- Existing uncommitted plan-archive changes are being preserved.
- Inspected the CLI command registration/help patterns, project configuration
  path resolution, rule DSL grammar, rule engine validation, tests, packaging
  checks, and release guidance.
- Recorded the recommended named-ruleset-directory contract, implementation
  phases, safety requirements, test matrix, documentation updates, and
  non-goals in `task_plan.md`.
- Plan is ready for implementation after confirming the meaning of `<name>`.
- User requested implementation; adopted the plan's recommended named-ruleset
  directory contract and finalized the destination/template behavior.
- Phase 2 is complete; implementation begins with a focused red test.
- Added the first public-behavior test for creating `my-rules/rules.breakcheck`.
- RED: `npx vitest run packages/cli/src/__tests__/new-rule.test.ts` failed
  because `packages/cli/src/cli/commands/new.ts` does not exist yet.
- GREEN: added the CLI rules scaffold helper and nested `new rule` command;
  the focused creation test now passes.
- RED: the parser-validity test initially imported `RulesEngine` from the public
  core package, where it is intentionally not exported; the test failed with
  `Cannot read properties of undefined (reading 'create')`.
- RED: the symlink safety test showed recursive directory creation followed a
  symlink and wrote `rules.breakcheck` into its target.
- GREEN: replaced recursive creation with cwd-bound component checks using
  `lstat`, safe one-at-a-time `mkdir`, and exclusive final-file creation; the
  focused suite is green again.
- Added and passed coverage for existing-file refusal/byte preservation and
  unsafe names (`.`, `..`, traversal, separators, whitespace, and empty input).
- Added the nested command registration, general/detailed help, and replaced
  manual integration rules-file creation with `new rule`; `npm run
test:integration` passes.
- `npm run format:check` initially found style issues in five changed files;
  `git diff --check` remained clean. Prettier will normalize those files before
  verification continues.
- A packaging-test patch missed the formatter's wrapped context; no file changed,
  and the installed-parser assertion is being reapplied with a narrower anchor.
- Final verification is green: 17 Vitest files / 129 tests, native CLI smoke,
  compiled integration, fresh-install packaging (including generated-file
  consumption), typecheck, format check, and `git diff --check`.
- Product implementation and documentation are complete; no version bump or
  generated build artifacts were added to the tracked change set.
- A first help patch missed its context because the existing general-help call
  is formatted on one line; no file was changed, and the patch is being
  reapplied with narrower context.
- A compiled CLI smoke attempt was rejected by the shell safety guard because
  its temporary-directory trap used `rm -rf`; rerunning with Node's fs cleanup
  API instead.
