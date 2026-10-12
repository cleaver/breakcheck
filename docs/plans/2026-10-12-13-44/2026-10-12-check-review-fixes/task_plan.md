# Plan: address check review findings

Status: implementation complete.

## Goal

Make site checks and baseline updates safe on interruption, protect stored baselines from name collisions, align tests with comparison exit codes, and move workflow logic into the established core modules.

## Scope and order

### 1. Lock down the behavior with focused tests

- Add a core API test where `runSiteCheck` receives the same `name` and `baselineSnapshotId`. It must reject before a crawl starts and leave baseline metadata, index, and page bytes unchanged.
- Add CLI lifecycle tests for interruption during readiness and during an operation. The wrapper must report interruption, stop its managed server, and leave no operation running after it returns. For baseline updates, an interruption before commit must leave the baseline unchanged.
- Update the comparison unit test for added and removed URLs to expect `overallResult: "fail"`.
- Update the packaging script's difference cases to expect exit code 1 while still reading and checking the saved comparison. Keep genuinely invalid comparisons on the existing error path.
- **Status:** complete

### 2. Refactor the core workflows

- Move `runSiteCheck`'s validation, capture, coverage checks, comparison, and status decision into `packages/core/src/core/check/index.ts`.
- Move `updateSnapshotRoutesFromConfig`'s staging, validation, replacement, and cleanup into `packages/core/src/core/snapshot/update-routes.ts` (or the existing snapshot module if that yields a clearer boundary).
- Extract the repeated route coverage check into one small helper in `core/snapshot`. It should verify each requested route exists, has an acceptable HTTP status, and that the captured page count matches the manifest.
- Keep `SnapshotRepository.replaceSnapshotRoutes` responsible for disk copying and atomic replacement. Keep public names and types at the package root. `api/index.ts` should resolve the storage context, construct dependencies, and delegate.
- Ensure the refactor preserves result shapes, error messages where public, storage selection, and cleanup behavior.
- **Status:** complete

### 3. Make interruption safe across the CLI/core boundary

- Change `withCheckEnvironment` to pass an `AbortSignal` to its operation and to abort that signal on SIGINT/SIGTERM. Thread it through the two CLI commands into the core workflows.
- Check the signal before starting work, after crawl/readiness awaits, and immediately before baseline replacement. Prevent a cancelled update from committing. Investigate Crawlee's shutdown API and use it to stop active crawling promptly if supported by the installed version.
- Do not let `Promise.race` return while its operation continues. Await operation settlement before reporting interruption and completing server cleanup. Keep signal listeners installed until cleanup is finished. Handle a signal arriving during process launch, readiness, and cleanup.
- Make `check` report exit code 2 and `baseline update` report failure on interruption. Preserve exactly one JSON result when `--json` is used.
- **Status:** complete

### 4. Guard check artifact names

- Reject `name === baselineSnapshotId` before calling snapshot creation. This guard applies to the public API as well as the CLI.
- Reuse the existing storage identifier validation; avoid changing general snapshot overwrite semantics outside this issue.
- **Status:** complete

### 5. Verify the complete change

- Run focused core and CLI tests first, then `npm run typecheck`, `npm run build`, `npm test`, `npm run test:cli-bin`, `npm run test:integration`, `npm run test:packaging`, and `git diff --check`.
- Inspect the final diff for public API exports, ESM `.js` imports, strict typing, generated files, and documentation accuracy. Update `system-docs/api.md` if the new module boundary changes its architectural description.
- **Status:** complete

## Acceptance criteria

- A check using the baseline ID as its output name fails before crawling and does not modify the baseline.
- Interruption cannot leave a check/update operation running after the CLI reports completion; a cancelled baseline update cannot commit later.
- Added or removed URLs still yield comparison failure, and unit, integration, and packaging checks expect the documented exit code.
- The API file acts as a facade; the check and update workflows live under `core/` and share one route coverage validator.
- All listed checks pass; no unrelated user changes are overwritten.

## Current evidence

- Prior review reproduced an operation completing after `withCheckEnvironment` reported SIGINT.
- `packages/core/src/__tests__/compare/index.test.ts` currently fails because it expects `pass` for changed URL sets.
- `scripts/test-packaging.mjs` still calls `runCli` for comparisons with differences even though the CLI now exits 1.
- The core API currently contains both new workflows directly.

## Errors encountered during planning

None. The existing root planning files belong to a completed compile feature and are preserved.

## Errors encountered during implementation

| Error | Resolution |
|-------|------------|
| The new baseline-collision regression test passed unexpectedly before the guard existed | Confirmed the destructive case returned `passed`; added the guard and retained the test as a regression check |
| Typecheck initially used stale core declaration output and reported the new `signal` option as unknown | Rebuilt the package declarations, fixed optional-server narrowing, and reran typecheck successfully |

## Verification results

- `npm run build` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed: 21 files, 138 tests.
- `npm run test:cli-bin` — passed.
- `npm run test:integration` — passed.
- `npm run test:packaging` — passed.
- `git diff --check` — passed.
