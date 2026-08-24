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
  repositories: SearchRepository[];
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
  const haystack = normalize(repository.searchText);
  if (query.language && !languages.some(language => language.includes(query.language))) return false;
  if (query.date && !repository.dates.some(date => date.startsWith(query.date))) return false;
  if (query.repository && !name.includes(query.repository)) return false;
  return query.terms.every(term => haystack.includes(term));
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
  const results = hasQuery
    ? index.repositories
        .filter(repository => matches(repository, query))
        .map(repository => ({ repository, score: score(repository, query) }))
        .sort((a, b) => b.score - a.score || b.repository.date.localeCompare(a.repository.date) || a.repository.name.localeCompare(b.repository.name))
        .map(result => result.repository)
    : index.repositories;
  return limit === undefined ? results : results.slice(0, limit);
}

export function repositoryPostHref(repository: SearchRepository): string {
  return `/posts/${encodeURIComponent(repository.slug)}?q=${encodeURIComponent(repository.name)}`;
}
