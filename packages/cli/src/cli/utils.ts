import { createLogger, logger } from "breakcheck-core";

// Global logger instance that can be reconfigured
let cliLogger = logger;

/**
 * Configure the logger for CLI usage based on command options
 */
export function configureLogger(options: {
  jsonLogs?: boolean;
  noJsonLogs?: boolean;
}) {
  // Determine if we should use JSON logs
  // --json-logs takes precedence over --no-json-logs
  const useJsonLogs = options.jsonLogs || false;

  // Create a new logger instance with the specified configuration
  cliLogger = createLogger({ useJsonLogs });

  return cliLogger;
}

/**
 * Get the current CLI logger instance
 */
export function getLogger() {
  return cliLogger;
}
