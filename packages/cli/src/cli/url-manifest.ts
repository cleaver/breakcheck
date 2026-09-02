import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolveUrlPaths, type UrlPathIssue } from "@cleaver/breakcheck-core";

export type UrlManifestIssue =
  | {
      type: "manifest";
      source: string;
      message: string;
    }
  | {
      type: "entry";
      source: string;
      line: number;
      value: string;
      message: string;
    };

export interface UrlManifestParseResult {
  paths: string[];
  issues: UrlManifestIssue[];
}

export async function readUrlManifest(
  source: string,
  stdin: Readable = process.stdin,
): Promise<string> {
  try {
    if (source !== "-") {
      return await readFile(source, "utf8");
    }

    stdin.setEncoding("utf8");
    const chunks: string[] = [];
    const input: AsyncIterable<unknown> = stdin;

    for await (const chunk of input) {
      if (typeof chunk === "string") {
        chunks.push(chunk);
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk).toString("utf8"));
      } else {
        throw new Error("stdin produced a non-text chunk");
      }
    }

    return chunks.join("");
  } catch (error) {
    const sourceLabel = source === "-" ? "stdin" : source;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to read URL manifest from ${sourceLabel}: ${message}`,
      {
        cause: error,
      },
    );
  }
}

export function parseUrlManifest(
  content: string,
  baseUrl: string,
  source: string,
): UrlManifestParseResult {
  const entries = content
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, value: line.trim() }))
    .filter(({ value }) => value !== "" && !value.startsWith("#"));

  const resolution = resolveUrlPaths(
    baseUrl,
    entries.map(({ value }) => value),
  );

  const issues = resolution.issues.map((issue) =>
    toManifestIssue(issue, entries, source),
  );

  return {
    paths: resolution.paths,
    issues,
  };
}

function toManifestIssue(
  issue: UrlPathIssue,
  entries: Array<{ line: number; value: string }>,
  source: string,
): UrlManifestIssue {
  if (issue.type === "entry") {
    const entry = entries[issue.index];
    return {
      type: "entry",
      source,
      line: entry?.line ?? issue.index + 1,
      value: entry?.value ?? issue.value,
      message: issue.message,
    };
  }

  return {
    type: "manifest",
    source,
    message:
      issue.type === "base"
        ? `${issue.message}: ${issue.value}`
        : issue.message,
  };
}
