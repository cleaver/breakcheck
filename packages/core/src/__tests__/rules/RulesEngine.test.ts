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
