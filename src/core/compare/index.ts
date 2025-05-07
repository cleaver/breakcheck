import { PageSnapshot } from "@project-types/crawler";
import { PageDiff } from "@project-types/compare";
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
    const differences: PageDiff["differences"] = [];
    const url = before.url;

    // Compare content
    const contentDiff = diffLines(before.content, after.content);

    // Process differences
    contentDiff.forEach((part: Change) => {
      if (part.added || part.removed) {
        differences.push({
          type: "content",
          selector: "body", // Default to body since we're comparing full HTML
          before: part.removed ? part.value : undefined,
          after: part.added ? part.value : undefined,
          message: part.added ? "Content added" : "Content removed",
        });
      }
    });

    return {
      url,
      differences,
      hasDifferences: differences.length > 0,
      existsInBoth: true,
      onlyInBefore: false,
      onlyInAfter: false,
    };
  }
}
