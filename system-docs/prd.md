# Product Requirements Document: Breakcheck

Version: 1.0

Date: 2025-04-24

## 1. Introduction

### 1.1 Purpose

This document outlines the requirements for a command-line interface (CLI) tool designed to assist developers and QA testers in verifying content-based websites after upgrades or significant changes (e.g., CMS updates, framework migrations, theme changes). The tool automates the process of comparing website states ("before" and "after" the change) to identify unexpected alterations in HTML content and structure, while allowing users to configure rules to ignore expected differences.

### 1.2 Scope

The initial version (v1.0) will focus on delivering a robust CLI application. It will include core functionalities: crawling, snapshotting, DOM processing based on configurable rules, content diffing, and reporting. Future versions may introduce a web-based user interface, visual diffing capabilities, and database integration.

### 1.3 Goals & Objectives

- **Goal:** Reduce the manual effort and improve the accuracy of regression testing for content-based websites undergoing upgrades or changes.
- **Objective 1:** Provide a reliable mechanism to capture the state of a website (HTML content and structure) before and after a change.
- **Objective 2:** Implement a flexible rules engine using a clear DSL (Domain Specific Language) to allow users to precisely define which parts of the HTML should be included, excluded, or transformed during comparison.
- **Objective 3:** Develop an efficient diff engine capable of highlighting meaningful differences between the "before" and "after" states, ignoring configured exceptions.
- **Objective 4:** Deliver a user-friendly CLI tool for configuring, executing, and reviewing the comparison process.
- **Objective 5:** Design the core logic with modularity and extensibility in mind, facilitating future enhancements like a web UI or plugin system.

### 1.4 Target Audience

- Web Developers
- Quality Assurance (QA) Engineers / Testers
- DevOps Engineers
- Technical Project Managers involved in website upgrades/migrations.

## 2. User Personas & Scenarios

### 2.1 Persona: Frontend Developer (Maria)

- **Needs:** Quickly verify that a CMS theme update hasn't broken layouts or altered static content unexpectedly across hundreds of pages. Needs to ignore dynamic elements like cache-busting query parameters or CSRF tokens.
- **Scenario:** Maria is updating the core CMS and theme on a client's website. Before deploying the update to staging, she runs the tool to capture the "before" state. She configures rules to ignore CSS class changes related to the theme's utility classes and specific meta tags added by the CMS. After deploying the update, she runs the tool again to capture the "after" state and initiates the comparison. The tool reports unexpected changes in the footer text on three specific pages, which she investigates and fixes before proceeding.

### 2.2 Persona: QA Engineer (David)

- **Needs:** Perform comprehensive regression testing after a major framework upgrade. Needs a detailed report of all structural and content changes, filtering out noise from minified scripts or style changes.
- **Scenario:** David is testing a website migration from an old framework to a new one. He uses the tool to compare the production site ("before") with the newly migrated site on a test server ("after"). He defines rules to exclude entire `<script>` and `<style>` blocks, ignore whitespace differences, and normalize specific attribute values (e.g., image paths). The diff report highlights structural changes in navigation menus and content differences in dynamically generated lists, allowing him to focus his manual testing efforts.

## 3. Functional Requirements

### 3.1 Core Workflow

The tool shall support the following core workflow:

1. **Initialization:** Configure the target site URL and rule set.
2. **Snapshot "Before":** Initiate a crawl of the target site to capture the initial state.
3. _(Manual Step: User performs website upgrade/changes)_
4. **Snapshot "After":** Initiate a second crawl of the target site to capture the final state.
5. **Comparison:** Run the diff process using the "before" and "after" snapshots and the configured rules.
6. **Reporting:** Present the comparison results to the user.

### 3.2 Crawler Component (Crawlee)

- **FR-CRAWL-01:** The tool must be able to recursively crawl a website starting from a given base URL.
- **FR-CRAWL-02:** The crawler must capture the full HTML content of each discovered page.
- **FR-CRAWL-03:** The crawler must support fetching content via a headless browser to handle client-side rendered content.
- **FR-CRAWL-04:** The crawler must handle URL normalization (e.g., removing trailing slashes, handling case sensitivity based on config) to avoid duplicate page captures.
- **FR-CRAWL-05:** The crawler must allow configuration options (e.g., max depth, URL include/exclude patterns, request concurrency, user-agent).
- **FR-CRAWL-06:** The crawler must record the final URL (after redirects) and HTTP status code for each page.
- **FR-CRAWL-07:** The crawler must handle common errors gracefully (e.g., timeouts, 4xx/5xx errors) and report them.

### 3.3 Snapshot Manager (File System, zlib)

- **FR-SNAP-01:** The tool must store snapshots of crawled site states ("before" and "after").
- **FR-SNAP-02:** Each snapshot must contain the collection of captured pages (URL, HTML content, headers).
- **FR-SNAP-03:** Snapshots must be stored efficiently on the local file system (e.g., compressed archive like ZIP containing JSON data).
- **FR-SNAP-04:** Snapshots must include metadata: timestamp of crawl, base URL, crawl configuration used.
- **FR-SNAP-05:** The tool shall allow users to specify names or identifiers for "before" and "after" snapshots.
- **FR-SNAP-06:** (Optional) Implement content fingerprinting (e.g., SHA hash of HTML) for quick identification of unchanged pages.

### 3.4 DOM Processor (Cheerio, xpath)

- **FR-DOM-01:** The tool must parse the raw HTML content of each page into a traversable DOM structure.
- **FR-DOM-02:** The DOM processor must apply normalization rules _before_ comparison (e.g., consistent whitespace handling, attribute order normalization - if feasible and desired).
- **FR-DOM-03:** The DOM processor must apply user-defined rules (from the Rules Engine) to modify the DOM before comparison. This includes:
  - Excluding specific elements or attributes based on CSS selectors or XPath expressions.
  - Including only specific elements or attributes based on CSS selectors or XPath expressions.
  - Transforming attribute values or element content based on defined patterns (e.g., regex replacement).
- **FR-DOM-04:** Processing steps (normalization, rule application) should form a configurable pipeline.

### 3.5 Rules Engine & DSL (Chevrotain, JSON Schema)

- **FR-RULE-01:** The tool must provide a DSL for users to define comparison rules.
- **FR-RULE-02:** The DSL must support rules for:
  - **Exclusion:** Specify elements/attributes to ignore during diffing (e.g., `exclude css:.dynamic-id`, `exclude xpath://script`).
  - **Inclusion:** Specify elements/attributes that _must_ be included (implicitly excluding others if used). Focus comparison on specific parts (e.g., `include css:#main-content`).
  - **Transformation:** Specify modifications to apply before diffing (e.g., `transform attr:href /version=\d+/ -> /version=XXX/`, `transform text css:.timestamp remove`).
- **FR-RULE-03:** The DSL must support both CSS selectors and XPath expressions for targeting elements and attributes.
- **FR-RULE-04:** Rule definitions shall be stored in a configuration file (e.g., JSON, YAML, or a custom format parsed by Chevrotain).
- **FR-RULE-05:** The Rules Engine must parse and validate the rule definitions (using JSON Schema or similar).
- **FR-RULE-06:** The Rules Engine must apply the parsed rules to the DOM structure provided by the DOM Processor.
- **FR-RULE-07:** The engine should handle potential rule conflicts or overlaps predictably (e.g., order of application, specificity).

### 3.6 Diff Engine (fast-diff, html-differ)

- **FR-DIFF-01:** The tool must compare the processed DOM structures of corresponding pages from the "before" and "after" snapshots.
- **FR-DIFF-02:** The comparison must identify differences at both the structural level (elements added, removed, moved) and the content level (text changes, attribute value changes).
- **FR-DIFF-03:** The Diff Engine must utilize the processed DOMs (after normalization and rule application) for comparison.
- **FR-DIFF-04:** The Diff Engine must classify changes based on whether they were covered by exclusion/transformation rules (expected) or not (unexpected). Only unexpected changes should be highlighted in the primary report.
- **FR-DIFF-05:** The output of the diff process for each page pair should clearly list the identified differences (e.g., type of change, selector/XPath of affected element, before/after content snippets).

### 3.7 Reporting

- **FR-REP-01:** The tool must generate a summary report after the comparison, indicating the number of pages compared, pages with differences, and pages without differences.
- **FR-REP-02:** The report must list the specific unexpected differences found, grouped by page URL.
- **FR-REP-03:** For each difference, the report must provide context (e.g., selector/XPath, type of change, snippet of before/after).
- **FR-REP-04:** The primary report output format shall be human-readable text suitable for the console.
- **FR-REP-05:** (Optional) The tool should offer an option to generate a structured report format (e.g., JSON) for machine processing.
- **FR-REP-06:** (Optional) The tool should offer an option to generate an HTML-based visual diff report highlighting changes directly within the page structure.

### 3.8 CLI Interface (Commander.js, Ink)

- **FR-CLI-01:** The tool must be executable from the command line.
- **FR-CLI-02:** The CLI must provide commands for:
  - `snapshot <name> --url <baseUrl> [--config <configFile>]`: Take a snapshot.
  - `compare <beforeSnapshot> <afterSnapshot> [--rules <rulesFile>] [--output <reportFile>]`: Compare two snapshots.
  - `config`: Manage configuration settings (optional).
  - `help`: Display usage instructions.
- **FR-CLI-03:** The CLI must accept arguments and options for configuration (base URL, rule file path, snapshot names, output paths, crawler settings).
- **FR-CLI-04:** The CLI must provide clear feedback during execution, including progress indicators for crawling and comparison (potentially using Ink for richer UI).
- **FR-CLI-05:** The CLI must report errors clearly (e.g., invalid configuration, crawl failures, file system errors).
- **FR-CLI-06:** The CLI shall not require a database connection or user login for its core functionality.

## 4. Non-Functional Requirements

- **NFR-PERF-01:** Crawling should be reasonably fast; leverage parallel requests where appropriate (configurable concurrency).
- **NFR-PERF-02:** DOM processing and diffing should be efficient, handling potentially large HTML documents without excessive memory consumption or processing time. Consider worker threads for parallel processing of pages.
- **NFR-SCALE-01:** The tool should handle websites with a moderate number of pages (e.g., thousands) within reasonable timeframes.
- **NFR-USE-01:** The CLI interface must be intuitive and well-documented (`--help` output).
- **NFR-USE-02:** The Rules DSL syntax must be clear, well-documented, and relatively easy for technical users to learn. Error messages during rule parsing must be informative.
- **NFR-MAINT-01:** The codebase must be written in Typescript, following best practices for code organization, readability, and type safety.
- **NFR-MAINT-02:** The architecture must be modular, aligning with the components outlined (Crawler, Snapshot Manager, DOM Processor, etc.), to facilitate maintenance and future development.
- **NFR-EXT-01:** Design with extensibility in mind (e.g., plugin system for rules, adapters for CMS-specific normalization, strategy pattern for diff algorithms) as outlined in the architecture.
- **NFR-SEC-01:** Handle user-provided configurations (like URLs, file paths) safely. Avoid command injection or insecure file access. (Note: As a local CLI tool, the initial security scope is limited compared to a web service).
- **NFR-REL-01:** The tool should be reliable and produce consistent comparison results for the same inputs and rules.

## 5. System Architecture

The tool will adhere to the provided system architecture diagram and component descriptions:

- **Components:** CLI Interface, Crawler, Snapshot Manager, DOM Processor, Diff Engine, Rules Engine.
- **Technologies:** Typescript, Crawlee, Cheerio, xpath, fast-diff, html-differ, Chevrotain, Commander.js, Ink, zlib.
- **Data Flow:** As depicted in the diagram, initiated by the CLI, flowing through crawling, snapshotting, processing, diffing, guided by rules.
- **Storage:** Local file system for snapshots and configuration.

_(Refer to the provided System Architecture document for detailed component responsibilities, technologies, APIs, and considerations)._

## 6. Data Management

- **DM-01:** Snapshots will be stored on the local file system in a user-specified or default location.
- **DM-02:** Snapshot format will likely be a compressed archive (e.g., ZIP) containing structured data (e.g., JSON files per page) and metadata.
- **DM-03:** Rule configurations will be stored in separate files (e.g., `.sitediffrc`, `rules.yaml`, `rules.json`) managed by the user.
- **DM-04:** No database is required for the initial CLI version.

## 7. Testing Strategy

- **TS-01:** Adopt a Test-Driven Development (TDD) approach where feasible, writing tests before or alongside feature implementation.
- **TS-02:** **Unit Tests:** Each core component (Crawler adapter, Snapshot Manager, DOM Processor, Rules Engine, Diff Engine) must have comprehensive unit tests covering its public API and internal logic. Mock dependencies extensively. Use frameworks like Jest or Vitest.
- **TS-03:** **Integration Tests:** Test the interaction between components (e.g., DOM Processor applying rules parsed by the Rules Engine, Diff Engine comparing processed DOMs). Test the full processing pipeline for a single page.
- **TS-04:** **End-to-End (E2E) Tests:** Create tests that simulate the full CLI workflow: running commands (`snapshot`, `compare`), using sample websites (potentially local static sites), applying rule files, and verifying the final report output against expected results.
- **TS-05:** **Rule DSL Tests:** Specific tests for the DSL parser (Chevrotain) to ensure correct parsing and validation of various rule syntaxes.
- **TS-06:** **Crawler Tests:** Test crawler configuration options (depth limits, exclusions) using mock HTTP servers or controlled test websites.

## 8. Future Considerations

- **FC-01:** **Web Interface:** Develop a web-based UI for managing projects, configuring crawls, defining rules (potentially with visual helpers), triggering comparisons, and viewing results interactively.
- **FC-02:** **Database Integration:** Utilize a database (e.g., PostgreSQL, SQLite) for storing snapshot data, rule sets, comparison results, and user accounts (for the web UI).
- **FC-03:** **Visual Diff Tools:** Integrate or develop visual diffing capabilities to show side-by-side renderings of pages with differences highlighted.
- **FC-04:** **Plugin System:** Formalize the plugin architecture for custom rule types, normalizers, or report formats.
- **FC-05:** **API / CI/CD Integration:** Provide a stable API or integration points for running comparisons as part of automated CI/CD pipelines.
- **FC-06:** **Screenshot Comparison:** Add optional screenshot comparison capabilities (visual regression testing) alongside HTML diffing.

## 9. Out of Scope (for v1.0)

- Web-based user interface.
- Database storage for snapshots or results.
- User authentication or multi-user support.
- Visual diffing (screenshot comparison or side-by-side HTML rendering with highlights).
- Real-time collaboration features.
- Direct integration with specific CMS platforms beyond generic crawling.
- Assertion library for defining expected states (focus is on finding _unexpected_ changes).

## 10. Glossary

- **Snapshot:** A representation of the website's state at a specific point in time, containing crawled URLs and their corresponding HTML content.
- **Crawler:** The component responsible for discovering and fetching pages from the target website.
- **DOM (Document Object Model):** A structured representation of an HTML document.
- **Diff Engine:** The component responsible for comparing two states (DOMs) and identifying differences.
- **Rules Engine:** The component responsible for parsing and applying user-defined rules to modify or filter the DOM before comparison.
- **DSL (Domain Specific Language):** A specialized language created for a specific purpose (in this case, defining comparison rules).
- **CSS Selector:** A pattern used to select specific HTML elements based on their tag name, ID, class, attributes, etc.
- **XPath (XML Path Language):** A query language for selecting nodes from an XML or HTML document.
- **Normalization:** The process of transforming data into a standard format (e.g., removing insignificant whitespace, standardizing attribute quotes).
- **Transformation:** The process of modifying specific parts of the content based on rules (e.g., rewriting URLs, removing dynamic values).
- **CLI:** Command-Line Interface.
