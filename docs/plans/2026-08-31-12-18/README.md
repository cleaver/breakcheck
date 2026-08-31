# Crawlee Logger Injection Plan

## Dates

- Plan created: 2026-08-31 (planning files first recorded during the implementation session)
- Archived: 2026-08-31 12:18 (America/Toronto)

## Goal

Route Crawlee lifecycle and crawler error logs through the selected Breakcheck
Pino logger so snapshot output has one formatter, honors `--json-logs`, and does
not emit duplicate lines.

## Accomplished

- Added a core-owned Crawlee-to-Pino adapter with severity, component, structured
  field, suffix, and exception forwarding.
- Updated the shared core logger and CLI configuration so Crawlee and core error
  messages follow the selected pretty or JSON transport.
- Added focused unit coverage and fixture integration coverage for formatting,
  level mapping, JSON error paths, and duplicate suppression.
- Updated root, CLI, and core logging documentation.
- Verified unit, integration, compiled CLI, and fresh-install packaging checks.

## Related Work

- Commit: [6c05336](https://github.com/cleaver/breakcheck/commit/6c05336)
- Pull request: [#7](https://github.com/cleaver/breakcheck/pull/7)
- Branch: `feat/inject-crawlee-logger`

The original planning files were copied here and remain in the project root for
user confirmation before deletion.
