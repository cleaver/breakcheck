import { findUp, pathExists } from "find-up";
import fs from "fs/promises";
import path from "path";

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
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf8"),
        );
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
