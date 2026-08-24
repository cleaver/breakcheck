# Development and release guide

This guide covers the local development workflow and the release process for
Breakcheck's npm packages.

Breakcheck requires Node.js 22 or newer. Use the repository root for all
commands unless a command says otherwise.

## Set up the repository

```bash
git clone https://github.com/cleaver/breakcheck.git
cd breakcheck
npm ci
```

`npm ci` installs the versions recorded in `package-lock.json`. Use `npm
install` when intentionally changing dependencies; commit the resulting
`package-lock.json` with the manifest changes.

## Build and test

The root build uses TypeScript project references and builds the packages in
dependency order. It also copies the core view assets and restores the
executable bit on the CLI entrypoint.

```bash
npm run build
```

The main development commands are:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the unit and component test suite once. |
| `npm run test:watch` | Run Vitest in watch mode while developing. |
| `npm run test:coverage` | Run the tests with V8 coverage. |
| `npm run test:cli-bin` | Build the CLI and invoke its compiled executable with native Node. |
| `npm run test:integration` | Build the project, start the before/after fixture servers, run snapshots and comparisons, and verify the viewer. |
| `npm run test:packaging` | Pack the core and CLI workspaces, install them in a temporary consumer with no `tsx`, and exercise the installed CLI, core import, snapshots, comparisons, and viewer. |

The integration test owns the fixture-server lifecycle. It starts the
before-version server, takes a snapshot, replaces it with the after-version
server, takes another snapshot, and then checks both filtered and unfiltered
comparisons. Temporary data and processes are cleaned up when the test exits.

For manual fixture debugging, the same servers can be started with a chosen
port:

```bash
BREAKCHECK_TEST_PORT=4173 npm run test-server:before
# Stop it, then:
BREAKCHECK_TEST_PORT=4173 npm run test-server:after
```

For CLI development, `tsx` is intentionally used only by the development
scripts; it is not required by consumers of the published package:

```bash
npm run dev:cli -- --help
npm run dev:debug -- --help
```

Before opening a pull request, run the high-value checks used by CI:

```bash
npm ci
npm run build
npm run test:cli-bin
npm test
npm run test:integration
npm run test:packaging
npm audit
```

CI runs this validation on Node.js 22 and 24 for pushes to `main` and pull
requests targeting `main`.

The repository also provides optional [just](https://github.com/casey/just)
recipes for the release workflow. `just` is not an npm dependency; the npm
scripts above remain the canonical development and CI interface.

```bash
just prerelease
```

`just prerelease` checks that the root, core, and CLI release versions match,
requires a clean checkout and npm authentication, confirms that neither
publishable package already has that version on npm, runs the complete build,
test, audit, and packaging checks, and stops before publishing. On success it
prints the exact `npm publish` commands.

`just release` runs the same preflight and then publishes core followed by the
CLI. Run it from an interactive terminal: npm retains the terminal's input and
output, so OTP prompts work normally. If npm needs browser-based login, run
`npm login` first; the recipe does not automate authentication. If the second
publish fails after core has been published, inspect the registry and publish
only the remaining package rather than rerunning the full preflight.

## Prepare a release

Only these workspaces are normally published:

- `@cleaver/breakcheck-core`: the programmatic API
- `@cleaver/breakcheck`: the `breakcheck` CLI

Do not use `npm publish --workspaces` because it would also select the
`breakcheck-server` workspace.

Create a release branch from an up-to-date `main`, and make the version change
in a pull request. Keep the root private package, core package, and CLI package
versions synchronized. The server workspace has its own version and is not
normally changed for a CLI/core release. Merge the approved version pull
request before publishing.

For example, for a patch release:

```bash
release_version=0.2.3
npm pkg set version="$release_version"
npm pkg set version="$release_version" --workspace=@cleaver/breakcheck-core
npm pkg set version="$release_version" --workspace=@cleaver/breakcheck
npm install --package-lock-only --ignore-scripts
```

Review all four files after the update:

```bash
node -e 'for (const file of ["package.json", "packages/core/package.json", "packages/cli/package.json", "packages/server/package.json"]) { const packageData = require(`./${file}`); console.log(`${file}: ${packageData.name}@${packageData.version}`); }'
git diff --check
```

For a minor or major core release, update the CLI and server dependency ranges
for `@cleaver/breakcheck-core` at the same time. Publish core first so that
the range required by the CLI is available when npm resolves its dependencies.

Use semantic versioning when choosing the release number. In the `0.x`
series, a minor version may contain breaking changes; document those changes
in the relevant README files.

## Validate the release candidate

After the version pull request is merged, update the local checkout and run the
complete checks from `main` before publishing:

```bash
git checkout main
git pull --ff-only
npm ci
npm run build
npm test
npm run test:coverage
npm run test:cli-bin
npm run test:integration
npm run test:packaging
npm pack --dry-run --workspace=@cleaver/breakcheck-core
npm pack --dry-run --workspace=@cleaver/breakcheck
```

The core package must contain its compiled JavaScript and declarations, view
templates, and public assets. The CLI package must contain an executable
`dist/index.js` with a `#!/usr/bin/env node` shebang. The packaging test checks
the core package contents and verifies that the installed CLI does not need a
consumer `tsx` dependency, a `breakcheck-core` symlink, or `NODE_OPTIONS`.
The CLI smoke test checks the executable bit; the two `npm pack --dry-run`
commands let you inspect the final file lists.

Confirm the npm account before publishing:

```bash
npm whoami
npm view @cleaver/breakcheck-core version
npm view @cleaver/breakcheck version
```

The publishing account needs permission to publish the `@cleaver` scope. If
the account uses two-factor authentication for publishing, npm will prompt
for the one-time password.

## Publish

Publish the core package first, then the CLI package:

```bash
npm publish --workspace=@cleaver/breakcheck-core --access public
npm view @cleaver/breakcheck-core version

npm publish --workspace=@cleaver/breakcheck --access public
npm view @cleaver/breakcheck version
```

npm package versions are immutable. If a package has already been published
at a version, do not try to republish it; fix the issue in a new patch version.

## Verify from a fresh consumer

After publishing, verify the exact version in a directory outside the
repository. `npx --no-install` is important here: it proves the executable
comes from the installed package rather than being downloaded or resolved
from a development dependency.

```bash
consumer_dir=$(mktemp -d)
trap 'rm -rf "$consumer_dir"' EXIT
cd "$consumer_dir"
npm init -y
npm install --save-dev @cleaver/breakcheck@0.2.3
npx --no-install breakcheck --help
npx --no-install breakcheck --version
```

The version command must print the published CLI version. For the complete
snapshot → compare → view check, run the packaging test locally before the
release; it uses a temporary local fixture site and exercises the same
installed-package path.

## Finish the release

Once the published package has passed fresh-consumer verification, create and
push a repository tag for the published version, for example:

```bash
git tag v0.2.3
git push origin v0.2.3
```

Optionally create a GitHub release from that tag with the user-facing changes
and upgrade notes.

Keep the release version, npm versions, git tag, and release notes aligned.
