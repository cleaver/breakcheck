import assert from "node:assert/strict";
import { createServer, get as httpGet } from "node:http";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

async function run(command, args, options = {}) {
  try {
    return await execFileAsync(command, args, {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    const stdout = error.stdout || "";
    const stderr = error.stderr || "";
    throw new Error(
      `${command} ${args.join(" ")} failed with code ${error.code ?? "unknown"}\n${stdout}\n${stderr}`,
      { cause: error }
    );
  }
}

async function packWorkspace(workspace, destination) {
  const before = new Set(await readdir(destination));
  await run(npmCommand, [
    "pack",
    `--workspace=${workspace}`,
    "--pack-destination",
    destination,
  ]);

  const created = (await readdir(destination)).filter(
    (file) => file.endsWith(".tgz") && !before.has(file)
  );
  assert.equal(created.length, 1, `Expected one tarball for ${workspace}`);
  return path.join(destination, created[0]);
}

async function tarballContents(tarball) {
  const result = await run("tar", ["-tzf", tarball]);
  return result.stdout.split("\n").filter(Boolean);
}

async function runCli(consumerDir, args) {
  return run(npxCommand, ["--no-install", "breakcheck", ...args], {
    cwd: consumerDir,
    env: { ...process.env, NODE_OPTIONS: undefined },
  });
}

async function expectCliFailure(consumerDir, args, message) {
  await assert.rejects(
    () => runCli(consumerDir, args),
    (error) => {
      assert.match(String(error), message);
      return true;
    }
  );
}

async function getFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function getUrl(url) {
  return new Promise((resolve, reject) => {
    const request = httpGet(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => resolve({ statusCode: response.statusCode, body }));
    });
    request.once("error", reject);
  });
}

async function waitForUrl(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await getUrl(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Timed out waiting for ${url}`, { cause: lastError });
}

async function waitForProcess(processHandle, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      processHandle.kill("SIGKILL");
      reject(new Error("Timed out waiting for child process to exit"));
    }, timeoutMs);
    processHandle.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    processHandle.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

function assertValidDiffScript(body) {
  const inlineScript = body.match(/    <script>\n([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript, "Missing inline diff script");
  assert.doesNotThrow(() => new vm.Script(inlineScript));
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "breakcheck-package-test-"));
const tarballDirectory = path.join(temporaryRoot, "tarballs");
const fixtureServer = createServer();
let fixtureState = "before";

try {
  await mkdir(tarballDirectory, { recursive: true });
  const coreTarball = await packWorkspace("@cleaver/breakcheck-core", tarballDirectory);
  const cliTarball = await packWorkspace("@cleaver/breakcheck", tarballDirectory);

  const coreFiles = await tarballContents(coreTarball);
  for (const requiredFile of [
    "package/dist/index.js",
    "package/dist/index.d.ts",
    "package/dist/api/index.js",
    "package/dist/core/view/index.js",
    "package/dist/views/index.ejs",
    "package/dist/views/diff.ejs",
    "package/dist/public/css/diff2html.min.css",
    "package/dist/public/js/diff2html.min.js",
  ]) {
    assert.ok(coreFiles.includes(requiredFile), `Missing ${requiredFile} from core tarball`);
  }

  const consumerDir = path.join(temporaryRoot, "consumer");
  await mkdir(consumerDir, { recursive: true });
  await run(npmCommand, ["init", "-y"], { cwd: consumerDir });
  await run(
    npmCommand,
    ["install", "--save-dev", "--no-audit", "--no-fund", coreTarball, cliTarball],
    { cwd: consumerDir }
  );

  await assert.rejects(() => access(path.join(consumerDir, "node_modules", "tsx")));
  await assert.rejects(() =>
    access(path.join(consumerDir, "node_modules", "breakcheck-core"))
  );

  const help = await runCli(consumerDir, ["--help"]);
  assert.match(help.stdout, /Usage: breakcheck/);
  const version = await runCli(consumerDir, ["--version"]);
  const cliPackage = JSON.parse(
    await readFile(path.join(repoRoot, "packages/cli/package.json"), "utf8")
  );
  assert.equal(version.stdout.trim(), cliPackage.version);

  await run(process.execPath, [
    "--input-type=module",
    "-e",
    'const core = await import("@cleaver/breakcheck-core"); if (typeof core.runComparison !== "function") process.exit(1);',
  ], { cwd: consumerDir });

  await new Promise((resolve, reject) => {
    fixtureServer.on("request", (request, response) => {
      if (request.url !== "/") {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        `<html><head><title>Fixture</title></head><body><h1>Breakcheck fixture</h1><script>window.breakcheckFixtureState = "stable";</script><div class="dynamic">${fixtureState}</div></body></html>`
      );
    });
    fixtureServer.once("error", reject);
    fixtureServer.listen(0, "127.0.0.1", resolve);
  });
  const fixtureAddress = fixtureServer.address();
  assert.ok(fixtureAddress && typeof fixtureAddress === "object");
  const fixtureUrl = `http://127.0.0.1:${fixtureAddress.port}/`;

  await runCli(consumerDir, [
    "snapshot",
    "--url",
    fixtureUrl,
    "--name",
    "before",
    "--depth",
    "1",
    "--concurrency",
    "1",
  ]);
  fixtureState = "after";
  await runCli(consumerDir, [
    "snapshot",
    "--url",
    fixtureUrl,
    "--name",
    "after",
    "--depth",
    "1",
    "--concurrency",
    "1",
  ]);

  await expectCliFailure(
    consumerDir,
    ["compare", "--before", "before", "--after", "after", "--rules", "missing-rules"],
    /Rules file not found/
  );

  await runCli(consumerDir, [
    "compare",
    "--before",
    "before",
    "--after",
    "after",
    "--output",
    "unfiltered-comparison",
  ]);
  const unfilteredIndex = JSON.parse(
    await readFile(path.join(consumerDir, "comparisons/unfiltered-comparison/index.json"), "utf8")
  );
  assert.equal(unfilteredIndex.metadata.pagesWithDifferences, 1);

  const rulesDirectory = path.join(consumerDir, "rules");
  await mkdir(rulesDirectory, { recursive: true });
  await writeFile(path.join(rulesDirectory, "rules.breakcheck"), "css:.dynamic do: exclude\n");
  await runCli(consumerDir, [
    "compare",
    "--before",
    "before",
    "--after",
    "after",
    "--rules",
    rulesDirectory,
    "--output",
    "comparison",
  ]);
  const comparisonIndex = JSON.parse(
    await readFile(path.join(consumerDir, "comparisons/comparison/index.json"), "utf8")
  );
  assert.equal(comparisonIndex.metadata.pagesWithDifferences, 0);

  const viewPort = await getFreePort();
  const installedCliEntry = path.join(
    consumerDir,
    "node_modules",
    "@cleaver",
    "breakcheck",
    "dist",
    "index.js"
  );
  const viewProcess = spawn(
    process.execPath,
    [installedCliEntry, "view", "comparison", "--port", String(viewPort)],
    {
      cwd: consumerDir,
      env: { ...process.env, NODE_OPTIONS: undefined },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  try {
    const response = await waitForUrl(`http://127.0.0.1:${viewPort}/`);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /comparison/);

    const diffResponse = await waitForUrl(
      `http://127.0.0.1:${viewPort}/diff?page=${encodeURIComponent("/")}`
    );
    assert.equal(diffResponse.statusCode, 200);
    assertValidDiffScript(diffResponse.body);
  } finally {
    viewProcess.kill("SIGTERM");
    await waitForProcess(viewProcess);
  }

  console.log("Fresh-install packaging test passed");
} finally {
  if (fixtureServer.listening) fixtureServer.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}
