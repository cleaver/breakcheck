import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processRulesDsl } from "../../core/rules/RulesDsl.js";

// Mock fs and path modules
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("node:path", () => ({
  resolve: vi.fn(),
}));

const cwdSpy = vi.spyOn(process, "cwd");

describe("RulesDsl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cwdSpy.mockReturnValue("/mock/cwd");
    (resolve as any).mockImplementation((...args: string[]) => args.join("/"));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("processRulesDsl", () => {
    it("should throw error if rules file not found", async () => {
      (readFile as any).mockImplementation(() => {
        const error = new Error("File not found") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      });

      await expect(processRulesDsl("non-existent")).rejects.toThrow(
        "Rules file not found: /mock/cwd/non-existent/rules.breakcheck"
      );
    });

    it("resolves relative rules directories from the current working directory", async () => {
      cwdSpy.mockReturnValue("/consumer/packages/site");
      (readFile as any).mockReturnValue("css:.dynamic do: exclude");

      await processRulesDsl("./rules");

      expect(resolve).toHaveBeenCalledWith(
        "/consumer/packages/site",
        "./rules",
        "rules.breakcheck"
      );
    });

    it("reports non-ENOENT read failures accurately and preserves their cause", async () => {
      const cause = new Error("Permission denied") as NodeJS.ErrnoException;
      cause.code = "EACCES";
      (readFile as any).mockRejectedValue(cause);

      await expect(processRulesDsl("private-rules")).rejects.toMatchObject({
        message: "Failed to read rules file: /mock/cwd/private-rules/rules.breakcheck",
        cause,
      });
    });

    it("should parse single action rules", async () => {
      const rulesContent = `
                css:.ad-container do: exclude
                css:#session-id do: exclude
                css:.important-note do: include content_regex:"Warning:"
            `;
      (readFile as any).mockReturnValue(rulesContent);

      const result = await processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
        regions: [],
        rules: [
          {
            selector: ".ad-container",
            actions: [{ action: "exclude", modifiers: {} }],
          },
          {
            selector: "#session-id",
            actions: [{ action: "exclude", modifiers: {} }],
          },
          {
            selector: ".important-note",
            actions: [
              {
                action: "include",
                modifiers: { content_regex: "Warning:" },
              },
            ],
          },
        ],
      });
    });

    it("parses complex CSS selectors up to the action delimiter", async () => {
      (readFile as any).mockReturnValue(`
        css:main > article.card + article[data-label="do: later"]:not(.hidden), #news\\:today do:exclude
        css:end do: include
        css:do-something do: exclude
      `);

      const result = await processRulesDsl("test-rules");

      expect(result.rules.map((rule) => rule.selector)).toEqual([
        'main > article.card + article[data-label="do: later"]:not(.hidden), #news\\:today',
        "end",
        "do-something",
      ]);
    });

    it("should parse action blocks", async () => {
      const rulesContent = `
                css:img do
                    remove_attr attr:"srcset"
                    remove_attr attr:"sizes"
                    rewrite_attr attr:"src" regex:"//cdn\\d+\\.example\\.com/" replace:"//cdn.example.com/"
                end
            `;
      (readFile as any).mockReturnValue(rulesContent);

      const result = await processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
        regions: [],
        rules: [
          {
            selector: "img",
            actions: [
              { action: "remove_attr", modifiers: { attr: "srcset" } },
              { action: "remove_attr", modifiers: { attr: "sizes" } },
              {
                action: "rewrite_attr",
                modifiers: {
                  attr: "src",
                  regex: "//cdn\\d+\\.example\\.com/",
                  replace: "//cdn.example.com/",
                },
              },
            ],
          },
        ],
      });
    });

    it("should parse rewrite content rules", async () => {
      const rulesContent = `
                css:.timestamp do: rewrite_content regex:"\\d{2}/\\d{2}/\\d{4}" replace:"DATE_STAMP"
                css:.view-count do: rewrite_content regex:"\\d{1,3}(,\\d{3})* views" replace:"VIEW_COUNT views"
            `;
      (readFile as any).mockReturnValue(rulesContent);

      const result = await processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
        regions: [],
        rules: [
          {
            selector: ".timestamp",
            actions: [
              {
                action: "rewrite_content",
                modifiers: {
                  regex: "\\d{2}/\\d{2}/\\d{4}",
                  replace: "DATE_STAMP",
                },
              },
            ],
          },
          {
            selector: ".view-count",
            actions: [
              {
                action: "rewrite_content",
                modifiers: {
                  regex: "\\d{1,3}(,\\d{3})* views",
                  replace: "VIEW_COUNT views",
                },
              },
            ],
          },
        ],
      });
    });

    it("should handle comments and whitespace", async () => {
      const rulesContent = `
-- This is a comment
css:.ad-container do: exclude

-- Another comment
css:.important-note do: include content_regex:"Warning:"
            `;
      (readFile as any).mockReturnValue(rulesContent);

      const result = await processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
        regions: [],
        rules: [
          {
            selector: ".ad-container",
            actions: [{ action: "exclude", modifiers: {} }],
          },
          {
            selector: ".important-note",
            actions: [
              {
                action: "include",
                modifiers: { content_regex: "Warning:" },
              },
            ],
          },
        ],
      });
    });

    it("should throw error for invalid syntax", async () => {
      const rulesContent = `
                css:.ad-container do exclude  # Missing colon after do
            `;
      (readFile as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(/errors in rules file/);
    });

    it("should throw error for invalid action", async () => {
      const rulesContent = `
                css:.ad-container do: invalid_action
            `;
      (readFile as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(/errors in rules file/);
    });

    it("should throw error for unclosed action block", async () => {
      const rulesContent = `
                css:img do
                    remove_attr attr:"srcset"
            `;
      (readFile as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for missing required modifiers", async () => {
      const rulesContent = `
                css:img do: remove_attr
            `;
      (readFile as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should parse named regions separately from ordinary rules", async () => {
      const rulesContent = `
        css:#section-b do: region name:"Section_B"
        css:#section-a do: region name:"Section_A"
        css:.dynamic do: exclude
      `;
      (readFile as any).mockReturnValue(rulesContent);

      const result = await processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
        regions: [
          { selector: "#section-b", name: "Section_B" },
          { selector: "#section-a", name: "Section_A" },
        ],
        rules: [
          {
            selector: ".dynamic",
            actions: [{ action: "exclude", modifiers: {} }],
          },
        ],
      });
    });

    it("leaves region-name domain validation to the engine", async () => {
      (readFile as any).mockReturnValue(
        'css:#section do: region name:"Section-A"'
      );

      await expect(processRulesDsl("test-rules")).resolves.toMatchObject({
        regions: [{ selector: "#section", name: "Section-A" }],
      });
    });

    it("leaves duplicate-region domain validation to the engine", async () => {
      (readFile as any).mockReturnValue(`
        css:#section-a do: region name:"Section_A"
        css:#section-b do: region name:"Section_A"
      `);

      await expect(processRulesDsl("test-rules")).resolves.toMatchObject({
        regions: [
          { selector: "#section-a", name: "Section_A" },
          { selector: "#section-b", name: "Section_A" },
        ],
      });
    });

    it("should reject region declarations inside action blocks", async () => {
      (readFile as any).mockReturnValue(`
        css:#section do
          region name:"Section"
        end
      `);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("requires at least one action in a block", async () => {
      (readFile as any).mockReturnValue("css:main do\nend");
      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("requires modifier values to be quoted", async () => {
      (readFile as any).mockReturnValue("css:a do: remove_attr attr:href");
      await expect(processRulesDsl("test-rules")).rejects.toThrow(/errors in rules file/);
    });

    it("decodes escaped quotes and backslashes but preserves regex escapes", async () => {
      (readFile as any).mockReturnValue(
        'css:a do: rewrite_attr attr:"data-\\"id" regex:"\\d+\\?" replace:"C:\\\\temp"'
      );
      const result = await processRulesDsl("test-rules");
      expect(result.rules[0].actions[0]).toEqual({
        action: "rewrite_attr",
        modifiers: { attr: 'data-"id', regex: "\\d+\\?", replace: "C:\\temp" },
      });
    });

    it("accepts a block header comment and reports malformed selectors with positions", async () => {
      (readFile as any).mockReturnValue("css:main do -- actions\n  exclude\nend");
      await expect(processRulesDsl("test-rules")).resolves.toMatchObject({
        rules: [{ selector: "main" }],
      });

      (readFile as any).mockReturnValue("\ncss:main > do: exclude");
      await expect(processRulesDsl("test-rules")).resolves.toMatchObject({
        rules: [{ selector: "main >" }],
      });
    });

    it("reports line and column for lexical failures", async () => {
      (readFile as any).mockReturnValue("\ncss:.item do: exclude\n@");
      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        /line 3, column 1/
      );
    });
  });
});
