<TASKS>
# **Breakcheck Developer Task Checklist (v2 - API Layer)**

## **1. Project Setup & Core Structures**

- [x] 1.1. Initialize Typescript project (npm/yarn init, tsconfig.json).
- [x] 1.2. Set up testing framework (Jest/Vitest) and configuration.
- [x] 1.3. Define core data structures/interfaces (e.g., PageSnapshot, DiffResult, Rule, Action based on JSON spec, API Layer input/output types like SnapshotConfig, ComparisonConfig, SnapshotResult, ComparisonSummary).
- [x] 1.4. Choose and install core dependencies (logging library, ~~error handling utility~~).
- [ ] 1.5. Consider adding an error handling utility like [handle-cli-error](https://github.com/ehmicky/handle-cli-error).

## **2. Rules Engine & DSL**

- [x] 2.1. **DSL Parser (Chevrotain)**
  - [x] 2.1.1. Define grammar for the object-first DSL (keywords: do, end, actions, modifiers).
  - [x] 2.1.2. Implement lexer and parser logic.
  - [x] 2.1.3. Implement transformation from parse tree (CST) to the intermediate JSON format (AST - RuleSetJson).
  - [x] 2.1.4. Add validation for selector syntax (basic check, maybe integrate CSS validator later).
  - [x] 2.1.5. Implement robust error handling for parsing errors (clear messages, line numbers).
  - [x] 2.1.6. Write unit tests for various valid and invalid DSL inputs, verifying JSON output.
- [x] 2.2. **Rule Application Logic (within DOM Processor)**
  - [x] 2.2.1. Design function/class to take a DOM object (Cheerio) and the parsed JSON ruleset (RuleSetJson) as input.
  - [x] 2.2.2. Implement exclude action logic (element removal).
  - [x] 2.2.3. Implement remove_attr action logic.
  - [x] 2.2.4. Implement rewrite_attr action logic (using regex/replace).
  - [x] 2.2.5. Implement rewrite_content action logic (using regex/replace).
  - [x] 2.2.6. Implement content_regex modifier logic for exclude.
  - [x] 2.2.7. Define and implement rule application order/conflict resolution (e.g., "last matching rule wins").
  - [x] 2.2.8. Write unit tests using sample HTML snippets and rule JSON, verifying the modified DOM state.

## **3. DOM Processor (Cheerio)**

- [x] 3.1. Implement HTML parsing using Cheerio.
- [x] 3.2. Implement basic DOM normalization (e.g., whitespace handling - configurable?).
- [x] 3.3. Integrate the Rule Application Logic: Create the processing pipeline (Parse -> Normalize -> Apply Rules). Input will be HTML content and parsed RuleSetJson.
- [x] 3.4. Implement support for selecting elements via CSS selectors (Cheerio default).
- [x] 3.5. Write unit tests for normalization and the integration with the Rules Engine logic.

## **4. Diff Engine (fast-diff, html-differ)**

- [x] 4.1. Choose and integrate HTML diffing library (CB: we'll use `diff` npm package)
- [x] 4.2. Choose and integrate text diffing library (`diff`)
- [x] 4.3. Implement comparison logic taking two processed DOMs (output from DOM Processor) as input.
- [x] 4.4. Implement logic to identify structural changes (added/removed/moved elements/attributes).
- [ ] ~~4.5. Implement logic to identify content changes (text modifications).~~
- [x] 4.6. Define and implement the Difference structure (part of ComparisonSummary).
- [x] 4.7. (Optional) Implement basic HTML report generation for visual diff (potentially as a separate utility or reporter module).
- [x] 4.8. Write unit tests comparing various pairs of processed HTML snippets, verifying Difference outputs.

## **5. Snapshot Manager (File System, zlib)**

- [x] 5.1. Design snapshot storage format (e.g., directory containing metadata.json, index.json, and a pages/ subdirectory with gzipped JSON files).
- [x] 5.2. Implement function to save a collection of PageSnapshot objects and metadata to a named snapshot file/directory.
- [x] 5.3. Implement compression (gzip) during saving.
- [x] 5.4. Add an index of pages for quick lookup.
- [x] 5.5. Implement function to load a snapshot file/directory back into memory (returning PageSnapshot collection and metadata).
- [x] 5.6. Implement decompression during loading.
- [x] 5.7. Implement metadata handling (timestamps, config used).
- [ ] 5.8. (Optional) Implement content fingerprinting (SHA hash) during snapshot creation (FR-SNAP-06).
- [x] 5.9. Write unit tests for saving and loading snapshots.

## **6. Crawler (Crawlee)**

- [x] 6.1. Integrate Crawlee library.
- [x] 6.2. Implement basic crawling logic using CheerioCrawler or PlaywrightCrawler (for JS rendering).
- [x] 6.3. Implement configuration handling based on CrawlerConfig (base URL, depth, include/exclude patterns, concurrency).
- [x] 6.4. Implement extraction of HTML content, final URL, status code, and headers for each page into PageSnapshot objects.
- [x] 6.5. Implement URL normalization logic. (CB: Deduplication handled automatically.)
- [x] 6.6. Implement error handling for crawl requests (timeouts, HTTP errors) into CrawlError structure.
- [x] 6.7. Implement function to return the collection of PageSnapshot data and any CrawlErrors **to the API Layer**.
- [ ] 6.8. Write integration tests for crawling test sites (local static sites or mock servers).

## **7. API Layer (Internal Module)**

- [x] 7.1. Define the BreakcheckApi interface and supporting types (SnapshotConfig, ComparisonConfig, SnapshotResult, ComparisonSummary, etc.) in Typescript.
- [x] 7.2. Implement the createSnapshot function:
  - [x] 7.2.1. Validate input SnapshotConfig.
  - [x] 7.2.2. Instantiate and configure the Crawler based on config.crawlSettings.
  - [x] 7.2.3. Execute the Crawler.
  - [x] 7.2.4. Receive PageSnapshot data and errors from Crawler.
  - [x] 7.2.5. Call Snapshot Manager to save the snapshot data and metadata.
  - [x] 7.2.6. Format and return the SnapshotResult (including success status, ID, metadata, errors).
- [ ] 7.3. Implement the runComparison function:
  - [x] 7.3.1. Validate input ComparisonConfig.
  - [x] 7.3.2. Call Snapshot Manager to load "before" and "after" snapshots. Handle errors if snapshots not found.
  - [x] 7.3.3. If config.rules is a string (DSL), call the Rules Engine Parser to get RuleSetJson. Handle parsing errors. If already RuleSetJson, use directly.
  - [x] 7.3.4. Iterate through corresponding pages (matching URLs) in the loaded snapshots.
  - [x] 7.3.5. For each page pair:
    - [x] 7.3.5.1. Call DOM Processor with 'before' HTML and parsed rules.
    - [x] 7.3.5.2. Call DOM Processor with 'after' HTML and parsed rules.
    - [x] 7.3.5.3. Call Diff Engine with the two processed DOMs.
  - [x] 7.3.6. Aggregate Difference results per page into PageComparisonDetail objects. Handle pages only present in one snapshot.
  - [x] 7.3.7. Compile the overall ComparisonSummary.
  - [x] 7.3.8. Format and return the final ComparisonSummary.
- [x] 7.4. Implement robust error handling throughout the API layer (catching errors from components, returning structured errors).
- [x] 7.5. Write integration tests for the API layer functions (createSnapshot, runComparison), mocking core components initially, then testing interactions with real components.

## **8. CLI Interface (Commander.js, interactive-commander, Ink)**

- [x] 8.1. Integrate Commander.js and interactive-commander for command parsing.
- [x] 8.2. Define CLI commands: snapshot, compare, help (and potentially config, list-snapshots).
- [x] 8.3. Implement argument/option parsing for URLs, snapshot names, rule files/text, output paths, crawl settings overrides, etc.
- [ ] 8.4. Implement the snapshot command logic:
  - [x] 8.4.1. Parse arguments into a SnapshotConfig object.
  - [x] 8.4.2. Instantiate the API Layer implementation.
  - [x] 8.4.3. Call apiLayer.createSnapshot(config).
  - ~~[ ] 8.4.4. Display progress/feedback to the user (potentially using Ink).~~
  - [x] 8.4.5. Report the SnapshotResult (success/failure, snapshot ID, errors) to the console.
- [ ] 8.5. Implement the compare command logic:
  - [x] 8.5.1. Parse arguments into a ComparisonConfig object (reading rule file content if path provided).
  - [x] 8.5.2. Instantiate the API Layer implementation.
  - [x] 8.5.3. Call apiLayer.runComparison(config).
  - [x] 8.5.4. Display progress/feedback to the user.
  - [x] 8.5.5. Receive the ComparisonSummary from the API Layer.
  - [x] 8.5.6. Format and display the report based on ComparisonSummary to the console (summary and details of differences).
  - ~~[ ] 8.5.7. (Optional) Implement JSON report output (--output): Write the received ComparisonSummary object to a file.~~
  - [x] 8.5.8. (Optional) Implement HTML report output (--output): Generate HTML from the ComparisonSummary (may require a separate reporting utility called by the CLI).
- [ ] ~~8.6. Integrate Ink for enhanced progress reporting and potentially richer output formatting.~~0
- [x] 8.7. Implement clear error reporting to the console based on errors received from the API Layer.
- [ ] 8.8. Write end-to-end tests simulating CLI usage with sample sites and rules, verifying console output and generated files.
- [x] 8.9. Implement the view command logic.

## **9. Documentation & Finalization**

- [x] 9.1. Write README documentation (installation, usage, CLI commands/options, DSL syntax, examples).
- [ ] 9.2. Add code comments (especially for the API Layer interface and core components) and generate API documentation (e.g., TypeDoc).
- [ ] 9.3. Refine error messages and user feedback (both from API Layer and CLI presentation).
- [ ] 9.4. Perform final testing and bug fixing across all layers.
- [ ] 9.5. Prepare for initial release (e.g., packaging for npm).

</TASKS>
