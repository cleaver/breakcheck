import { comparePage, compareSnapshots } from "@core/compare";
import { ComparisonRepository } from "@core/compare/classes/ComparisonRepository";
import { RulesEngine } from "@core/rules/RulesEngine";
import { SnapshotRepository } from "@core/snapshot";
import {
    ComparisonIndex,
    ComparisonMetadata,
    PageDiff
} from "@project-types/compare";
import { PageSnapshot } from "@project-types/crawler";
import { Dataset } from "crawlee";
import { describe, expect, it } from "vitest";

/**
 * Creates a mock SnapshotRepository for testing
 */
class MockSnapshotRepository extends SnapshotRepository {
  constructor(private beforeSnapshot: any, private afterSnapshot: any) {
    super();
  }

  async loadSnapshot(name: string) {
    return name === "before" ? this.beforeSnapshot : this.afterSnapshot;
  }

  async saveSnapshot(name: string, data: { dataset: Dataset; metadata: any }) {
    return 0;
  }

  async generateUrlList(name: string) {
    return "";
  }

  async listSnapshots() {
    return [];
  }
}

/**
 * Creates a mock RulesEngine for testing
 */
class MockRulesEngine {
  constructor(rulesetOrName: string | any) {
    // No-op constructor
  }

  process(html: string): string {
    return html;
  }
}

/**
 * Creates a mock ComparisonRepository for testing
 */
class MockComparisonRepository {
  private index: ComparisonIndex = {
    urls: {},
    metadata: {
      timestamp: new Date().toISOString(),
      totalPages: 0,
      pagesWithDifferences: 0,
    } as any,
  };

  async startComparison(
    name: string,
    metadata: ComparisonMetadata
  ): Promise<void> {
    this.index.metadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      totalPages: 0,
      pagesWithDifferences: 0,
    };
  }

  async savePageDiff(pageDiff: PageDiff): Promise<void> {
    this.index.urls[pageDiff.url] = {
      filename: `${pageDiff.url}.json.gz`,
      hasDifferences: pageDiff.hasDifferences,
    };
    this.index.metadata.totalPages++;
    if (pageDiff.hasDifferences) {
      this.index.metadata.pagesWithDifferences++;
    }
  }

  async finalizeComparison(): Promise<string> {
    return "/mock/comparison/path";
  }

  getIndex(): ComparisonIndex {
    return this.index;
  }
}

function createMockSnapshotRepository(
  beforeSnapshot: any,
  afterSnapshot: any
): SnapshotRepository {
  return new MockSnapshotRepository(beforeSnapshot, afterSnapshot);
}

function createMockRulesEngine(): RulesEngine {
  return new MockRulesEngine("default") as unknown as RulesEngine;
}

function createMockComparisonRepository(): ComparisonRepository {
  return new MockComparisonRepository() as unknown as ComparisonRepository;
}

describe("Compare Functions", () => {
  describe("comparePage", () => {
    it("should detect content differences between snapshots", async () => {
      const before: PageSnapshot = {
        url: "https://example.com",
        finalUrl: "https://example.com",
        content: "<html>\n<body>Hello World</body>\n</html>",
        statusCode: 200,
        headers: { "content-type": "text/html" },
      };

      const after: PageSnapshot = {
        url: "https://example.com",
        finalUrl: "https://example.com",
        content: "<html>\n<body>Hello New World</body>\n</html>",
        statusCode: 200,
        headers: { "content-type": "text/html" },
      };

      const result = await comparePage(before, after);

      expect(result.url).toBe("https://example.com");
      expect(result.hasDifferences).toBe(true);

      // Expect 4 lines: One addition, one removal, two unchanged
      expect(result.differences).toHaveLength(4);

      const numberLinesAdded = result.differences.filter((d) => d.added).length;
      const numberLinesRemoved = result.differences.filter(
        (d) => d.removed
      ).length;
      const numberLinesUnchanged = result.differences.filter(
        (d) => !d.added && !d.removed
      ).length;

      expect(numberLinesAdded).toBe(1);
      expect(numberLinesRemoved).toBe(1);
      expect(numberLinesUnchanged).toBe(2);
    });

    it("should return no differences for identical snapshots", async () => {
      const snapshot: PageSnapshot = {
        url: "https://example.com",
        finalUrl: "https://example.com",
        content: "<html><body>Hello World</body></html>",
        statusCode: 200,
        headers: { "content-type": "text/html" },
      };

      const result = await comparePage(snapshot, snapshot);

      expect(result.url).toBe("https://example.com");
      expect(result.hasDifferences).toBe(false);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].added).toBe(false);
      expect(result.differences[0].removed).toBe(false);
    });
  });

  describe("compareSnapshots", () => {
    it("should detect content differences between snapshots", async () => {
      const beforeSnapshot = {
        index: {
          urls: {
            "https://example.com": {
              filename: "example.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-01",
            totalPages: 1,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html>\n<body>Hello World</body>\n</html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const afterSnapshot = {
        index: {
          urls: {
            "https://example.com": {
              filename: "example.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-02",
            totalPages: 1,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html>\n<body>Hello New World</body>\n</html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const snapshotRepository = createMockSnapshotRepository(
        beforeSnapshot,
        afterSnapshot
      );
      const comparisonRepository = createMockComparisonRepository();
      const rulesEngine = createMockRulesEngine();
      const result = await compareSnapshots(
        {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          comparisonName: "test-comparison",
          ruleset: "default",
        },
        snapshotRepository,
        comparisonRepository,
        rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("fail");
      expect(result.totalPagesCompared).toBe(1);
      expect(result.pagesWithDifferences).toBe(1);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });

    it("should detect new and removed URLs between snapshots", async () => {
      const beforeSnapshot = {
        index: {
          urls: {
            "https://example.com/old": {
              filename: "old.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-01",
            totalPages: 1,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html><body>Old Page</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const afterSnapshot = {
        index: {
          urls: {
            "https://example.com/new": {
              filename: "new.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-02",
            totalPages: 1,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html><body>New Page</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const snapshotRepository = createMockSnapshotRepository(
        beforeSnapshot,
        afterSnapshot
      );
      const comparisonRepository = createMockComparisonRepository();
      const rulesEngine = createMockRulesEngine();
      const result = await compareSnapshots(
        {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          comparisonName: "test-comparison",
          ruleset: "default",
        },
        snapshotRepository,
        comparisonRepository,
        rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("pass");
      expect(result.totalPagesCompared).toBe(0);
      expect(result.pagesWithDifferences).toBe(0);
      expect(result.newUrls).toHaveLength(1);
      expect(result.newUrls[0]).toBe("https://example.com/new");
      expect(result.removedUrls).toHaveLength(1);
      expect(result.removedUrls[0]).toBe("https://example.com/old");
    });

    it("should filter URLs when specified", async () => {
      const beforeSnapshot = {
        index: {
          urls: {
            "https://example.com/page1": {
              filename: "page1.html",
              statusCode: 200,
            },
            "https://example.com/page2": {
              filename: "page2.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-01",
            totalPages: 2,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html><body>Original Content</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const afterSnapshot = {
        index: {
          urls: {
            "https://example.com/page1": {
              filename: "page1.html",
              statusCode: 200,
            },
            "https://example.com/page2": {
              filename: "page2.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-02",
            totalPages: 2,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: url.includes("page1")
            ? "<html><body>Modified Content</body></html>"
            : "<html><body>Original Content</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const snapshotRepository = createMockSnapshotRepository(
        beforeSnapshot,
        afterSnapshot
      );
      const comparisonRepository = createMockComparisonRepository();
      const rulesEngine = createMockRulesEngine();
      const result = await compareSnapshots(
        {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          comparisonName: "test-comparison",
          urls: ["https://example.com/page1"],
          ruleset: "default",
        },
        snapshotRepository,
        comparisonRepository,
        rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("fail");
      expect(result.totalPagesCompared).toBe(1);
      expect(result.pagesWithDifferences).toBe(1);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });

    it("should return no differences for identical snapshots", async () => {
      const snapshot = {
        index: {
          urls: {
            "https://example.com": {
              filename: "example.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-01",
            totalPages: 1,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html><body>Hello World</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const snapshotRepository = createMockSnapshotRepository(
        snapshot,
        snapshot
      );
      const comparisonRepository = createMockComparisonRepository();
      const rulesEngine = createMockRulesEngine();
      const result = await compareSnapshots(
        {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          comparisonName: "test-comparison",
          ruleset: "default",
        },
        snapshotRepository,
        comparisonRepository,
        rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("pass");
      expect(result.totalPagesCompared).toBe(1);
      expect(result.pagesWithDifferences).toBe(0);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });

    it("should return URLs in ascending sorted order regardless of input order", async () => {
      const beforeSnapshot = {
        index: {
          urls: {
            "https://example.com/m": {
              filename: "m.html",
              statusCode: 200,
            },
            "https://example.com/a": {
              filename: "a.html",
              statusCode: 200,
            },
            "https://example.com/z": {
              filename: "z.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-01",
            totalPages: 3,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html><body>Original Content</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const afterSnapshot = {
        index: {
          urls: {
            "https://example.com/m": {
              filename: "m.html",
              statusCode: 200,
            },
            "https://example.com/a": {
              filename: "a.html",
              statusCode: 200,
            },
            "https://example.com/z": {
              filename: "z.html",
              statusCode: 200,
            },
          },
          metadata: {
            baseUrl: "https://example.com",
            timestamp: "2024-01-02",
            totalPages: 3,
          },
        },
        getPage: async (url: string) => ({
          url,
          finalUrl: url,
          content: "<html><body>Modified Content</body></html>",
          statusCode: 200,
          headers: { "content-type": "text/html" },
        }),
      };

      const snapshotRepository = createMockSnapshotRepository(
        beforeSnapshot,
        afterSnapshot
      );
      const comparisonRepository = createMockComparisonRepository();
      const rulesEngine = createMockRulesEngine();
      const result = await compareSnapshots(
        {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          comparisonName: "test-comparison",
          ruleset: "default",
        },
        snapshotRepository,
        comparisonRepository,
        rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("fail");
      expect(result.totalPagesCompared).toBe(3);
      expect(result.pagesWithDifferences).toBe(3);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });
  });
});
