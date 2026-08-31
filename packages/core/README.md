# Breakcheck Core

This package provides the core programmatic API for **Breakcheck**. Use this library to integrate website snapshotting, comparison, and viewing directly into your own JavaScript or TypeScript projects.

This package is intended for developers who need to build custom automation or tooling. If you're looking to use Breakcheck from the command line, see the main [`breakcheck`](https://github.com/cleaver/breakcheck) package.

## Upgrading to 0.2.0

`0.2.0` is a breaking release. Import the core API from `@cleaver/breakcheck-core`'s public root entrypoint; deep imports and `startCliViewServer` are no longer supported. Use `startViewServer` for programmatic viewing. String `ruleset` values are directories containing `rules.breakcheck`, resolved relative to `process.cwd()`.

---

## Installation

```bash
npm install @cleaver/breakcheck-core
```

Node.js 22 or newer is required.

---

## API Usage

The `@cleaver/breakcheck-core` library exposes a set of simple, asynchronous functions to manage the entire workflow.

### Creating a Snapshot

To begin, you need to create a "snapshot" of a website. A snapshot is a record of a site's state at a specific point in time, created by crawling the site and saving its content.

The `createSnapshotFromConfig` function takes a configuration object and returns the results of the crawl.

```javascript
import { createSnapshotFromConfig } from "@cleaver/breakcheck-core";

async function takeSnapshot() {
  const snapshotConfig = {
    // The URL where the crawler will start
    baseUrl: "http://localhost:3000",

    // A unique name for this snapshot
    name: "my-site-before-changes",

    // Settings for the crawler
    crawlSettings: {
      baseUrl: "http://localhost:3000",
      // 'cheerio' for static sites, 'playwright' for dynamic, JS-heavy sites
      crawlerType: "cheerio",
      maxDepth: 3, // How many links deep to follow
    },

    // Optional: Write a list of all crawled URLs to a file
    urlListPath: "./crawled-urls.txt",
  };

  const result = await createSnapshotFromConfig(snapshotConfig);

  if (result.status === "success") {
    console.log(`✅ Snapshot created: ${result.snapshotId}`);
    console.log(`📊 Pages crawled: ${result.pageCount}`);
  } else {
    console.error(`❌ Snapshot failed: ${result.message}`);
  }
}

takeSnapshot();
```

### Configuring Logs

The core package uses pretty Pino logs by default. Call `configureLogger` before
starting a workflow to select JSON output or a different log level. Crawlee
messages emitted during snapshotting use the same configured logger.

```javascript
import { configureLogger } from "@cleaver/breakcheck-core";

configureLogger({ useJsonLogs: true });
```

### Listing Snapshots

You can get a list of all locally saved snapshots using the `listSnapshots` function.

```javascript
import { listSnapshots } from "@cleaver/breakcheck-core";

async function showSnapshots() {
  const snapshots = await listSnapshots();

  if (snapshots.length === 0) {
    console.log("No snapshots found.");
    return;
  }

  console.log("Available Snapshots:");
  snapshots.forEach((snapshot) => {
    console.log(
      `- ${snapshot.name} (${snapshot.pageCount} pages, created on ${snapshot.date})`,
    );
  });
}

showSnapshots();
```

### Running a Comparison

The core of the tool is comparing two snapshots. The `runComparison` function compares a "before" and "after" snapshot, applies rules to ignore dynamic content, and saves a detailed diff report.

String `ruleset` values are directories containing `rules.breakcheck`. Relative paths resolve from `process.cwd()`, the directory where the consuming project invokes Breakcheck. In a monorepo, invoke it from the package that owns the rules or use an absolute path.

Rules may also be supplied inline as a typed `Ruleset`. `RulesEngine.create()` eagerly validates non-empty selectors and actions, Cheerio selector syntax, region names and uniqueness, supported modifier combinations, and JavaScript regular expressions. It compiles and clones the rules so later caller mutation cannot change processing. The DSL accepts full Cheerio-compatible CSS selectors on a single rule-header line; modifier values are double-quoted, with `\"` and `\\` decoded while regex escapes remain intact. `include` is an intentional compatibility no-op, and `rewrite_content` preserves nested markup by rewriting each descendant text node independently.

```javascript
import { runComparison } from "@cleaver/breakcheck-core";

async function compareStates() {
  const comparisonConfig = {
    // The name of the 'before' snapshot
    beforeSnapshotId: "my-site-before-changes",

    // The name of the 'after' snapshot
    afterSnapshotId: "my-site-after-changes",

    // A unique name for the comparison results directory
    comparisonName: "v1-vs-v2-comparison",

    // Optional directory containing rules.breakcheck, or an inline ruleset.
    // Omit ruleset for an unfiltered comparison.
    ruleset: "./my-rules",
  };

  const summary = await runComparison(comparisonConfig);

  if (summary.status === "completed") {
    console.log(`✅ Comparison complete!`);
    console.log(`   - Overall result: ${summary.overallResult.toUpperCase()}`);
    console.log(`   - Pages with differences: ${summary.pagesWithDifferences}`);
    console.log(`   - Results saved to: ${summary.resultsPath}`);
  } else {
    console.error("❌ Comparison failed.");
  }
}

compareStates();
```

### Viewing Comparison Results

After a comparison is complete, you can launch a local web server to view the results in your browser. The `startViewServer` function starts an Express server that renders the diffs.

```javascript
import { startViewServer } from "@cleaver/breakcheck-core";

async function viewResults() {
  const comparisonName = "v1-vs-v2-comparison"; // The name of the comparison to view
  const port = 8080;

  try {
    const server = await startViewServer(comparisonName, port);
    console.log(`🌐 View server running at http://localhost:${port}`);
    console.log("Press Ctrl+C to stop the server.");

    // You can add logic to automatically open the browser or close the server
    // For example, to stop it after 60 seconds:
    // setTimeout(() => server.close(), 60000);
  } catch (error) {
    console.error(`❌ Could not start view server: ${error.message}`);
  }
}

viewResults();
```
