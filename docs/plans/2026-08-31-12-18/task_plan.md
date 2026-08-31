# Task Plan: Inject the Breakcheck logger into Crawlee

## Goal

Route Crawlee lifecycle and crawler error logs through the selected Breakcheck Pino logger so snapshot output has one formatter, honors `--json-logs`, and does not emit duplicate lines.

## Current Phase

Phase 3: Test-First Implementation

## Acceptance Criteria

- Crawlee messages use the same Pino transport as Breakcheck command messages.
- Default CLI output is consistently pretty-printed with timestamps.
- `--json-logs` produces JSON for Crawlee and Breakcheck messages alike.
- Crawlee levels, prefixes, structured data, and exceptions remain useful after adaptation.
- The original `@apify/log` console output is replaced, rather than forwarded and duplicated.
- Core API consumers can continue to use the default logger without requiring CLI-only setup.
- Focused unit coverage and CLI/integration coverage protect the behavior.
- User-facing logging documentation describes the unified behavior.

## Phases

### Phase 1: Requirements & Discovery

- [x] Confirm the desired scope: inject the selected Breakcheck Pino logger into Crawlee.
- [x] Trace the CLI logger lifecycle and crawler invocation.
- [x] Verify Crawlee's logger injection/customization API and level model.
- [x] Reproduce the mixed output and verify JSON mode behavior.
- [x] Document findings in `findings.md`.
- **Status:** complete

### Phase 2: Planning & Structure

- [x] Choose a core-owned Crawlee-to-Pino adapter.
- [x] Define logger ownership, configuration timing, level mapping, and error handling.
- [x] Define the focused unit, CLI, integration, and packaging checks.
- [x] Record decisions and risks in `findings.md`.
- **Status:** complete

### Phase 3: Test-First Implementation

- [x] Add unit tests for the adapter's level, prefix, data, and exception mapping.
- [x] Add a test proving replacement of Crawlee's logger prevents duplicate console output.
- [x] Add CLI coverage for default pretty mode and `--json-logs`.
- [x] Run the new tests and observe the expected failures before implementation.
- **Status:** complete

### Phase 4: Implementation

- [x] Add a core-owned adapter implementing Crawlee's logger extension point.
- [x] Add one explicit configuration path that installs the adapter before crawler execution.
- [x] Make the selected CLI Pino logger available to that core configuration path without importing Crawlee as a CLI-only dependency.
- [x] Ensure core-originated error logs use the same selected logger where the current singleton design would otherwise bypass configuration.
- [x] Preserve the existing REST/server JSON logger behavior.
- **Status:** complete

### Phase 5: Verification & Documentation

- [x] Run focused unit tests, then the full unit suite.
- [x] Run build, CLI smoke, integration, and packaging checks.
- [x] Verify no duplicate Crawlee lines and inspect both pretty and JSON output manually.
- [x] Update the relevant README logging section and any API/development notes.
- [x] Run `git diff --check` and confirm generated artifacts are not included.
- **Status:** complete

### Phase 6: Delivery

- [x] Review the implementation against the acceptance criteria.
- [x] Summarize changed files, test results, and any remaining tradeoffs.
- **Status:** complete

## Key Questions

1. Should the adapter be public? Recommended: expose only the smallest core configuration function needed by the CLI; keep the adapter class internal.
2. How should Crawlee's `SOFT_FAIL` and `PERF` levels map to Pino? Recommended: `SOFT_FAIL` to `warn`, `PERF` to `debug` (or `trace` if the project elects to expose it), with `ERROR`, `WARNING`, `INFO`, and `DEBUG` mapped directly.
3. How should Crawlee's crawler prefix be represented? Recommended: preserve it as a structured `component`/`prefix` field while retaining a readable message in pretty mode.
4. Should global Crawlee logger state be restored? The CLI process is short-lived, but core library calls may share a process; decide whether configuration is scoped to a snapshot operation or documented as process-wide.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Adapt Crawlee's logger instead of intercepting stdout | The extension point preserves levels and structured data and avoids duplicate output. |
| Keep the adapter in `packages/core` | Core owns the Crawlee dependency; the CLI should not depend on Crawlee transitively. |
| Configure after selecting Pino and before creating/running the crawler | This lets `--json-logs` and pretty mode select the same transport for both log sources. |
| Test both output modes and duplicate suppression | The reported bug is formatting inconsistency, while accidental double emission is the main integration risk. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Local fixture could not bind a listening socket under the default sandbox (`listen EPERM`) | 1 | Re-ran the reproduction with approved local-network access; the successful crawl reproduced the mixed formats. |
| Git branch creation could not write `.git/refs` under the default sandbox | 1 | Re-ran the explicitly requested branch creation with approved repository metadata access. |
| Focused logger test imported the core index from the wrong relative path | 1 | Corrected `../../index.js` to `../index.js` before rerunning the RED test. |
| Exception forwarding referenced a renamed `_exception` parameter | 1 | Renamed the parameter to `exception` so Pino can receive the error field. |
| Integration logging regression failed on the existing un-timestamped Crawlee output | 1 | Expected RED result before CLI wiring; the captured output confirmed the intended failure seam. |
| JSON error-path regression could not parse the core's pretty-formatted validation error | 1 | Expected RED result; this confirms the shared core logger must follow CLI configuration. |

## Notes

- Do not commit generated `dist`, coverage, or TypeScript build-info files.
- Re-read `findings.md` before making the logger ownership decision during implementation.
