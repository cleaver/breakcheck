# Breakcheck REST API Specification

Version: 1.0 (Draft)

Date: 2025-05-15

## 1. Introduction

This document describes the REST API for Breakcheck, a tool for comparing website states. The API allows for creating website snapshots and comparing them to identify differences.

This API is designed to be consumed by clients such as future web interfaces.

**Base URL:** `/api/v1`

**Authentication:** For the initial version, no specific authentication mechanisms are defined. If this API becomes publicly network-accessible in the future, appropriate security measures (e.g., API keys, OAuth 2.0) will be implemented.

## 2. Data Types

Many request and response payloads will use JSON structures based on the project's TypeScript types. Key shared data types are referenced below. (Refer to `src/types/` directory in the project for detailed TypeScript definitions).

### 2.1 `ErrorResponse`

Standard error responses will follow this format:

```json
{
  "error": {
    "code": "ErrorCodeString", // e.g., "ValidationFailed", "NotFound", "InternalServerError"
    "message": "A human-readable error message.",
    "details": [
      // Optional: for more specific error information
      {
        "field": "fieldName",
        "issue": "Description of the issue with the field"
      }
    ]
  }
}
```

### 2.2 `CrawlerConfig`

(Based on `src/types/crawler.ts::CrawlerConfig`)

```json
{
  "baseUrl": "string (url)",
  "maxDepth": "integer (optional)",
  "maxRequests": "integer (optional)",
  "maxConcurrency": "integer (optional)",
  "includePatterns": ["string (glob pattern)", "... (optional)"],
  "excludePatterns": ["string (glob pattern)", "... (optional)"],
  "userAgent": "string (optional)",
  "crawlerType": "\"cheerio\" | \"playwright\""
}
```

### 2.3 `PageSnapshotData`

(Based on `src/types/crawler.ts::PageSnapshot`)
Represents the data for a single captured page within a snapshot.

```json
{
  "url": "string (url)",
  "finalUrl": "string (url)",
  "content": "string (html)",
  "statusCode": "integer",
  "headers": {
    "headerName": "headerValue (string)",
    "...": "..."
  },
  "title": "string (optional)"
}
```

### 2.4 `Rule` (Illustrative for `ComparisonConfig`)

The structure of rules passed to the comparison endpoint. This would be the JSON representation of the Rules DSL.
(Example based on PRD, actual structure to be finalized by `breakcheck_json_spec_v1`)

```json
[
  {
    "mode": "exclude",
    "selectors": ["#dynamic-widget", ".ad-banner"],
    "selectorType": "css" // or "xpath"
  },
  {
    "mode": "rewrite_attr",
    "selectors": ["script[src]"],
    "selectorType": "css",
    "attribute": "src",
    "pattern": "\\?v=[0-9]+$",
    "replacement": ""
  }
  // ... more rules
]
```

## 3. Snapshots API

Resource: `/snapshots`

Manages website snapshots.

### 3.1 Create Snapshot

- **Endpoint:** `POST /snapshots`
- **Description:** Initiates the creation of a new website snapshot.
- **Request Body:** (`SnapshotConfig` from `src/types/api.ts`)
  ```json
  {
    "name": "string (snapshot_identifier)",
    "baseUrl": "string (url)",
    "crawlSettings": {
      // CrawlerConfig object (see 2.2)
      "baseUrl": "string (url)", // Should match outer baseUrl
      "crawlerType": "cheerio",
      "maxDepth": 3
      // ... other crawl settings
    },
    "generateUrlList": true // or false (boolean, optional)
  }
  ```
- **Responses:**
  - `202 Accepted`: Snapshot job accepted and initiated.
    - Headers:
      `Location: /api/v1/snapshots/{snapshotId}` (URL to the newly created snapshot.)
    - Body:
      ```json
      {
        "snapshotId": "string (unique ID for this snapshot job)",
        "status": "pending",
        "message": "Snapshot job initiated."
      }
      ```
  - `400 Bad Request`: Invalid request payload (e.g., missing required fields, invalid URL).
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: An error occurred during the snapshot creation process.
    - Body: `ErrorResponse`

### 3.2 Snapshot Status

- **Endpoint:** `GET /snapshots/{snapshotId}/status`
- **Description:** Returns current status of the snapshot job.
- **Path Parameters:**
  - `snapshotId`: the ID of the snapshot job.
- **Responses:**
  - `200 OK`: Job pending.
    - Body: (`SnapshotResult` from `src/types/api.ts`)
      ```json
      {
        "snapshotId": "string (name used in request)",
        "status": "pending",
        "progress": {
          "pagesCrawled": "integer",
          "estimatedTotalPages": "integer (optional)"
        }
      }
      ```
  - `200 OK`: Job complete - success.
    - Body: (`SnapshotResult` from `src/types/api.ts`)
      ```json
      {
        "status": "success",
        "snapshotId": "string (name used in request)",
        "timestamp": "string (ISO 8601 datetime)",
        "baseUrl": "string (url)",
        "pageCount": "integer",
        "errors": [
          {
            "url": "string (url)",
            "message": "string",
            "code": "string (optional, http status code)"
          }
        ],
        "metadata": {
          "crawlSettings": {
            // CrawlerConfig object
            // ...
          },
          "duration": "integer (milliseconds)"
        },
        "urlList": [
          "string (url)"
          // ...
        ]
      }
      ```
  - `200 OK`: Job complete - failed.
    - Body: (`SnapshotResult` from `src/types/api.ts`)
      ```json
      {
        "snapshotId": "string (name from request)",
        "status": "failed",
        "message": "Snapshot creation failed.",
        "errors": [
          // Detailed errors that caused the failure
          {
            "url": "string (optional)",
            "message": "string",
            "code": "string (optional)"
          }
        ]
      }
      ```
  - `404 Not Found`: Snapshot with the given ID does not exist.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving status.
    - Body: `ErrorResponse`

### 3.3 List Snapshots

- **Endpoint:** `GET /snapshots`
- **Description:** Retrieves a list of all available snapshots. Pending or error snapshots omitted.
- **Request Query Parameters:** None
- **Responses:**
  - `200 OK`: Successfully retrieved the list of snapshots.
    - Body: Array of `SnapshotSummary` objects
      ```json
      [
        {
          "name": "string (snapshot_identifier)",
          "date": "string (ISO 8601 datetime, from snapshot metadata)",
          "pageCount": "integer",
          "errorCount": "integer" // Based on TODO: Track error count
        }
        // ... more snapshots
      ]
      ```
  - `500 Internal Server Error`: Error retrieving snapshots.
    - Body: `ErrorResponse`

### 3.4 Get Snapshot Details (Conceptual - based on PRD `getSnapshotDetails`)

- **Endpoint:** `GET /snapshots/{snapshotId}`
- **Description:** Retrieves detailed information about a specific snapshot, including its metadata and index.
- **Path Parameters:**
  - `snapshotId`: The identifier of the snapshot.
- **Responses:**
  - `200 OK`: Successfully retrieved snapshot details.
    - Body: (Combines `SnapshotMetadata` and `SnapshotIndex` concepts)
      ```json
      {
        "metadata": {
          // SnapshotMetadata from src/core/snapshot/index.ts
          "baseUrl": "string (url)",
          "timestamp": "string (ISO 8601 datetime)",
          "crawlSettings": {
            // CrawlerConfig object
            // ...
          }
          // Potentially add errorCount here if persisted
        },
        "index": {
          // SnapshotIndex from src/types/snapshot.ts
          "urls": {
            "[http://example.com/page1](http://example.com/page1)": {
              "filename": "base64encoded_url.json.gz",
              "statusCode": 200,
              "finalUrl": "[http://example.com/page1](http://example.com/page1)",
              "pageTitle": "Page 1 Title"
            }
            // ... other urls
          },
          "metadata": {
            "baseUrl": "string (url)",
            "timestamp": "string (ISO 8601 datetime)",
            "totalPages": "integer"
          }
        }
      }
      ```
  - `404 Not Found`: Snapshot with the given ID does not exist.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving snapshot details.
    - Body: `ErrorResponse`

### 3.5 Get Snapshot Page Content

- **Endpoint:** `GET /snapshots/{snapshotId}/pages`
- **Description:** Retrieves the captured data for a specific page within a snapshot.
- **Path Parameters:**
  - `snapshotId`: The identifier of the snapshot.
- **Query Parameters:**
  - `url`: `string` (URL-encoded full URL of the page to retrieve).
- **Responses:**
  - `200 OK`: Successfully retrieved the page snapshot data.
    - Body: `PageSnapshotData` (see 2.3)
  - `400 Bad Request`: Missing or invalid `url` parameter.
    - Body: `ErrorResponse`
  - `404 Not Found`: Snapshot ID not found or page URL not found within the snapshot.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving page data.
    - Body: `ErrorResponse`

### 3.6 Get Snapshot URL List

- **Endpoint:** `GET /snapshots/{snapshotId}/url-list`
- **Description:** Retrieves the content of the generated URL list for a snapshot, if one was created.
- **Path Parameters:**
  - `snapshotId`: The identifier of the snapshot.
- **Responses:**
  - `200 OK`: Successfully retrieved the URL list.
    - Content-Type: `text/plain`
    - Body: A plain text list of URLs, one per line.
  - `404 Not Found`: Snapshot ID not found or URL list not generated for this snapshot.
    - Body: `ErrorResponse` (JSON)
  - `500 Internal Server Error`: Error retrieving URL list.
    - Body: `ErrorResponse` (JSON)

## 4. Comparisons API

Resource: `/comparisons`

Manages comparisons between two snapshots. Adopts an asynchronous pattern for potentially long-running full comparisons.

### 4.1 Initiate Comparison

- **Endpoint:** `POST /comparisons`
- **Description:** Initiates an asynchronous comparison between two snapshots.
- **Request Body:** (`ComparisonConfig` - to be formally defined, example below)
  ```json
  {
    "beforeSnapshotId": "string",
    "afterSnapshotId": "string",
    "rules": [
      // Rule[] object (see 2.4) (optional)
      // ... rules
    ],
    "urlsToCompare": [
      "string (url)",
      "... (optional, specific URLs to limit comparison to)"
    ]
  }
  ```
- **Responses:**
  - `202 Accepted`: Comparison job accepted and initiated.
    - Headers:
      - `Location`: `/api/v1/comparisons/{comparisonId}` (URL to the newly created comparison resource)
    - Body:
      ```json
      {
        "comparisonId": "string (unique ID for this comparison job)",
        "status": "pending", // Or "processing"
        "message": "Comparison job initiated."
      }
      ```
  - `400 Bad Request`: Invalid request payload (e.g., missing IDs, invalid rules format).
    - Body: `ErrorResponse`
  - `404 Not Found`: One or both Snapshot IDs not found.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error initiating comparison job.
    - Body: `ErrorResponse`

### 4.2 Get Comparison Status

- **Endpoint:** `GET /comparisons/{comparisonId}/status`
- **Description:** Retrieves the current status of a comparison job.
- **Path Parameters:**
  - `comparisonId`: The ID of the comparison job.
- **Responses:**
  - `200 OK`: Status retrieved.
    - Body:
      ```json
      {
        "comparisonId": "string",
        "status": "\"pending\" | \"processing\" | \"completed\" | \"failed\"",
        "progress": {
          // Optional, might not be available for all stages
          "processedPages": "integer",
          "totalPages": "integer"
        },
        "startTime": "string (ISO 8601 datetime, optional)",
        "endTime": "string (ISO 8601 datetime, optional, if completed/failed)"
      }
      ```
  - `404 Not Found`: Comparison job with the given ID does not exist.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving status.
    - Body: `ErrorResponse`

### 4.3 Get Comparison Summary

- **Endpoint:** `GET /comparisons/{comparisonId}/summary`
- **Description:** Retrieves a summary of a completed comparison job. Intended for quick checks, like automated testing pass/fail.
- **Path Parameters:**
  - `comparisonId`: The ID of the comparison job.
- **Responses:**
  - `200 OK`: Summary retrieved. (Requires comparison job status to be "completed")
    - Body: (Structure based on `SnapshotDiff` from `src/types/compare.ts` and aspects of `ComparisonResult` from `src/types/api.ts`)
      ```json
      {
        "comparisonId": "string",
        "status": "\"completed\" | \"failed\"", // Reflects the outcome
        "overallResult": "\"pass\" | \"fail\"", // 'pass' if no differences after rules, 'fail' otherwise
        "beforeSnapshotId": "string",
        "afterSnapshotId": "string",
        "timestamp": "string (ISO 8601 datetime of completion)",
        "durationMs": "integer", // Duration of the comparison processing
        "totalPagesCompared": "integer",
        "pagesWithDifferences": "integer",
        "newUrls": ["string (url)", "..."],
        "removedUrls": ["string (url)", "..."],
        "errors": [
          // Errors encountered *during* the comparison process itself
          {
            "url": "string (optional, if error is page-specific)",
            "message": "string",
            "code": "string (optional)"
          }
        ]
      }
      ```
  - `404 Not Found`: Comparison job with the given ID does not exist.
    - Body: `ErrorResponse`
  - `409 Conflict` (or similar): Comparison job is not yet completed. Client should check status first.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving summary.
    - Body: `ErrorResponse`

### 4.4 List Page Differences

- **Endpoint:** `GET /comparisons/{comparisonId}/pagediffs`
- **Description:** Retrieves a list of pages that were part of the comparison, typically filtered to show pages with differences. Intended for interactive investigation.
- **Path Parameters:**
  - `comparisonId`: The ID of the comparison job.
- **Query Parameters:**
  - `filter`: `string (optional)` (e.g., `"hasDifferences"`, `"all"`) - default might be `"hasDifferences"`
  - `page`: `integer (optional, for pagination)` - default `1`
  - `pageSize`: `integer (optional, for pagination)` - default `50`
- **Responses:**
  - `200 OK`: List of page differences retrieved. (Requires comparison job status to be "completed")
    - Body:
      ```json
      {
        "comparisonId": "string",
        "pagination": {
          "currentPage": "integer",
          "pageSize": "integer",
          "totalPages": "integer",
          "totalItems": "integer"
        },
        "items": [
          // Array of PageDiffSummary objects
          {
            "url": "string (url)",
            "hasDifferences": "boolean",
            "differenceCount": "integer (optional)", // Number of distinct diff blocks
            "status": "\"changed\" | \"new\" | \"removed\" | \"unchanged\"" // Relative to the comparison
            // Potentially a very small snippet of a key difference if feasible
          }
          // ... more items
        ]
      }
      ```
  - `404 Not Found`: Comparison job with the given ID does not exist.
    - Body: `ErrorResponse`
  - `409 Conflict`: Comparison job is not yet completed.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving page differences list.
    - Body: `ErrorResponse`

### 4.5 Get Detailed Page Difference

- **Endpoint:** `GET /comparisons/{comparisonId}/pagediffs/{encodedPageUrl}`
- **Description:** Retrieves the detailed comparison (diffs) for a specific page from a completed comparison job.
- **Path Parameters:**
  - `comparisonId`: The ID of the comparison job.
  - `encodedPageUrl`: The URL-encoded full URL of the page.
- **Responses:**
  - `200 OK`: Detailed page difference retrieved. (Requires comparison job status to be "completed")
    - Body: (`PageDiff` structure from `src/types/compare.ts`, where `differences` are `LineDiff` objects or a more structured representation if transformed, e.g. similar to `ComparisonResult.differences[n].differences` from `src/types/api.ts` but for a single page)
      ```json
      {
        "url": "string (url)",
        "hasDifferences": "boolean",
        "differences": [
          // Array of structured diff objects
          // Option A: LineDiff[] (raw, from `diff` package's Change object)
          {
            "count": "integer",
            "value": "string (diff text)",
            "added": "boolean (optional)",
            "removed": "boolean (optional)"
          }
          // Option B: Transformed, more semantic diffs (preferred for API clients)
          // This should align with the 'differences' array in the API's ComparisonResult type
          // {
          //   "type": "\"element\" | \"attribute\" | \"content\"",
          //   "selector": "string (css or xpath)",
          //   "before": "string (optional, content before)",
          //   "after": "string (optional, content after)",
          //   "message": "string (description of change)"
          // }
        ],
        "newContent": "string (optional, full content of page in 'after' snapshot if page is new)",
        "removedContent": "string (optional, full content of page in 'before' snapshot if page is removed in 'after')"
      }
      ```
      _(Decision needed on the structure of `differences` array. Option B is generally more useful for API consumers than raw LineDiffs)._
  - `404 Not Found`: Comparison job ID not found, or page URL not part of this comparison / not found.
    - Body: `ErrorResponse`
  - `409 Conflict`: Comparison job is not yet completed.
    - Body: `ErrorResponse`
  - `500 Internal Server Error`: Error retrieving detailed page difference.
    - Body: `ErrorResponse`

## 5\. Future Considerations

- **Rules Management API:** Endpoints to create, read, update, and delete rule sets.
- **Webhook Notifications:** For completed comparison jobs.
- **More Sophisticated Querying/Filtering:** For snapshots and comparison results.
