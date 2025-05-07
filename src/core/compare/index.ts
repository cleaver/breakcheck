import { SnapshotManager } from "@core/snapshot";
import { LineDifference, PageDiff, SnapshotDiff } from "@project-types/compare";
import { PageSnapshot } from "@project-types/crawler";
import { diffLines } from "diff";

/**
 * Manages the comparison of page snapshots
 */
export class CompareManager {
  private snapshotManager: SnapshotManager;

  constructor(snapshotsDir?: string) {
    this.snapshotManager = new SnapshotManager(snapshotsDir);
  }

  /**
   * Compares two page snapshots and returns the differences found
   */
  async comparePage(
    before: PageSnapshot,
    after: PageSnapshot
  ): Promise<PageDiff> {
    const url = before.url;

    const differences: LineDifference[] = diffLines(
      before.content,
      after.content
    );

    const hasDifferences = differences.some(
      (diff) => diff.added || diff.removed
    );

    return {
      url,
      differences,
      hasDifferences,
    };
  }

  /**
   * Compares two snapshots and returns the differences found
   * @param beforeName Name of the before snapshot
   * @param afterName Name of the after snapshot
   * @param urls Optional list of URLs to compare. If not provided, compares all URLs.
   */
  async compareSnapshots(
    beforeName: string,
    afterName: string,
    urls?: string[]
  ): Promise<SnapshotDiff> {
    // Load both snapshots
    const beforeSnapshot = await this.snapshotManager.loadSnapshot(beforeName);
    const afterSnapshot = await this.snapshotManager.loadSnapshot(afterName);

    // Get all URLs from both snapshots
    const beforeUrls = Object.keys(beforeSnapshot.index.urls).sort();
    const afterUrls = Object.keys(afterSnapshot.index.urls);

    // Filter URLs if specified
    const urlsToCompare = urls
      ? beforeUrls.filter((url) => urls.includes(url))
      : beforeUrls;

    // Find new and removed URLs
    const newUrls = afterUrls.filter((url) => !beforeUrls.includes(url));
    const removedUrls = beforeUrls.filter((url) => !afterUrls.includes(url));

    // Compare pages
    const pageDiffs: PageDiff[] = [];
    for (const url of urlsToCompare) {
      // Skip URLs that don't exist in both snapshots
      if (!afterUrls.includes(url)) continue;

      const beforePage = await beforeSnapshot.getPage(url);
      const afterPage = await afterSnapshot.getPage(url);

      if (beforePage && afterPage) {
        const diff = await this.comparePage(beforePage, afterPage);
        pageDiffs.push(diff);
      }
    }

    return {
      pageDiffs,
      newUrls,
      removedUrls,
    };
  }
}
