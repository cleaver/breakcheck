# Findings & Decisions: Exact Snapshot URL Manifest

## Requirements

- Add exact path-manifest input to `snapshot` from either a file or stdin.
- Crawl only listed paths; do not discover or follow links.
- Ignore blank lines and full-line `#` comments.
- Reject malformed, unsupported, and cross-origin entries.
- Deduplicate valid entries.
- Report invalid entries clearly, preferably all at once with line numbers.
- Do not support a follow-links mode.
- Include implementation, test, and user/system documentation work in the plan.
- Work on a feature branch after the previously unrelated change was committed.

## Repository Findings

- The roadmap already lists `breakcheck snapshot --url-file` in `system-docs/future.md`.
- `packages/cli/src/cli/commands/snapshot.ts` currently requires `--url`, maps CLI options into public `SnapshotConfig`, and calls `createSnapshotFromConfig`.
- `--write-urls` maps to `SnapshotConfig.urlListPath`; this is an output path and should not be overloaded as input.
- `SnapshotRepository.generateUrlList` writes normalized path-only entries from the snapshot index, matching the proposed manifest grammar.
- `BreakcheckCrawler.crawl()` currently hard-codes one initial request: `crawler.run([config.baseUrl])`.
- Both crawler implementations call `enqueueLinks` from every successful page, so exact mode must explicitly suppress those calls rather than merely adding more initial requests.
- The installed Crawlee 3.18.1 API accepts an array of initial requests in `crawler.run(...)`; `RequestList` is not needed for this feature.
- Current include/exclude patterns are applied only during `enqueueLinks`, not to initial requests. In exact mode they would be misleading, so the CLI should reject their combination with `--url-file`.
- Snapshot metadata persists `crawlSettings`; putting a large path array inside `CrawlerConfig` would duplicate the manifest. A separate optional `SnapshotConfig` field avoids that duplication.
- The snapshot repository normalizes stored page URLs to pathname + search + hash, so root-relative manifest input naturally aligns with comparison keys.
- A real-crawler unit harness was unstable because Crawlee's global storage/session-pool state can be purged while another test initializes. Exact request behavior is covered by the separate-process integration harness; core unit tests cover resolver and boundary behavior.
- The first CLI typecheck after adding the core resolver saw stale declarations in `packages/core/dist`; rebuilding the referenced workspaces refreshed the package boundary and the typecheck passed.
- The first compiled integration attempt correctly failed with `unknown option '--url-file'`; after CLI wiring, the file-input scenario passed.
- The compiled integration harness now proves an edited file manifest, stdin input, duplicate/comment handling, invalid-line aggregation, and no partial invalid snapshot.
- CLI command behavior is documented consistently in the root README, CLI README, and the hand-written detailed help command.
- Public core behavior is documented in `packages/core/README.md`, `system-docs/api.md`, and `system-docs/system-architecture.md`.
- Existing integration and packaging scripts exercise the compiled and freshly installed CLI and are the appropriate place for end-to-end manifest coverage.
- The worktree was clean when planning began. Local Git status reported `main...origin/main [ahead 2]`; `feat/snapshot-url-manifest` was created from the current committed `HEAD` without assuming the local remote-tracking ref was freshly fetched.
- The first multi-run core crawler test lost Crawlee's process-global session-pool state; the stable unit coverage uses one exact crawl, while repeated CLI crawls remain covered in separate integration processes.
- The compiled integration harness now passes file and stdin manifests, duplicate/comment handling, aggregated invalid-line diagnostics, and the no-partial-snapshot guarantee.

## Technical Decisions

| Decision                                                              | Rationale                                                                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interpret “no need for absolute/relative” as root-relative-only input | This matches generated `urls.txt` examples and keeps the base origin controlled by required `--url`.                                                   |
| Reject `//host/path` separately as cross-origin/scheme-relative       | It begins with `/` but can change authority when resolved by the URL parser.                                                                           |
| Treat comments as full-line only                                      | Preserves `#fragment` when it appears after a valid path.                                                                                              |
| Read stdin only when the option value is `-`                          | Prevents accidental hangs and is conventional for Unix pipelines.                                                                                      |
| Buffer validation results before starting the crawl                   | Required to aggregate all errors and avoid partial snapshots. The CLI accepts a stream source while retaining line numbers for diagnostics.            |
| Preserve first-seen order during deduplication                        | Gives deterministic behavior and intuitive diagnostics.                                                                                                |
| Keep ordinary snapshot discovery unchanged                            | Limits regression risk and makes manifest mode opt-in.                                                                                                 |
| Use TDD                                                               | Required by repository guidance and especially valuable for parser/error behavior.                                                                     |
| Test exact crawling in the separate-process integration harness       | Crawlee's process-global storage lifecycle makes concurrent in-process crawler tests unreliable; core unit tests cover resolver and boundary behavior. |

## Risks and Edge Cases

- An empty file, a comment-only file, or input containing only duplicates is rejected when it has no effective path.
- Query strings and fragments participate in the generated path format; parser tests preserve fragments and canonical duplicate tests cover query strings.
- URL parsing may normalize dot segments and encoding. Deduplication should happen after the same canonicalization used to create requests.
- `maxRequests` lower than the unique manifest size is rejected before crawling so Crawlee cannot silently omit a listed request.
- Manifest parse/read failures are surfaced by the CLI with a non-zero exit code before snapshot creation.
- File paths resolve from the invocation directory, consistent with other CLI file options; stdin is selected explicitly with `--url-file -`.

## Relevant Files

- `packages/cli/src/cli/commands/snapshot.ts`
- `packages/cli/src/cli/commands/help.ts`
- `packages/core/src/types/api.ts`
- `packages/core/src/core/snapshot/index.ts`
- `packages/core/src/core/crawler/index.ts`
- `packages/core/src/core/crawler/implementations/cheerio.ts`
- `packages/core/src/core/crawler/implementations/playwright.ts`
- `packages/core/src/core/snapshot/classes/SnapshotRepository.ts`
- `packages/core/src/__tests__/snapshot/index.test.ts`
- `scripts/test-integration.mjs`
- `scripts/test-packaging.mjs`
- `README.md`
- `packages/cli/README.md`
- `packages/core/README.md`
- `system-docs/api.md`
- `system-docs/system-architecture.md`
- `system-docs/prd.md`
- `system-docs/future.md`
- `docs/development-and-release.md`

## Issues Encountered

| Issue                                                                                                               | Resolution                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| User said the previous change was pushed, while local tracking reports `main` ahead of `origin/main` by two commits | Treat current committed `HEAD` as the requested branch point and avoid network or remote mutations during planning. |
| The managed sandbox exposes `.git` read-only by default                                                             | Created the requested branch through a narrowly scoped, approved elevated Git command.                              |
| The first Markdown formatting check found style differences                                                         | Formatted all three planning documents with the repository's installed Prettier version.                            |
| Multiple in-process crawler runs lost Crawlee's process-global session-pool state                                   | Kept one crawler run in the focused core test; repeated CLI runs use separate integration processes.                |
| CLI typecheck could not see the new core resolver export                                                            | Rebuilt workspace declarations, then reran typecheck successfully.                                                  |
