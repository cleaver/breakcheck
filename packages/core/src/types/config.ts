import type { CrawlerType } from "./api.js";

/** The currently supported project configuration schema version. */
export type ProjectConfigVersion = 1;

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

/** The JSON shape accepted by `breakcheck.config.json`. */
export interface ProjectConfig {
  version: ProjectConfigVersion;
  baseUrl?: string;
  storageDir?: string;
  crawl?: ProjectCrawlConfig;
  comparison?: ProjectComparisonConfig;
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
}
