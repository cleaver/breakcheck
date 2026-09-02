import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSnapshot,
  SnapshotRepository,
} from "../../core/snapshot/index.js";
import { resolveUrlPaths } from "../../core/crawler/url-paths.js";
import type { SnapshotConfig } from "../../types/api.js";

describe("exact snapshot URL manifests", () => {
  const baseUrl = "https://example.com";
  let snapshotsDirectory: string;

  beforeEach(async () => {
    snapshotsDirectory = await mkdtemp(
      join(tmpdir(), "breakcheck-snapshot-manifest-"),
    );
  });

  afterEach(async () => {
    await rm(snapshotsDirectory, { recursive: true, force: true });
  });

  it("resolves unique manifest paths in first-seen order", () => {
    expect(
      resolveUrlPaths(baseUrl, ["/listed", "/seed", "/listed", "/unlisted"]),
    ).toEqual({
      paths: ["/listed", "/seed", "/unlisted"],
      issues: [],
    });
  });

  it("rejects invalid programmatic manifest paths before crawling", async () => {
    const config: SnapshotConfig = {
      baseUrl,
      name: "invalid-manifest",
      urlPaths: ["/", "listed", "//other.example/path"],
      crawlSettings: {
        baseUrl,
        crawlerType: "cheerio",
      },
    };
    const repository =
      await SnapshotRepository.createWithCustomDir(snapshotsDirectory);

    const result = await createSnapshot(config, repository);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error("Expected invalid manifest snapshot to fail");
    }
    expect(result.message).toContain("Manifest path 2 (listed)");
    expect(result.message).toContain("Manifest path 3 (//other.example/path)");
    await expect(readdir(snapshotsDirectory)).resolves.toEqual([]);
  });

  it("rejects a request budget smaller than the manifest", async () => {
    const config: SnapshotConfig = {
      baseUrl,
      name: "limited-manifest",
      urlPaths: ["/", "/listed"],
      crawlSettings: {
        baseUrl,
        crawlerType: "cheerio",
        maxRequests: 1,
      },
    };
    const repository =
      await SnapshotRepository.createWithCustomDir(snapshotsDirectory);

    const result = await createSnapshot(config, repository);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error("Expected limited manifest snapshot to fail");
    }
    expect(result.message).toContain("maxRequests (1)");
  });

  it("rejects discovery filters with an exact manifest", async () => {
    const config: SnapshotConfig = {
      baseUrl,
      name: "filtered-manifest",
      urlPaths: ["/listed"],
      crawlSettings: {
        baseUrl,
        crawlerType: "cheerio",
        excludePatterns: ["**/unlisted"],
      },
    };
    const repository =
      await SnapshotRepository.createWithCustomDir(snapshotsDirectory);

    const result = await createSnapshot(config, repository);

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error("Expected filtered manifest snapshot to fail");
    }
    expect(result.message).toContain(
      "includePatterns and excludePatterns cannot be used",
    );
  });
});
