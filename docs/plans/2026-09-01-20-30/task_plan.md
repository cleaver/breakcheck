# Task Plan: Exact Snapshot URL Manifest

## Goal

Add a documented `snapshot --url-file <path|->` feature that crawls exactly the unique, valid, root-relative paths supplied by a file or stdin and never discovers additional links.

## Current Phase

Phase 7: final verification and handoff.

## Scope and Acceptance Criteria

- `breakcheck snapshot --url <base-url> --url-file <path>` reads a newline-delimited manifest from a file.
- `breakcheck snapshot --url <base-url> --url-file -` reads the same format from stdin.
- `--url` remains required and supplies the origin used to resolve manifest paths.
- Only root-relative path references beginning with exactly one `/` are accepted.
  - Valid examples: `/`, `/about`, `/blog/post?preview=1`, `/page#section`.
  - Invalid examples: `about`, `../about`, `https://example.com/about`, and `//other.example/about`.
- Blank lines and full-line comments whose first non-whitespace character is `#` are ignored. A `#` later in a path remains a URL fragment.
- Entries are URL-parsed and canonicalized against the base URL, then deduplicated while preserving first-seen order.
- All invalid entries are reported together with source and line number; any invalid entry aborts before crawling or writing a snapshot.
- An empty manifest after blank/comment removal is an error.
- Manifest mode schedules every remaining path as an initial request and does not call link discovery. `/` is crawled only when `/` appears in the manifest.
- No `--follow-links` option is added. Existing discovery behavior remains unchanged when `--url-file` is absent.
- `--type` and `--concurrency` continue to apply. `--include` and `--exclude` are rejected when used with `--url-file`; crawl depth has no effect in exact-manifest mode.
- The programmatic core API can provide an in-memory path list without exposing local file or stdin concepts.
- Existing `urlListPath` / `--write-urls` behavior remains output-only and unchanged.
- User-facing help, package READMEs, and relevant system documentation describe the format, stdin syntax, validation, and exact behavior.

## Phases

### Phase 1: Feature Branch and Baseline

- [x] Create `feat/snapshot-url-manifest` from the current committed `HEAD`.
- [x] Confirm the worktree contains only planning-file changes.
- [x] Run focused baseline tests before implementation and record results.
- **Status:** complete

### Phase 2: Red Tests for Manifest Parsing and Input Sources

- [x] Add focused Vitest tests for blank lines, CRLF, full-line comments, fragments, and first-seen ordering.
- [x] Add tests for canonical deduplication and an empty effective manifest.
- [x] Add table-driven invalid-entry tests for relative paths, full URLs, scheme-relative/cross-origin paths, malformed paths, and invalid base URLs.
- [x] Verify aggregated diagnostics include source labels and one-based line numbers.
- [x] Test file input relative to the invocation directory, missing/unreadable files, stdin input, and stdin read failures.
- [x] Run the focused tests and record the expected red failures.
- **Status:** complete

### Phase 3: Core Exact-Manifest Execution

- [x] Add an optional in-memory manifest field to the public snapshot configuration; use a name such as `urlPaths` and document that presence selects exact-manifest mode.
- [x] Keep the actual path list out of `crawlSettings` metadata to avoid duplicating large manifests in `metadata.json`; the saved snapshot index remains the record of successfully crawled paths.
- [x] Validate programmatic manifest input at the core boundary, including non-empty input and root-relative/same-origin constraints.
- [x] Resolve validated paths to absolute HTTP(S) request URLs using the required base URL.
- [x] Pass the resolved list to `crawler.run(initialRequests)` and explicitly suppress `enqueueLinks` for both Cheerio and Playwright implementations.
- [x] Preserve current recursive crawling behavior when no manifest is supplied.
- [x] Ensure request failures are reported through the existing crawl-error result without allowing discovery.
- [x] Add core resolver/boundary tests plus integration coverage proving listed paths are attempted, duplicates are attempted once, unlisted linked paths are not crawled, and `/` is not implicitly added.
- **Status:** complete

### Phase 4: CLI Wiring and Diagnostics

- [x] Add `--url-file <path>` to the snapshot command without a short alias; reserve `-` for stdin.
- [x] Implement a small promise-based line reader/parser with strict typing and no new dependency.
- [x] Aggregate manifest validation errors and fail with a non-zero status before calling `createSnapshotFromConfig`.
- [x] Map valid parsed paths to the core in-memory manifest field.
- [x] Reject `--include` or `--exclude` when manifest mode is selected, with a concise actionable message.
- [x] Keep `--url`, `--name`, `--type`, `--concurrency`, logging, and `--write-urls` behavior consistent with the existing command.
- [x] Update the detailed built-in help command and command examples.
- **Status:** complete

### Phase 5: Integration and Packaging Coverage

- [x] Use the fixture site's linked and unlisted routes to distinguish exact-manifest execution from recursive discovery.
- [x] Add integration coverage for file input that snapshots exactly the listed subset.
- [x] Add integration coverage piping a manifest through stdin.
- [x] Assert duplicate and comment handling through the compiled CLI.
- [x] Assert invalid manifests exit non-zero, report every invalid line, and do not create a snapshot.
- [x] Exercise the feature through the fresh-install packaging harness, including the published core type surface if it changes.
- [x] Confirm ordinary recursive snapshots still crawl the existing fixture unchanged.
- **Status:** complete

### Phase 6: Documentation

- [x] Update the root `README.md` command reference and add file/stdin workflow examples.
- [x] Update `packages/cli/README.md` with exact-manifest semantics and manifest grammar.
- [x] Update `packages/core/README.md` for the in-memory programmatic API field.
- [x] Update `system-docs/api.md` and `system-docs/system-architecture.md` for the source-to-crawler data flow.
- [x] Mark the `system-docs/future.md` URL-file item complete only after implementation and verification.
- [x] Update `system-docs/prd.md` with the exact-manifest requirement if the implementation establishes it as a supported product behavior.
- [x] Explicitly document that paths are root-relative, comments are full-line only, invalid input aborts the entire run, stdin uses `-`, and no links are followed.
- **Status:** complete

### Phase 7: Verification and Handoff

- [x] Run focused Vitest tests during red/green/refactor.
- [x] Run `npm run typecheck`, `npm run build`, `npm test`, `npm run test:cli-bin`, `npm run test:integration`, and `npm run test:packaging`.
- [x] Run `git diff --check` and inspect the complete diff for generated artifacts or unrelated changes.
- [x] Confirm no `dist`, coverage, or TypeScript build-info files are included.
- [x] Record final results in `progress.md` and prepare a concise handoff.
- **Status:** complete

## Proposed Data Flow

```text
file path or stdin (`--url-file <path|->`)
  -> CLI line reader (source + line number)
  -> strict path manifest parser (ignore, validate, canonicalize, deduplicate)
  -> SnapshotConfig.urlPaths (in-memory paths only)
  -> core boundary validation and base-URL resolution
  -> BreakcheckCrawler exact initial request list
  -> Cheerio/Playwright request handlers with link discovery disabled
  -> existing snapshot repository and optional `--write-urls` output
```

## Key Questions Resolved

1. **Is a manifest a seed list or an allowlist?** It is the complete request list. No additional links are discovered.
2. **How is stdin selected?** Explicitly with `--url-file -`; there is no implicit stdin detection.
3. **What URL forms are accepted?** Root-relative paths beginning with one `/` only; absolute, relative, and scheme-relative references are invalid.
4. **Does the base page run automatically?** No. `/` must appear in the manifest.
5. **How are invalid entries handled?** Collect all diagnostics with line numbers and abort the operation before crawling.
6. **Where is file I/O handled?** In the CLI. The public core API receives an in-memory path list so it remains usable by library and future network clients.
7. **Is Crawlee `RequestList` required?** No. The installed Crawlee API accepts an array in `crawler.run(...)`; a dedicated persistent request source is unnecessary for this feature.

## Decisions Made

| Decision                                                 | Rationale                                                                                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Use explicit `--url-file` input                          | Matches the existing roadmap wording and supports both files and explicit stdin without another option.                          |
| Make file mode exact                                     | Reusing a prior snapshot's URL list should produce a stable page set for before/after comparison.                                |
| Accept root-relative paths only                          | The generated file is path-only, `--url` supplies the origin, and rejecting other forms prevents accidental cross-site requests. |
| Parse and validate the complete manifest before crawling | Enables complete line-numbered diagnostics and guarantees invalid input leaves no partial snapshot.                              |
| Deduplicate canonical URLs in first-seen order           | Avoids duplicate requests while keeping diagnostics and execution deterministic.                                                 |
| Keep file/stdin concerns in the CLI                      | Prevents filesystem paths and process streams from leaking into the public core or future REST boundary.                         |
| Add an in-memory core manifest field                     | Supports custom-generated callers without requiring a temporary file.                                                            |
| Do not store the full manifest in crawl metadata         | Avoids duplicating potentially large input; the snapshot index records successful pages.                                         |
| Do not add `--follow-links`                              | Exact behavior is the feature contract and avoids a second crawl mode inside the option.                                         |

## Errors Encountered

| Error                                                                                   | Attempt | Resolution                                                                        |
| --------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| Git could not create the branch lock because `.git` is read-only in the default sandbox | 1       | Re-ran the scoped `git switch -c` command with user-approved elevated permission. |
| Initial Prettier check reported style differences in all three new Markdown files       | 1       | Ran the repository's Prettier formatter on the planning files.                    |

## Notes

- Preserve unrelated user changes and do not commit generated build output.
- Re-read this file before making public API or parser-semantic decisions.
- If implementation reveals that query strings or fragments cannot round-trip through Crawlee's request identity rules, add a focused decision and test rather than silently changing manifest semantics.
