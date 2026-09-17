# Plan: Project configuration and `breakcheck init`

Status: implemented; verification in progress.

## Scope and recommended contract

Add a versioned `breakcheck.config.json` containing persistent project defaults,
automatic CLI configuration discovery, explicit configuration selection, and
`breakcheck init` for creating the file. Add opt-in interactive initialization
after the non-interactive path works. No release or version bump is included.

Example:

```json
{
  "version": 1,
  "baseUrl": "https://example.com",
  "storageDir": ".breakcheck",
  "crawl": {
    "crawlerType": "cheerio",
    "maxDepth": 3,
    "maxConcurrency": 5,
    "includePatterns": [],
    "excludePatterns": []
  },
  "comparison": {
    "rulesDir": "./rules"
  }
}
```

- JSON only initially; do not execute JavaScript configuration or add YAML dependencies.
- `version` is required; all settings are optional. Reject unknown fields,
  unsupported versions, invalid types, non-HTTP(S) URLs, invalid crawler types,
  negative/non-integer depth, and non-positive/non-integer concurrency.
- Keep the first schema limited to URL, artifact storage, currently exposed crawl
  defaults, and rules directory. Defer environment profiles, secrets, manifest
  defaults, viewer settings, generic `config set`, and migration tooling.
- `storageDir` holds `snapshots/` and `comparisons/`. It does not relocate Crawlee's
  temporary datasets or queues; document that distinction explicitly.

## Discovery, precedence, and paths

1. `--config <file>` selects exactly that file; resolve the flag from invocation
   cwd. A missing explicit file is an error.
2. Otherwise search from invocation cwd upward for the nearest
   `breakcheck.config.json`, stopping at the filesystem root. Use only that file;
   do not merge ancestor configurations. This permits package-specific monorepo settings.
3. `--no-config` disables discovery; reject it together with `--config`.
4. If no file exists, preserve current CLI defaults and `findRootDir()` storage
   behavior. Malformed or unreadable discovered files fail with their path and
   field details, before crawling, writing, or deleting anything.
5. Explicit command flags override file values, which override existing defaults.
   Merge fields within sections; arrays replace rather than concatenate. Empty
   arrays clear configured filters. Add `--no-include`, `--no-exclude`, and
   `compare --no-rules` as explicit ways to clear configured defaults; reject
   contradictory positive/negative flags.
6. File paths resolve from the configuration file's directory. CLI paths retain
   cwd-relative behavior. Resolve paths once and pass absolute values downstream.
7. If a file omits `storageDir`, retain legacy storage resolution. Generated init
   files explicitly record the current legacy storage location relative to the
   new file, so initializing an existing project does not hide its artifacts.
   Users opt into `.breakcheck` with `init --storage-dir .breakcheck`.
8. Validate manifest/filter conflicts after merging settings. A configured filter
   combined with `--url-file` fails clearly and points to the clearing flags.
9. Help and version commands work even when the project configuration is invalid.

## Implementation sequence

### 1. Typed configuration loader and resolver

- Add core configuration types, JSON parsing/validation, discovery, and path
  resolution with public exports through `packages/core/src/index.ts`.
- Separate loaded configuration (with source path) from effective command
  settings. Expose explicit loading for library consumers; existing core calls
  must not silently begin reading project files.
- Add focused tests first for discovery, overrides, arrays, absent and malformed
  files, unknown keys, numeric boundaries, and relative/absolute paths.

### 2. Explicit storage context throughout core

- Add a backward-compatible optional storage context to public creation,
  comparison, listing, deletion, and viewer entrypoints. Resolve legacy storage
  only when the caller omits the context.
- Thread the same resolved artifact root to snapshot and comparison repositories
  and `startViewServer`; avoid `process.chdir()` and mutable global configuration.
- Reuse custom-directory repository seams. Avoid comparison initialization when
  opening a store for listing or deletion.
- Preserve clean's artifact-type isolation and direct-child deletion constraints.
  Verify invalid configuration fails before clean and test symlinked storage and
  targets so configured paths cannot bypass the intended deletion boundary.
- Test two explicit storage contexts in one process without cross-project access.

### 3. Integrate every CLI command

- Add shared `--config`/`--no-config` handling, including nested clean commands;
  document and test supported flag placement before and after command names.
- Remove eager Commander defaults for configurable settings, or use explicit
  option-source tracking so defaults cannot override file values.
- Make snapshot URL validation happen after resolution: a configured URL satisfies
  the requirement, while no URL anywhere produces an actionable error.
- Apply configured rules and crawl defaults, clearing flags, and merged validation.
- Pass the same storage context through snapshot, compare, view, list-snapshots,
  clean snapshot, and clean comparison. Preserve no-config behavior and exit codes.

### 4. Non-interactive initialization

```text
breakcheck init [--url <url>] [--storage-dir <directory>] [--rules <directory>]
breakcheck init --config <destination-file> [other options]
```

- Default destination: `breakcheck.config.json` in cwd. Init chooses its destination
  directly and does not edit a discovered ancestor configuration.
- Generate valid, formatted version-1 JSON with current crawl defaults and explicit
  legacy storage location unless overridden. URL and rules may be omitted; do not
  write placeholder URLs or point at a nonexistent rules file by default.
- Resolve init path flags from cwd, then serialize them relative to the destination
  directory. Validate before writing. Require the destination parent to exist.
- Use exclusive creation; refuse an existing file or symlink without overwriting.
  Do not add an overwrite flag in this first increment.
- Report the created file, resolved artifact location, and next command. Write only
  the configuration; do not move data, create rules, or change `.gitignore`.

### 5. Opt-in interactive initialization

```text
breakcheck init --interactive
```

- Prompt for omitted URL, storage location, rules location, and crawl defaults.
  Explicit flags supply fixed values and suppress the corresponding questions.
- Reuse a testable prompt adapter; support skipping optional fields, validation
  retries, and cancellation with no file written.
- Require a terminal for `--interactive`. Plain init remains deterministic in CI.
- Persist through the same validated exclusive writer as non-interactive init.
  Existing configuration is edited manually initially; interactive editing is deferred.

### 6. Documentation and end-to-end verification

- Update root, CLI, and core READMEs plus `system-docs/api.md`, architecture,
  and future-work notes with discovery, precedence, schema, and path examples.
- Include a monorepo example and an existing-project example showing that init
  retains artifact visibility. Explain that changing storage does not migrate data.
- Extend temporary-workspace integration tests: init, snapshot without --url,
  configured rules, viewer, listing, and cleanup in a configured store. Keep
  sentinel artifacts in the legacy store and assert they survive configured clean.
- Test config selection from subdirectories, overrides, --no-config, malformed
  config failure before mutation, existing-file refusal, and interactive cancellation.
- Extend fresh-install packaging coverage for init, discovery, public exports,
  and declarations. Confirm the installed package needs no development tools.
- Run build, typecheck, unit tests, CLI smoke, integration, packaging, and
  `git diff --check`. Use focused red/green cycles during implementation.

## Completion criteria

A project can initialize configuration once, run the entire snapshot/compare/view/
list/clean workflow using its defaults, and override them explicitly. Existing
unconfigured projects and existing core API calls retain their behavior. Initialization
does not overwrite configuration or relocate artifacts. All new public behavior is
documented and tested from an installed consumer.

## Evidence from the current implementation

- `packages/core/src/lib/root.ts`: storage currently uses workspace discovery or cwd.
- `packages/core/src/api/index.ts`: individual operations instantiate repositories
  independently without a shared storage context.
- `packages/core/src/core/view/index.ts`: the viewer independently resolves storage.
- `packages/cli/src/cli/commands/snapshot.ts`: URL is currently required by Commander;
  depth, concurrency, and crawler type receive eager defaults.
- `packages/cli/src/cli/commands/compare.ts`: rules currently come only from flags.
- `packages/core/src/core/crawler/`: Crawlee datasets use separate global configuration.
- `packages/server/src/index.ts`: comparison endpoint is a stub; implementing REST
  configuration is outside this milestone.
