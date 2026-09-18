import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatCompiledRules, runCompile } from "../cli/commands/compile.js";

describe("runCompile", () => {
  it("resolves a rules directory from the supplied working directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "breakcheck-cli-compile-"));
    try {
      await mkdir(join(root, "rules"));
      await writeFile(
        join(root, "rules", "rules.breakcheck"),
        "css:.dynamic do: exclude\n",
      );

      await expect(runCompile("./rules", root)).resolves.toEqual({
        rules: [
          {
            selector: ".dynamic",
            actions: [{ action: "exclude", modifiers: {} }],
          },
        ],
        regions: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("formats compiled rules as machine-readable JSON with a trailing newline", () => {
    expect(
      formatCompiledRules({
        rules: [],
        regions: [],
      }),
    ).toBe(["{", '  "rules": [],', '  "regions": []', "}", ""].join("\n"));
  });
});
