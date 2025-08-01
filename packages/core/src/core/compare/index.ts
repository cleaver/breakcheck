import { createPatch, diffLines } from "diff";
import jsbeautify from "js-beautify";
import path from "path";
import { ComparisonConfig, ComparisonSummary } from "../../types/api";
import { LineDiff, PageDiff } from "../../types/compare";
import { PageSnapshot } from "../../types/crawler";
import { RulesEngine } from "../rules/RulesEngine";
import { SnapshotRepository } from "../snapshot";
import { ComparisonRepository } from "./classes/ComparisonRepository";

/**
 * Compares two page snapshots and returns the differences found.
 */
export async function comparePage(
  before: PageSnapshot,
  after: PageSnapshot
): Promise<PageDiff> {
  const url = before.url;

  const beautify = jsbeautify.html;

  const beautifyOptions = {
    indent_size: 2,
    preserve_newlines: true,
    unformatted: ["a", "span", "b", "strong", "i", "em"],
  };
  const beforeContent = beautify(before.content, beautifyOptions);
  const afterContent = beautify(after.content, beautifyOptions);

  const patch = createPatch(url, beforeContent, afterContent);
  const differences: LineDiff[] = diffLines(beforeContent, afterContent);
  const hasDifferences = differences.some((diff) => diff.added || diff.removed);
  return { url, differences, hasDifferences, patch };
}

/**
 * Compares two snapshots iteratively, saving each diff to disk.
 */
export async function compareSnapshots(
  config: ComparisonConfig,
  snapshotRepository: SnapshotRepository,
  comparisonRepository: ComparisonRepository,
  rulesEngine: RulesEngine
): Promise<ComparisonSummary> {
  const startTime = Date.now();

  // Load both snapshots
  const beforeSnapshot = await snapshotRepository.loadSnapshot(
    config.beforeSnapshotId
  );
  const afterSnapshot = await snapshotRepository.loadSnapshot(
    config.afterSnapshotId
  );

  // Determine URLs to compare
  const beforeUrls = Object.keys(beforeSnapshot.index.urls);
  const afterUrls = new Set(Object.keys(afterSnapshot.index.urls));
  const urlsToCompare = config.urls || beforeUrls;
  const rulesUsedIdentifier =
    typeof config.ruleset === "string" ? config.ruleset : config.ruleset.name;

  // Find new and removed URLs
  const newUrls = [...afterUrls].filter((url) => !beforeUrls.includes(url));
  const removedUrls = beforeUrls.filter((url) => !afterUrls.has(url));

  let pagesWithErrors = 0;

  // Compare pages one by one
  for (const url of urlsToCompare) {
    if (!afterUrls.has(url)) continue; // Skip URLs not in the "after" snapshot

    const beforePage = await beforeSnapshot.getPage(url);
    const afterPage = await afterSnapshot.getPage(url);
    if (!beforePage || !afterPage) {
      pagesWithErrors++;
      continue;
    }
    const beforeContentWithRules = rulesEngine.process(beforePage.content);
    const afterContentWithRules = rulesEngine.process(afterPage.content);

    if (beforeContentWithRules && afterContentWithRules) {
      const diff = await comparePage(
        { ...beforePage, content: beforeContentWithRules },
        { ...afterPage, content: afterContentWithRules }
      );
      await comparisonRepository.savePageDiff(diff);
    } else {
      pagesWithErrors++;
    }
  }

  const finalIndex = comparisonRepository.getIndex();
  const resultsPath = await comparisonRepository.finalizeComparison();

  // Return the summary data
  return {
    status: "completed",
    overallResult:
      finalIndex.metadata.pagesWithDifferences > 0 ? "fail" : "pass",
    beforeSnapshotId: config.beforeSnapshotId,
    afterSnapshotId: config.afterSnapshotId,
    rulesUsedIdentifier,
    timestamp: finalIndex.metadata.timestamp,
    totalPagesCompared: finalIndex.metadata.totalPages,
    pagesWithDifferences: finalIndex.metadata.pagesWithDifferences,
    pagesWithErrors,
    newUrls,
    removedUrls,
    comparisonProcessErrors: [],
    comparisonId: config.comparisonName,
    durationMs: Date.now() - startTime,
    summaryFilePath: path.join(resultsPath, "index.json"),
    resultsPath,
  };
}
