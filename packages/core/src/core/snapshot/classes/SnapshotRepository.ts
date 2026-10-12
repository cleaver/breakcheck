import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "node:crypto";
import { promisify } from "util";
import * as zlib from "zlib";
import { findRootDir } from "../../../lib/root.js";
import {
  deleteAllStorageEntries,
  deleteStorageEntry,
  resolveStorageEntry,
  type StorageContext,
} from "../../../lib/storage.js";
import { PageSnapshot } from "../../../types/crawler.js";
import {
  SnapshotData,
  SnapshotIndex,
  SnapshotMetadata,
  SnapshotSummary,
} from "../../../types/snapshot.js";
import { LoadedSnapshot } from "./LoadedSnapshot.js";

const gzip = promisify(zlib.gzip);

type SnapshotFileOperations = Pick<
  typeof fs,
  "cp" | "copyFile" | "readFile" | "writeFile" | "rename" | "rm"
>;

export class SnapshotRepository {
  private readonly snapshotsDir: string;
  private readonly fileOperations: SnapshotFileOperations;

  private constructor(
    snapshotsDir: string,
    fileOperations: SnapshotFileOperations = fs,
  ) {
    this.snapshotsDir = snapshotsDir;
    this.fileOperations = fileOperations;
  }

  /**
   * Creates a new SnapshotRepository instance using the project root directory
   * @returns Promise<SnapshotRepository>
   */
  static async create(storageDir?: string): Promise<SnapshotRepository> {
    const rootDir = storageDir === undefined ? await findRootDir() : storageDir;
    const snapshotsDir = path.join(
      path.resolve(storageDir ?? rootDir),
      "snapshots",
    );
    return new SnapshotRepository(snapshotsDir);
  }

  /** Creates a repository from an already-resolved shared storage context. */
  static createWithStorageContext(
    storageContext: StorageContext,
  ): SnapshotRepository {
    return new SnapshotRepository(storageContext.snapshotsDir);
  }

  /**
   * Creates a new SnapshotRepository instance with a custom snapshots directory
   * @param snapshotsDir Custom directory path for snapshots
   * @returns Promise<SnapshotRepository>
   */
  static async createWithCustomDir(
    snapshotsDir: string,
    fileOperations: Partial<SnapshotFileOperations> = {},
  ): Promise<SnapshotRepository> {
    return new SnapshotRepository(snapshotsDir, { ...fs, ...fileOperations });
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
    const snapshotDir = resolveStorageEntry(
      this.snapshotsDir,
      name,
      "snapshot",
    );
    await fs.mkdir(this.snapshotsDir, { recursive: true });

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

  /** Replaces only the requested routes in an existing snapshot. */
  async replaceSnapshotRoutes(
    targetName: string,
    sourceName: string,
    routes: readonly string[],
    signal?: AbortSignal,
  ): Promise<void> {
    signal?.throwIfAborted();
    if (targetName === sourceName) {
      throw new Error("The source and target snapshots must be different.");
    }
    if (routes.length === 0) {
      throw new Error("At least one route is required for a baseline update.");
    }

    const targetDir = resolveStorageEntry(
      this.snapshotsDir,
      targetName,
      "snapshot",
    );
    const sourceDir = resolveStorageEntry(
      this.snapshotsDir,
      sourceName,
      "snapshot",
    );
    const temporaryDir = `${targetDir}.route-update-${randomUUID()}`;
    const backupDir = `${targetDir}.route-backup-${randomUUID()}`;
    let backupCreated = false;
    let committed = false;

    try {
      const targetIndexPath = path.join(targetDir, "index.json");
      const sourceIndexPath = path.join(sourceDir, "index.json");
      const targetIndex = JSON.parse(
        await this.fileOperations.readFile(targetIndexPath, "utf8"),
      ) as SnapshotIndex;
      const sourceIndex = JSON.parse(
        await this.fileOperations.readFile(sourceIndexPath, "utf8"),
      ) as SnapshotIndex;
      const sourcePagesDir = path.join(sourceDir, "pages");
      const targetPagesDir = path.join(temporaryDir, "pages");
      const uniqueRoutes = [...new Set(routes)];

      for (const route of uniqueRoutes) {
        if (!route.startsWith("/") || route.startsWith("//")) {
          throw new Error(`Invalid root-relative route "${route}".`);
        }
        const sourcePage = sourceIndex.urls[route];
        if (!sourcePage) {
          throw new Error(
            `The source snapshot does not contain route "${route}".`,
          );
        }
        const filename = `${Buffer.from(route).toString("base64url")}.json.gz`;
        if (sourcePage.filename !== filename) {
          throw new Error(
            `The source snapshot has an invalid page entry for "${route}".`,
          );
        }
      }

      await this.fileOperations.cp(targetDir, temporaryDir, {
        recursive: true,
        errorOnExist: true,
      });
      for (const route of uniqueRoutes) {
        const sourcePage = sourceIndex.urls[route];
        if (!sourcePage) {
          throw new Error(
            `The source snapshot does not contain route "${route}".`,
          );
        }
        const filename = sourcePage.filename;
        await this.fileOperations.copyFile(
          path.join(sourcePagesDir, filename),
          path.join(targetPagesDir, filename),
        );
        targetIndex.urls[route] = { ...sourcePage };
      }

      const now = new Date().toISOString();
      targetIndex.metadata = {
        ...targetIndex.metadata,
        baseUrl: sourceIndex.metadata.baseUrl,
        timestamp: now,
        totalPages: Object.keys(targetIndex.urls).length,
      };
      const sourceMetadata = JSON.parse(
        await this.fileOperations.readFile(
          path.join(sourceDir, "metadata.json"),
          "utf8",
        ),
      ) as SnapshotMetadata;
      await this.fileOperations.writeFile(
        path.join(temporaryDir, "metadata.json"),
        JSON.stringify({ ...sourceMetadata, timestamp: now }, null, 2),
      );
      await this.fileOperations.writeFile(
        path.join(temporaryDir, "index.json"),
        JSON.stringify(targetIndex, null, 2),
      );

      signal?.throwIfAborted();
      await this.fileOperations.rename(targetDir, backupDir);
      backupCreated = true;
      try {
        signal?.throwIfAborted();
        await this.fileOperations.rename(temporaryDir, targetDir);
        committed = true;
      } catch (error) {
        await this.fileOperations.rename(backupDir, targetDir);
        backupCreated = false;
        throw error;
      }
      await this.fileOperations.rm(backupDir, { recursive: true, force: true });
      backupCreated = false;
    } finally {
      await this.fileOperations.rm(temporaryDir, {
        recursive: true,
        force: true,
      });
      if (backupCreated && !committed) {
        await this.fileOperations.rename(backupDir, targetDir);
      }
    }
  }

  /**
   * Load a snapshot from disk
   */
  async loadSnapshot(name: string) {
    const snapshotDir = resolveStorageEntry(
      this.snapshotsDir,
      name,
      "snapshot",
    );

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
    filter?: (url: string, statusCode: number) => boolean,
  ): Promise<string> {
    const snapshotDir = resolveStorageEntry(
      this.snapshotsDir,
      name,
      "snapshot",
    );

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

  /** Deletes one named snapshot without removing the storage root. */
  async deleteSnapshot(name: string): Promise<boolean> {
    return deleteStorageEntry(this.snapshotsDir, name, "snapshot");
  }

  /** Deletes all direct child snapshot directories and returns their names. */
  async deleteAllSnapshots(): Promise<string[]> {
    return deleteAllStorageEntries(this.snapshotsDir, "snapshot");
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
            "metadata.json",
          );
          const metadataContent = await fs.readFile(metadataPath, "utf-8");
          const metadata = JSON.parse(metadataContent);

          // Load index for page count
          const indexPath = path.join(
            this.snapshotsDir,
            snapshot.name,
            "index.json",
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
