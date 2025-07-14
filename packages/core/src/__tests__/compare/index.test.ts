import { Dataset } from "crawlee";
import { describe, expect, it } from "vitest";
import { comparePage, compareSnapshots } from "../../core/compare";
import { ComparisonRepository } from "../../core/compare/classes/ComparisonRepository";
import { RulesEngine } from "../../core/rules/RulesEngine";
import { SnapshotRepository } from "../../core/snapshot";
import {
    ComparisonIndex,
    ComparisonMetadata,
    PageDiff
} from "../../types/compare";
import { PageSnapshot } from "../../types/crawler";

/**
 * Creates a mock SnapshotRepository for testing
 */
class MockSnapshotRepository
  implements
    Pick<
      SnapshotRepository,
      "loadSnapshot" | "saveSnapshot" | "generateUrlList" | "listSnapshots"
    >
{
  constructor(private beforeSnapshot: any, private afterSnapshot: any) {}

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

  private constructor() {}

  static async create(
    name: string,
    metadata: ComparisonMetadata
  ): Promise<MockComparisonRepository> {
    const instance = new MockComparisonRepository();
    instance.index.metadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      totalPages: 0,
      pagesWithDifferences: 0,
    };
    return instance;
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

async function createMockSnapshotRepository(
  beforeSnapshot: any,
  afterSnapshot: any
): Promise<SnapshotRepository> {
  return new MockSnapshotRepository(
    beforeSnapshot,
    afterSnapshot
  ) as unknown as SnapshotRepository;
}

function createMockRulesEngine(): RulesEngine {
  return new MockRulesEngine("default") as unknown as RulesEngine;
}

interface TestSetup {
  snapshotRepository: SnapshotRepository;
  comparisonRepository: ComparisonRepository;
  rulesEngine: RulesEngine;
  comparisonParams: {
    beforeSnapshotId: string;
    afterSnapshotId: string;
    comparisonName: string;
    ruleset: string;
  };
}

function createMockSnapshot(
  urls: Record<string, { filename: string; statusCode: number }>,
  content: string
) {
  return {
    index: {
      urls,
      metadata: {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        totalPages: Object.keys(urls).length,
      },
    },
    getPage: async (url: string) => ({
      url,
      finalUrl: url,
      content,
      statusCode: 200,
      headers: { "content-type": "text/html" },
    }),
  };
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
      expect(result.differences[0].added).toBeUndefined();
      expect(result.differences[0].removed).toBeUndefined();
    });
  });

  describe("compareSnapshots", () => {
    async function createSetup(
      beforeUrls: Record<string, { filename: string; statusCode: number }>,
      afterUrls: Record<string, { filename: string; statusCode: number }>,
      beforeContent: string,
      afterContent: string
    ): Promise<TestSetup> {
      const beforeSnapshot = createMockSnapshot(beforeUrls, beforeContent);
      const afterSnapshot = createMockSnapshot(afterUrls, afterContent);
      const snapshotRepository = await createMockSnapshotRepository(
        beforeSnapshot,
        afterSnapshot
      );
      const comparisonRepository = await ComparisonRepository.create(
        "test-comparison",
        {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          rulesUsedIdentifier: "default",
        }
      );
      const rulesEngine = createMockRulesEngine();
      return {
        snapshotRepository,
        comparisonRepository,
        rulesEngine,
        comparisonParams: {
          beforeSnapshotId: "before",
          afterSnapshotId: "after",
          comparisonName: "test-comparison",
          ruleset: "default",
        },
      };
    }

    it("should detect content differences between snapshots", async () => {
      const beforeUrls = {
        "https://example.com": {
          filename: "example.html",
          statusCode: 200,
        },
      };
      const afterUrls = {
        "https://example.com": {
          filename: "example.html",
          statusCode: 200,
        },
      };
      const beforeContent = "<html>\n<body>Hello World</body>\n</html>";
      const afterContent = "<html>\n<body>Hello New World</body>\n</html>";
      const setup = await createSetup(
        beforeUrls,
        afterUrls,
        beforeContent,
        afterContent
      );

      const result = await compareSnapshots(
        setup.comparisonParams,
        setup.snapshotRepository,
        setup.comparisonRepository,
        setup.rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("fail");
      expect(result.totalPagesCompared).toBe(1);
      expect(result.pagesWithDifferences).toBe(1);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });

    it("should detect new and removed URLs between snapshots", async () => {
      const beforeUrls = {
        "https://example.com/old": {
          filename: "old.html",
          statusCode: 200,
        },
      };
      const afterUrls = {
        "https://example.com/new": {
          filename: "new.html",
          statusCode: 200,
        },
      };
      const beforeContent = "<html><body>Old Page</body></html>";
      const afterContent = "<html><body>New Page</body></html>";
      const setup = await createSetup(
        beforeUrls,
        afterUrls,
        beforeContent,
        afterContent
      );

      const result = await compareSnapshots(
        setup.comparisonParams,
        setup.snapshotRepository,
        setup.comparisonRepository,
        setup.rulesEngine
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
      const beforeUrls = {
        "https://example.com/page1": {
          filename: "page1.html",
          statusCode: 200,
        },
        "https://example.com/page2": {
          filename: "page2.html",
          statusCode: 200,
        },
      };
      const afterUrls = {
        "https://example.com/page1": {
          filename: "page1.html",
          statusCode: 200,
        },
        "https://example.com/page2": {
          filename: "page2.html",
          statusCode: 200,
        },
      };
      const beforeContent = "<html><body>Original Content</body></html>";
      const afterContent = "<html><body>Modified Content</body></html>";
      const setup = await createSetup(
        beforeUrls,
        afterUrls,
        beforeContent,
        afterContent
      );

      const result = await compareSnapshots(
        {
          ...setup.comparisonParams,
          urls: ["https://example.com/page1"],
        },
        setup.snapshotRepository,
        setup.comparisonRepository,
        setup.rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("fail");
      expect(result.totalPagesCompared).toBe(1);
      expect(result.pagesWithDifferences).toBe(1);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });

    it("should return no differences for identical snapshots", async () => {
      const beforeUrls = {
        "https://example.com": {
          filename: "example.html",
          statusCode: 200,
        },
      };
      const afterUrls = {
        "https://example.com": {
          filename: "example.html",
          statusCode: 200,
        },
      };
      const beforeContent = "<html><body>Hello World</body></html>";
      const afterContent = "<html><body>Hello World</body></html>";
      const setup = await createSetup(
        beforeUrls,
        afterUrls,
        beforeContent,
        afterContent
      );

      const result = await compareSnapshots(
        setup.comparisonParams,
        setup.snapshotRepository,
        setup.comparisonRepository,
        setup.rulesEngine
      );

      expect(result.status).toBe("completed");
      expect(result.overallResult).toBe("pass");
      expect(result.totalPagesCompared).toBe(1);
      expect(result.pagesWithDifferences).toBe(0);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);
    });

    it("should return URLs in ascending sorted order regardless of input order", async () => {
      const beforeUrls = {
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
      };
      const afterUrls = {
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
      };
      const beforeContent = "<html><body>Original Content</body></html>";
      const afterContent = "<html><body>Modified Content</body></html>";
      const setup = await createSetup(
        beforeUrls,
        afterUrls,
        beforeContent,
        afterContent
      );

      const result = await compareSnapshots(
        setup.comparisonParams,
        setup.snapshotRepository,
        setup.comparisonRepository,
        setup.rulesEngine
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
