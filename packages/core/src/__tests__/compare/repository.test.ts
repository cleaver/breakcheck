import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ComparisonRepository } from "../../core/compare/classes/ComparisonRepository.js";
import type { ComparisonMetadata } from "../../types/compare.js";

describe("ComparisonRepository deletion", () => {
  let comparisonsDirectory: string;

  const metadata: ComparisonMetadata = {
    beforeSnapshotId: "before",
    afterSnapshotId: "after",
  };

  beforeEach(async () => {
    comparisonsDirectory = await mkdtemp(
      join("/tmp", "breakcheck-comparison-"),
    );
  });

  afterEach(async () => {
    await rm(comparisonsDirectory, { recursive: true, force: true });
  });

  it("deletes a named comparison and reports whether it existed", async () => {
    const repository = await ComparisonRepository.create(
      "to-delete",
      metadata,
      comparisonsDirectory,
    );

    await expect(repository.deleteComparison("to-delete")).resolves.toBe(true);
    await expect(repository.deleteComparison("to-delete")).resolves.toBe(false);
  });

  it("rejects path-like comparison names", async () => {
    const repository = await ComparisonRepository.create(
      "safe",
      metadata,
      comparisonsDirectory,
    );

    await expect(repository.deleteComparison("../outside")).rejects.toThrow(
      "Invalid comparison name",
    );
  });

  it("deletes all comparison directories but preserves the storage root", async () => {
    const first = await ComparisonRepository.create(
      "first",
      metadata,
      comparisonsDirectory,
    );
    await ComparisonRepository.create("second", metadata, comparisonsDirectory);

    await expect(first.deleteAllComparisons()).resolves.toEqual([
      "first",
      "second",
    ]);
    await expect(readdir(comparisonsDirectory)).resolves.toEqual([]);
  });
});
