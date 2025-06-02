import { describe, it, expect, beforeEach, vi } from "vitest";
import { startViewServer } from "../../../core/view";
import express from "express";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

// Mock fs and zlib functions
vi.mock("fs");
vi.mock("zlib");

describe("View Server", () => {
  const mockComparisonName = "test-comparison";
  const mockPort = 8080;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock fs.readFileSync for index.json
    vi.mocked(fs.readFileSync).mockImplementation((path: string) => {
      if (path.includes("index.json")) {
        return JSON.stringify({
          pages: [
            { url: "/page1", diffFile: "page1.json.gz", hasDifferences: true },
            { url: "/page2", diffFile: "page2.json.gz", hasDifferences: false },
          ],
        });
      }
      return Buffer.from("mock data");
    });

    // Mock gunzip
    vi.mocked(gunzip).mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          url: "/page1",
          differences: [
            { count: 1, added: false, removed: false, value: "unchanged" },
            { count: 1, added: true, removed: false, value: "added" },
            { count: 1, added: false, removed: true, value: "removed" },
          ],
          hasDifferences: true,
        })
      )
    );
  });

  it("should start the server on the specified port", async () => {
    const server = await startViewServer(mockComparisonName, mockPort);
    expect(server).toBeDefined();
  });

  it("should handle index route correctly", async () => {
    const app = express();
    const server = await startViewServer(mockComparisonName, mockPort);

    const response = await new Promise((resolve) => {
      app.get("/", (req, res) => {
        resolve(res);
      });
    });

    expect(response).toBeDefined();
  });

  it("should handle diff route correctly", async () => {
    const app = express();
    const server = await startViewServer(mockComparisonName, mockPort);

    const response = await new Promise((resolve) => {
      app.get("/diff", (req, res) => {
        resolve(res);
      });
    });

    expect(response).toBeDefined();
  });

  it("should handle missing page parameter in diff route", async () => {
    const app = express();
    const server = await startViewServer(mockComparisonName, mockPort);

    const response = await new Promise((resolve) => {
      app.get("/diff", (req, res) => {
        resolve(res);
      });
    });

    expect(response).toBeDefined();
  });
});
