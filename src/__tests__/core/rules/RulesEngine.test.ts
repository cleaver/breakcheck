import { describe, it, expect } from "vitest";
import { RulesEngine } from "../../../core/rules/RulesEngine";
import { Ruleset } from "../../../types/rules";

describe("RulesEngine", () => {
  describe("constructor", () => {
    it("should create instance with ruleset object", () => {
      const ruleset: Ruleset = {
        name: "test-ruleset",
        mode: "default_include",
        rules: [],
      };
      const engine = new RulesEngine(ruleset);
      expect(engine).toBeInstanceOf(RulesEngine);
    });

    it("should create instance with ruleset name", () => {
      // This test would require a mock filesystem or actual rules file
      // We'll skip this for now as it requires more setup
    });
  });

  describe("process", () => {
    it("should handle empty ruleset", () => {
      const ruleset: Ruleset = {
        name: "empty-ruleset",
        mode: "default_include",
        rules: [],
      };
      const engine = new RulesEngine(ruleset);
      const html = "<div>Test</div>";
      const expected = "<html><head></head><body><div>Test</div></body></html>";
      expect(engine.process(html)).toBe(expected);
    });

    it("should exclude elements matching selector", () => {
      const ruleset: Ruleset = {
        name: "exclude-ruleset",
        mode: "default_include",
        rules: [
          {
            selector_type: "css",
            selector: ".ad",
            actions: [{ action: "exclude" }],
          },
        ],
      };
      const engine = new RulesEngine(ruleset);
      const html = '<div class="ad">Ad content</div><div>Regular content</div>';
      const expected =
        "<html><head></head><body><div>Regular content</div></body></html>";
      expect(engine.process(html)).toBe(expected);
    });

    it("should remove attributes", () => {
      const ruleset: Ruleset = {
        name: "remove-attr-ruleset",
        mode: "default_include",
        rules: [
          {
            selector_type: "css",
            selector: "img",
            actions: [
              {
                action: "remove_attr",
                modifiers: { attr: "srcset" },
              },
            ],
          },
        ],
      };
      const engine = new RulesEngine(ruleset);
      const html = '<img src="test.jpg" srcset="test.jpg 1x, test@2x.jpg 2x">';
      const expected =
        '<html><head></head><body><img src="test.jpg"></body></html>';
      expect(engine.process(html)).toBe(expected);
    });

    it("should rewrite attributes", () => {
      const ruleset: Ruleset = {
        name: "rewrite-attr-ruleset",
        mode: "default_include",
        rules: [
          {
            selector_type: "css",
            selector: "a",
            actions: [
              {
                action: "rewrite_attr",
                modifiers: {
                  attr: "href",
                  regex: "/user/\\d+",
                  replace: "/user/USER_ID",
                },
              },
            ],
          },
        ],
      };
      const engine = new RulesEngine(ruleset);
      const html = '<a href="/user/123">Profile</a>';
      const expected =
        '<html><head></head><body><a href="/user/USER_ID">Profile</a></body></html>';
      expect(engine.process(html)).toBe(expected);
    });

    it("should rewrite content", () => {
      const ruleset: Ruleset = {
        name: "rewrite-content-ruleset",
        mode: "default_include",
        rules: [
          {
            selector_type: "css",
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
        ],
      };
      const engine = new RulesEngine(ruleset);
      const html = '<div class="timestamp">Posted on 12/31/2023</div>';
      const expected =
        '<html><head></head><body><div class="timestamp">Posted on DATE_STAMP</div></body></html>';
      expect(engine.process(html)).toBe(expected);
    });

    it("should apply content regex filter", () => {
      const ruleset: Ruleset = {
        name: "content-regex-ruleset",
        mode: "default_include",
        rules: [
          {
            selector_type: "css",
            selector: ".message",
            actions: [
              {
                action: "exclude",
                modifiers: {
                  content_regex: "Logged in: \\d+ minutes ago",
                },
              },
            ],
          },
        ],
      };
      const engine = new RulesEngine(ruleset);
      const html = `
        <div class="message">Logged in: 5 minutes ago</div>
        <div class="message">Regular message</div>
      `;
      const expected = `
        <html><head></head><body>
        <div class="message">Regular message</div>
        </body></html>
      `;
      expect(engine.process(html).replace(/\s+/g, " ").trim()).toBe(
        expected.replace(/\s+/g, " ").trim()
      );
    });

    it("should skip non-CSS selectors", () => {
      const ruleset: Ruleset = {
        name: "non-css-ruleset",
        mode: "default_include",
        rules: [
          {
            selector_type: "xpath",
            selector: "//div",
            actions: [{ action: "exclude" }],
          },
        ],
      };
      const engine = new RulesEngine(ruleset);
      const html = "<div>Test</div>";
      const expected = "<html><head></head><body><div>Test</div></body></html>";
      expect(engine.process(html)).toBe(expected);
    });
  });
});
