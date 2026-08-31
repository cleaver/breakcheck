import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { RulesEngine } from "../../core/rules/RulesEngine.js";
import { Ruleset } from "../../types/rules.js";

describe("RulesEngine", () => {
  describe("create", () => {
    it("should create instance with ruleset object", async () => {
      const ruleset: Ruleset = {
        name: "test-ruleset",
        rules: [],
      };
      const engine = await RulesEngine.create(ruleset);
      expect(engine).toBeInstanceOf(RulesEngine);
    });

    it("should load rules.breakcheck from a supplied directory", async () => {
      const rulesDirectory = await mkdtemp(join(tmpdir(), "breakcheck-rules-"));
      await writeFile(
        join(rulesDirectory, "rules.breakcheck"),
        "css:.dynamic do: exclude"
      );

      try {
        const engine = await RulesEngine.create(rulesDirectory);

        expect(engine.process("<div class=\"dynamic\">ignored</div>")).toBe(
          "<html><head></head><body></body></html>"
        );
      } finally {
        await rm(rulesDirectory, { recursive: true, force: true });
      }
    });

    it("should create an empty rules engine when no rules are supplied", async () => {
      const engine = await RulesEngine.create();

      expect(engine.process("<div>Before</div>")).toBe(
        "<html><head></head><body><div>Before</div></body></html>"
      );
    });

    it("eagerly rejects invalid ordinary and region selectors", async () => {
      await expect(RulesEngine.create({
        name: "invalid-selector",
        rules: [{ selector: "[", actions: [{ action: "exclude" }] }],
      })).rejects.toThrow('Rule 0 has invalid selector "["');

      await expect(RulesEngine.create({
        name: "invalid-region-selector",
        rules: [],
        regions: [{ selector: "[", name: "Main" }],
      })).rejects.toThrow('Region 0 has invalid selector "["');
    });

    it("eagerly rejects invalid regexes with rule and action context", async () => {
      await expect(RulesEngine.create({
        name: "invalid-regex",
        rules: [{ selector: ".message", actions: [{ action: "exclude", modifiers: { content_regex: "[" } }] }],
      })).rejects.toThrow(/Rule 0 selector "\.message" action 0 has invalid content_regex regex/);
    });

    it("rejects missing, extra, and inappropriate modifiers at the runtime boundary", async () => {
      const invalidRulesets = [
        { action: "remove_attr", modifiers: {} },
        { action: "exclude", modifiers: { attr: "id" } },
        { action: "rewrite_content", modifiers: { regex: "x" } },
        { action: "rewrite_attr", modifiers: { attr: "id", regex: "x", replace: "y", extra: "z" } },
      ];
      for (const action of invalidRulesets) {
        await expect(RulesEngine.create({
          name: "runtime-validation",
          rules: [{ selector: "div", actions: [action] }],
        } as unknown as Ruleset)).rejects.toThrow(/Rule 0 selector "div" action 0/);
      }
    });

    it("requires non-empty selectors, actions, and attribute names", async () => {
      await expect(RulesEngine.create({ name: "empty-selector", rules: [{ selector: "", actions: [{ action: "exclude" }] }] })).rejects.toThrow("non-empty selector");
      await expect(RulesEngine.create({ name: "empty-actions", rules: [{ selector: "div", actions: [] }] })).rejects.toThrow("at least one action");
      await expect(RulesEngine.create({ name: "empty-attr", rules: [{ selector: "div", actions: [{ action: "remove_attr", modifiers: { attr: "" } }] }] })).rejects.toThrow("non-empty");
    });
  });

  describe("process", () => {
    it("should handle empty ruleset", async () => {
      const ruleset: Ruleset = {
        name: "empty-ruleset",
        rules: [],
      };
      const engine = await RulesEngine.create(ruleset);
      const html = "<div>Test</div>";
      const expected = "<html><head></head><body><div>Test</div></body></html>";
      expect(engine.process(html)).toBe(expected);
    });

    it("should exclude elements matching selector", async () => {
      const ruleset: Ruleset = {
        name: "exclude-ruleset",
        rules: [
          {
            selector: ".ad",
            actions: [{ action: "exclude" }],
          },
        ],
      };
      const engine = await RulesEngine.create(ruleset);
      const html = '<div class="ad">Ad content</div><div>Regular content</div>';
      const expected =
        "<html><head></head><body><div>Regular content</div></body></html>";
      expect(engine.process(html)).toBe(expected);
    });

    it("should remove attributes", async () => {
      const ruleset: Ruleset = {
        name: "remove-attr-ruleset",
        rules: [
          {
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
      const engine = await RulesEngine.create(ruleset);
      const html = '<img src="test.jpg" srcset="test.jpg 1x, test@2x.jpg 2x">';
      const expected =
        '<html><head></head><body><img src="test.jpg"></body></html>';
      expect(engine.process(html)).toBe(expected);
    });

    it("should rewrite attributes", async () => {
      const ruleset: Ruleset = {
        name: "rewrite-attr-ruleset",
        rules: [
          {
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
      const engine = await RulesEngine.create(ruleset);
      const html = '<a href="/user/123">Profile</a>';
      const expected =
        '<html><head></head><body><a href="/user/USER_ID">Profile</a></body></html>';
      expect(engine.process(html)).toBe(expected);
    });

    it("should rewrite content", async () => {
      const ruleset: Ruleset = {
        name: "rewrite-content-ruleset",
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
        ],
      };
      const engine = await RulesEngine.create(ruleset);
      const html = '<div class="timestamp">Posted on 12/31/2023</div>';
      const expected =
        '<html><head></head><body><div class="timestamp">Posted on DATE_STAMP</div></body></html>';
      expect(engine.process(html)).toBe(expected);
    });

    it("preserves nested markup and rewrites each descendant text node independently", async () => {
      const engine = await RulesEngine.create({
        name: "nested-content",
        rules: [{ selector: ".content", actions: [{ action: "rewrite_content", modifiers: { regex: "ID-\\d+", replace: "ID" } }] }],
      });
      expect(engine.process('<div class="content">ID-1 <strong data-id="2">ID-2</strong> ID-3</div>')).toBe(
        '<html><head></head><body><div class="content">ID <strong data-id="2">ID</strong> ID</div></body></html>'
      );
    });

    it("does not match content across element boundaries", async () => {
      const engine = await RulesEngine.create({
        name: "node-local-content",
        rules: [{ selector: ".content", actions: [{ action: "rewrite_content", modifiers: { regex: "hello world", replace: "matched" } }] }],
      });
      expect(engine.process('<div class="content">hello <em>world</em></div>')).toContain("hello <em>world</em>");
    });

    it("supports empty regex patterns and empty attribute values", async () => {
      const engine = await RulesEngine.create({
        name: "empty-values",
        rules: [{ selector: "input", actions: [{ action: "rewrite_attr", modifiers: { attr: "value", regex: "", replace: "default" } }] }],
      });
      expect(engine.process('<input value="">')).toContain('value="default"');
    });

    it("clones and compiles rules so caller mutation cannot change behavior", async () => {
      const ruleset: Ruleset = {
        name: "immutable",
        rules: [{ selector: ".item", actions: [{ action: "rewrite_content", modifiers: { regex: "old", replace: "new" } }] }],
        regions: [{ selector: "body", name: "Body" }],
      };
      const engine = await RulesEngine.create(ruleset);
      ruleset.rules[0].selector = ".other";
      const action = ruleset.rules[0].actions[0];
      if (action.action === "rewrite_content") action.modifiers.replace = "mutated";
      if (ruleset.regions) ruleset.regions[0].name = "Changed";
      expect(engine.process('<div class="item">old</div>')).toBe(
        '<breakcheck-regions><region name="Body"><div class="item">new</div></region></breakcheck-regions>'
      );
    });

    it("should apply content regex filter", async () => {
      const ruleset: Ruleset = {
        name: "content-regex-ruleset",
        rules: [
          {
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
      const engine = await RulesEngine.create(ruleset);
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

    it("should apply ordinary rules before sorting and extracting named regions", async () => {
      const ruleset: Ruleset = {
        name: "named-regions-ruleset",
        rules: [
          {
            selector: ".dynamic",
            actions: [{ action: "exclude" }],
          },
        ],
        regions: [
          { selector: "#section-b", name: "Section_B" },
          { selector: "#section-a", name: "Section_A" },
          { selector: "#missing", name: "Missing" },
        ],
      };
      const engine = await RulesEngine.create(ruleset);
      const html = `
        <div id="outside">Outside</div>
        <div id="section-b"><span class="dynamic">Removed</span><p>B</p></div>
        <div id="section-a">A</div>
      `;

      expect(engine.process(html)).toBe(
        '<breakcheck-regions><region name="Section_A"><div id="section-a">A</div></region><region name="Section_B"><div id="section-b"><p>B</p></div></region></breakcheck-regions>'
      );
    });

    it("should preserve document order for repeated matches in one region", async () => {
      const engine = await RulesEngine.create({
        name: "repeated-region-ruleset",
        rules: [],
        regions: [{ selector: ".item", name: "Items" }],
      });

      expect(
        engine.process(
          '<ul><li class="item">First</li><li class="item">Second</li></ul>'
        )
      ).toBe(
        '<breakcheck-regions><region name="Items"><li class="item">First</li><li class="item">Second</li></region></breakcheck-regions>'
      );
    });

    it("should emit overlapping region declarations independently", async () => {
      const engine = await RulesEngine.create({
        name: "overlapping-region-ruleset",
        rules: [],
        regions: [
          { selector: ".section", name: "Outer" },
          { selector: ".section .child", name: "Inner" },
        ],
      });

      expect(
        engine.process(
          '<div class="section"><span class="child">Child</span></div>'
        )
      ).toBe(
        '<breakcheck-regions><region name="Inner"><span class="child">Child</span></region><region name="Outer"><div class="section"><span class="child">Child</span></div></region></breakcheck-regions>'
      );
    });

    it("should reject invalid inline region names", async () => {
      await expect(
        RulesEngine.create({
          name: "invalid-region-ruleset",
          rules: [],
          regions: [{ selector: ".section", name: "Section-A" }],
        })
      ).rejects.toThrow("Invalid region name \"Section-A\"");
    });
  });
});
