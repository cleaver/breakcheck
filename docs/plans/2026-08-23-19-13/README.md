# Archived plan: Make Breakcheck installable and runnable from npm

## Dates

- Plan created: 2026-08-23, based on the root planning-file modification times.
- Plan archived: 2026-08-23 at 19:13 America/Toronto.

## Goal

Make the published `@cleaver/breakcheck` package runnable by a fresh native-Node consumer. The plan covered package naming, Node ESM output, dependency-ordered builds, rules behavior, CLI version reporting, regression tests, packaging validation, and release documentation.

The final integration phase added an npm-driven workflow around the before/after fixture servers, including snapshots, unfiltered and rules-filtered comparisons, and viewer verification.

## Accomplished

- Replaced the invalid `npx tsx` executable path with a native Node CLI entrypoint.
- Standardized imports and dependencies on `@cleaver/breakcheck-core`.
- Converted the core package to native NodeNext ESM with explicit `.js` imports and package exports.
- Made the root build follow core → CLI → server project references.
- Implemented the documented `--rules <directory>` contract, useful missing-file errors, and valid no-rules comparisons.
- Aligned CLI version output with package metadata and moved process-exit decisions to the CLI boundary.
- Added unit, native-Node, fresh-install packaging, and fixture integration coverage.
- Added configurable fixture ports and the `npm run test:integration` workflow.
- Verified the build, 37 unit tests, fixture integration workflow, fresh-install packaging workflow, and package contents.

## Session references

The complete planning history remains available in the archived files and the original workspace files:

- [Task plan](task_plan.md)
- [Findings](findings.md)
- [Progress log](progress.md)
- [Original task plan](../../../task_plan.md)
- [Original findings](../../../findings.md)
- [Original progress log](../../../progress.md)

No commit was created for this implementation session; the progress log records the work and verification commands.
