# Findings & Decisions

## Requirements

- Add a `clean snapshot|comparison` CLI capability.
- Plan safe deletion for individual named artifacts and bulk deletion.
- Cover confirmation behavior, errors, tests, and documentation.

## Research Findings

- Snapshots are stored as direct child directories under the repository root's `snapshots/` directory. `SnapshotRepository` currently supports save, load, URL-list generation, and listing, but no deletion method.
- Comparisons are stored as direct child directories under the repository root's `comparisons/` directory. `ComparisonRepository.create()` initializes a comparison and recursively removes an existing same-named directory, but there is no independent delete/list API.
- The public core API currently exports snapshot creation, comparison execution, and snapshot listing. A clean command will need new repository methods plus public API wrappers if it should remain layered like the existing CLI commands.
- Existing repository methods build paths from caller-provided names. A deletion implementation must validate names or otherwise constrain resolution to the intended storage root to prevent traversal or deleting an unintended path.
- The CLI currently registers `snapshot`, `compare`, `list-snapshots`/`lss`, `view`, and `help`; it has no prompt abstraction or existing destructive command to copy.
- `findRootDir()` resolves the workspace root by finding the nearest package with a `workspaces` field; default storage is therefore rooted at that project, while repository tests use custom temporary directories.
- `interactive-commander` supports Inquirer-backed prompts through `InteractiveOption`, but the current root command does not enable `.interactive()` and no command currently defines interactive options. The clean flow should therefore use an explicit, testable confirmation/selection adapter rather than changing prompting behavior for every command.
- Existing core snapshot tests use temporary directories and clean them in `afterEach`; this is a good seam for repository deletion tests. Existing integration/packaging harnesses invoke the compiled CLI from a temporary workspace, which can cover end-to-end clean behavior without touching the checkout.
- The existing comparison repository writes self-contained compressed page diffs and metadata. The viewer reads the comparison directory directly, so deleting a source snapshot does not inherently require deleting its comparisons; however, metadata may reference a snapshot that no longer exists.

## Technical Decisions

| Decision                                                                    | Rationale                                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Put deletion primitives on the repositories and expose narrow API wrappers  | Keeps filesystem ownership in core and keeps CLI orchestration thin.                           |
| Treat snapshot/comparison names as storage identifiers, not arbitrary paths | Prevents `clean` from escaping `snapshots/` or `comparisons/`.                                 |
| Prefer a small prompt abstraction over enabling global interactive mode     | Keeps existing non-interactive commands unchanged and makes confirmation tests deterministic.  |
| Let `--all` proceed after confirmation, but require `--force` without a TTY | Gives humans a safety check and gives automation an explicit opt-in.                           |
| Do not cascade snapshot deletion into comparisons                           | Comparison diffs are stored independently and remain useful in the viewer.                     |
| Prompt for a name when neither `--name` nor `--all` is provided             | Implements the existing future note without adding a comparison-listing feature to this scope. |

## Proposed Command Contract

```text
breakcheck clean snapshot --name <name> [--force]
breakcheck clean snapshot --all [--force]
breakcheck clean comparison --name <name> [--force]
breakcheck clean comparison --all [--force]
```

- `--name` and `--all` are mutually exclusive.
- If neither is present, an interactive terminal prompts for a name; non-interactive execution fails with guidance to provide `--name` or `--all --force`.
- Named deletion confirms by default. Bulk deletion confirms by default and reports the number of entries targeted.
- `--force` suppresses confirmation only; it does not broaden the deletion target.
- A missing named entry is an error. `--all` against an empty store succeeds with a “nothing to clean” result.
- Deletion is limited to direct child directories under the selected `snapshots/` or `comparisons/` store.

## Issues Encountered

| Issue | Resolution |
| ----- | ---------- |
|       |            |

## Resources

- `system-docs/future.md`
- `packages/cli/src/cli/commands/`
- `packages/core/src/core/snapshot/`
- `packages/core/src/core/compare/`
- `packages/core/src/api/index.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/cli/commands/help.ts`
- `scripts/test-integration.mjs`
- `scripts/test-packaging.mjs`

## Visual/Browser Findings

- Not applicable.
