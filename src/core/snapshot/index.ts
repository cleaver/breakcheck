import { CrawlerConfig, PageSnapshot } from "@project-types/crawler";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface SnapshotData {
  pages: PageSnapshot[];
  metadata: {
    baseUrl: string;
    timestamp: string;
    crawlSettings: CrawlerConfig;
  };
}

export class SnapshotManager {
  private readonly snapshotsDir: string;

  constructor(snapshotsDir: string = path.join(process.cwd(), "snapshots")) {
    this.snapshotsDir = snapshotsDir;
  }

  /**
   * Save a snapshot to disk
   */
  async saveSnapshot(name: string, data: SnapshotData): Promise<void> {
    // Ensure snapshots directory exists
    await fs.mkdir(this.snapshotsDir, { recursive: true });

    // Create snapshot directory
    const snapshotDir = path.join(this.snapshotsDir, name);
    await fs.mkdir(snapshotDir, { recursive: true });

    // Save metadata
    const metadataPath = path.join(snapshotDir, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(data.metadata, null, 2));

    // Save pages
    const pagesDir = path.join(snapshotDir, "pages");
    await fs.mkdir(pagesDir, { recursive: true });

    // Save each page as a compressed JSON file
    for (const page of data.pages) {
      const pageData = JSON.stringify(page);
      const compressed = await gzip(pageData);
      const filename = Buffer.from(page.url).toString("base64url") + ".json.gz";
      await fs.writeFile(path.join(pagesDir, filename), compressed);
    }
  }

  /**
   * Load a snapshot from disk
   */
  async loadSnapshot(name: string): Promise<SnapshotData> {
    const snapshotDir = path.join(this.snapshotsDir, name);

    // Load metadata
    const metadataPath = path.join(snapshotDir, "metadata.json");
    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent);

    // Load pages
    const pagesDir = path.join(snapshotDir, "pages");
    const pageFiles = await fs.readdir(pagesDir);
    const pages: PageSnapshot[] = [];

    for (const file of pageFiles) {
      if (file.endsWith(".json.gz")) {
        const compressed = await fs.readFile(path.join(pagesDir, file));
        const decompressed = await gunzip(compressed);
        const page = JSON.parse(decompressed.toString());
        pages.push(page);
      }
    }

    return {
      pages,
      metadata,
    };
  }

  /**
   * List all available snapshots
   */
  async listSnapshots(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.snapshotsDir, {
        withFileTypes: true,
      });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}
