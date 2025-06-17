import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processRulesDsl } from "../../core/rules/RulesDsl";

// Mock fs and path modules
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("path", () => ({
  join: vi.fn(),
}));

describe("RulesDsl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (join as any).mockImplementation((...args: string[]) => args.join("/"));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("processRulesDsl", () => {
    it("should throw error if rules file not found", () => {
      (readFileSync as any).mockImplementation(() => {
        throw new Error("File not found");
      });

      expect(() => processRulesDsl("non-existent")).toThrow(
        "Rules file not found: rules/non-existent/rules.breakcheck"
      );
    });

    it("should parse single action rules", () => {
      const rulesContent = `
                css:.ad-container do: exclude
                css:#session-id do: exclude
                css:.important-note do: include content_regex:"Warning:"
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      const result = processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
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

    it("should parse action blocks", () => {
      const rulesContent = `
                css:img do
                    remove_attr attr:"srcset"
                    remove_attr attr:"sizes"
                    rewrite_attr attr:"src" regex:"//cdn\\d+\\.example\\.com/" replace:"//cdn.example.com/"
                end
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      const result = processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
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

    it("should parse rewrite content rules", () => {
      const rulesContent = `
                css:.timestamp do: rewrite_content regex:"\\d{2}/\\d{2}/\\d{4}" replace:"DATE_STAMP"
                css:.view-count do: rewrite_content regex:"\\d{1,3}(,\\d{3})* views" replace:"VIEW_COUNT views"
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      const result = processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
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

    it("should handle comments and whitespace", () => {
      const rulesContent = `
-- This is a comment
css:.ad-container do: exclude

-- Another comment
css:.important-note do: include content_regex:"Warning:"
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      const result = processRulesDsl("test-rules");

      expect(result).toEqual({
        name: "test-rules",
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

    it("should throw error for invalid syntax", () => {
      const rulesContent = `
                css:.ad-container do exclude  # Missing colon after do
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      expect(() => processRulesDsl("test-rules")).toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for invalid action", () => {
      const rulesContent = `
                css:.ad-container do: invalid_action
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      expect(() => processRulesDsl("test-rules")).toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for unclosed action block", () => {
      const rulesContent = `
                css:img do
                    remove_attr attr:"srcset"
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      expect(() => processRulesDsl("test-rules")).toThrow(
        "Syntax errors in rules file"
      );
    });

    it("should throw error for missing required modifiers", () => {
      const rulesContent = `
                css:img do: remove_attr
            `;
      (readFileSync as any).mockReturnValue(rulesContent);

      expect(() => processRulesDsl("test-rules")).toThrow(
        "Syntax errors in rules file"
      );
    });
  });
});
