# Findings

## Initial observations

- The repository is an npm-workspace monorepo with public `core` and `cli` packages.
- Existing artifact storage defaults to the workspace/root directory discovered by `findRootDir()`, with `snapshots/` and `comparisons/` beneath it.
- The prior clean-command work already exposes snapshot/comparison deletion through the core API and CLI.
- Snapshot and comparison operations currently create their own repositories, so configured storage must be threaded through those boundaries.
- The snapshot CLI currently makes `--url`, depth, concurrency, and crawler type eager/defaulted Commander options; config support requires distinguishing omitted flags from explicit overrides.
- The existing viewer independently resolves the comparison directory and therefore also needs the selected storage location.
- Crawlee's internal datasets/queues are separate from Breakcheck's artifact directories and should remain so.

## Decisions to verify while implementing

- Exact public shape for the optional storage context and backward-compatible repository overloads.
- Commander behavior when `--config`/`--no-config` appears before versus after a subcommand.
- How to represent explicit clearing of configured include/exclude/rules values without confusing omitted options.
- Whether config-file paths should be normalized to absolute paths at load time or only at operation boundaries.

## Confirmed decisions

- `ResolvedProjectConfig.storageDir` is always absolute. An omitted config storage path resolves to the legacy `findRootDir(cwd)` location; a configured path resolves relative to the config file.
- Configuration validation is strict and keeps the schema limited to version, base URL, storage directory, crawl defaults, and comparison rules directory.
- The config writer uses exclusive creation (`wx`), so existing files and symlinks are not overwritten.
- Public operations accept `{ storageDir }` as a second/options argument; repositories also expose shared-context constructors while retaining their existing custom-directory seams.
- `--config`/`--no-config` are parsed from raw CLI arguments so root-before-command and subcommand-after-command placement resolve identically; `init --config` is treated as its destination path.
- End-to-end verification confirms configured snapshot/compare/view/list/clean workflows use the selected root, while `--no-config` returns to legacy storage and malformed config prevents cleanup before mutation.
