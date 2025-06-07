import { logger } from "@lib/logger";
import { PageSnapshot } from "@project-types/crawler";
import { SnapshotIndex, SnapshotMetadata } from "@project-types/snapshot";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";

const gunzip = promisify(zlib.gunzip);

export class LoadedSnapshot {
  public readonly metadata: SnapshotMetadata;
  public readonly index: SnapshotIndex;
  private readonly pagesDir: string;

  constructor(
    metadata: SnapshotMetadata,
    index: SnapshotIndex,
    pagesDir: string
  ) {
    this.metadata = metadata;
    this.index = index;
    this.pagesDir = pagesDir;
  }

  /**
   * Loads a single page snapshot on demand by URL
   */
  async getPage(url: string): Promise<PageSnapshot | null> {
    const info = this.index.urls[url];
    if (!info) return null;
    const filePath = path.join(this.pagesDir, info.filename);
    try {
      const compressed = await fs.readFile(filePath);
      const decompressed = await gunzip(compressed);
      const page = JSON.parse(decompressed.toString());
      return page;
    } catch (err) {
      // Could be file not found, decompression, or parse error
      logger.error({ err, url, filePath }, "Failed to load page snapshot");
      return null;
    }
  }
}
