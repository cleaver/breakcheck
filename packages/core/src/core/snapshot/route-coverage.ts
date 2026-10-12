import type { LoadedSnapshot } from "./classes/LoadedSnapshot.js";

/** Returns route and page-count problems found in a captured snapshot. */
export async function validateSnapshotRoutes(
  snapshot: LoadedSnapshot,
  routes: readonly string[],
): Promise<string[]> {
  const failures: string[] = [];
  for (const route of routes) {
    const page = await snapshot.getPage(route);
    if (!page) {
      failures.push(`The crawl did not capture route "${route}".`);
    } else if (page.statusCode < 200 || page.statusCode >= 400) {
      failures.push(`Route "${route}" returned HTTP ${page.statusCode}.`);
    }
  }
  if (snapshot.index.metadata.totalPages !== routes.length) {
    failures.push(
      `Expected ${routes.length} route(s), but captured ${snapshot.index.metadata.totalPages}.`,
    );
  }
  return failures;
}
