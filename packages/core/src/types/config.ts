import type { CrawlerType } from "./api.js";

/** The supported project configuration schema versions. */
export type ProjectConfigVersion = 1 | 2;

/** Crawl defaults that may be persisted in a project configuration file. */
export interface ProjectCrawlConfig {
  crawlerType?: CrawlerType;
  maxDepth?: number;
  maxConcurrency?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
}

/** Comparison defaults that may be persisted in a project configuration file. */
export interface ProjectComparisonConfig {
  rulesDir?: string;
}

/** A command passed to Node's process launcher without shell interpretation. */
export type ProjectCommand = string[];

/** Local site lifecycle settings for `breakcheck check`. */
export interface ProjectCheckServerConfig {
  start: ProjectCommand;
  stop?: ProjectCommand;
  cwd?: string;
  env?: Record<string, string>;
  readyPath?: string;
  timeoutMs?: number;
}

/** Settings for a repeatable exact-route regression check. */
export interface ProjectCheckConfig {
  routesFile: string;
  baselineSnapshot: string;
  prepare?: ProjectCommand[];
  server?: ProjectCheckServerConfig;
  reportDir?: string;
}

/** The JSON shape accepted by `breakcheck.config.json`. */
export interface ProjectConfig {
  version: ProjectConfigVersion;
  baseUrl?: string;
  storageDir?: string;
  crawl?: ProjectCrawlConfig;
  comparison?: ProjectComparisonConfig;
  check?: ProjectCheckConfig;
}

/** A validated project configuration together with the file that supplied it. */
export interface LoadedProjectConfig {
  configPath: string;
  config: ProjectConfig;
}

/** Options controlling explicit configuration selection and discovery. */
export interface ProjectConfigLoadOptions {
  cwd?: string;
  configPath?: string;
  noConfig?: boolean;
}

/** A validated configuration with paths resolved for downstream operations. */
export interface ResolvedProjectConfig {
  configPath?: string;
  storageDir: string;
  baseUrl?: string;
  crawl: ProjectCrawlConfig;
  rulesDir?: string;
  check?: ResolvedProjectCheckConfig;
}

/** Check configuration with filesystem paths resolved from the config file. */
export interface ResolvedProjectCheckConfig extends Omit<
  ProjectCheckConfig,
  "routesFile" | "reportDir" | "server"
> {
  configDirectory: string;
  routesFile: string;
  reportDir: string;
  server?: Omit<ProjectCheckServerConfig, "cwd"> & { cwd: string };
}
