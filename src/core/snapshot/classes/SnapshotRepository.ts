import { PageSnapshot } from "@project-types/crawler";
import {
    SnapshotData,
    SnapshotIndex,
    SnapshotSummary
} from "@project-types/snapshot";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";
import { LoadedSnapshot } from "./LoadedSnapshot";

const gzip = promisify(zlib.gzip);

export class SnapshotRepository {
  private readonly snapshotsDir: string;

  constructor(snapshotsDir: string = path.join(process.cwd(), "snapshots")) {
    this.snapshotsDir = snapshotsDir;
  }

  /**
   * Normalizes a URL by removing scheme, hostname, and port
   * @param url The URL to normalize
   * @returns The normalized URL path starting with "/"
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
      // If URL parsing fails, return the original URL
      return url;
    }
  }

  /**
   * Save a snapshot to disk (streaming/iterative)
   * Returns the number of non-error pages saved
   */
  async saveSnapshot(name: string, data: SnapshotData): Promise<number> {
    await fs.mkdir(this.snapshotsDir, { recursive: true });

    const snapshotDir = path.join(this.snapshotsDir, name);

    try {
      await fs.rm(snapshotDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }

    await fs.mkdir(snapshotDir, { recursive: true });

    const metadataPath = path.join(snapshotDir, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(data.metadata, null, 2));

    const pagesDir = path.join(snapshotDir, "pages");
    await fs.mkdir(pagesDir, { recursive: true });

    // Create index
    const index: SnapshotIndex = {
      urls: {},
      metadata: {
        baseUrl: data.metadata.baseUrl,
        timestamp: data.metadata.timestamp,
        totalPages: 0,
      },
    };

    let pageCount = 0;
    await data.dataset.forEach(async (item: any) => {
      if (item.type === "error") return;
      // Save each page as a compressed JSON file
      const page = item as PageSnapshot;
      const normalizedUrl = this.normalizeUrl(page.url);

      // Create a copy of the page with normalized URL
      const normalizedPage = {
        ...page,
        url: normalizedUrl,
      };

      const pageData = JSON.stringify(normalizedPage);
      const compressed = await gzip(pageData);
      const filename =
        Buffer.from(normalizedUrl).toString("base64url") + ".json.gz";
      await fs.writeFile(path.join(pagesDir, filename), compressed);

      // Add to index
      index.urls[normalizedUrl] = {
        filename,
        statusCode: page.statusCode,
        finalUrl: page.finalUrl !== page.url ? page.finalUrl : undefined,
        pageTitle: page.title,
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
  async loadSnapshot(name: string) {
    const snapshotDir = path.join(this.snapshotsDir, name);

    // Load metadata
    const metadataPath = path.join(snapshotDir, "metadata.json");
    const metadataContent = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(metadataContent);

    // Load index
    const indexPath = path.join(snapshotDir, "index.json");
    const indexContent = await fs.readFile(indexPath, "utf-8");
    const index: SnapshotIndex = JSON.parse(indexContent);

    // Prepare pages directory path
    const pagesDir = path.join(snapshotDir, "pages");

    // Return a LoadedSnapshot instance for on-demand page loading
    return new LoadedSnapshot(metadata, index, pagesDir);
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
   * List all available snapshots with their details
   */
  async listSnapshots(): Promise<SnapshotSummary[]> {
    try {
      const entries = await fs.readdir(this.snapshotsDir, {
        withFileTypes: true,
      });

      const snapshots = entries.filter((entry) => entry.isDirectory());
      const summaries: SnapshotSummary[] = [];

      for (const snapshot of snapshots) {
        try {
          // Load metadata
          const metadataPath = path.join(
            this.snapshotsDir,
            snapshot.name,
            "metadata.json"
          );
          const metadataContent = await fs.readFile(metadataPath, "utf-8");
          const metadata = JSON.parse(metadataContent);

          // Load index for page count
          const indexPath = path.join(
            this.snapshotsDir,
            snapshot.name,
            "index.json"
          );
          const indexContent = await fs.readFile(indexPath, "utf-8");
          const index: SnapshotIndex = JSON.parse(indexContent);

          summaries.push({
            name: snapshot.name,
            date: metadata.timestamp,
            pageCount: index.metadata.totalPages,
            errorCount: 0,
          });
        } catch (error) {
          // If we can't read the metadata or index, just include the name
          summaries.push({
            name: snapshot.name,
            date: "Unknown",
            pageCount: 0,
            errorCount: 0,
          });
        }
      }

      return summaries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }
}
