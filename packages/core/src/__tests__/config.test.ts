import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  findProjectConfig,
  loadProjectConfig,
  resolveProjectConfig,
  validateProjectConfig,
  writeProjectConfig,
} from "../lib/config.js";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "breakcheck-config-"));
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

describe("project configuration", () => {
  it("discovers the nearest config and resolves paths from its directory", async () => {
    const root = await createTemporaryDirectory();
    const nested = path.join(root, "packages", "site");
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
    );
    await writeFile(
      path.join(root, "breakcheck.config.json"),
      JSON.stringify({
        version: 1,
        baseUrl: "https://example.com",
        storageDir: ".breakcheck",
        crawl: { maxDepth: 4, maxConcurrency: 2 },
        comparison: { rulesDir: "./rules" },
      }),
    );

    expect(await findProjectConfig(nested)).toBe(
      path.join(root, "breakcheck.config.json"),
    );
    const resolved = await resolveProjectConfig({ cwd: nested });
    expect(resolved).toEqual({
      configPath: path.join(root, "breakcheck.config.json"),
      storageDir: path.join(root, ".breakcheck"),
      baseUrl: "https://example.com",
      crawl: { maxDepth: 4, maxConcurrency: 2 },
      rulesDir: path.join(root, "rules"),
    });
  });

  it("selects an explicit file and rejects a missing file", async () => {
    const root = await createTemporaryDirectory();
    const configPath = path.join(root, "custom.json");
    await writeFile(configPath, JSON.stringify({ version: 1 }));

    const loaded = await loadProjectConfig({
      cwd: root,
      configPath: "custom.json",
    });
    expect(loaded?.configPath).toBe(configPath);
    await expect(
      loadProjectConfig({ cwd: root, configPath: "missing.json" }),
    ).rejects.toThrow(configPath.replace("custom.json", "missing.json"));
    await expect(
      loadProjectConfig({
        cwd: root,
        configPath: "custom.json",
        noConfig: true,
      }),
    ).rejects.toThrow("cannot be used together");
  });

  it("allows discovery to be disabled and retains legacy storage resolution", async () => {
    const root = await createTemporaryDirectory();
    const nested = path.join(root, "packages", "site");
    await writeFile(path.join(root, "breakcheck.config.json"), "not json");
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*"] }),
    );

    await expect(
      resolveProjectConfig({ cwd: nested, noConfig: true }),
    ).resolves.toEqual({
      storageDir: root,
      crawl: {},
    });
  });

  it("rejects unknown fields, invalid URLs, and invalid numeric boundaries", () => {
    expect(() => validateProjectConfig({ version: 1, unknown: true })).toThrow(
      "unsupported field",
    );
    expect(() =>
      validateProjectConfig({ version: 1, baseUrl: "ftp://example.com" }),
    ).toThrow("HTTP(S)");
    expect(() =>
      validateProjectConfig({ version: 1, crawl: { maxDepth: -1 } }),
    ).toThrow("maxDepth");
    expect(() =>
      validateProjectConfig({ version: 1, crawl: { maxConcurrency: 0 } }),
    ).toThrow("maxConcurrency");
  });

  it("refuses to overwrite an existing configuration", async () => {
    const root = await createTemporaryDirectory();
    const configPath = path.join(root, "breakcheck.config.json");
    await writeProjectConfig(configPath, { version: 1 });
    await expect(
      writeProjectConfig(configPath, { version: 1 }),
    ).rejects.toThrow();
    await expect(access(configPath)).resolves.toBeUndefined();
  });
});
