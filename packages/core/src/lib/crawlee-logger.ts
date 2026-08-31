import { Logger as CrawleeLogger, log as crawleeLog, LogLevel } from "crawlee";
import type { Logger as PinoLogger } from "pino";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class PinoCrawleeLogger extends CrawleeLogger {
  constructor(private readonly pinoLogger: PinoLogger) {
    super({});
  }

  override _log(
    level: LogLevel,
    message: string,
    data?: unknown,
    exception?: unknown,
    opts: Record<string, unknown> = {},
  ): void {
    const component = typeof opts.prefix === "string" ? opts.prefix : undefined;
    const prefix = component ? `${component}: ` : "";
    const suffix = typeof opts.suffix === "string" ? ` ${opts.suffix}` : "";
    const fields = {
      ...(isRecord(data) ? data : {}),
      ...(component ? { component } : {}),
      ...(exception !== undefined ? { err: exception } : {}),
    };
    const logMessage = `${prefix}${message}${suffix}`;

    switch (level) {
      case LogLevel.ERROR:
        this.pinoLogger.error(fields, logMessage);
        break;
      case LogLevel.SOFT_FAIL:
      case LogLevel.WARNING:
        this.pinoLogger.warn(fields, logMessage);
        break;
      case LogLevel.DEBUG:
      case LogLevel.PERF:
        this.pinoLogger.debug(fields, logMessage);
        break;
      case LogLevel.INFO:
      default:
        this.pinoLogger.info(fields, logMessage);
        break;
    }
  }
}

export function configureCrawleeLogger(pinoLogger: PinoLogger): void {
  crawleeLog.setOptions({ logger: new PinoCrawleeLogger(pinoLogger) });
}
