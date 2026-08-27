import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processRulesDsl } from "../../core/rules/RulesDsl.js";

// Mock fs and path modules
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("path", () => ({
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
      (readFileSync as any).mockImplementation(() => {
        throw new Error("File not found");
      });

      await expect(processRulesDsl("non-existent")).rejects.toThrow(
        "Rules file not found: /mock/cwd/non-existent/rules.breakcheck"
      );
    });

    it("resolves relative rules directories from the current working directory", async () => {
      cwdSpy.mockReturnValue("/consumer/packages/site");
      (readFileSync as any).mockReturnValue("css:.dynamic do: exclude");

      await processRulesDsl("./rules");

      expect(resolve).toHaveBeenCalledWith(
        "/consumer/packages/site",
        "./rules",
        "rules.breakcheck"
      );
    });

    it("should parse single action rules", async () => {
      const rulesContent = `
                css:.ad-container do: exclude
                css:#session-id do: exclude
                css:.important-note do: include content_regex:"Warning:"
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

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

    it("should parse action blocks", async () => {
      const rulesContent = `
                css:img do
                    remove_attr attr:"srcset"
                    remove_attr attr:"sizes"
                    rewrite_attr attr:"src" regex:"//cdn\\d+\\.example\\.com/" replace:"//cdn.example.com/"
                end
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

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
      (readFileSync as any).mockReturnValue(rulesContent);

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
      (readFileSync as any).mockReturnValue(rulesContent);

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
      (readFileSync as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for invalid action", async () => {
      const rulesContent = `
                css:.ad-container do: invalid_action
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for unclosed action block", async () => {
      const rulesContent = `
                css:img do
                    remove_attr attr:"srcset"
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for missing required modifiers", async () => {
      const rulesContent = `
                css:img do: remove_attr
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

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
      (readFileSync as any).mockReturnValue(rulesContent);

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

    it("should reject invalid region names", async () => {
      (readFileSync as any).mockReturnValue(
        'css:#section do: region name:"Section-A"'
      );

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Invalid region name \"Section-A\""
      );
    });

    it("should reject duplicate region names", async () => {
      (readFileSync as any).mockReturnValue(`
        css:#section-a do: region name:"Section_A"
        css:#section-b do: region name:"Section_A"
      `);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Duplicate region name: Section_A"
      );
    });

    it("should reject region declarations inside action blocks", async () => {
      (readFileSync as any).mockReturnValue(`
        css:#section do
          region name:"Section"
        end
      `);

      await expect(processRulesDsl("test-rules")).rejects.toThrow(
        "Syntax errors in rules file"
      );
    });
  });
});
