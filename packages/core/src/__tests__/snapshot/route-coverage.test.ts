import { describe, expect, it, vi } from "vitest";
import { LoadedSnapshot } from "../../core/snapshot/classes/LoadedSnapshot.js";
import { validateSnapshotRoutes } from "../../core/snapshot/route-coverage.js";
import type { SnapshotIndex, SnapshotMetadata } from "../../types/snapshot.js";

function snapshot(
  pages: Record<string, { statusCode: number }>,
  totalPages = Object.keys(pages).length,
): LoadedSnapshot {
  const metadata: SnapshotMetadata = {
    baseUrl: "https://example.com",
    timestamp: "2026-10-12T00:00:00.000Z",
    crawlSettings: {
      baseUrl: "https://example.com",
      crawlerType: "cheerio",
    },
  };
  const index: SnapshotIndex = {
    urls: Object.fromEntries(
      Object.entries(pages).map(([route, page]) => [
        route,
        {
          filename: `${Buffer.from(route).toString("base64url")}.json.gz`,
          statusCode: page.statusCode,
        },
      ]),
    ),
    metadata: {
      baseUrl: metadata.baseUrl,
      timestamp: metadata.timestamp,
      totalPages,
    },
  };
  const loaded = new LoadedSnapshot(metadata, index, "/unused");
  vi.spyOn(loaded, "getPage").mockImplementation(async (route) => {
    const page = pages[route];
    return page
      ? {
          url: route,
          finalUrl: `https://example.com${route}`,
          content: "<p>ok</p>",
          statusCode: page.statusCode,
          headers: {},
        }
      : null;
  });
  return loaded;
}

describe("validateSnapshotRoutes", () => {
  it("accepts complete captures with 2xx and 3xx responses", async () => {
    await expect(
      validateSnapshotRoutes(
        snapshot({ "/": { statusCode: 200 }, "/a": { statusCode: 399 } }),
        ["/", "/a"],
      ),
    ).resolves.toEqual([]);
  });

  it("reports missing routes and captured page count mismatches", async () => {
    await expect(
      validateSnapshotRoutes(snapshot({ "/": { statusCode: 200 } }), [
        "/",
        "/missing",
      ]),
    ).resolves.toEqual([
      'The crawl did not capture route "/missing".',
      "Expected 2 route(s), but captured 1.",
    ]);
  });

  it.each([199, 400])("rejects HTTP %i responses", async (statusCode) => {
    await expect(
      validateSnapshotRoutes(snapshot({ "/": { statusCode } }), ["/"]),
    ).resolves.toEqual([`Route "/" returned HTTP ${statusCode}.`]);
  });
});
