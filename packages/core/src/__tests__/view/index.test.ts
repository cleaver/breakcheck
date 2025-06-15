import { startViewServer } from "@/core/view";
import http from "http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { promisify } from "util";

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(async (path: string | Buffer | URL) => {
      if (typeof path === "string" && path.includes("index.json")) {
        return JSON.stringify({
          urls: {
            "/page1": { filename: "page1.json.gz", hasDifferences: true },
            "/page2": { filename: "page2.json.gz", hasDifferences: false },
          },
        });
      }
      if (typeof path === "string" && path.includes("page1.json.gz")) {
        return Buffer.from("compressed data");
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

describe("View Server", () => {
  const mockComparisonName = "test-comparison";
  const mockPort = 8080;
  let server: http.Server;
  const closeServer = promisify(
    (server: http.Server, cb: (err?: Error) => void) => server.close(cb)
  );

  beforeEach(async () => {
    vi.clearAllMocks();
    server = await startViewServer(mockComparisonName, mockPort);
  });

  afterEach(async () => {
    await closeServer(server);
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
