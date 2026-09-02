# Plan Archive: Exact Snapshot URL Manifest

## Dates

- Plan created: 2026-09-01, based on the planning-file timestamps.
- Archived: 2026-09-01 20:30 (America/Toronto).

## Goal

Implement a documented `snapshot --url-file <path|->` feature that crawls exactly the unique, valid, root-relative paths supplied by a file or stdin, without discovering additional links.

## Accomplishments

- Added strict manifest parsing, canonicalization, deduplication, and aggregated line-aware diagnostics.
- Added exact-manifest support to the public core API and disabled link discovery in exact mode.
- Wired CLI file and stdin input, option validation, help text, and documentation.
- Added unit, integration, CLI, and packaging coverage.
- Completed build, typecheck, unit, CLI, integration, packaging, and diff checks.

## Related work

The work is on branch `feat/snapshot-url-manifest`, based at commit [`5b6986f`](https://github.com/cleaver/breakcheck/commit/5b6986f). Implementation changes remain in the working tree and are not committed by this archive operation.
