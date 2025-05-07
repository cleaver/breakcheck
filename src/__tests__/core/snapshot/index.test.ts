import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SnapshotManager, LoadedSnapshot } from "../../../core/snapshot";
import { Dataset, purgeDefaultStorages } from "crawlee";
import * as fs from "fs/promises";
import * as path from "path";
import { PageSnapshot, CrawlerType } from "@project-types/crawler";

describe("SnapshotManager", () => {
  const TEST_SNAPSHOTS_DIR = path.join(process.cwd(), "test-snapshots");
  let snapshotManager: SnapshotManager;
  let testDataset: Dataset;

  beforeEach(async () => {
    // Initialize storage system
    await purgeDefaultStorages();

    // Create a fresh test snapshots directory
    await fs.mkdir(TEST_SNAPSHOTS_DIR, { recursive: true });
    snapshotManager = new SnapshotManager(TEST_SNAPSHOTS_DIR);

    // Create a test dataset
    testDataset = await Dataset.open("test-dataset");
    // Create initial data
    await testDataset.pushData({
      type: "page",
      url: "https://example.com",
      finalUrl: "https://example.com",
      statusCode: 200,
      title: "Example Page",
      html: "<html><body>Test</body></html>",
      headers: { "content-type": "text/html" },
    });
  });

  afterEach(async () => {
    // Clean up test snapshots directory
    await fs.rm(TEST_SNAPSHOTS_DIR, { recursive: true, force: true });
    // Clean up dataset
    await testDataset.drop();
  });

  describe("saveSnapshot", () => {
    it("should save a snapshot with metadata and pages", async () => {
      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      const pageCount = await snapshotManager.saveSnapshot("test-snapshot", {
        dataset: testDataset,
        metadata,
      });

      expect(pageCount).toBe(1);

      // Verify files were created
      const snapshotDir = path.join(TEST_SNAPSHOTS_DIR, "test-snapshot");
      const files = await fs.readdir(snapshotDir);
      expect(files).toContain("metadata.json");
      expect(files).toContain("index.json");
      expect(files).toContain("pages");

      // Verify metadata
      const metadataContent = await fs.readFile(
        path.join(snapshotDir, "metadata.json"),
        "utf-8"
      );
      const savedMetadata = JSON.parse(metadataContent);
      expect(savedMetadata).toEqual(metadata);

      // Verify index
      const indexContent = await fs.readFile(
        path.join(snapshotDir, "index.json"),
        "utf-8"
      );
      const index = JSON.parse(indexContent);
      expect(index.metadata.totalPages).toBe(1);
      expect(Object.keys(index.urls)).toHaveLength(1);
    });

    it("should handle empty dataset", async () => {
      const emptyDataset = await Dataset.open("empty-dataset");
      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      const pageCount = await snapshotManager.saveSnapshot("empty-snapshot", {
        dataset: emptyDataset,
        metadata,
      });

      expect(pageCount).toBe(0);
      await emptyDataset.drop();
    });
  });

  describe("loadSnapshot", () => {
    it("should load a saved snapshot", async () => {
      // First save a snapshot
      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      await snapshotManager.saveSnapshot("test-snapshot", {
        dataset: testDataset,
        metadata,
      });

      // Then load it
      const loadedSnapshot = await snapshotManager.loadSnapshot(
        "test-snapshot"
      );

      expect(loadedSnapshot).toBeInstanceOf(LoadedSnapshot);
      expect(loadedSnapshot.metadata).toEqual(metadata);
      expect(loadedSnapshot.index.metadata.totalPages).toBe(1);

      // Test loading a specific page
      const page = await loadedSnapshot.getPage("https://example.com");
      expect(page).not.toBeNull();
      expect(page?.url).toBe("https://example.com");
      expect(page?.statusCode).toBe(200);
    });

    it("should return null for non-existent page", async () => {
      // First save a snapshot
      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      await snapshotManager.saveSnapshot("test-snapshot", {
        dataset: testDataset,
        metadata,
      });

      // Then load it
      const loadedSnapshot = await snapshotManager.loadSnapshot(
        "test-snapshot"
      );

      // Try to get a non-existent page
      const page = await loadedSnapshot.getPage("https://nonexistent.com");
      expect(page).toBeNull();
    });
  });

  describe("generateUrlList", () => {
    it("should generate a URL list file", async () => {
      // First save a snapshot
      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      await snapshotManager.saveSnapshot("test-snapshot", {
        dataset: testDataset,
        metadata,
      });

      // Generate URL list
      const outputPath = await snapshotManager.generateUrlList("test-snapshot");

      // Verify file exists and contains correct content
      const content = await fs.readFile(outputPath, "utf-8");
      expect(content.trim()).toBe("https://example.com");
    });

    it("should filter URLs based on status code", async () => {
      // Add a page with error status
      await testDataset.pushData({
        type: "page",
        url: "https://example.com/error",
        finalUrl: "https://example.com/error",
        statusCode: 404,
        title: "Error Page",
        html: "<html><body>Error</body></html>",
        headers: { "content-type": "text/html" },
      });

      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      await snapshotManager.saveSnapshot("test-snapshot", {
        dataset: testDataset,
        metadata,
      });

      // Generate URL list with filter
      const outputPath = await snapshotManager.generateUrlList(
        "test-snapshot",
        undefined,
        (url, statusCode) => statusCode === 200
      );

      const content = await fs.readFile(outputPath, "utf-8");
      const urls = content.trim().split("\n");
      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe("https://example.com");
    });
  });

  describe("listSnapshots", () => {
    it("should list all snapshots", async () => {
      // Create multiple snapshots
      const metadata = {
        baseUrl: "https://example.com",
        timestamp: new Date().toISOString(),
        crawlSettings: {
          baseUrl: "https://example.com",
          crawlerType: "cheerio" as CrawlerType,
          maxRequestsPerCrawl: 10,
        },
      };

      await snapshotManager.saveSnapshot("snapshot1", {
        dataset: testDataset,
        metadata,
      });

      await snapshotManager.saveSnapshot("snapshot2", {
        dataset: testDataset,
        metadata,
      });

      const snapshots = await snapshotManager.listSnapshots();

      // Check that we got the expected number of snapshots
      expect(snapshots).toHaveLength(2);

      // Check that both snapshots are present with correct data
      const snapshot1 = snapshots.find((s) => s.name === "snapshot1");
      const snapshot2 = snapshots.find((s) => s.name === "snapshot2");

      expect(snapshot1).toBeDefined();
      expect(snapshot2).toBeDefined();

      // Check snapshot1 details
      expect(snapshot1).toEqual({
        name: "snapshot1",
        date: metadata.timestamp,
        pageCount: 1,
        errorCount: 0,
      });

      // Check snapshot2 details
      expect(snapshot2).toEqual({
        name: "snapshot2",
        date: metadata.timestamp,
        pageCount: 1,
        errorCount: 0,
      });
    });

    it("should return empty array when no snapshots exist", async () => {
      const snapshots = await snapshotManager.listSnapshots();
      expect(snapshots).toEqual([]);
    });
  });
});
