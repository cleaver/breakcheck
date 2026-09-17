import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { findRootDir } from "./root.js";

/** Resolved locations for all Breakcheck-managed artifacts. */
export interface StorageContext {
  storageDir: string;
  snapshotsDir: string;
  comparisonsDir: string;
}

/** Resolves an explicit artifact root or the legacy project root. */
export async function resolveStorageContext(
  storageDir?: string,
): Promise<StorageContext> {
  const resolvedStorageDir = path.resolve(storageDir ?? (await findRootDir()));
  return {
    storageDir: resolvedStorageDir,
    snapshotsDir: path.join(resolvedStorageDir, "snapshots"),
    comparisonsDir: path.join(resolvedStorageDir, "comparisons"),
  };
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error && "code" in error && typeof error.code === "string"
  );
}

export function resolveStorageEntry(
  storageDir: string,
  name: string,
  kind: string,
): string {
  if (
    name.length === 0 ||
    name.trim().length === 0 ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    throw new Error(
      `Invalid ${kind} name "${name}". Names must be a single path component.`,
    );
  }

  const resolvedStorageDir = path.resolve(storageDir);
  const resolvedEntry = path.resolve(resolvedStorageDir, name);
  if (path.dirname(resolvedEntry) !== resolvedStorageDir) {
    throw new Error(
      `Invalid ${kind} name "${name}". Names must remain inside the storage directory.`,
    );
  }

  return resolvedEntry;
}

export async function deleteStorageEntry(
  storageDir: string,
  name: string,
  kind: string,
): Promise<boolean> {
  const entryPath = resolveStorageEntry(storageDir, name, kind);

  let entryStats;
  try {
    entryStats = await lstat(entryPath);
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }

  if (!entryStats.isDirectory()) {
    throw new Error(`Cannot delete ${kind} "${name}": it is not a directory.`);
  }

  await rm(entryPath, { recursive: true });
  return true;
}

export async function listStorageDirectories(
  storageDir: string,
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(storageDir, { withFileTypes: true });
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function deleteAllStorageEntries(
  storageDir: string,
  kind: string,
): Promise<string[]> {
  const names = await listStorageDirectories(storageDir);
  const deletedNames: string[] = [];

  for (const name of names) {
    if (await deleteStorageEntry(storageDir, name, kind)) {
      deletedNames.push(name);
    }
  }

  return deletedNames;
}
