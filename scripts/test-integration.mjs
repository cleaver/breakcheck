import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "packages/cli/dist/index.js");
const beforeFixture = join(
  repoRoot,
  "packages/cli/src/__test_server__/server-before.js",
);
const afterFixture = join(
  repoRoot,
  "packages/cli/src/__test_server__/server-after.js",
);

async function getFreePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function waitForHttp(url, child) {
  const deadline = Date.now() + 10_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Fixture server exited before becoming ready: ${child.exitCode}`,
      );
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return { status: response.status, body: await response.text() };
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message ?? "no response"}`,
  );
}

function startFixture(script, port, cwd) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: { ...process.env, BREAKCHECK_TEST_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  child.fixtureOutput = () => output;
  return child;
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;

  child.kill("SIGTERM");
  await new Promise((resolvePromise) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolvePromise();
    }, 2_000);
    child.once("close", () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });
}

async function runCli(cwd, args) {
  const { NODE_OPTIONS: _nodeOptions, ...environment } = process.env;

  try {
    return await execFileAsync(process.execPath, [cliEntry, ...args], {
      cwd,
      env: environment,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `CLI failed: breakcheck ${args.join(" ")}\n${error.stdout ?? ""}\n${error.stderr ?? error.message}`,
      { cause: error },
    );
  }
}

async function expectCliFailure(cwd, args, pattern) {
  await assert.rejects(
    () => runCli(cwd, args),
    (error) => {
      assert.match(String(error), pattern);
      return true;
    },
  );
}

async function runSnapshot(cwd, dataRoot, baseUrl, name) {
  await runCli(cwd, [
    "snapshot",
    "--url",
    baseUrl,
    "--name",
    name,
    "--depth",
    "3",
    "--concurrency",
    "2",
  ]);

  const snapshotIndex = JSON.parse(
    await readFile(join(dataRoot, "snapshots", name, "index.json"), "utf8"),
  );
  assert.equal(snapshotIndex.metadata.totalPages, 4);
}

async function readComparison(dataRoot, name) {
  return JSON.parse(
    await readFile(join(dataRoot, "comparisons", name, "index.json"), "utf8"),
  );
}

async function runComparison(cwd, dataRoot, output, rulesDirectory) {
  const args = [
    "compare",
    "--before",
    "before",
    "--after",
    "after",
    "--output",
    output,
  ];
  if (rulesDirectory) args.push("--rules", rulesDirectory);

  await runCli(cwd, args);
  return readComparison(dataRoot, output);
}

async function runView(cwd, comparisonName) {
  const port = await getFreePort();
  const { NODE_OPTIONS: _nodeOptions, ...environment } = process.env;
  const viewProcess = spawn(
    process.execPath,
    [cliEntry, "view", comparisonName, "--port", String(port)],
    {
      cwd,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  viewProcess.stdout.on("data", (chunk) => {
    output += chunk;
  });
  viewProcess.stderr.on("data", (chunk) => {
    output += chunk;
  });

  try {
    const response = await waitForHttp(`http://127.0.0.1:${port}/`, viewProcess);
    assert.equal(response.status, 200);
    assert.match(response.body, /filtered-comparison/);
  } catch (error) {
    throw new Error(`${error.message}\n${output}`, { cause: error });
  } finally {
    await stopProcess(viewProcess);
  }
}

const tempRoot = await mkdtemp(join(tmpdir(), "breakcheck-integration-"));
const invocationRoot = join(tempRoot, "packages/site");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
let fixture;

try {
  await mkdir(invocationRoot, { recursive: true });
  await writeFile(
    join(tempRoot, "package.json"),
    '{"name":"breakcheck-integration-fixture","private":true,"workspaces":["packages/*"]}\n',
  );
  await writeFile(
    join(invocationRoot, "package.json"),
    '{"name":"breakcheck-integration-site","private":true}\n',
  );

  fixture = startFixture(beforeFixture, port, invocationRoot);
  await waitForHttp(`${baseUrl}/`, fixture).catch((error) => {
    throw new Error(`${error.message}\n${fixture.fixtureOutput()}`, { cause: error });
  });
  await runSnapshot(invocationRoot, tempRoot, baseUrl, "before");
  await stopProcess(fixture);
  fixture = undefined;

  fixture = startFixture(afterFixture, port, invocationRoot);
  await waitForHttp(`${baseUrl}/`, fixture).catch((error) => {
    throw new Error(`${error.message}\n${fixture.fixtureOutput()}`, { cause: error });
  });
  await runSnapshot(invocationRoot, tempRoot, baseUrl, "after");
  await stopProcess(fixture);
  fixture = undefined;

  await expectCliFailure(
    invocationRoot,
    ["compare", "--before", "before", "--after", "after", "--rules", "./missing-rules"],
    /Rules file not found/,
  );

  const unfiltered = await runComparison(
    invocationRoot,
    tempRoot,
    "unfiltered-comparison",
  );
  assert.equal(unfiltered.metadata.totalPages, 4);
  assert.ok(unfiltered.metadata.pagesWithDifferences > 0);

  const rulesDirectory = join(invocationRoot, "rules");
  await mkdir(rulesDirectory);
  await writeFile(
    join(rulesDirectory, "rules.breakcheck"),
    [
      "css:link do: exclude",
      "css:img do: exclude",
      "css:article do: exclude",
      "css:.member do: exclude",
      "css:form do: exclude",
      "",
    ].join("\n"),
  );

  const filtered = await runComparison(
    invocationRoot,
    tempRoot,
    "filtered-comparison",
    "./rules",
  );
  assert.equal(filtered.metadata.totalPages, 4);
  assert.equal(filtered.metadata.pagesWithDifferences, 0);

  await runView(invocationRoot, "filtered-comparison");
  console.log("Fixture integration test passed");
} finally {
  if (fixture) await stopProcess(fixture);
  await rm(tempRoot, { recursive: true, force: true });
}
