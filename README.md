# Breakcheck

**A command-line tool for comparing website states to detect unintended content and structural changes after upgrades, deployments, or migrations.**

[![CI](https://github.com/cleaver/breakcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/cleaver/breakcheck/actions/workflows/ci.yml)

<p align="center">
<img src="./breakcheck-logo-notext-sm.png" alt="Breakcheck Logo" width="300">
</p>

Breakcheck helps developers and QA testers automate visual and structural regression testing. It works by taking a "snapshot" of a website before a change, another snapshot after, and then intelligently comparing them. You can define fine-grained rules to ignore dynamic content like ads, session IDs, or timestamps, ensuring you only get alerted to the changes that matter.

## Install from npm

```bash
npm install --save-dev @cleaver/breakcheck
# Verify the local install without allowing npx to download a fallback
npx --no-install breakcheck --help
npx --no-install breakcheck --version
```

Breakcheck requires Node.js 22 or newer.

## Run the CLI

From the root of the project where Breakcheck is installed, the simplest way
to run it is with `npx`:

```bash
npx breakcheck --help
npx breakcheck snapshot --url https://my-website.com --name before
```

`npx` uses the locally installed executable. If it cannot find one, it may
prompt to download a package. Use `npx --no-install breakcheck ...` when you
want the command to fail instead, which is useful for CI and installation
checks.

Installing Breakcheck does not create an `npm run breakcheck` script. To use
that form, add the script to the consuming project's `package.json`:

```json
{
  "scripts": {
    "breakcheck": "breakcheck"
  }
}
```

Then pass CLI arguments after `--`:

```bash
npm run breakcheck -- --version
npm run breakcheck -- snapshot --url https://my-website.com --name before
```

The command examples below use `breakcheck` as shorthand; use `npx breakcheck`
unless you have added this npm script or deliberately installed the CLI
globally.

## Upgrading to 0.2.0

`0.2.0` is a breaking release. String `ComparisonConfig.ruleset` values now name a directory containing `rules.breakcheck`, and relative directories resolve from the directory where Breakcheck is invoked. In a monorepo, run the command from the package that owns the rules or pass an absolute path. The old `startCliViewServer` export was removed; library users should use `startViewServer`, while CLI users should use `breakcheck view`. Import the core package through its public root entrypoint; deep imports are no longer supported.

## Development and tests

```bash
npm test
npm run test:cli-bin
npm run test:integration
npm run test:packaging
```

`test:cli-bin` rebuilds the CLI and runs its compiled entrypoint directly with native Node. `test:integration` starts the repository's before/after fixture servers, runs both snapshot and comparison paths, and checks the local viewer. It uses a temporary workspace and cleans it up automatically. `test:packaging` additionally packs both workspaces and verifies a fresh consumer can run the installed CLI without `tsx`.

See the [development and release guide](docs/development-and-release.md) for the full local workflow, CI checks, npm publishing sequence, and fresh-consumer verification.

## Core Workflow

The typical workflow for using Breakcheck involves five main steps:

1.  **📸 Take a "before" snapshot:** Crawl your production site to save its current state.
2.  **⚙️ Make your changes:** Deploy your update, migrate your CMS, or update your theme.
3.  **📸 Take an "after" snapshot:** Crawl the site again to capture the new state.
4.  **🔍 Compare the snapshots:** Run the comparison using a set of rules to filter out expected dynamic changes.
5.  **📊 View the results:** Launch a local web server to view a detailed diff report.

### Example

```bash
# 1. Snapshot the "before" state from your live site
npx breakcheck snapshot --url https://my-website.com --name production-live

# --- (Deploy your changes here) ---

# 2. Snapshot the "after" state
npx breakcheck snapshot --url https://my-website.com --name after-deployment

# 3. Compare the two snapshots using a rules directory
npx breakcheck compare --before production-live --after after-deployment --rules ./my-rules --output my-first-comparison

# 4. View the results in your browser
npx breakcheck view my-first-comparison
```

---

## The Breakcheck Rules DSL

To get meaningful comparisons, you need to tell Breakcheck what to ignore. This is done with a simple Domain Specific Language (DSL) in a `rules.breakcheck` file. The DSL allows you to target elements with CSS selectors and apply actions to them before the comparison runs.

### Syntax

Rules can be a single line for one action or a `do/end` block for multiple actions on the same element. Selectors use the full CSS syntax supported by Cheerio, including combinators, groups, pseudo-classes, escaped identifiers, and quoted attribute values. A selector and its `do:` or block `do` delimiter must share one physical header line; block `do` may only be followed by whitespace or a comment. Comments start with `--`.

Tailwind utility class names often contain colons, such as `prose-h1:font-bold`. Because `css:` selectors use CSS syntax, escape each colon when selecting the class directly:

```
css:.prose-h1\:font-bold do: exclude
```

This uses one backslash in a `rules.breakcheck` file. If the selector is supplied in JSON or a JavaScript string, encode that backslash as `\\`:

```json
"selector": ".prose-h1\\:font-bold"
```

As an alternative, use a class-token attribute selector, which does not require escaping the colon:

```
css:[class~="prose-h1:font-bold"] do: exclude
```

**Single Action:**

```
css:[SELECTOR] do: action [MODIFIERS...]
```

**Multiple Actions (Block):**

```
css:[SELECTOR] do
  action [MODIFIERS...]
  action [MODIFIERS...]
end
```

### Actions & Modifiers

- **Actions:**

  - `exclude`: Removes the selected element entirely.
  - `remove_attr`: Removes a specific attribute from an element.
  - `rewrite_attr`: Rewrites the value of an attribute, useful for normalizing URLs or IDs.
  - `rewrite_content`: Rewrites the text inside an element.

- **Named regions:**

  - `css:[SELECTOR] do: region name:"[IDENTIFIER]"`: Selects a named section for stable comparison ordering.

- **Modifiers:**
  - `attr:"<attribute_name>"`: Specifies the target attribute (e.g., `attr:"href"`).
  - `regex:"<pattern>"`: A regular expression for matching and capturing.
  - `replace:"<replacement>"`: The string to replace matches with. Can use capture groups like `$1`.
  - `content_regex:"<pattern>"`: Applies the action only if the element's text content matches the regex.
  - `name:"<identifier>"`: Names a region. Names must match `[A-Za-z_][A-Za-z0-9_]*` and be unique.

Modifier values are always double-quoted. Inside them, use `\"` for a quote and `\\` for a literal backslash; other backslash sequences such as `\d`, `\w`, and `\?` are preserved for regular expressions. Rules are validated when the engine is created, so empty rules, invalid selectors, invalid regular expressions, unknown modifiers, and action/modifier mismatches fail before any HTML is processed.

`include` remains an intentional no-op for compatibility. `rewrite_content` changes descendant text nodes independently while preserving nested elements and attributes; a regular-expression match cannot span an element boundary.

When named regions are present, Breakcheck applies all ordinary rules first, then selects regions from the transformed DOM. Only matched regions are compared; they are sorted alphabetically by exact name, while repeated matches retain document order. Each region includes the matched element's outer HTML and is wrapped in a stable synthetic document. Missing regions are allowed, and overlapping declarations are emitted independently.

### Rules Example (`rules.breakcheck`)

Here is an example rules file that demonstrates how to handle common dynamic content:

```
-- Breakcheck Rules File

-- Completely remove ad containers and session displays
css:.ad-container do: exclude
css:#session-id-display do: exclude

-- Exclude an element only if its content matches a pattern
css:.last-login do: exclude content_regex:"Logged in: \d+ minutes ago"

-- For all images, remove dynamic attributes and normalize the CDN host
css:img do
  remove_attr attr:"srcset"
  remove_attr attr:"sizes"
  rewrite_attr attr:"src" regex:"//cdn\d+\.example\.com/" replace:"//cdn.example.com/"
end

-- Normalize cache-busting query parameters on CSS and JS files
css:link[rel=stylesheet] do: rewrite_attr attr:"href" regex:"(\?|&)v=\w+" replace:"?v=STATIC"
css:script do: rewrite_attr attr:"src" regex:"(\?|&)v=\w+" replace:"?v=STATIC"

-- Rewrite dynamic timestamps and view counts inside elements
css:.timestamp do: rewrite_content regex:"\d{2}/\d{2}/\d{4}" replace:"DATE_STAMP"
css:.view-count do: rewrite_content regex:"\d{1,3}(,\d{3})* views" replace:"VIEW_COUNT views"

-- Compare layout sections in a stable order when their source order changes
css:#section-b do: region name:"Section_B"
css:#section-a do: region name:"Section_A"
```

---

## Command Reference

### `snapshot`

Crawls a website and saves its HTML content and structure to a named snapshot.

```
breakcheck snapshot [options]
```

| Option                        | Description                                                           | Default                         |
| :---------------------------- | :-------------------------------------------------------------------- | :------------------------------ |
| `-u, --url <url>`             | **(Required)** The base URL to start crawling from.                   |                                 |
| `-n, --name <name>`           | A unique name for the snapshot.                                       | `snapshot_YYYY-MM-DD_HH-mm-ssZ` |
| `-d, --depth <number>`        | Maximum crawl depth.                                                  | `3`                             |
| `-c, --concurrency <number>`  | Number of concurrent requests to make.                                | `5`                             |
| `-i, --include <patterns...>` | Glob patterns for URLs to include.                                    |                                 |
| `-e, --exclude <patterns...>` | Glob patterns for URLs to exclude.                                    |                                 |
| `-t, --type <type>`           | The crawler to use (`cheerio` or `playwright`).                       | `cheerio`                       |
| `--url-file <path>`           | Crawl exactly the root-relative paths in a file, or `-` for stdin.    |                                 |
| `-w, --write-urls <path>`     | Generate a plain text file of all crawled URLs at the specified path. |                                 |
| `--json-logs`                 | Output logs in JSON format (useful for automation).                   |                                 |
| `--no-json-logs`              | Output logs in pretty format (default, user-friendly).                |                                 |

#### Exact URL manifests

Use `--url-file` when the snapshot must contain exactly a supplied set of
paths. The required `--url` still supplies the site's origin, but `/` is not
added unless it appears in the manifest. Links found in listed pages are not
followed, and `--include`/`--exclude` cannot be combined with an exact
manifest.

The manifest is newline-delimited. Blank lines and full-line comments are
ignored; valid entries are root-relative paths beginning with one `/`.
Duplicates are removed in first-seen order. Invalid entries are all reported
with their source line, and the snapshot is aborted before crawling.

```text
# Pages selected for the regression check
/
/about-me
/blog/the-nephew-effect
/blog/you-might-be-losing-me
```

Use a file or stream a generated list through stdin:

```bash
breakcheck snapshot --url https://my-website.com --name selected \
  --url-file ./urls.txt

generate-url-list | breakcheck snapshot --url https://my-website.com \
  --name selected --url-file -
```

### `compare`

Compares two snapshots, applies rules, and saves the results.

```
breakcheck compare [options]
```

| Option                    | Description                                                                                                     | Default                      |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| `-b, --before <name>`     | **(Required)** The name of the "before" snapshot.                                                               |                              |
| `-a, --after <name>`      | **(Required)** The name of the "after" snapshot.                                                                |                              |
| `-o, --output <name>`     | A name for the comparison output directory.                                                                     | `compare_default`            |
| `-r, --rules <directory>` | Directory containing `rules.breakcheck`; relative paths resolve from the directory where Breakcheck is invoked. | None (unfiltered comparison) |
| `--json-logs`             | Output logs in JSON format (useful for automation).                                                             |                              |
| `--no-json-logs`          | Output logs in pretty format (default, user-friendly).                                                          |                              |

### `view`

Starts a local web server to display the results of a comparison in a user-friendly interface.

```
breakcheck view [comparison-name] [options]
```

| Argument          | Description                         | Default           |
| :---------------- | :---------------------------------- | :---------------- |
| `comparison-name` | The name of the comparison to view. | `compare_default` |

| Option                | Description                                                                                        | Default                 |
| :-------------------- | :------------------------------------------------------------------------------------------------- | :---------------------- |
| `-p, --port <number>` | The port to run the view server on. When omitted, starts at 8080 and uses the next available port. | `8080` (next available) |
| `--json-logs`         | Output logs in JSON format (useful for automation).                                                |                         |
| `--no-json-logs`      | Output logs in pretty format (default, user-friendly).                                             |                         |

### `list-snapshots`

Lists all snapshots that have been saved locally.

**Alias:** `lss`

```
breakcheck list-snapshots
```

The command outputs a table of available snapshots:

```
Name                | Date                      | Pages | Errors
--------------------|---------------------------|-------|-------
production-live     | 2025-06-10T16:05:40.123Z  | 152   | 0
after-deployment    | 2025-06-10T17:10:15.456Z  | 153   | 1
```

---

## Logging Options

Breakcheck provides flexible logging options to suit different use cases:

### Pretty Logging (Default)

By default, Breakcheck uses pretty-printed logs that are human-readable and include colors and formatting:

```bash
breakcheck snapshot --url https://example.com
# Output: ✅ Snapshot created successfully: snapshot_2025-01-15_10-30-45Z
```

### JSON Logging

For automation and integration with log aggregation systems, you can use JSON-formatted logs:

```bash
breakcheck snapshot --url https://example.com --json-logs
# Output: {"level":30,"time":1705315845000,"msg":"✅ Snapshot created successfully: snapshot_2025-01-15_10-30-45Z"}
```

### Logging Options

All commands support these logging options:

| Option           | Description                                        | Default |
| :--------------- | :------------------------------------------------- | :------ |
| `--json-logs`    | Output logs in JSON format (useful for automation) |         |
| `--no-json-logs` | Output logs in pretty format (user-friendly)       | ✓       |

Snapshot crawler lifecycle and error messages use the same logger as Breakcheck's
command messages. This means `--json-logs` also produces structured JSON for
Crawlee records, including a `component` field such as `CheerioCrawler`; the
default pretty output includes timestamps for both sources.

### Use Cases

- **Interactive use**: Use the default pretty logging for easy reading during development and testing
- **CI/CD pipelines**: Use `--json-logs` for structured logging that can be parsed by log aggregation tools
- **REST API**: The upcoming REST API will always use JSON logging for consistency
