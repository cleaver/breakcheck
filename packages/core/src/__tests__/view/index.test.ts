import http from "node:http";
import vm from "node:vm";
import { promisify } from "node:util";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock fs/promises before importing the module
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(async (path: string | Buffer | URL) => {
      if (typeof path === "string") {
        if (path.includes("package.json")) {
          return JSON.stringify({
            workspaces: ["packages/*"],
            name: "breakcheck-monorepo",
          });
        }
        if (path.includes("index.json")) {
          return JSON.stringify({
            urls: {
              "/page1": { filename: "page1.json.gz", hasDifferences: true },
              "/page2": { filename: "page2.json.gz", hasDifferences: false },
            },
          });
        }
        if (path.includes("diffs/page1.json.gz")) {
          return Buffer.from("compressed data");
        }
      }
      throw new Error(`fs.readFile mock not implemented for ${path}`);
    }),
  },
}));

vi.mock("zlib", () => ({
  gunzip: vi.fn((_buffer, callback) => {
    const decompressed = Buffer.from(
      JSON.stringify({
        url: "/page1",
        differences: [],
        patch:
          "@@ -1,1 +1,1 @@\n-<p>before</p>\n+<script>const pageState = 'after';</script>\n",
        hasDifferences: true,
      }),
    );
    callback(null, decompressed);
  }),
}));

// Import after mocks
import { startViewServer } from "../../core/view/index.js";

describe("View Server", () => {
  const mockComparisonName = "test-comparison";
  const mockPort = 0;
  let server: http.Server | undefined;
  let serverPort: number;
  const closeServer = promisify(
    (server: http.Server, cb: (err?: Error) => void) => server.close(cb),
  );

  beforeAll(async () => {
    try {
      server = await startViewServer(mockComparisonName, mockPort);
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("View server did not expose a TCP address");
      }
      serverPort = address.port;
    } catch (error) {
      console.error("Failed to start server:", error);
      throw error;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (server) {
      try {
        await closeServer(server);
      } catch (error) {
        // Ignore errors when server is already closed
      }
    }
  });

  const makeRequest = (
    path: string,
  ): Promise<{ statusCode: number; data: string }> => {
    return new Promise((resolve, reject) => {
      const options = {
        host: "127.0.0.1",
        path,
        port: serverPort,
        agent: new http.Agent({ keepAlive: false }),
      };
      http
        .get(options, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve({ statusCode: res.statusCode || 500, data });
          });
        })
        .on("error", reject);
    });
  };

  it("should start the server and respond to the index route", async () => {
    const response = await makeRequest("/");
    expect(response.statusCode).toBe(200);
  });

  it("should handle diff route correctly", async () => {
    const response = await makeRequest("/diff?page=/page1");
    expect(response.statusCode).toBe(200);
  });

  it("should render diff payloads with script tags as valid JavaScript", async () => {
    const response = await makeRequest("/diff?page=/page1");
    const inlineScript = response.data.match(
      /    <script>\n([\s\S]*?)<\/script>/,
    )?.[1];

    expect(inlineScript).toBeDefined();
    expect(() => new vm.Script(inlineScript as string)).not.toThrow();
  });

  it("should handle missing page parameter in diff route", async () => {
    const response = await makeRequest("/diff");
    expect(response.statusCode).toBe(400);
  });

  it("should reject when the requested port is already in use", async () => {
    const occupiedServer = http.createServer();
    await new Promise<void>((resolve, reject) => {
      occupiedServer.once("error", reject);
      occupiedServer.listen(0, resolve);
    });

    const address = occupiedServer.address();
    if (!address || typeof address === "string") {
      await closeServer(occupiedServer);
      throw new Error("Occupied server did not expose a TCP address");
    }

    try {
      await expect(
        startViewServer(mockComparisonName, address.port),
      ).rejects.toThrow(`Port ${address.port} is already in use.`);
    } finally {
      await closeServer(occupiedServer);
    }
  });
});
