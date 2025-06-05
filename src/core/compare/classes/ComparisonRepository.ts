import { RulesEngine } from "@/core/rules/RulesEngine";
import {
  ComparisonIndex,
  ComparisonMetadata,
  PageDiff,
} from "@project-types/compare";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import * as zlib from "zlib";

const gzip = promisify(zlib.gzip);

export class ComparisonRepository {
  private readonly comparisonsDir: string;
  private comparisonDir!: string;
  private diffsDir!: string;
  private index: ComparisonIndex = { urls: {}, metadata: {} as any };

  constructor(
    comparisonsDir: string = path.join(process.cwd(), "comparisons"),
    rulesEngine: RulesEngine
  ) {
    this.comparisonsDir = comparisonsDir;
  }

  /**
   * Initializes a new comparison, creating directories and saving initial metadata.
   */
  async startComparison(
    name: string,
    metadata: ComparisonMetadata
  ): Promise<void> {
    await fs.mkdir(this.comparisonsDir, { recursive: true });
    this.comparisonDir = path.join(this.comparisonsDir, name);
    this.diffsDir = path.join(this.comparisonDir, "diffs");

    // Clean up previous results
    await fs.rm(this.comparisonDir, { recursive: true, force: true });

    // Create fresh directories
    await fs.mkdir(this.comparisonDir, { recursive: true });
    await fs.mkdir(this.diffsDir, { recursive: true });

    // Save metadata and initialize index
    const metadataPath = path.join(this.comparisonDir, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    this.index.metadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      totalPages: 0,
      pagesWithDifferences: 0,
    };
  }

  /**
   * Saves a single page diff to a compressed file and updates the index.
   */
  async savePageDiff(pageDiff: PageDiff): Promise<void> {
    const diffData = JSON.stringify(pageDiff);
    const compressed = await gzip(diffData);
    const filename =
      Buffer.from(pageDiff.url).toString("base64url") + ".json.gz";
    await fs.writeFile(path.join(this.diffsDir, filename), compressed);

    // Add to index
    this.index.urls[pageDiff.url] = {
      filename,
      hasDifferences: pageDiff.hasDifferences,
    };
    this.index.metadata.totalPages++;
    if (pageDiff.hasDifferences) {
      this.index.metadata.pagesWithDifferences++;
    }
  }

  /**
   * Writes the final index file to disk.
   */
  async finalizeComparison(): Promise<string> {
    const indexPath = path.join(this.comparisonDir, "index.json");
    await fs.writeFile(indexPath, JSON.stringify(this.index, null, 2));
    return this.comparisonDir;
  }

  getIndex(): ComparisonIndex {
    return this.index;
  }
}
