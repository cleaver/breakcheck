# Findings

- `packages/core/src/api/index.ts` now contains both new workflows. Existing API functions delegate their main work to `core/snapshot` and `core/compare`.
- `packages/core/src/core/snapshot/classes/SnapshotRepository.ts` already owns the file replacement operation. Snapshot creation removes any existing directory with the requested name, which makes a check name equal to the baseline ID unsafe.
- `packages/cli/src/cli/site-environment.ts` races the operation with an interruption promise; the losing operation keeps running. The previous review reproduced completion after the wrapper returned.
- Both `check` and `baseline update` use that same lifecycle wrapper. The update operation can mutate a named baseline.
- Crawlee exposes `teardown()` for immediate crawler shutdown. `BreakcheckCrawler` now invokes it when its optional `AbortSignal` is aborted and waits for teardown before settling.
- `packages/core/src/__tests__/compare/index.test.ts` asserts that added/removed URL sets pass. The modified comparison code now returns fail for that case.
- `scripts/test-packaging.mjs` invokes difference producing comparisons through a helper that expects exit code 0. These expectations need updating together with the unit test.
- The API now delegates check orchestration to `core/check`, route updates to `core/snapshot/update-routes`, and both workflows to `core/snapshot/route-coverage` for route validation.
- Root `task_plan.md`, `findings.md`, and `progress.md` contain a completed plan for `breakcheck compile`. This plan is isolated under `.planning/`.
