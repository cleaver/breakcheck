# Archived plan: `breakcheck new rule <name>`

- Plan created: 2026-09-17, recorded in commit `252e9c3` at 17:41:58 -04:00.
- Archived: 2026-09-17 at 18:21 America/Toronto.
- Goal: Add a CLI workflow that scaffolds a valid `rules.breakcheck` file for a new ruleset, reports the generated path and next command, and never overwrites an existing file or follows an unsafe path.
- Accomplished: Added the nested `new rule` command, safe cwd-bound destination handling, exclusive and symlink-safe file creation, parser-valid comments-only templates, CLI/help/docs updates, and unit/integration/packaging coverage. All checks passed.

Archived files:

- [task_plan.md](./task_plan.md)
- [findings.md](./findings.md)
- [progress.md](./progress.md)

Relevant commit: [252e9c3](https://github.com/cleaver/breakcheck/commit/252e9c3) (`feat: add new rule command`).

The original planning files remain in the project root until confirmed for deletion.
