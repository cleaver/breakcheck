/** Internal types for snapshot saves / indexing used by other modules. */

export interface SnapshotIndex {
  urls: {
    [url: string]: {
      filename: string;
      statusCode: number;
      finalUrl?: string;
      pageTitle?: string;
    };
  };
  metadata: {
    baseUrl: string;
    timestamp: string;
    totalPages: number;
  };
}

export interface SnapshotMetadata {
  baseUrl: string;
  timestamp: string;
  crawlSettings: any; // Using any here since CrawlerConfig is not directly imported
}

export interface SnapshotSummary {
  name: string;
  date: string;
  pageCount: number;
  errorCount: number;
}

export interface SnapshotData {
  dataset: any; // Using any here since Dataset type is not directly imported
  metadata: SnapshotMetadata;
}
