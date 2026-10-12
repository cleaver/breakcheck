# Using Breakcheck with coding agents

This guide describes a small feedback loop for coding agents working on a
website that has a Breakcheck baseline. It is reference material: load it when
a task changes user-visible website behavior, routes, content, or layout rather
than adding the whole guide to every agent session.

## What the check does

`breakcheck check` prepares and starts the configured local site when needed,
crawls the exact routes in `check.routesFile`, compares them with the named
`check.baselineSnapshot`, saves a report, and stops the managed server. A
configured `comparison.rulesDir` can normalize known dynamic content. The
regular check never modifies the baseline.

## Consumer project setup

Install Breakcheck as a development dependency:

```bash
npm install --save-dev @cleaver/breakcheck
```

Add a project script so the agent and developer use the same command:

```json
{
  "scripts": {
    "breakcheck:check": "breakcheck check --json"
  }
}
```

Configure a version-2 `breakcheck.config.json` with a `baseUrl`, `storageDir`,
and `check` section. The check section names an exact route manifest and a
baseline snapshot:

```json
{
  "version": 2,
  "baseUrl": "http://127.0.0.1:3000",
  "storageDir": ".breakcheck",
  "check": {
    "routesFile": "./breakcheck-routes.txt",
    "baselineSnapshot": "site-baseline"
  }
}
```

Add server `prepare` and `server.start` settings when Breakcheck should start
the site itself. If the site is already running, pass `--url` to skip those
lifecycle commands. Review configured commands before running the check; they
execute with the project's environment.

Create the initial named baseline from an approved, known-good site state, then
commit that snapshot with the project. Keep generated check snapshots,
comparisons, and reports out of version control while retaining the named
baseline.

For example, with the local site already running:

```bash
breakcheck snapshot \
  --url http://127.0.0.1:3000 \
  --url-file ./breakcheck-routes.txt \
  --name site-baseline
```

## Minimal project instructions

Keep the consumer repository's `AGENTS.md` focused on local decisions. For
example:

```markdown
For changes to user-visible website behavior, run `npm run breakcheck:check`.
Inspect the JSON report and comparison details when differences are found.
Do not update the committed baseline or rules just to silence a difference;
confirm that the change is expected before recording it.
```

The project's own instructions should identify its server start command, route
manifest, and any task-specific acceptance criteria. Those details vary by
consumer and should not be guessed from this package guide.

## Agent feedback loop

1. Read the task's expected behavior and identify which configured routes cover
   it. The check only visits routes listed in `check.routesFile`.
2. Make the code change and run the project's ordinary build and tests.
3. Run `npm run breakcheck:check`. The command writes one JSON object to stdout;
   build, server, and crawler output is written to stderr.
4. Interpret the result:
   - `status: "passed"` and exit code `0`: no route or page differences were
     found.
   - `status: "differences"` and exit code `1`: inspect `comparison` and its
     `resultsPath`, then decide whether each difference matches the task.
   - `status: "failed"` and exit code `2`: the check did not complete
     successfully. Fix the setup or execution problem; do not report this as a
     passing check.
5. If a difference is expected, describe it in the task result. Update only the
   accepted routes with `breakcheck baseline update --route <path> --json`,
   then rerun the check. Use `--all` only when every configured route is meant
   to change.

Do not use a baseline update or a new ignore rule to make an unexplained
difference disappear. If the expected result is unclear, report the difference
and ask before changing the committed baseline.
