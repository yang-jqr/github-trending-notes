export interface SearchRepository {
  name: string;
  description: string;
  slug: string;
  date: string;
  language: string;
  dates: string[];
  languages: string[];
  appearances: number;
  searchText: string;
}

export interface SearchIndex {
  version: number;
  repositories: SearchRepository[];
}

let searchIndexPromise: Promise<SearchIndex> | null = null;

/** Load the static index only when search is used, and share one request per tab. */
export function loadSearchIndex(): Promise<SearchIndex> {
  if (!searchIndexPromise) {
    searchIndexPromise = fetch('/search-data.json', { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error('搜索数据加载失败');
        return response.json() as Promise<SearchIndex>;
      })
      .catch(error => {
        searchIndexPromise = null;
        throw error;
      });
  }
  return searchIndexPromise;
}

interface ParsedQuery {
  terms: string[];
  language: string;
  date: string;
  repository: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

function parseQuery(rawQuery: string): ParsedQuery {
  const fields = { language: '', date: '', repository: '' };
  const remaining = rawQuery.replace(
    /(?:^|\s)(语言|lang(?:uage)?|日期|date|仓库|repo):(?:"([^"]+)"|(\S+))/gi,
    (_, field: string, quoted: string, plain: string) => {
      const value = normalize(quoted || plain || '');
      if (/^(语言|lang|language)$/i.test(field)) fields.language = value;
      else if (/^(日期|date)$/i.test(field)) fields.date = value;
      else fields.repository = value;
      return ' ';
    },
  );
  const terms = (remaining.match(/"[^"]+"|\S+/g) || []).map(term => normalize(term.replace(/^"|"$/g, ''))).filter(Boolean);
  return { terms, ...fields };
}

function matches(repository: SearchRepository, query: ParsedQuery): boolean {
  const name = normalize(repository.name);
  const languages = repository.languages.map(normalize);
  const haystack = repository.searchText;
  if (query.language && !languages.some(language => language.includes(query.language))) return false;
  if (query.date && !repository.dates.some(date => date.startsWith(query.date))) return false;
  if (query.repository && !name.includes(query.repository)) return false;
  return query.terms.every(term => haystack.includes(term));
}

interface RankedRepository {
  repository: SearchRepository;
  score: number;
}

function compareRanked(a: RankedRepository, b: RankedRepository): number {
  return b.score - a.score
    || b.repository.date.localeCompare(a.repository.date)
    || a.repository.name.localeCompare(b.repository.name);
}

function score(repository: SearchRepository, query: ParsedQuery): number {
  const fullName = normalize(repository.name);
  const shortName = fullName.split('/').pop() || fullName;
  const description = normalize(repository.description);
  let total = 0;
  for (const term of query.terms) {
    if (fullName === term || shortName === term) total += 100;
    else if (fullName.startsWith(term) || shortName.startsWith(term)) total += 70;
    else if (fullName.includes(term)) total += 50;
    else if (description.includes(term)) total += 25;
    else total += 5;
  }
  if (query.repository) total += 80;
  if (query.language) total += 10;
  if (query.date) total += 5;
  return total;
}

/** Search unique repositories across name, intro, language, date and note content. */
export function searchRepositories(index: SearchIndex, rawQuery: string, limit?: number): SearchRepository[] {
  const query = parseQuery(rawQuery);
  const hasQuery = Boolean(query.terms.length || query.language || query.date || query.repository);
  if (!hasQuery) return limit === undefined ? index.repositories : index.repositories.slice(0, limit);

  const ranked: RankedRepository[] = [];
  for (const repository of index.repositories) {
    if (!matches(repository, query)) continue;
    const candidate = { repository, score: score(repository, query) };
    if (limit === undefined) {
      ranked.push(candidate);
      continue;
    }

    const position = ranked.findIndex(current => compareRanked(candidate, current) < 0);
    if (position >= 0) ranked.splice(position, 0, candidate);
    else if (ranked.length < limit) ranked.push(candidate);
    if (ranked.length > limit) ranked.pop();
  }

  if (limit === undefined) ranked.sort(compareRanked);
  return ranked.map(result => result.repository);
}

export function repositoryPostHref(repository: SearchRepository, rawQuery = ''): string {
  const dateFilter = rawQuery ? parseQuery(rawQuery).date : '';
  const matchedDate = dateFilter ? repository.dates.find(date => date.startsWith(dateFilter)) : undefined;
  const slug = matchedDate ? `trending-${matchedDate}` : repository.slug;
  return `/posts/${encodeURIComponent(slug)}?q=${encodeURIComponent(repository.name)}`;
}
