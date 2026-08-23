# Findings & Decisions

## Requirements

- A fresh consumer installs `@cleaver/breakcheck` and runs `npx --no-install breakcheck --help` and `--version` without a consumer `tsx` dependency, symlink, or `NODE_OPTIONS`.
- All references to `breakcheck-core` should use `@cleaver/breakcheck-core`, unless an explicit compatibility plan is added.
- Published output must be directly importable by native Node ESM.
- Root build must build core before CLI and server consumers.
- `--rules`, help, README, and tests must agree; no-rules comparison must be a valid unfiltered no-op.
- Core libraries throw; CLI owns process exit behavior.
- Add installed-package and fresh-install regression coverage and validate tarball contents.

## Research Findings

### Fixture integration workflow

- The root `test-server:before` and `test-server:after` scripts only launch the fixture servers and block; they do not currently orchestrate scans or comparisons.
- Both fixture scripts hard-code port 3000, so the automated test needs a configurable port to avoid collisions.
- The fixture routes are shared between before and after, while the after content changes stylesheet/image query strings and several DOM ids. This gives the integration test both unfiltered differences and rules-filtered equality to assert.
- The existing packaging test uses its own temporary fixture server. The new integration test should specifically exercise `packages/cli/src/__test_server__/server-before.js` and `server-after.js`.
- The first integration slice confirmed the expected gap: the test selected an ephemeral port, while the fixture announced and listened on port 3000. The fixture scripts now accept `BREAKCHECK_TEST_PORT` with 3000 retained as the manual default.
- Comparison `index.json` stores `metadata.totalPages` and `metadata.pagesWithDifferences`; `totalPagesCompared` and `overallResult` are API summary fields. The integration assertions use the persisted fields and infer the filtered pass from zero differences.
- The completed integration workflow uses `tmpdir()` and an ephemeral fixture/view port, so it does not leave snapshots, comparisons, or long-lived servers in the repository and does not require a justfile.

- Root `npm run build` currently passes with existing/generated artifacts, but its output runs the CLI package before core; the CLI has a TypeScript project reference to core, so a clean-build check is still required.
- Native `node packages/cli/dist/index.js --help` and `--version` both fail before command handling with `ERR_MODULE_NOT_FOUND` for `packages/core/dist/api/index`, confirming extensionless emitted ESM is an active local failure.
- `packages/cli/src/index.ts` starts with `#!/usr/bin/env npx tsx`; the published bin points at `dist/index.js`, so direct execution would also fail before the Node loader gets involved.
- CLI source imports `breakcheck-core`; `packages/server/src/index.ts` and `packages/server/package.json` do too. The actual core package manifest is `@cleaver/breakcheck-core`.
- `packages/core/src/core/rules/RulesDsl.ts` maps every string rules argument to `<root>/rules/<name>/rules.breakcheck`, while README/help describe a directory path. `compare.ts` supplies `options.rules` directly and defaults it to `default`.
- `package-lock.json` still contains a `node_modules/breakcheck-core` entry from the stale server dependency and must be regenerated after manifest changes.
- A compound shell inspection command failed with `zsh: unmatched "`; this was a command quoting error, not an application failure.
- Relative imports are already `.js` in the CLI entrypoint and command-to-command imports, but core source has extensionless imports throughout its API, view, crawler, snapshot, compare, rules, type, and index modules. Core test imports are also extensionless and should be kept compatible with the test runner when the source graph is converted.
- The root `tsconfig.json` already declares project references in core → CLI → server order, while the root npm script ignores that graph and invokes workspace scripts. A root `tsc -b` build can enforce the references, but core asset copying must remain part of the release build.
- `vitest.config.ts` aliases `breakcheck-core` to core source; that alias must move to `@cleaver/breakcheck-core` so tests verify the real package name.
- `RulesEngine.create` currently catches parser errors and calls `process.exit(1)`, which violates the requested library/CLI error boundary. `runComparison` cannot currently express no rules because `ruleset` is required and string values always load a file.
- The CLI version is hard-coded as `0.0.1` in `packages/cli/src/index.ts`; package metadata is `0.1.0`.
- The repository currently has both `node_modules/@cleaver/breakcheck-core` and a stale `node_modules/breakcheck-core` symlink; the latter is exactly the local workaround the consumer must not need.
- Existing core rules tests mock `path.join` and assert the old `rules/<name>/rules.breakcheck` path. They need to assert a supplied directory plus `rules.breakcheck`, while keeping parser tests focused on content.
- Existing Vitest coverage is core-focused; the CLI only has a setup test. A separate Node packaging smoke script is appropriate for built artifacts and temporary consumer behavior because it must run after build and exercise npm installation, native Node, a fixture HTTP site, and a long-lived view process.
- The first post-change `npm test` run passed CLI setup, compare, rules DSL, rules engine, and snapshot tests. The three existing view tests failed only when their HTTP client attempted localhost:8080 with sandbox `EPERM`; they need an unrestricted verification run.
- `npm install --package-lock-only --ignore-scripts` refreshed the workspace lockfile: only `@cleaver/breakcheck-core` remains as the core workspace dependency, with both published packages at `0.1.1`.
- A native build and runtime smoke already pass: `npm run build`, direct `node` CLI help/version, direct executable bin help, and a native ESM import of `packages/core/dist/index.js`.
- The first fresh-install run showed `interactive-commander`'s built-in version path prints correctly but exits with status 1. The CLI now handles `--version` and `-V` directly while still sourcing the version from its package manifest.
- With local-network permission, the full suite reached all view routes but one existing test expected `GET /diff` without `page` to return 400 and observed 200. This needs an isolated repro; it may be a test-server lifecycle/port collision rather than the route handler.
- Both package dry-run commands were blocked before packaging by the sandbox’s read-only npm cache at `/home/cleaver/.npm/_cacache/tmp/***`; rerun outside the sandbox restriction.
- The isolated view failure was environmental: localhost:8080 served an unrelated Adminer process. The test now binds port 0 and requests 127.0.0.1, and the focused view test passes all three cases.
- Escalated `npm pack --dry-run` succeeds for both packages and confirms core tarball contents include JavaScript, declarations, templates, and public assets. The build also cleans the separate test-config output so stale `dist/__tests__` files do not enter future packs.
- The final boundary audit finds `process.exit` only in CLI command handlers; core now exports `startViewServer` without owning process termination.
- Final verification is green: root build passes, Vitest reports 37/37 tests, the fresh-install packaging workflow passes, and both final package dry-runs list the required files.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Use `@cleaver/breakcheck-core` as the sole package import name | Matches `packages/core/package.json` intent and npm package naming. |
| Use NodeNext-compatible TypeScript settings and explicit `.js` source specifiers | Native Node ESM requires resolvable file extensions in emitted relative imports. |
| Use an explicit dependency-ordered root build if project references are not already structured | It is the smallest reliable fix for core → CLI → server. |
| Implement `--rules <directory>` | Recommended contract from the request; directory maps to `<directory>/rules.breakcheck`. |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Native package/runtime and test-environment failures during implementation | Fixed with NodeNext output, scoped imports, direct CLI version handling, optional directory rules, ephemeral view-test ports, and CLI-owned shutdown; all final checks pass. |

## Resources

- Root package/build files: `package.json`, `tsconfig.base.json`, `tsconfig.json`.
- Package manifests: `packages/core/package.json`, `packages/cli/package.json`, `packages/server/package.json`.
- CLI entrypoint and commands: `packages/cli/src/index.ts`, `packages/cli/src/cli/commands/`.
- Core API and tests: `packages/core/src/api/index.ts`, `packages/core/src/__tests__/`.

## Visual/Browser Findings

- None; this task is repository and CLI/package behavior.
