import { ComparisonConfig, ComparisonSummary } from "@/types/api";
import { SnapshotRepository } from "@core/snapshot";
import { LineDiff, PageDiff } from "@project-types/compare";
import { PageSnapshot } from "@project-types/crawler";
import { diffLines } from "diff";

/**
 * Compares two page snapshots and returns the differences found
 */
export async function comparePage(
  before: PageSnapshot,
  after: PageSnapshot
): Promise<PageDiff> {
  const url = before.url;

  const differences: LineDiff[] = diffLines(before.content, after.content);

  const hasDifferences = differences.some((diff) => diff.added || diff.removed);

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
export async function compareSnapshots(
  config: ComparisonConfig,
  snapshotRepository: SnapshotRepository
): Promise<ComparisonSummary> {
  // Load both snapshots
  const beforeSnapshot = await snapshotRepository.loadSnapshot(
    config.beforeSnapshotId
  );
  const afterSnapshot = await snapshotRepository.loadSnapshot(
    config.afterSnapshotId
  );

  // Get all URLs from both snapshots
  const beforeUrls = Object.keys(beforeSnapshot.index.urls).sort();
  const afterUrls = Object.keys(afterSnapshot.index.urls);

  // Filter URLs if specified
  const urlsToCompare =
    Array.isArray(config.urls) && config.urls.length > 0
      ? beforeUrls.filter((url) => (config.urls as string[]).includes(url))
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
      const diff = await comparePage(beforePage, afterPage);
      pageDiffs.push(diff);
    }
  }

  return {
    pageDiffs,
    newUrls,
    removedUrls,
  };
}
