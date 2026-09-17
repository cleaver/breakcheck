import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { processRulesDsl } from "../../../../packages/core/src/core/rules/RulesDsl.js";
import { runNewRule } from "../cli/commands/new.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runNewRule", () => {
  it("creates a named ruleset with a rules.breakcheck scaffold", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "breakcheck-new-rule-"));
    temporaryDirectories.push(root);

    const result = await runNewRule("my-rules", {}, root);

    expect(result).toEqual({
      name: "my-rules",
      directory: path.join(root, "my-rules"),
      filePath: path.join(root, "my-rules", "rules.breakcheck"),
    });
    await expect(
      readFile(path.join(root, "my-rules", "rules.breakcheck"), "utf8"),
    ).resolves.toContain("-- Breakcheck Rules File");
  });

  it("creates a parser-valid no-op scaffold under a custom parent", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "breakcheck-new-rule-"));
    temporaryDirectories.push(root);

    const result = await runNewRule("dynamic", { directory: "rules" }, root);
    const ruleset = await processRulesDsl(result.directory);

    expect(result.filePath).toBe(
      path.join(root, "rules", "dynamic", "rules.breakcheck"),
    );
    expect(ruleset.rules).toEqual([]);
    expect(ruleset.regions).toEqual([]);
  });

  it("rejects a symlinked destination directory without writing through it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "breakcheck-new-rule-"));
    const target = await mkdtemp(
      path.join(os.tmpdir(), "breakcheck-new-rule-target-"),
    );
    temporaryDirectories.push(root, target);
    await symlink(target, path.join(root, "linked-rules"), "dir");

    await expect(
      runNewRule("my-rules", { directory: "linked-rules" }, root),
    ).rejects.toThrow("symlink");
    await expect(
      access(path.join(target, "my-rules", "rules.breakcheck")),
    ).rejects.toThrow();
  });

  it("refuses to overwrite an existing rules file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "breakcheck-new-rule-"));
    temporaryDirectories.push(root);
    const filePath = path.join(root, "existing", "rules.breakcheck");
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "keep this file\n");

    await expect(runNewRule("existing", {}, root)).rejects.toThrow(
      "already exists",
    );
    await expect(readFile(filePath, "utf8")).resolves.toBe("keep this file\n");
  });

  it.each(["", ".", "..", "../escape", "bad/name", "bad name", "bad\\name"])(
    "rejects unsafe ruleset name %j",
    async (name) => {
      const root = await mkdtemp(
        path.join(os.tmpdir(), "breakcheck-new-rule-"),
      );
      temporaryDirectories.push(root);

      await expect(runNewRule(name, {}, root)).rejects.toThrow("path-safe");
    },
  );

  it("rejects a parent directory that escapes or is absolute", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "breakcheck-new-rule-"));
    temporaryDirectories.push(root);

    await expect(
      runNewRule("safe", { directory: "../outside" }, root),
    ).rejects.toThrow("inside the current working directory");
    await expect(
      runNewRule("safe", { directory: path.join(root, "outside") }, root),
    ).rejects.toThrow("relative to the current directory");
  });

  it("refuses to overwrite a symlinked rules file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "breakcheck-new-rule-"));
    const target = await mkdtemp(
      path.join(os.tmpdir(), "breakcheck-new-rule-target-"),
    );
    temporaryDirectories.push(root, target);
    const filePath = path.join(root, "existing", "rules.breakcheck");
    await mkdir(path.dirname(filePath), { recursive: true });
    await symlink(path.join(target, "rules.breakcheck"), filePath);

    await expect(runNewRule("existing", {}, root)).rejects.toThrow(
      "already exists",
    );
    await expect(
      access(path.join(target, "rules.breakcheck")),
    ).rejects.toThrow();
  });
});
