import { pino } from "pino";
import { configureCrawleeLogger } from "./crawlee-logger.js";

// Define valid log levels
type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

// Determine the log level from the environment variable, defaulting to 'info'
const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// Logger configuration options
export interface LoggerConfig {
  useJsonLogs?: boolean;
  level?: LogLevel;
}

// Create a logger with the specified configuration
export function createLogger(config: LoggerConfig = {}) {
  const { useJsonLogs = false, level = logLevel } = config;

  // Configure transport based on useJsonLogs flag
  const transport = useJsonLogs
    ? undefined // Use standard JSON logging
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      };

  return pino({
    level,
    transport,
  });
}

/**
 * Configure the shared Breakcheck logger and the Crawlee logger together.
 */
export function configureLogger(config: LoggerConfig = {}) {
  logger = createLogger(config);
  configureCrawleeLogger(logger);
  return logger;
}

// Create the default shared logger instance (for backward compatibility)
// This will use pretty logging by default for CLI, but can be overridden
export let logger = createLogger({ useJsonLogs: false });
configureCrawleeLogger(logger);
