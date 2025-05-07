import { describe, it, expect } from "vitest";
import { CompareManager } from "@core/compare";
import { PageSnapshot } from "@project-types/crawler";

describe("CompareManager", () => {
  const compareManager = new CompareManager();

  describe("compareSnapshots", () => {
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
});
