import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const RULES_FILE_NAME = "rules.breakcheck";

const RULE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error && "code" in error && typeof error.code === "string"
  );
}

function isWithinDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

async function assertDirectory(directory: string): Promise<void> {
  const stats = await lstat(directory);
  if (stats.isSymbolicLink()) {
    throw new Error(`Cannot use symlinked rules directory: ${directory}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Rules destination is not a directory: ${directory}`);
  }
}

async function ensureDirectoryTree(
  rootDirectory: string,
  destination: string,
): Promise<void> {
  await assertDirectory(rootDirectory);
  let current = rootDirectory;
  const relative = path.relative(rootDirectory, destination);
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      await assertDirectory(current);
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
      try {
        await mkdir(current);
      } catch (mkdirError) {
        if (!isNodeError(mkdirError) || mkdirError.code !== "EEXIST")
          throw mkdirError;
        await assertDirectory(current);
      }
    }
  }
}

function resolveParentDirectory(
  cwd: string,
  directory?: string,
): {
  cwd: string;
  parent: string;
} {
  const absoluteCwd = path.resolve(cwd);
  if (directory !== undefined) {
    if (directory.trim().length === 0) {
      throw new Error("--directory must not be empty.");
    }
    if (path.isAbsolute(directory)) {
      throw new Error("--directory must be relative to the current directory.");
    }
  }

  const parent = path.resolve(absoluteCwd, directory ?? ".");
  if (!isWithinDirectory(absoluteCwd, parent)) {
    throw new Error(
      "--directory must resolve inside the current working directory.",
    );
  }
  return { cwd: absoluteCwd, parent };
}

export interface RuleScaffoldOptions {
  directory?: string;
}

export interface RuleScaffoldResult {
  name: string;
  directory: string;
  filePath: string;
}

export function validateRuleName(name: string): string {
  if (typeof name !== "string" || !RULE_NAME_PATTERN.test(name)) {
    throw new Error(
      "Rule name must be a single path-safe segment containing only letters, numbers, '.', '_' or '-'.",
    );
  }
  return name;
}

export function renderRuleScaffold(name: string): string {
  return `-- Breakcheck Rules File
-- Ruleset: ${name}
--
-- Add active rules below. Examples:
-- css:.ad-container do: exclude
-- css:[data-dynamic] do: remove_attr attr:"data-id"
-- css:.timestamp do: rewrite_content regex:"\\d+" replace:"STATIC"
`;
}

export async function createRuleScaffold(
  name: string,
  options: RuleScaffoldOptions = {},
  cwd: string = process.cwd(),
): Promise<RuleScaffoldResult> {
  const validName = validateRuleName(name);
  const resolved = resolveParentDirectory(cwd, options.directory);
  const parentDirectory = resolved.parent;
  const directory = path.join(parentDirectory, validName);
  const filePath = path.join(directory, RULES_FILE_NAME);

  await ensureDirectoryTree(resolved.cwd, directory);
  try {
    await lstat(filePath);
    throw new Error(`Rules file already exists: ${filePath}`);
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") throw error;
  }

  try {
    await writeFile(filePath, renderRuleScaffold(validName), {
      encoding: "utf8",
      flag: "wx",
    });
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      throw new Error(`Rules file already exists: ${filePath}`, {
        cause: error,
      });
    }
    throw error;
  }

  return { name: validName, directory, filePath };
}
