export interface SearchIndex {
  repositories: string[];
}

function rankRepository(name: string, query: string): number {
  const full = name.toLowerCase();
  const short = full.split('/').pop() || full;
  if (full === query || short === query) return 0;
  if (full.startsWith(query) || short.startsWith(query)) return 1;
  return 2;
}

/** Search the build-time de-duplicated repository directory. */
export function searchRepositories(index: SearchIndex, rawQuery: string, limit?: number): string[] {
  const query = rawQuery.trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  const matches = query
    ? index.repositories.filter(name => words.every(word => name.toLowerCase().includes(word)))
    : index.repositories;

  const sorted = query
    ? [...matches].sort((a, b) => rankRepository(a, query) - rankRepository(b, query) || a.localeCompare(b))
    : matches;

  return limit === undefined ? sorted : sorted.slice(0, limit);
}
