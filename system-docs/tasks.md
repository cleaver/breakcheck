# **Breakcheck Developer Task Checklist**

## **1. Project Setup & Core Structures**

- [ ] 1.1. Initialize Typescript project (npm/yarn init, tsconfig.json).
- [ ] 1.2. Set up testing framework (Jest/Vitest) and configuration.
- [ ] 1.3. Define core data structures/interfaces (e.g., PageSnapshot, DiffResult, Rule, Action based on JSON spec).
- [ ] 1.4. Choose and install core dependencies (logging library, error handling utility).

## **2. Rules Engine & DSL**

- [ ] 2.1. **DSL Parser (Chevrotain)**
  - [ ] 2.1.1. Define grammar for the object-first DSL (keywords: mode, do, end, actions, modifiers).
  - [ ] 2.1.2. Implement lexer and parser logic.
  - [ ] 2.1.3. Implement transformation from parse tree (CST) to the intermediate JSON format (AST).
  - [ ] 2.1.4. Add validation for selector syntax (basic check, maybe integrate CSS/XPath validator later).
  - [ ] 2.1.5. Implement robust error handling for parsing errors (clear messages, line numbers).
  - [ ] 2.1.6. Write unit tests for various valid and invalid DSL inputs, verifying JSON output.
- [ ] 2.2. **Rule Application Logic**
  - [ ] 2.2.1. Design function/class to take a DOM object (Cheerio) and the parsed JSON ruleset as input.
  - [ ] 2.2.2. Implement logic for default_include vs explicit_include modes.
  - [ ] 2.2.3. Implement include action logic (for explicit_include mode).
  - [ ] 2.2.4. Implement exclude action logic (element removal).
  - [ ] 2.2.5. Implement remove_attr action logic.
  - [ ] 2.2.6. Implement rewrite_attr action logic (using regex/replace).
  - [ ] 2.2.7. Implement rewrite_content action logic (using regex/replace).
  - [ ] 2.2.8. Implement content_regex modifier logic for include/exclude.
  - [ ] 2.2.9. Define and implement rule application order/conflict resolution (e.g., "last matching rule wins").
  - [ ] 2.2.10. Write unit tests using sample HTML snippets and rule JSON, verifying the modified DOM state.

## **3. DOM Processor (Cheerio, xpath)**

- [ ] 3.1. Implement HTML parsing using Cheerio.
- [ ] 3.2. Implement basic DOM normalization (e.g., whitespace handling - configurable?).
- [ ] 3.3. Integrate the Rules Engine: Create the processing pipeline (Parse -> Normalize -> Apply Rules).
- [ ] 3.4. Implement support for selecting elements via CSS selectors (Cheerio default).
- [ ] 3.5. Integrate xpath library for XPath selection.
- [ ] 3.6. Write unit tests for normalization and the integration with the Rules Engine.

## **4. Diff Engine (fast-diff, html-differ)**

- [ ] 4.1. Choose and integrate HTML diffing library (e.g., html-differ or similar for structural comparison).
- [ ] 4.2. Choose and integrate text diffing library (e.g., fast-diff for content changes within elements).
- [ ] 4.3. Implement comparison logic taking two processed DOMs (output from DOM Processor) as input.
- [ ] 4.4. Implement logic to identify structural changes (added/removed/moved elements/attributes).
- [ ] 4.5. Implement logic to identify content changes (text modifications).
- [ ] 4.6. Define and implement the DiffResult structure (FR-DIFF-05).
- [ ] 4.7. (Optional) Implement basic HTML report generation for visual diff (FR-REP-06).
- [ ] 4.8. Write unit tests comparing various pairs of processed HTML snippets, verifying DiffResult.

## **5. Snapshot Manager (File System, zlib)**

- [ ] 5.1. Design snapshot storage format (e.g., ZIP archive containing JSON files per page + metadata JSON).
- [ ] 5.2. Implement function to save a collection of PageSnapshot objects and metadata to a named snapshot file/directory.
- [ ] 5.3. Implement compression (zlib) during saving.
- [ ] 5.4. Implement function to load a snapshot file/directory back into memory.
- [ ] 5.5. Implement decompression during loading.
- [ ] 5.6. Implement metadata handling (timestamps, config used).
- [ ] 5.7. (Optional) Implement content fingerprinting (SHA hash) during snapshot creation (FR-SNAP-06).
- [ ] 5.8. Write unit tests for saving and loading snapshots.

## **6. Crawler (Crawlee)**

- [ ] 6.1. Integrate Crawlee library.
- [ ] 6.2. Implement basic crawling logic using CheerioCrawler or PlaywrightCrawler (for JS rendering).
- [ ] 6.3. Implement configuration handling (base URL, depth, include/exclude patterns, concurrency).
- [ ] 6.4. Implement extraction of HTML content, final URL, status code, and headers for each page.
- [ ] 6.5. Implement URL normalization logic.
- [ ] 6.6. Implement error handling for crawl requests (timeouts, HTTP errors).
- [ ] 6.7. Integrate with Snapshot Manager: Pass crawled PageSnapshot data to be saved.
- [ ] 6.8. Write integration tests for crawling test sites (local static sites or mock servers).

## **7. CLI Interface (yargs, Ink)**

- [ ] 7.1. Integrate yargs for command parsing.
- [ ] 7.2. Define CLI commands: snapshot, compare, help (and potentially config).
- [ ] 7.3. Implement argument/option parsing for URLs, snapshot names, rule files, output paths, etc.
- [ ] 7.4. Implement the snapshot command logic:
  - [ ] 7.4.1. Parse arguments.
  - [ ] 7.4.2. Configure and run the Crawler.
  - [ ] 7.4.3. Trigger Snapshot Manager to save the result.
  - [ ] 7.4.4. Provide user feedback/progress.
- [ ] 7.5. Implement the compare command logic:
  - [ ] 7.5.1. Parse arguments.
  - [ ] 7.5.2. Load "before" and "after" snapshots using Snapshot Manager.
  - [ ] 7.5.3. Load rules file and parse using Rules Engine parser.
  - [ ] 7.5.4. Iterate through corresponding pages in snapshots.
  - [ ] 7.5.5. For each page pair, run through DOM Processor (using loaded rules).
  - [ ] 7.5.6. Run processed DOMs through Diff Engine.
  - [ ] 7.5.7. Collate diff results.
  - [ ] 7.5.8. Format and display the report (console output).
  - [ ] 7.5.9. (Optional) Implement JSON report output (--output).
  - [ ] 7.5.10. (Optional) Implement HTML report output (--output).
  - [ ] 7.5.11. Provide user feedback/progress.
- [ ] 7.6. Integrate Ink for enhanced progress reporting and potentially richer output formatting.
- [ ] 7.7. Implement clear error reporting to the console for all stages.
- [ ] 7.8. Write end-to-end tests simulating CLI usage with sample sites and rules.

## **8. Documentation & Finalization**

- [ ] 8.1. Write README documentation (installation, usage, DSL syntax, examples).
- [ ] 8.2. Add code comments and generate API documentation (e.g., TypeDoc).
- [ ] 8.3. Refine error messages and user feedback.
- [ ] 8.4. Perform final testing and bug fixing.
- [ ] 8.5. Prepare for initial release (e.g., packaging for npm).
