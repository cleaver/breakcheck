import { describe, it, expect } from "vitest";
import { CompareManager } from "@core/compare";
import { PageSnapshot } from "@project-types/crawler";

/**
 * Creates a CompareManager with a mocked SnapshotManager
 */
function createCompareManagerWithMockSnapshots(
  beforeSnapshot: any,
  afterSnapshot: any
) {
  const snapshotManager = {
    loadSnapshot: async (name: string) =>
      name === "before" ? beforeSnapshot : afterSnapshot,
  };
  const compareManager = new CompareManager();
  (compareManager as any).snapshotManager = snapshotManager;
  return compareManager;
}

describe("CompareManager", () => {
  const compareManager = new CompareManager();

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

      const result = await compareManager.comparePage(before, after);

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

      const result = await compareManager.comparePage(snapshot, snapshot);

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

      const compareManager = createCompareManagerWithMockSnapshots(
        beforeSnapshot,
        afterSnapshot
      );
      const result = await compareManager.compareSnapshots("before", "after");

      expect(result.pageDiffs).toHaveLength(1);
      expect(result.newUrls).toHaveLength(0);
      expect(result.removedUrls).toHaveLength(0);

      const pageDiff = result.pageDiffs[0];
      expect(pageDiff.url).toBe("https://example.com");
      expect(pageDiff.hasDifferences).toBe(true);
      expect(pageDiff.differences).toHaveLength(4);
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

      const compareManager = createCompareManagerWithMockSnapshots(
        beforeSnapshot,
        afterSnapshot
      );
      const result = await compareManager.compareSnapshots("before", "after");

      expect(result.pageDiffs).toHaveLength(0);
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

      const compareManager = createCompareManagerWithMockSnapshots(
        beforeSnapshot,
        afterSnapshot
      );
      const result = await compareManager.compareSnapshots("before", "after", [
        "https://example.com/page1",
      ]);

      expect(result.pageDiffs).toHaveLength(1);
      expect(result.pageDiffs[0].url).toBe("https://example.com/page1");
      expect(result.pageDiffs[0].hasDifferences).toBe(true);
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

      const compareManager = createCompareManagerWithMockSnapshots(
        snapshot,
        snapshot
      );
      const result = await compareManager.compareSnapshots("before", "after");

      expect(result.pageDiffs).toHaveLength(1);
      expect(result.pageDiffs[0].hasDifferences).toBe(false);
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

      const compareManager = createCompareManagerWithMockSnapshots(
        beforeSnapshot,
        afterSnapshot
      );
      const result = await compareManager.compareSnapshots("before", "after");

      expect(result.pageDiffs).toHaveLength(3);

      // Verify URLs are in ascending order
      const urls = result.pageDiffs.map((diff) => diff.url);
      expect(urls).toEqual([
        "https://example.com/a",
        "https://example.com/m",
        "https://example.com/z",
      ]);
    });
  });
});
