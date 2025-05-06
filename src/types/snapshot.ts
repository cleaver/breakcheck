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
