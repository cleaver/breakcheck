# Project configuration implementation

## Objective

Implement the versioned `breakcheck.config.json` workflow described in
`docs/plans/project-configuration.md`, including discovery, CLI overrides,
storage propagation, `breakcheck init`, tests, and user-facing documentation.

## Phases

- [complete] 1. Reconfirm repository behavior and establish focused tests.
- [complete] 2. Add typed configuration loading, discovery, validation, and resolution.
- [complete] 3. Thread an explicit artifact-storage context through core operations.
- [complete] 4. Integrate configuration and `init` into every affected CLI command.
- [complete] 5. Add documentation, integration/packaging coverage, and run the full checks.
- [complete] 6. Review the diff, update progress/findings, and hand off the result.

## Working constraints

- Preserve existing unconfigured CLI and public-core behavior.
- Keep configuration loading explicit in the CLI; library calls do not implicitly read config files.
- Keep paths safe and deterministic; never use process-wide `chdir` or global mutable configuration.
- Use focused red-green-refactor tests before implementation changes.
- Do not commit generated `dist`, coverage, or TypeScript build-info files.
