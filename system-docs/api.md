### **Breakcheck API Layer Overview**

**Purpose:**

- Acts as the primary internal interface for interacting with Breakcheck's core functionalities (website snapshotting and comparison).
- Orchestrates calls to underlying core components (Crawler, Snapshot Manager, DOM Processor, Diff Engine, Rules Engine).
- Decouples clients (like the CLI or a future Web UI) from the core implementation details.
- Promotes modularity, testability, and maintainability.

**Location & Structure:**

- Located within the src/api/ directory.
- src/api/index.ts: Exports the public API functions.
- src/api/types.ts: Defines shared TypeScript types for API request configurations (e.g., SnapshotConfig, ComparisonConfig) and response objects (e.g., SnapshotResult, ComparisonSummary).
- Individual modules (e.g., src/api/snapshot.ts, src/api/compare.ts) contain the logic for specific API operations, orchestrating calls to the src/core/ components.

**Key Public Functions (Examples):**

```typescript
// Exported from src/api/index.ts
import type {
  SnapshotConfig,
  SnapshotResult,
  ComparisonConfig,
  ComparisonSummary,
} from "@project-types/api";

/**
 * Creates a snapshot of a website based on the provided configuration.
 * Orchestrates calls to Crawler and Snapshot Manager.
 */
async function createSnapshot(config: SnapshotConfig): Promise<SnapshotResult>;

/**
 * Runs a comparison between two snapshots using specified rules.
 * Orchestrates calls to Snapshot Manager, Rules Engine Parser (if needed),
 * DOM Processor, and Diff Engine.
 */
async function runComparison(
  config: ComparisonConfig
): Promise<ComparisonSummary>;

// Potentially others: listSnapshots, getSnapshotDetails, validateRules...
```

**Interaction Patterns:**

1. **From CLI (src/cli/commands/):**
   - Import API functions directly from ../../api/index.js.
   - Import necessary types from ../../api/types.js.
   - In the commander action handler:
     - Map CLI options (options) to the corresponding API configuration object (e.g., SnapshotConfig).
     - Call the imported API function (e.g., await createSnapshot(config)).
     - Process the returned result (SnapshotResult) or handle errors.
2. **As a Library (External JS/TS):**
   - Export API functions from the package's main entry point (src/index.ts re-exporting from src/api/index.ts).
   - Other projects can npm install breakcheck and import { createSnapshot, ... } from 'breakcheck'.
3. **As a Network Service (Future):**
   - A separate server module (e.g., using Express) would import the internal API functions and expose them via HTTP endpoints (REST/JSON-RPC). This layer would handle request/response serialization and network concerns.

**Core Idea:** The API layer provides a stable, typed contract for all operations, hiding the complexity of the underlying core components. Clients interact _only_ with this layer.
