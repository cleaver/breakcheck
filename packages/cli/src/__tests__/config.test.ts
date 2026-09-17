import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSnapshotInvocation } from "../cli/commands/snapshot.js";
import { parseConfigSelection } from "../cli/config.js";

describe("CLI configuration selection", () => {
  it("accepts config flags before or after command names", () => {
    expect(parseConfigSelection(["--config", "one.json", "snapshot"])).toEqual({
      configPath: "one.json",
    });
    expect(parseConfigSelection(["snapshot", "--config=two.json"])).toEqual({
      configPath: "two.json",
    });
    expect(parseConfigSelection(["snapshot", "--no-config"])).toEqual({
      noConfig: true,
    });
  });

  it("rejects contradictory or incomplete selections", () => {
    expect(() =>
      parseConfigSelection(["--config", "one.json", "--no-config"]),
    ).toThrow("cannot be used together");
    expect(() => parseConfigSelection(["--config"])).toThrow("requires");
  });

  it("merges configured crawl defaults and supports explicit clearing", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "breakcheck-cli-config-"),
    );
    try {
      await writeFile(
        path.join(root, "breakcheck.config.json"),
        JSON.stringify({
          version: 1,
          baseUrl: "https://example.com",
          crawl: {
            crawlerType: "playwright",
            maxDepth: 7,
            maxConcurrency: 4,
            includePatterns: ["/configured/**"],
            excludePatterns: ["/private/**"],
          },
        }),
      );

      const configured = await buildSnapshotInvocation({}, ["snapshot"], root);
      expect(configured.config.crawlSettings).toMatchObject({
        baseUrl: "https://example.com",
        crawlerType: "playwright",
        maxDepth: 7,
        maxConcurrency: 4,
        includePatterns: ["/configured/**"],
        excludePatterns: ["/private/**"],
      });

      const overridden = await buildSnapshotInvocation(
        {
          depth: "2",
          include: ["/cli/**"],
          exclude: false,
        },
        ["snapshot", "--no-exclude"],
        root,
      );
      expect(overridden.config.crawlSettings).toMatchObject({
        maxDepth: 2,
        includePatterns: ["/cli/**"],
        excludePatterns: [],
      });

      await expect(
        buildSnapshotInvocation(
          { urlFile: "urls.txt" },
          ["snapshot", "--url-file", "urls.txt"],
          root,
        ),
      ).rejects.toThrow("--include and --exclude cannot be used");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
