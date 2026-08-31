# Findings & Decisions

## Requirements

- Inject the selected Breakcheck Pino logger into Crawlee.
- Make Crawlee's crawler lifecycle output honor the CLI's pretty/JSON logging mode.
- Preserve useful log levels, crawler prefixes, structured data, and exceptions.
- Avoid duplicate output from Crawlee's existing console logger.
- Keep the change compatible with the core API and REST/server logger usage.
- Add focused regression coverage and update user-facing logging documentation.

## Research Findings

- `packages/core/src/lib/logger.ts` creates Breakcheck's Pino logger. Pretty mode uses `pino-pretty` with `translateTime: "SYS:standard"`; JSON mode uses Pino's standard JSON output.
- `packages/cli/src/cli/utils.ts` creates a new Pino logger inside `configureLogger()`. The CLI command uses that returned logger for result messages.
- `packages/core/src/core/crawler/index.ts` calls `this.crawler.run(...)`; the lifecycle messages are emitted inside Crawlee, not by Breakcheck's `logger` wrapper.
- `packages/core/src/core/crawler/implementations/cheerio.ts` and the Playwright implementation construct Crawlee crawler instances without passing a logger.
- The installed Crawlee 3.18.1 package re-exports the global `@apify/log` instance and its `Logger`/`LoggerText`/`LoggerJson` extension classes.
- `@apify/log`'s default `LoggerText` has `skipTime: true`. Its `Log.setOptions({ logger })` API accepts a replacement logger, and its documentation explicitly supports custom logger implementations.
- Crawlee's `BasicCrawler` emits the observed messages through `this.log.info(...)`; replacing the underlying `@apify/log` logger is therefore sufficient to stop the original text output and route the calls elsewhere.
- Crawlee's numeric levels are `ERROR=1`, `SOFT_FAIL=2`, `WARNING=3`, `INFO=4`, `DEBUG=5`, and `PERF=6`. Pino has no exact `SOFT_FAIL` or `PERF` equivalents, so those require an explicit mapping.
- A successful fixture crawl reproduced the reported split. Adding `--json-logs` changed only Breakcheck's final lines; Crawlee's lines remained colored text, confirming the two logger paths are independent.
- Core modules import the exported `logger` singleton directly. Replacing only the CLI-local logger can leave core error messages on the original default Pino instance, so logger ownership should be addressed as part of implementation.
- There are currently no dedicated logger tests in `packages/*/src/__tests__`; the new tests should establish that seam.

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Use Crawlee's replacement-logger extension point | It preserves the structured call boundary and avoids parsing rendered text. |
| Implement the adapter in core | The Crawlee dependency belongs to `@cleaver/breakcheck-core`; this avoids adding a direct Crawlee dependency to the published CLI. |
| Install the adapter before crawler construction/execution | It guarantees lifecycle logs use the selected Pino logger from the first crawler message. |
| Map `ERROR→error`, `WARNING→warn`, `INFO→info`, `DEBUG→debug` | These mappings preserve the closest Pino severity. |
| Map `SOFT_FAIL→warn` and `PERF→debug` initially | Pino has no matching names; warning keeps soft failures visible, while performance diagnostics should not become normal informational output. Confirm with tests/documentation. |
| Preserve Crawlee's prefix as structured metadata and readable context | This keeps fields queryable in JSON while retaining `CheerioCrawler`/`PlaywrightCrawler` context in terminal output. |
| Do not use `log.on("line")` or intercept `console.*` | Those approaches observe already-rendered output, risk double emission, and lose original severity/fields. |
| Prefer one explicit logging configuration entrypoint over side effects in `createLogger()` | A logger factory should not unexpectedly reconfigure Crawlee's process-global logger every time it is called. |
| Make the exported core logger a live binding updated by `configureLogger()` | Core modules import the logger directly; updating the exported binding lets validation and other core error paths honor CLI-selected JSON/pretty mode. |
| Configure the default core logger for Crawlee at module initialization | Programmatic core consumers get a consistent default without requiring CLI-only setup. |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Default sandbox prevented the local fixture from listening | Used approved local-network access for reproduction; no repository code was changed. |
| CLI Pino logger and core default logger are separate instances | Include shared logger/configuration handling in the implementation phase rather than adapting Crawlee alone. |

## Resources

- `packages/core/src/lib/logger.ts`
- `packages/cli/src/cli/utils.ts`
- `packages/cli/src/cli/commands/snapshot.ts`
- `packages/core/src/core/crawler/index.ts`
- `packages/core/src/core/crawler/implementations/cheerio.ts`
- `packages/core/src/core/crawler/implementations/playwright.ts`
- `packages/core/src/index.ts`
- `packages/cli/src/__tests__/setup.test.ts`
- `scripts/test-integration.mjs`
- `scripts/test-packaging.mjs`
- `node_modules/@crawlee/core/log.d.ts`
- `node_modules/@apify/log/esm/index.d.mts`

## Visual/Browser Findings

- None.
