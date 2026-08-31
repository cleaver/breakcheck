import { Writable } from "node:stream";
import { log as crawleeLog, LogLevel } from "crawlee";
import { pino, type Logger as PinoLogger } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureCrawleeLogger } from "../lib/crawlee-logger.js";

const originalCrawleeLogger = crawleeLog.getOptions().logger;
const originalCrawleeLevel = crawleeLog.getLevel();

interface CapturedPinoLogger {
  logger: PinoLogger;
  lines: string[];
}

function createCapturedPinoLogger(): CapturedPinoLogger {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

  return {
    logger: pino({ level: "trace" }, destination),
    lines,
  };
}

afterEach(() => {
  crawleeLog.setOptions({ logger: originalCrawleeLogger });
  crawleeLog.setLevel(originalCrawleeLevel);
  vi.restoreAllMocks();
});

describe("Crawlee logger integration", () => {
  it("routes Crawlee info records through the supplied Pino logger", () => {
    const captured = createCapturedPinoLogger();

    configureCrawleeLogger(captured.logger);
    crawleeLog.info("Crawler started", { url: "https://example.com" });

    expect(captured.lines).toHaveLength(1);
    expect(JSON.parse(captured.lines[0])).toMatchObject({
      level: 30,
      msg: "Crawler started",
      url: "https://example.com",
    });
  });

  it("preserves Crawlee severity levels in Pino", () => {
    const captured = createCapturedPinoLogger();

    configureCrawleeLogger(captured.logger);
    crawleeLog.error("Crawler failed");
    crawleeLog.warning("Crawler warning");
    crawleeLog.info("Crawler started");

    expect(captured.lines.map((line) => JSON.parse(line).level)).toEqual([
      50,
      40,
      30,
    ]);
  });

  it("maps Crawlee soft-fail and performance levels to Pino", () => {
    const captured = createCapturedPinoLogger();

    configureCrawleeLogger(captured.logger);
    crawleeLog.setLevel(LogLevel.PERF);
    crawleeLog.softFail("Crawler soft failure");
    crawleeLog.perf("Crawler performance");

    expect(captured.lines.map((line) => JSON.parse(line).level)).toEqual([
      40,
      20,
    ]);
  });

  it("preserves Crawlee prefixes and structured fields", () => {
    const captured = createCapturedPinoLogger();

    configureCrawleeLogger(captured.logger);
    crawleeLog
      .child({ prefix: "CheerioCrawler" })
      .info("Crawler started", { url: "https://example.com" });

    expect(JSON.parse(captured.lines[0])).toMatchObject({
      msg: "CheerioCrawler: Crawler started",
      component: "CheerioCrawler",
      url: "https://example.com",
    });
  });

  it("forwards Crawlee exceptions as Pino errors", () => {
    const captured = createCapturedPinoLogger();

    configureCrawleeLogger(captured.logger);
    crawleeLog.exception(new Error("Request failed"), "Crawler failed", {
      url: "https://example.com",
    });

    expect(JSON.parse(captured.lines[0])).toMatchObject({
      level: 50,
      msg: "Crawler failed",
      url: "https://example.com",
      err: {
        message: "Request failed",
      },
    });
  });

  it("replaces Crawlee console output instead of duplicating it", () => {
    const captured = createCapturedPinoLogger();
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    configureCrawleeLogger(captured.logger);
    crawleeLog.info("Crawler started");

    expect(captured.lines).toHaveLength(1);
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
