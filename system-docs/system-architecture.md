# **Breakcheck System Architecture**

## **Prompt**

As an expert in AI-assisted software development, I want you to design a system architecture for a tool that will help me test content-based websites that are built on a CMS or framework. The tool will be written in Typescript.  
OUTPUT:

- A high-level system architecture mermaid diagram
- A list of the key components and the technologies that should be used for each component
- A list of the APIs that will be required for the components to interact with each other

CONTEXT:  
I want to build a tool for testing content-based websites that are built on a CMS or framework. I intend to use Typescript for most of the tool.  
It will work by crawling the site to be upgraded and taking a snapshot as the "before" state. The snapshot would consist of the HTML content of the site and a list of URLs. After the user has performed the site upgrade, a second crawl would be performed and an "after" snapshot would be stored. The tool would then do a page-level diff of the before and after snapshots to find unexpected differences.  
Many CMSs and frameworks will minify Javascript and CSS, or add cache-busting attributes or URLs. The tool will then do a refining stage where it parses the DOM tree and allows a rules-based DSL to explicitly include or exclude parts of the page markup. I imagine using Xpath or CSS selector syntax for this. Additionally the tool can rewrite parts of HTML tags or attributes to remove or modify some of the differing text.  
The overall strategy is to compare before and after an upgrade, looking for unexpected changes while ignoring the parts we expect to change.  
In the future I may wish to add visual tools to assist users in refining the diffs to reduce the need to directly write the DSL syntax.  
Initially, I'd want to run the tool as a CLI, but design it with a web interface in mind for the future. The CLI would not require a database or login, but the web interface would.  
I'd like to use existing open source libraries for as much of the tool as possible. EG: web crawling, DOM parsing, CLI, etc. The web interface may be in a different language, so don't include that in the output

## **Architecture Document**

```mermaid
%% Updated System Architecture Diagram (Aligned with PRD v2.2)
graph TD
 A\[CLI Interface\] \--\> B(API Layer)
 C\[Web Interface--Future\] \---\> B
 B \--\> D\[Core Engine Orchestrator/Facade\]

subgraph Core Engine Components
 direction TB
 E\[Crawler\]
 F\[Snapshot Manager\]
 G\[DOM Processor\]
 H\[Diff Engine\]
 I\[Rules Engine Parser\]
 end

D \--\> E
 D \--\> F
 D \--\> G
 D \--\> H
 D \--\> I

F \--\> J\[(File System / Snapshot Storage)\]
 I \--\> K\[Rules DSL / JSON Configuration\]
 G \--\> L\[Rule Application Logic\]
 K \--\> L
```

- **Initial Interaction:** The CLI (or future Web Interface) interacts primarily with the **API Layer**.
- **Orchestration:** The **API Layer** receives requests, validates them, and orchestrates the necessary calls to the **Core Engine Components** (Crawler, Snapshot Manager, DOM Processor, Diff Engine, Rules Engine Parser) to fulfill the request. It handles tasks like parsing Rules DSL if provided as text.
- **Results:** The **API Layer** aggregates results from the components and returns a structured response to the calling interface.

### **Key Components & Technologies**

1. **Crawler Component**
   - **Tech**: Crawlee ([https://crawlee.dev](https://crawlee.dev))
   - **Responsibility**: Site discovery, HTML capture, URL normalization. _Invoked by the API Layer with specific configuration._
2. **Snapshot Manager**
   - **Tech**: Compression (e.g., zlib), Storage (File system \- local JSON/ZIP)
   - **Responsibility**: Storing/retrieving versioned site states (snapshots), managing metadata. _Invoked by the API Layer._
3. **DOM Processor**
   - **Tech**: Cheerio ([https://github.com/cheeriojs/cheerio](https://github.com/cheeriojs/cheerio)), xpath (XPath library)
   - **Responsibility**: Parsing HTML, applying normalization, applying rules (via CSS/XPath selectors) received from the API Layer. _Invoked by the API Layer during comparison._
4. **Diff Engine**
   - **Tech**: fast-diff ([https://github.com/jhchen/fast-diff](https://github.com/jhchen/fast-diff)), html-differ (structural comparison)
   - **Responsibility**: Comparing two processed DOM structures provided by the API Layer, identifying differences. _Invoked by the API Layer._
5. **Rules Engine Parser**
   - **Tech**: Chevrotain (DSL parser), JSON Schema (validation)
   - **Responsibility**: Parsing the Rules DSL text into a structured format (e.g., JSON) for use by the DOM Processor. _Invoked by the API Layer when rules are provided as text._ The _application_ of parsed rules happens within the DOM Processor.
6. **CLI Interface**
   - **Tech**: yargs ([https://github.com/yargs/yargs](https://github.com/yargs/yargs)), Ink (React CLI components)
   - **Responsibility**: User interaction, command parsing, configuration gathering, **calling the API Layer**, presenting results received from the API Layer.
7. **API Layer** (New/Explicit Component)
   - **Tech**: Typescript interfaces/modules (Internal for v2.1)
   - **Responsibility**: Provides the primary interface for clients (CLI, future Web UI). Orchestrates core component interactions, handles rule parsing invocation, validates inputs, formats outputs, manages errors.

### **Primary API (Exposed by API Layer)**

This section defines the main interface clients use to interact with Breakcheck's core functionality, as exposed by the API Layer.

```typescript
// Example API Layer Interface (Conceptual)
interface BreakcheckApi {
 /\*\*
 \* Creates a snapshot of a website based on the provided configuration.
 \* Orchestrates calls to Crawler and Snapshot Manager.
 \*/
 createSnapshot(config: SnapshotConfig): Promise\<SnapshotResult\>;

/\*\*
 \* Runs a comparison between two snapshots using specified rules.
 \* Orchestrates calls to Snapshot Manager, Rules Engine Parser (if needed),
 \* DOM Processor, and Diff Engine.
 \*/
 runComparison(config: ComparisonConfig): Promise\<ComparisonResult\>;

// Potential future methods:
 // listSnapshots(): Promise\<SnapshotMetadata\[\]\>;
 // getSnapshotDetails(snapshotId: string): Promise\<Snapshot\>;
 // validateRules(rulesDsl: string): Promise\<ValidationResult\>;
}

// \--- Supporting Input/Output Types \---

interface SnapshotConfig {
 baseUrl: string;
 snapshotName: string; // Identifier for the snapshot
 crawlSettings?: CrawlerSettings; // Depth, concurrency, user-agent, include/exclude patterns etc.
 // ... other snapshot-specific options
}

interface CrawlerSettings {
 maxDepth?: number;
 concurrency?: number;
 userAgent?: string;
 includePatterns?: string\[\];
 excludePatterns?: string\[\];
 useHeadlessBrowser?: boolean;
 // ... other Crawlee options
}

interface SnapshotResult {
 success: boolean;
 snapshotId: string; // Name or unique ID assigned
 timestamp: Date;
 pageCount: number;
 errors?: CrawlError\[\];
 // ... other metadata
}

interface ComparisonConfig {
 beforeSnapshotId: string;
 afterSnapshotId: string;
 rules: string | RuleSetJson; // Can be raw DSL text or pre-parsed JSON
 // ... other comparison options (e.g., output format hint)
}

// Represents the structured JSON format after parsing the DSL
// (Details depend on breakcheck_json_spec_v1 mentioned in PRD)
type RuleSetJson \= object;

interface ComparisonResult {
 success: boolean;
 summary: ComparisonSummary;
 details: PageComparisonDetail\[\]; // Array of differences per page
 errors?: ComparisonError\[\];
}

interface ComparisonSummary {
 pagesCompared: number;
 pagesWithDifferences: number;
 // ... other summary stats
}

interface PageComparisonDetail {
 url: string;
 status: 'match' | 'differ' | 'error' | 'only_in_before' | 'only_in_after';
 differences?: Difference\[\]; // Populated if status is 'differ'
 error?: string; // Populated if status is 'error'
}

interface Difference {
 type: 'structural' | 'content' | 'attribute';
 selector: string; // CSS or XPath identifying the location
 beforeSnippet?: string;
 afterSnippet?: string;
 // ... potentially more detail depending on diff engine output
}

// Define CrawlError, ComparisonError etc. as needed
```

_(Note: The internal APIs used by the API Layer to communicate with components like the Crawler, DOM Processor, and Diff Engine are implementation details and not listed here as the primary interface.)_

### **Architectural Considerations**

(Retained and updated slightly for context)

1. **Extensibility Patterns**
   - Plugin system for custom rule types (potentially managed via API Layer).
   - Adapter pattern for CMS-specific normalizers.
   - Strategy pattern for diff algorithms.
2. **Performance Optimizations**
   - Parallel crawl execution (configured via API Layer).
   - Efficient DOM processing and diffing.
3. **Future Web Interface Hooks**
   - The API Layer provides the natural integration point (potentially via a network wrapper like REST/JSON-RPC in the future).
   - Standardized JSON result format from the API Layer.
   - Audit trail metadata can be managed by the API Layer.

This updated architecture aligns with the PRD v2.2, emphasizing the API Layer for better modularity, testability, and future extensibility (like adding a Web UI). It leverages TypeScript's type system and relies on appropriate OSS libraries for core functionality.
