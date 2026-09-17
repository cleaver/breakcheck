# Archived plan: `clean snapshot|comparison`

## Dates

- Plan created: 2026-09-17 (planning files were created during the implementation session).
- Archived: 2026-09-17 at 15:07 America/Toronto.

## Goal

Design and implement a safe CLI command for deleting named snapshots and
comparisons, including explicit bulk deletion, confirmation behavior, tests,
and user-facing documentation.

## Accomplished

- Added storage-safe deletion primitives for snapshots and comparisons.
- Added public core API wrappers for named and bulk deletion.
- Added `breakcheck clean snapshot|comparison` with interactive confirmation,
  prompted names, `--all`, and `--force` support.
- Added path/name validation so cleanup cannot escape the intended storage root.
- Preserved comparisons when snapshots are deleted.
- Updated CLI help, READMEs, and the future-work checklist.
- Added unit, integration, packaging, build, typecheck, smoke, and formatting
  verification; all recorded checks passed.

## Archived files

- [task_plan.md](./task_plan.md)
- [findings.md](./findings.md)
- [progress.md](./progress.md)

## Related work

No commit was created specifically for this plan; the implementation changes
remain in the current working tree and can be reviewed with `git diff`.
