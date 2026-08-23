# Task Plan: Make Breakcheck installable and runnable from npm

## Goal

Make the published `@cleaver/breakcheck` package runnable by a fresh native-Node consumer, with coherent package naming, Node ESM output, build ordering, rules behavior, version reporting, tests, and packaging documentation.

## Current Phase

Phase 6: Fixture Integration Test

## Phases

### Phase 1: Requirements & Discovery

- [x] Reproduce the reported failures
- [x] Map package/build/CLI/rules architecture
- [x] Document findings
- **Status:** complete

### Phase 2: Planning & Structure

- [x] Choose NodeNext/build-order approach
- [x] Choose and document the `--rules` contract
- [x] Define regression and fresh-install test seams
- **Status:** complete

### Phase 3: Implementation

- [x] Fix package names and source imports
- [x] Make emitted packages native Node ESM
- [x] Fix CLI bin, version, rules, and error boundaries
- [x] Fix root build ordering and package exports
- [x] Update docs and release metadata as appropriate
- **Status:** complete

### Phase 4: Testing & Verification

- [x] Run focused regression tests
- [x] Run the complete test suite and root build
- [x] Run native-Node and fresh-install packaging checks
- [x] Validate `npm pack --dry-run` contents
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery

- [x] Review diff and package metadata
- [x] Report verification results and any release step requiring credentials
- **Status:** complete

### Phase 6: Fixture Integration Test

- [x] Add an npm-driven integration test around the before/after fixture servers
- [x] Make fixture ports configurable and run snapshot, compare, and view workflows
- [x] Assert persisted comparison results and clean up all temporary processes/files
- **Status:** complete

## Key Questions

1. What package layout and TypeScript configuration currently control emitted imports?
2. Should `--rules` accept a directory or a named built-in ruleset? Use the requested directory contract unless repository constraints require otherwise.
3. Which existing tests and fixtures can exercise installed-package snapshot, compare, and view behavior?

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Prefer `@cleaver/breakcheck-core` everywhere | It is the actual package name and avoids an undocumented compatibility package name. |
| Prefer native NodeNext output and `.js` relative imports | Consumers must load compiled ESM without `tsx` or `NODE_OPTIONS`. |
| Treat `--rules` as a directory containing `rules.breakcheck` | This matches the requested recommended CLI contract and makes help/documentation direct. |
| Keep planning artifacts in the repository workspace | Required for recovery and progress tracking during this multi-phase change. |
| Use root `tsc -b` plus a core asset-copy step for the root build | Existing project references encode core → CLI → server; this uses them directly while retaining templates/assets in published dist. |
| Convert all core relative source/test imports to `.js` | Core is the native ESM boundary; the test runner can be verified against the same specifiers. |
| Represent no rules as an optional ruleset and an empty `Ruleset` | This avoids a magic default file and makes an unfiltered comparison explicit. |
| Add a post-build Node packaging smoke script | Built-package/native-Node and temp-consumer checks need compiled dist and should not depend on Vitest aliases or source transpilation. |
| Keep package version changes at patch level only after implementation is verified | Release metadata should reflect a patch release without publishing from this environment unless explicitly authorized. |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Reported `env: ‘npx tsx’: No such file or directory` in published CLI | 1 | Replaced bin shebang with `#!/usr/bin/env node` and verified fresh install |
| Reported `ERR_MODULE_NOT_FOUND` for `breakcheck-core` | 1 | Replaced source, server, alias, manifest, and lockfile references with scoped package |
| Reported extensionless ESM imports in compiled core | 1 | Converted source imports and NodeNext build; native import passes |
| Reported unordered root workspace build | 1 | Root build now uses `tsc -b` project references core → CLI → server |
| Native CLI repro failed on extensionless core import | 1 | Explicit `.js`/`index.js` specifiers resolve in native Node |
| Shell inspection command had unmatched quote | 1 | Correct command quoting; no repository change needed |
| Planning patch used a stale context line twice | 1 | Re-read planning files and applied smaller exact patches |
| Vitest view tests hit sandbox `EPERM` while connecting to localhost:8080 | 1 | Reran with permission and made the test use an ephemeral port |
| Installed `breakcheck --version` printed `0.1.1` but exited 1 via interactive-commander | 1 | Direct version handling now exits successfully |
| Full test suite had one view assertion failure: `/diff` returned 200 instead of 400 | 1 | Fixed test port collision with unrelated Adminer on 8080 |
| `npm pack --dry-run` hit read-only npm cache path under sandbox | 1 | Escalated dry-run; both package contents pass |

## Notes

- Log every failed command or test in this file and `progress.md`.
- Re-read this plan before major implementation decisions.
