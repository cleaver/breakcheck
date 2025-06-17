import pino from "pino";

// Define valid log levels
type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

// Determine the log level from the environment variable, defaulting to 'info'
const logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// Configure pino-pretty for development, otherwise use standard JSON logging
const transport =
  process.env.NODE_ENV === "development"
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined;

// Create the shared logger instance
export const logger = pino({
  level: logLevel,
  transport,
});
