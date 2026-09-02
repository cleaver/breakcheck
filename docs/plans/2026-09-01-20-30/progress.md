# Progress Log: Exact Snapshot URL Manifest

## Session: 2026-09-01

### Phase 0: Discovery and Planning

- **Status:** complete
- **Started:** 2026-09-01
- Actions taken:
  - Reviewed the snapshot CLI, public snapshot/crawler configuration, crawler orchestration, both crawler implementations, URL-list generation, tests, integration harnesses, package documentation, development guide, and relevant system documentation.
  - Confirmed the installed Crawlee API can receive an array of initial requests directly.
  - Agreed with the user on exact-manifest semantics, file and stdin input, strict validation, deduplication, aggregated diagnostics, and no link-following mode.
  - Created a phased TDD implementation plan with documentation and verification work.
- Files created/modified:
  - `task_plan.md` (created)
  - `findings.md` (created)
  - `progress.md` (created)

### Phase 1: Feature Branch and Baseline

- **Status:** complete
- Actions taken:
  - Created `feat/snapshot-url-manifest` from commit `5b6986f`.
  - Confirmed the branch worktree contains only the three new planning files.
  - Ran the focused existing snapshot and view tests before changing source code.
  - Confirmed no source code has changed.
- Files created/modified:
  - `task_plan.md` (updated)
  - `findings.md` (updated)
  - `progress.md` (updated)

### Phase 2: Red Tests for Manifest Parsing and Input Sources

- **Status:** complete
- Actions taken:
  - Added parser tests for ignored lines, empty input, strict invalid entries, line-aware aggregation, canonical deduplication, and invalid bases.
  - Added source-reader tests for explicit stdin, file input, and missing-file diagnostics.
  - Implemented the parser/resolver and source reader through successive red-green cycles.
- Files created/modified:
  - `packages/cli/src/__tests__/url-manifest.test.ts` (created)
  - `packages/cli/src/cli/url-manifest.ts` (created)
  - `packages/core/src/core/crawler/url-paths.ts` (created)
  - `packages/core/src/index.ts` (updated)

### Phase 3: Core Exact-Manifest Execution

- **Status:** complete
- Actions taken:
  - Added `SnapshotConfig.urlPaths` for in-memory programmatic manifests.
  - Added exact initial-request execution and disabled link discovery in both crawler implementations when a manifest is present.
  - Added core resolver and boundary tests; real crawler execution is covered by the compiled integration harness to avoid Crawlee's shared test-storage lifecycle.
  - Added core validation for invalid paths, include/exclude conflicts, and an insufficient `maxRequests` budget.
  - Verified invalid input is rejected before any request or snapshot directory is created.
- Files created/modified:
  - `packages/core/src/types/api.ts` (updated)
  - `packages/core/src/core/snapshot/index.ts` (updated)
  - `packages/core/src/core/crawler/index.ts` (updated)
  - `packages/core/src/core/crawler/implementations/cheerio.ts` (updated)
  - `packages/core/src/core/crawler/implementations/playwright.ts` (updated)
  - `packages/core/src/__tests__/snapshot/manifest.test.ts` (created)

### Phase 4: CLI Wiring and Diagnostics

- **Status:** complete
- Actions taken:
  - Added `--url-file <path>` with `-` reserved for stdin.
  - Added CLI parsing, contextual read errors, line-aware validation output, and non-zero failure for invalid manifests.
  - Added compiled integration coverage for file and stdin input and invalid manifests.
  - Built the workspaces after the package declaration boundary became stale; `npm run typecheck` passed afterward.
- Files created/modified:
  - `packages/cli/src/cli/commands/snapshot.ts` (updated)
  - `scripts/test-integration.mjs` (updated)

### Phase 5: Integration and Packaging Coverage

- **Status:** complete
- Actions taken:
  - Added and passed file, stdin, duplicate/comment, invalid-input, and no-partial-snapshot integration scenarios.
  - Existing recursive fixture coverage continues to pass as part of the same integration run.
  - Fresh-install packaging now covers the installed CLI option and the published `SnapshotConfig.urlPaths` type.
- Files created/modified:
  - `scripts/test-integration.mjs` (updated)

## Test Results

| Test                           | Input                                                                                                    | Expected                                               | Actual                                            | Status   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- | -------- |
| Planning-only session          | N/A                                                                                                      | No implementation tests required yet                   | No tests run                                      | Not run  |
| Markdown formatting            | Three planning files                                                                                     | Prettier accepts all files                             | All matched files use Prettier code style         | Pass     |
| Baseline snapshot/view tests   | `npm test -- packages/core/src/__tests__/snapshot/index.test.ts packages/cli/src/__tests__/view.test.ts` | Existing behavior passes                               | 2 files and 10 tests passed                       | Pass     |
| Manifest parser/source tests   | `npx vitest run packages/cli/src/__tests__/url-manifest.test.ts`                                         | Parser and source behaviors pass                       | 10 tests passed                                   | Pass     |
| Exact-manifest core test       | `npx vitest run packages/core/src/__tests__/snapshot/manifest.test.ts`                                   | Resolver and boundary constraints pass                 | 4 tests passed                                    | Pass     |
| Integration manifest scenarios | `npm run test:integration`                                                                               | File, stdin, invalid input, and existing workflow pass | Fixture integration test passed                   | Pass     |
| Full unit suite                | `npm test`                                                                                               | All unit tests pass                                    | 10 files and 88 tests passed                      | Pass     |
| CLI binary smoke test          | `npm run test:cli-bin`                                                                                   | Built native CLI entrypoint is executable              | Native CLI bin smoke test passed                  | Pass     |
| Fresh-install packaging        | `npm run test:packaging`                                                                                 | Packed CLI/core support manifest behavior              | Fresh-install packaging test passed               | Pass     |
| Initial typecheck              | `npm run typecheck` before rebuilding core declarations                                                  | New package export is visible to CLI                   | Failed on stale `packages/core/dist` declarations | Resolved |
| Typecheck after build          | `npm run build`, then `npm run typecheck`                                                                | All workspace declarations and source types pass       | Passed with no diagnostics                        | Pass     |

## Error Log

| Timestamp  | Error                                                                                                        | Attempt | Resolution                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-01 | Local `origin/main` tracking still shows current `main` ahead by two commits after the user reported pushing | 1       | Avoided fetching or pushing; plan branches from the current committed `HEAD`.                                                    |
| 2026-09-01 | `git switch -c` could not create a ref lock because `.git` is read-only in the default sandbox               | 1       | Re-ran only the branch-creation command with approved elevated permission; branch creation succeeded.                            |
| 2026-09-01 | Initial Prettier check reported style differences in the three new Markdown files                            | 1       | Ran Prettier with `--write`; the final check passed.                                                                             |
| 2026-09-01 | Multiple in-process crawler runs lost Crawlee's process-global session-pool state                            | 1       | Kept real crawler assertions in the separate-process integration harness; core unit tests cover pure resolver/boundary behavior. |
| 2026-09-01 | CLI typecheck could not see the newly exported core resolver in stale `packages/core/dist` declarations      | 1       | Rebuilt the workspace references, then reran typecheck successfully.                                                             |

## 5-Question Reboot Check

| Question             | Answer                                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Where am I?          | Parser, core exact execution, CLI wiring, documentation, packaging coverage, and verification are complete.                                  |
| Where am I going?    | Review the final diff and hand off the feature branch without committing generated build output.                                             |
| What's the goal?     | Crawl exactly a validated path manifest supplied by file or stdin, with no discovery.                                                        |
| What have I learned? | See `findings.md`.                                                                                                                           |
| What have I done?    | Created the branch/plan and implemented the parser, exact crawler mode, CLI file/stdin input, documentation, and full verification coverage. |
