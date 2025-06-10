# Breakcheck

**A command-line tool for comparing website states to detect unintended content and structural changes after upgrades, deployments, or migrations.**

<p align="center">
<img src="./breakcheck-logo-notext-sm.png" alt="Breakcheck Logo" width="300">
</p>

Breakcheck helps developers and QA testers automate visual and structural regression testing. It works by taking a "snapshot" of a website before a change, another snapshot after, and then intelligently comparing them. You can define fine-grained rules to ignore dynamic content like ads, session IDs, or timestamps, ensuring you only get alerted to the changes that matter.

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
breakcheck snapshot --url https://my-website.com --name production-live

# --- (Deploy your changes here) ---

# 2. Snapshot the "after" state
breakcheck snapshot --url https://my-website.com --name after-deployment

# 3. Compare the two snapshots using a rules file
breakcheck compare --before production-live --after after-deployment --rules ./my-rules --output my-first-comparison

# 4. View the results in your browser
breakcheck view my-first-comparison
```

---

## The Breakcheck Rules DSL

To get meaningful comparisons, you need to tell Breakcheck what to ignore. This is done with a simple Domain Specific Language (DSL) in a `rules.breakcheck` file. The DSL allows you to target elements with CSS selectors and apply actions to them before the comparison runs.

### Syntax

Rules can be a single line for one action or a `do/end` block for multiple actions on the same element. Comments start with `--`.

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

- **Modifiers:**
  - `attr:"<attribute_name>"`: Specifies the target attribute (e.g., `attr:"href"`).
  - `regex:"<pattern>"`: A regular expression for matching and capturing.
  - `replace:"<replacement>"`: The string to replace matches with. Can use capture groups like `$1`.
  - `content_regex:"<pattern>"`: Applies the action only if the element's text content matches the regex.

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
| `-w, --write-urls <path>`     | Generate a plain text file of all crawled URLs at the specified path. |                                 |

### `compare`

Compares two snapshots, applies rules, and saves the results.

```
breakcheck compare [options]
```

| Option                | Description                                                   | Default           |
| :-------------------- | :------------------------------------------------------------ | :---------------- |
| `-b, --before <name>` | **(Required)** The name of the "before" snapshot.             |                   |
| `-a, --after <name>`  | **(Required)** The name of the "after" snapshot.              |                   |
| `-o, --output <name>` | A name for the comparison output directory.                   | `compare_default` |
| `-r, --rules <path>`  | Path to the directory containing the `rules.breakcheck` file. | `default`         |

### `view`

Starts a local web server to display the results of a comparison in a user-friendly interface.

```
breakcheck view [comparison-name] [options]
```

| Argument          | Description                         | Default           |
| :---------------- | :---------------------------------- | :---------------- |
| `comparison-name` | The name of the comparison to view. | `compare_default` |

| Option                | Description                         | Default |
| :-------------------- | :---------------------------------- | :------ |
| `-p, --port <number>` | The port to run the view server on. | `8080`  |

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
