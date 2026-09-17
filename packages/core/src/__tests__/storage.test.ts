import { access, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deleteSnapshot, resolveStorageContext } from "../index.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "breakcheck-storage-"),
  );
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

describe("explicit artifact storage", () => {
  it("keeps two storage contexts independent in one process", async () => {
    const first = await temporaryDirectory();
    const second = await temporaryDirectory();
    await mkdir(path.join(first, "snapshots", "first"), { recursive: true });
    await mkdir(path.join(second, "snapshots", "second"), { recursive: true });

    expect(await resolveStorageContext(first)).toEqual({
      storageDir: first,
      snapshotsDir: path.join(first, "snapshots"),
      comparisonsDir: path.join(first, "comparisons"),
    });
    await expect(deleteSnapshot("first", { storageDir: first })).resolves.toBe(
      true,
    );
    await expect(
      access(path.join(second, "snapshots", "second")),
    ).resolves.toBeUndefined();
  });

  it("does not follow a symlinked artifact target during deletion", async () => {
    const storage = await temporaryDirectory();
    const outside = await temporaryDirectory();
    await mkdir(path.join(outside, "secret"), { recursive: true });
    await mkdir(path.join(storage, "snapshots"), { recursive: true });
    await symlink(
      path.join(outside, "secret"),
      path.join(storage, "snapshots", "linked"),
      "dir",
    );

    await expect(
      deleteSnapshot("linked", { storageDir: storage }),
    ).rejects.toThrow("not a directory");
    await expect(access(path.join(outside, "secret"))).resolves.toBeUndefined();
  });
});
