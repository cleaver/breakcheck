# Task Plan: Add `clean snapshot|comparison`

## Goal

Design a safe, consistent CLI command for deleting named snapshots and comparisons, including explicit bulk deletion, confirmation behavior, tests, and user-facing documentation.

## Current Phase

Phase 5: Delivery

## Phases

### Phase 1: Requirements & Discovery

- [x] Inspect current CLI command conventions and storage/repository APIs
- [x] Identify deletion semantics, safety boundaries, and naming constraints
- [x] Record findings and open questions in `findings.md`
- **Status:** complete

### Phase 2: Planning & Structure

- [x] Choose command grammar and option behavior
- [x] Define core API/repository boundaries and failure behavior
- [x] Define focused unit, CLI, integration, and packaging coverage
- [x] Update this plan with the implementation sequence
- **Status:** complete

### Phase 3: Implementation

- [x] Add repository/API deletion operations
- [x] Add the `clean` command and confirmation/force handling
- [x] Add aliases/help text and documentation
- **Status:** complete

### Phase 4: Testing & Verification

- [x] Add tests for single-item, all-item, confirmation, cancellation, and error paths
- [x] Run typecheck, unit tests, CLI smoke/integration, and packaging checks
- [x] Review the final diff for accidental deletion scope
- **Status:** complete

### Phase 5: Delivery

- [x] Summarize behavior, files changed, and verification results
- [x] Leave the repository ready for implementation or user approval
- **Status:** complete

## Key Questions

No blocking questions. The plan uses the recommended defaults below; they can be changed before implementation.

## Decisions Made

| Decision                                                                                  | Rationale                                                                                                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Keep deletion behind an explicit `clean` command                                          | Makes destructive behavior visually distinct from read/create workflows.                                      |
| Plan separate snapshot and comparison deletion paths                                      | They have different storage repositories and different safety implications.                                   |
| Use `clean snapshot`/`comparison` with `[--name <name>]`, `[--all]`, and `[--force]`      | Matches the existing future-work note while making the target explicit.                                       |
| Allow `--all` after an interactive confirmation; require `--force` in non-interactive use | Preserves a safety gate without making local cleanup cumbersome.                                              |
| When no name is supplied, prompt for a name; reject ambiguous `--name` + `--all`          | Honors the planned interactive behavior and keeps automation deterministic.                                   |
| Leave comparisons intact when snapshots are deleted                                       | Comparisons contain self-contained diffs and remain viewable; cleanup must not cascade across artifact types. |
| Treat missing named artifacts as errors and empty `--all` as a successful no-op           | Catches typos while making cleanup scripts idempotent when there is nothing to remove.                        |
| Delete only direct child directories and never the storage root                           | Limits recursive deletion to recognized artifact entries and protects project storage.                        |
| Use a small `readline/promises` prompt adapter                                            | Uses a Node built-in, avoids changing global interactive mode, and is straightforward to inject in tests.     |

## Errors Encountered

| Error                                                                  | Attempt   | Resolution                                                                              |
| ---------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| New deletion tests reported missing repository methods                 | 1         | Expected red TDD baseline; implement repository deletion primitives next.               |
| CLI typecheck used stale core declarations and rejected logger options | 1         | Add logger flags to `CleanOptions`; rebuild the core workspace before checking the CLI. |
| `mise` reported an invalid `t3_code_alpha.appimage` shim               | recurring | Commands still completed; unrelated environment warning remains.                        |

## Notes

- The repository's future-work note already proposes `--name`, `--all`, interactive omission of the name, and `--force`.
- Recommended command contract:
  - `breakcheck clean snapshot --name <name>` deletes one snapshot after confirmation.
  - `breakcheck clean comparison --name <name>` deletes one comparison after confirmation.
  - `breakcheck clean snapshot|comparison --all` deletes all direct child artifact directories after confirmation.
  - `--force` skips confirmation but still requires either `--name` or `--all`.
  - With neither `--name` nor `--all`, an interactive terminal prompts for the name; a non-TTY invocation fails with an actionable error.
- Implementation sequence:
  1. Add name/path validation and repository deletion primitives, including count/name reporting for bulk deletion.
  2. Add public core API wrappers without exposing CLI flag parsing in core.
  3. Add the nested CLI command and prompt/confirmation adapter.
  4. Add help and README documentation; mark the future-work item complete.
  5. Add repository unit tests, CLI behavior tests, temporary-workspace integration coverage, and packaging smoke coverage.
- Implementation is complete following the contract above.
