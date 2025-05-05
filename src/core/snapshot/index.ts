import { CrawlerConfig, PageSnapshot } from "@project-types/crawler";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";
import type { Dataset } from "crawlee";

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

interface SnapshotDataStreamed {
  dataset: InstanceType<typeof Dataset>;
  metadata: {
    baseUrl: string;
    timestamp: string;
    crawlSettings: CrawlerConfig;
  };
}

interface SnapshotIndex {
  urls: {
    [url: string]: {
      filename: string;
      statusCode: number;
      finalUrl?: string;
    };
  };
  metadata: {
    baseUrl: string;
    timestamp: string;
    totalPages: number;
  };
}

export class SnapshotManager {
  private readonly snapshotsDir: string;

  constructor(snapshotsDir: string = path.join(process.cwd(), "snapshots")) {
    this.snapshotsDir = snapshotsDir;
  }

  /**
   * Save a snapshot to disk (streaming/iterative)
   * Returns the number of non-error pages saved
   */
  async saveSnapshot(
    name: string,
    data: SnapshotDataStreamed
  ): Promise<number> {
    // Ensure snapshots directory exists
    await fs.mkdir(this.snapshotsDir, { recursive: true });

    // Create snapshot directory
    const snapshotDir = path.join(this.snapshotsDir, name);

    // Remove existing snapshot directory if it exists
    try {
      await fs.rm(snapshotDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }

    // Create fresh snapshot directory
    await fs.mkdir(snapshotDir, { recursive: true });

    // Save metadata
    const metadataPath = path.join(snapshotDir, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(data.metadata, null, 2));

    // Save pages
    const pagesDir = path.join(snapshotDir, "pages");
    await fs.mkdir(pagesDir, { recursive: true });

    // Create index
    const index: SnapshotIndex = {
      urls: {},
      metadata: {
        baseUrl: data.metadata.baseUrl,
        timestamp: data.metadata.timestamp,
        totalPages: 0, // will be updated
      },
    };

    let pageCount = 0;
    await data.dataset.forEach(async (item: any) => {
      if (item.type === "error") return;
      // Save each page as a compressed JSON file
      const page = item as PageSnapshot;
      const pageData = JSON.stringify(page);
      const compressed = await gzip(pageData);
      const filename = Buffer.from(page.url).toString("base64url") + ".json.gz";
      await fs.writeFile(path.join(pagesDir, filename), compressed);
      // Add to index
      index.urls[page.url] = {
        filename,
        statusCode: page.statusCode,
        finalUrl: page.finalUrl !== page.url ? page.finalUrl : undefined,
      };
      pageCount++;
    });

    // Save index
    index.metadata.totalPages = pageCount;
    const indexPath = path.join(snapshotDir, "index.json");
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

    return pageCount;
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

    // Load index
    const indexPath = path.join(snapshotDir, "index.json");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const index: SnapshotIndex = JSON.parse(indexContent);

    // Load pages
    const pagesDir = path.join(snapshotDir, "pages");
    const pages: PageSnapshot[] = [];

    for (const [url, info] of Object.entries(index.urls)) {
      const filePath = path.join(pagesDir, info.filename);
      const compressed = await fs.readFile(filePath);
      const decompressed = await gunzip(compressed);
      const page = JSON.parse(decompressed.toString());
      pages.push(page);
    }

    return {
      pages,
      metadata,
    };
  }

  /**
   * Generate a URL list file from a snapshot
   * @param name Snapshot name
   * @param outputPath Optional path to save the URL list. If not provided, saves in the snapshot directory
   * @param filter Optional function to filter URLs
   */
  async generateUrlList(
    name: string,
    outputPath?: string,
    filter?: (url: string, statusCode: number) => boolean
  ): Promise<string> {
    const snapshotDir = path.join(this.snapshotsDir, name);

    // Load index
    const indexPath = path.join(snapshotDir, "index.json");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const index: SnapshotIndex = JSON.parse(indexContent);

    // Filter and collect URLs
    const urls = Object.entries(index.urls)
      .filter(([url, info]) => !filter || filter(url, info.statusCode))
      .map(([url]) => url);

    // Generate URL list content
    const content = urls.join("\n");

    // Determine output path
    const finalOutputPath = outputPath || path.join(snapshotDir, "urls.txt");

    // Save URL list
    await fs.writeFile(finalOutputPath, content);

    return finalOutputPath;
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
