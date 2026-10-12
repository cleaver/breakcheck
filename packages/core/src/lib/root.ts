import { findUp } from "find-up";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

/**
 * Finds the root directory of the project by looking for a package.json file
 * that contains a "workspaces" configuration.
 *
 * @returns The absolute path to the root directory
 */
export async function findRootDir(
  startDir: string = process.cwd(),
): Promise<string> {
  const rootPackageJsonPath = await findUp(
    async (directory) => {
      const packageJsonPath = path.join(directory, "package.json");
      const exists = await pathExists(packageJsonPath);
      if (exists) {
        const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
        if (packageJson.workspaces) {
          return packageJsonPath;
        }
      }
    },
    { type: "file", cwd: startDir },
  );

  return rootPackageJsonPath
    ? path.dirname(rootPackageJsonPath)
    : process.cwd();
}
