export type UrlPathIssue =
  | {
      type: "manifest";
      message: string;
    }
  | {
      type: "base";
      value: string;
      message: string;
    }
  | {
      type: "entry";
      index: number;
      value: string;
      message: string;
    };

export interface UrlPathResolution {
  paths: string[];
  issues: UrlPathIssue[];
}

const ROOT_RELATIVE_PATH_MESSAGE =
  "Path must be root-relative and begin with exactly one '/'";

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function toPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveUrlPaths(
  baseUrl: string,
  paths: readonly string[],
): UrlPathResolution {
  const issues: UrlPathIssue[] = [];
  const resolvedPaths: string[] = [];
  const seenUrls = new Set<string>();

  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return {
      paths: [],
      issues: [
        {
          type: "base",
          value: baseUrl,
          message: "Base URL must be a valid HTTP(S) URL",
        },
      ],
    };
  }

  if (!isHttpUrl(base)) {
    return {
      paths: [],
      issues: [
        {
          type: "base",
          value: baseUrl,
          message: "Base URL must be a valid HTTP(S) URL",
        },
      ],
    };
  }

  if (paths.length === 0) {
    issues.push({
      type: "manifest",
      message: "URL manifest must contain at least one path",
    });
  }

  paths.forEach((path, index) => {
    const value = path.trim();

    if (value === "" || !value.startsWith("/") || value.startsWith("//")) {
      issues.push({
        type: "entry",
        index,
        value: path,
        message: value.startsWith("//")
          ? "Cross-origin or scheme-relative paths are not allowed"
          : ROOT_RELATIVE_PATH_MESSAGE,
      });
      return;
    }

    if (/\s/.test(value)) {
      issues.push({
        type: "entry",
        index,
        value: path,
        message: "Path must not contain whitespace",
      });
      return;
    }

    if (value.includes("\\")) {
      issues.push({
        type: "entry",
        index,
        value: path,
        message: ROOT_RELATIVE_PATH_MESSAGE,
      });
      return;
    }

    if (/%(?![0-9A-Fa-f]{2})/.test(value)) {
      issues.push({
        type: "entry",
        index,
        value: path,
        message: "Path contains an invalid percent escape",
      });
      return;
    }

    try {
      const url = new URL(value, base);
      if (!isHttpUrl(url) || url.origin !== base.origin) {
        issues.push({
          type: "entry",
          index,
          value: path,
          message: "Cross-origin paths are not allowed",
        });
        return;
      }

      if (!seenUrls.has(url.href)) {
        seenUrls.add(url.href);
        resolvedPaths.push(toPath(url));
      }
    } catch {
      issues.push({
        type: "entry",
        index,
        value: path,
        message: "Path is not a valid URL path",
      });
    }
  });

  return { paths: resolvedPaths, issues };
}
