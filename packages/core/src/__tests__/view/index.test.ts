import http from "http";
import { promisify } from "util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        hasDifferences: true,
      })
    );
    callback(null, decompressed);
  }),
}));

// Import after mocks
import { startViewServer } from "../../core/view";

describe("View Server", () => {
  const mockComparisonName = "test-comparison";
  const mockPort = 8080;
  let server: http.Server | undefined;
  const closeServer = promisify(
    (server: http.Server, cb: (err?: Error) => void) => server.close(cb)
  );

  beforeEach(async () => {
    vi.clearAllMocks();
    try {
      server = await startViewServer(mockComparisonName, mockPort);
    } catch (error) {
      console.error("Failed to start server:", error);
      throw error;
    }
  });

  afterEach(async () => {
    if (server) {
      try {
        await closeServer(server);
      } catch (error) {
        // Ignore errors when server is already closed
      }
    }
  });

  const makeRequest = (
    path: string
  ): Promise<{ statusCode: number; data: string }> => {
    return new Promise((resolve, reject) => {
      const options = {
        host: "localhost",
        path,
        port: mockPort,
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

  it("should handle missing page parameter in diff route", async () => {
    const response = await makeRequest("/diff");
    expect(response.statusCode).toBe(400);
  });
});
