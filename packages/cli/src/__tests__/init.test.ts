import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "../cli/commands/init.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "breakcheck-init-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runInit", () => {
  it("writes a formatted config with paths relative to the destination", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "config"));
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
    );

    const result = await runInit(
      {
        config: "config/project.json",
        url: "https://example.com",
        storageDir: ".breakcheck",
        rules: "rules",
      },
      root,
    );

    expect(result.storageDir).toBe(path.join(root, ".breakcheck"));
    await expect(
      readFile(path.join(root, "config/project.json"), "utf8"),
    ).resolves.toContain('"storageDir": "../.breakcheck"');
    await expect(
      readFile(path.join(root, "config/project.json"), "utf8"),
    ).resolves.toContain('"rulesDir": "../rules"');
  });

  it("records legacy storage explicitly when no storage flag is supplied", async () => {
    const root = await temporaryDirectory();
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
    );

    await runInit({}, root);
    const config = JSON.parse(
      await readFile(path.join(root, "breakcheck.config.json"), "utf8"),
    ) as { storageDir: string };
    expect(config.storageDir).toBe(".");
  });

  it("does not overwrite an existing destination", async () => {
    const root = await temporaryDirectory();
    const destination = path.join(root, "breakcheck.config.json");
    await writeFile(destination, "keep me");

    await expect(runInit({}, root)).rejects.toThrow();
    await expect(readFile(destination, "utf8")).resolves.toBe("keep me");
  });

  it("does not write a file when interactive initialization is cancelled", async () => {
    const root = await temporaryDirectory();
    await expect(
      runInit({ interactive: true }, root, {
        isInteractive: true,
        ask: async () => Promise.reject(new Error("cancelled")),
      }),
    ).rejects.toThrow("cancelled");
    await expect(
      access(path.join(root, "breakcheck.config.json")),
    ).rejects.toThrow();
  });

  it("supports skipped optional values in interactive mode", async () => {
    const root = await temporaryDirectory();
    const answers = ["https://example.com", "", "", "", "", ""];
    const result = await runInit({ interactive: true }, root, {
      isInteractive: true,
      ask: async () => answers.shift() ?? "",
    });

    expect(result.config.baseUrl).toBe("https://example.com");
    expect(result.config.comparison).toBeUndefined();
  });

  it("does not prompt for explicitly supplied interactive values", async () => {
    const root = await temporaryDirectory();
    const result = await runInit(
      {
        interactive: true,
        url: "https://example.com",
        storageDir: ".breakcheck",
        rules: "rules",
        type: "cheerio",
        depth: "1",
        concurrency: "1",
      },
      root,
      {
        isInteractive: true,
        ask: async () => {
          throw new Error("unexpected prompt");
        },
      },
    );

    expect(result.config.baseUrl).toBe("https://example.com");
  });
});
