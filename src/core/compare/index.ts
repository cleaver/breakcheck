import { PageSnapshot } from "@project-types/crawler";
import { PageDiff, LineDifference } from "@project-types/compare";
import { diffLines, Change } from "diff";

/**
 * Manages the comparison of page snapshots
 */
export class CompareManager {
  /**
   * Compares two page snapshots and returns the differences found
   */
  async compareSnapshots(
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
}
