# Agent guidance

## Project

- Work from the repository root.
- Use Node.js 22 or newer and npm. Keep `package-lock.json` with dependency changes.
- This is an npm-workspace monorepo:
  - `packages/core`: public `@cleaver/breakcheck-core` API.
  - `packages/cli`: public `@cleaver/breakcheck` CLI.
  - `packages/server`: local server workspace.
- Read the relevant README, `docs/development-and-release.md`, and `system-docs/` before changing public behavior, the CLI, or the DSL.

## Development

- Prefer TDD (red, green, refactor): write or update a focused Vitest test, see it fail, make the smallest change, see it pass, then refactor.
- Keep tests in `packages/*/src/__tests__/**/*.test.ts`.
- Test observable behavior and error paths. Use temporary directories and fixtures; clean up files, servers, and processes.
- Add integration or packaging coverage for CLI, public API, install, or packaged-file changes.
- Avoid unnecessary dependencies.
- No repository lint or format command is configured. Follow nearby style and run `git diff --check`.

## TypeScript

- Preserve strict typing. Avoid `any`, unsafe casts, and non-null assertions; use `unknown`, narrowing, and discriminated unions.
- Type public APIs and external boundaries. Let simple local values infer their types.
- Keep ESM local imports on `.js` extensions. Use `node:` for new Node built-in imports.
- Keep consumer-facing core exports in `packages/core/src/index.ts`; do not depend on deep imports.
- Use the logger wrapper in `packages/core/src/lib/logger.ts` for application logging.
- Prefer small functions, explicit error handling, and promise-based I/O.

## Checks

- Install: `npm ci`
- Build: `npm run build`
- Unit tests: `npm test`
- Watch tests: `npm run test:watch`
- CLI smoke test: `npm run test:cli-bin`
- Integration test: `npm run test:integration`
- Packaging test: `npm run test:packaging`
- Coverage: `npm run test:coverage`
- CI runs the build, CLI, unit, integration, and packaging checks on Node 22 and 24.
- Do not commit generated `dist`, coverage, or TypeScript build-info files.

Update user-facing README or documentation for API, CLI, or DSL changes. Follow `docs/development-and-release.md` for release work.
