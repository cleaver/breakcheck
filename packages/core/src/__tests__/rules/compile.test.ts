import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileRulesDsl } from "../../index.js";

describe("compileRulesDsl", () => {
  it("compiles a rules directory into the documented JSON shape", async () => {
    const directory = await mkdtemp(join(tmpdir(), "breakcheck-compile-"));
    try {
      await writeFile(
        join(directory, "rules.breakcheck"),
        [
          "-- Ignore dynamic advertising content",
          "css:.ad do: exclude",
          'css:main do: region name:"Content"',
          "",
        ].join("\n"),
      );

      await expect(compileRulesDsl(directory)).resolves.toEqual({
        rules: [
          {
            selector: ".ad",
            actions: [{ action: "exclude", modifiers: {} }],
          },
        ],
        regions: [{ selector: "main", name: "Content" }],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("compiles an empty or comments-only rules file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "breakcheck-compile-"));
    try {
      await writeFile(
        join(directory, "rules.breakcheck"),
        "-- Add rules to this file when needed\n",
      );

      await expect(compileRulesDsl(directory)).resolves.toEqual({
        rules: [],
        regions: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects rules that fail engine validation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "breakcheck-compile-"));
    try {
      await writeFile(
        join(directory, "rules.breakcheck"),
        'css:.message do: rewrite_content regex:"[" replace:"x"\n',
      );

      await expect(compileRulesDsl(directory)).rejects.toThrow(/invalid regex/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("preserves ordered actions and modifiers in the JSON document", async () => {
    const directory = await mkdtemp(join(tmpdir(), "breakcheck-compile-"));
    try {
      await writeFile(
        join(directory, "rules.breakcheck"),
        [
          "css:img do",
          '  remove_attr attr:"srcset"',
          '  rewrite_attr attr:"src" regex:"cdn" replace:"static"',
          "end",
          'css:.timestamp do: rewrite_content regex:"[0-9]+" replace:"DATE"',
          'css:.note do: include content_regex:"Warning:"',
          "",
        ].join("\n"),
      );

      await expect(compileRulesDsl(directory)).resolves.toEqual({
        rules: [
          {
            selector: "img",
            actions: [
              { action: "remove_attr", modifiers: { attr: "srcset" } },
              {
                action: "rewrite_attr",
                modifiers: { attr: "src", regex: "cdn", replace: "static" },
              },
            ],
          },
          {
            selector: ".timestamp",
            actions: [
              {
                action: "rewrite_content",
                modifiers: { regex: "[0-9]+", replace: "DATE" },
              },
            ],
          },
          {
            selector: ".note",
            actions: [
              {
                action: "include",
                modifiers: { content_regex: "Warning:" },
              },
            ],
          },
        ],
        regions: [],
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
