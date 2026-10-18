import { CONCEPTS, GENERIC_SURFACES, STOPWORDS } from './search-concepts';

export interface SearchRepository {
  name: string;
  description: string;
  slug: string;
  date: string;
  language: string;
  stars: number;
  dates: string[];
  languages: string[];
  appearances: number;
  searchText: string;
}

export interface SearchIndex {
  version: number;
  repositories: SearchRepository[];
}

export interface QueryInterpretation {
  /** 被识别出的检索概念（已合并同义词），用于界面展示「理解为：…」。 */
  concepts: string[];
  language: string;
  date: string;
  repository: string;
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

const K1 = 1.2;
const B = 0.75;
const MAX_SYNONYMS = 4;
/** 先多收候选同义词，再由 pruneSynonyms 按「够具体」筛到 MAX_SYNONYMS 个。 */
const MAX_SYNONYM_CANDIDATES = 12;

interface FormEntry {
  text: string;
  primary: boolean;
}

interface TermGroup {
  label: string;
  weight: number;
  forms: FormEntry[];
}

interface ParsedQuery {
  groups: TermGroup[];
  language: string;
  date: string;
  repository: string;
}

// ---- 词表索引（模块级只构建一次） ----

const surfaceToConcept = new Map<string, string>();
const conceptForms = new Map<string, string[]>();
const compounds = new Set<string>();
const stopwords = new Set(STOPWORDS.map(word => word.toLowerCase()));
const genericSurfaces = new Set(GENERIC_SURFACES.map(word => word.toLowerCase()));

for (const [label, forms] of Object.entries(CONCEPTS)) {
  conceptForms.set(label, forms);
  for (const form of forms) {
    const key = form.toLowerCase();
    surfaceToConcept.set(key, label);
    if (key.length >= 2) compounds.add(key);
  }
}

// ---- 分词 ----

interface WordSegmenter {
  segment(input: string): Iterable<{ segment: string; isWordLike?: boolean }>;
}

type SegmenterConstructor = new (locale: string, options: { granularity: 'word' }) => WordSegmenter;

const SegmenterCtor = (Intl as unknown as { Segmenter?: SegmenterConstructor }).Segmenter;
let segmenter: WordSegmenter | null | undefined;

function getSegmenter(): WordSegmenter | null {
  if (segmenter === undefined) {
    try {
      segmenter = SegmenterCtor ? new SegmenterCtor('zh', { granularity: 'word' }) : null;
    } catch {
      segmenter = null;
    }
  }
  return segmenter;
}

/** 查询切词：Intl.Segmenter（浏览器/Node 内置）优先，老浏览器回退到「拉丁词 + CJK 双字」。 */
function segmentWords(input: string): string[] {
  const text = input.toLowerCase();
  const engine = getSegmenter();
  const words: string[] = [];
  if (engine) {
    for (const part of engine.segment(text)) {
      if (part.isWordLike === false) continue;
      const word = part.segment.trim();
      if (word) words.push(word);
    }
    return words;
  }
  for (const block of text.match(/[a-z0-9]+|[\u3400-\u9fff]+/g) ?? []) {
    if (/^[a-z0-9]+$/.test(block)) {
      words.push(block);
      continue;
    }
    for (let i = 0; i < block.length; i += 2) words.push(block.slice(i, i + 2));
  }
  return words;
}

/**
 * 把分词器切碎的固定搭配重新拼回来：开源 → 开 + 源、低代码 → 低 + 代码。
 * 只在候选串是词表里的多字 surface 时才合并，最长匹配优先。
 */
function mergeCompounds(words: string[]): string[] {
  const merged: string[] = [];
  let cursor = 0;
  while (cursor < words.length) {
    let hit = '';
    for (let length = Math.min(4, words.length - cursor); length >= 2; length--) {
      const candidate = words.slice(cursor, cursor + length).join('');
      if (compounds.has(candidate)) {
        hit = candidate;
        cursor += length;
        break;
      }
    }
    if (hit) {
      merged.push(hit);
      continue;
    }
    merged.push(words[cursor]);
    cursor += 1;
  }
  return merged;
}

const normalize = (value: string) => value.trim().toLowerCase();

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

  const groups: TermGroup[] = [];
  const seen = new Set<string>();
  const expandedConcepts = new Set<string>();
  for (const word of mergeCompounds(segmentWords(remaining))) {
    if (!word || stopwords.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    const concept = surfaceToConcept.get(word);
    // 单个汉字只有落在词表里才有检索价值（「库」「税」这类直接丢）
    if (word.length === 1 && !concept) continue;
    // 同一表面形式只保留一次；不同表面形式即使用同一个概念也各自成组，
    // 这样「股票 量化」不会因为同属一个概念而丢掉一个词。
    if (seen.has(word)) continue;
    seen.add(word);

    // 同一概念只展开一次同义词：否则「股票 量化」里两个组都会展开「交易」，
    // 同一处正文被重复计分，会把真正的量化项目挤下去。
    const allowSynonyms = concept !== undefined && !expandedConcepts.has(concept);
    if (concept) expandedConcepts.add(concept);
    const synonyms = allowSynonyms
      ? (conceptForms.get(concept as string) ?? []).filter(form => form.toLowerCase() !== word).slice(0, MAX_SYNONYM_CANDIDATES)
      : [];
    const group: TermGroup = {
      label: concept ?? word,
      weight: concept ? 1 : genericSurfaces.has(word) ? 0.3 : 1,
      forms: [{ text: word, primary: true }, ...synonyms.map(text => ({ text: text.toLowerCase(), primary: false }))],
    };
    groups.push(group);
  }

  return { groups, ...fields };
}

/** 概念同义词太泛时会拉进大量噪声（如「采集」），按文档频率砍掉高频同义词，只留具体的。 */
function pruneSynonyms(groups: TermGroup[], data: IndexData): TermGroup[] {
  const total = data.docs.length;
  for (const group of groups) {
    const [primary, ...candidates] = group.forms;
    group.forms = [primary, ...candidates
      .filter(form => {
        const frequency = documentFrequency(data, form.text);
        return frequency > 0 && frequency <= total * 0.2;
      })
      .slice(0, MAX_SYNONYMS)];
  }
  return groups;
}

// ---- 文档侧 ----

interface DocEntry {
  repository: SearchRepository;
  haystack: string;
  name: string;
  description: string;
  length: number;
}

interface IndexData {
  docs: DocEntry[];
  averageLength: number;
  documentFrequencies: Map<string, number>;
}

const indexDataCache = new WeakMap<SearchIndex, IndexData>();

function getIndexData(index: SearchIndex): IndexData {
  const cached = indexDataCache.get(index);
  if (cached) return cached;
  const docs = index.repositories.map(repository => ({
    repository,
    haystack: repository.searchText,
    name: repository.name.toLowerCase(),
    description: repository.description.toLowerCase(),
    length: repository.searchText.length,
  }));
  const averageLength = Math.max(docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(docs.length, 1), 1);
  const data: IndexData = { docs, averageLength, documentFrequencies: new Map() };
  indexDataCache.set(index, data);
  return data;
}

/** 某表面形式出现在多少条仓库里；按索引缓存，打字过程中反复查询不重复扫描。 */
function documentFrequency(data: IndexData, form: string): number {
  const cached = data.documentFrequencies.get(form);
  if (cached !== undefined) return cached;
  let count = 0;
  for (const doc of data.docs) if (doc.haystack.includes(form)) count += 1;
  data.documentFrequencies.set(form, count);
  return count;
}

function idf(data: IndexData, form: string): number {
  const total = data.docs.length;
  const frequency = documentFrequency(data, form);
  return Math.log(1 + (total - frequency + 0.5) / (frequency + 0.5));
}

/** 子串出现次数。中文没有空格，词频只能靠子串计数近似。 */
function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let position = haystack.indexOf(needle);
  while (position !== -1) {
    count += 1;
    position = haystack.indexOf(needle, position + needle.length);
  }
  return count;
}

/**
 * 召回门槛：只需命中最具判别力（df ≤ 20%）的词中的任意一个；判别力靠 BM25 的 IDF 排序。
 * 旧实现要求「所有词都出现在正文里」，正是中文长句直接 0 命中的根因。
 */
function passesGate(doc: DocEntry, groups: TermGroup[], data: IndexData): boolean {
  const total = data.docs.length;
  let strongTotal = 0;
  let matchedStrong = 0;
  for (const group of groups) {
    const primaryDf = documentFrequency(data, group.forms[0].text);
    if (primaryDf > total * 0.2) continue;
    strongTotal += 1;
    const matched = group.forms.some((form, index) => {
      if (!doc.haystack.includes(form.text)) return false;
      // 同义词只有在足够具体（df ≤ 10%）时才算命中，避免「抓取 / 采集」这类高频词混过门槛
      return index === 0 || documentFrequency(data, form.text) <= total * 0.1;
    });
    if (matched) matchedStrong += 1;
  }
  if (strongTotal === 0) return groups.some(group => group.forms.some(form => doc.haystack.includes(form.text)));
  return matchedStrong >= 1;
}

/** BM25（字段加权：仓库名 2.2×，简介 1.4×，其余正文 1×）。 */
function scoreDocument(doc: DocEntry, groups: TermGroup[], data: IndexData): number {
  let total = 0;
  let matched = 0;
  for (const group of groups) {
    let groupHit = false;
    for (const form of group.forms) {
      const body = occurrences(doc.haystack, form.text);
      if (body === 0) continue;
      groupHit = true;
      const name = occurrences(doc.name, form.text);
      const description = Math.min(occurrences(doc.description, form.text), body);
      const weightedTf = body + name * 2.2 + description * 1.4;
      const saturation = (weightedTf * (K1 + 1)) / (weightedTf + K1 * (1 - B + (B * doc.length) / data.averageLength));
      total += group.weight * (form.primary ? 1 : 0.4) * idf(data, form.text) * saturation;
    }
    if (groupHit) matched += 1;
  }
  if (matched === 0) return 0;
  // 覆盖率加成：全部概念都命中的文档优先于只命中一个的
  const coverage = matched / groups.length;
  return total * (0.7 + 0.3 * coverage);
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

function matchesFilters(repository: SearchRepository, query: ParsedQuery): boolean {
  if (query.language && !repository.languages.map(normalize).some(language => language.includes(query.language))) return false;
  if (query.date && !repository.dates.some(date => date.startsWith(query.date))) return false;
  if (query.repository && !normalize(repository.name).includes(query.repository)) return false;
  return true;
}

/** 搜索唯一仓库：中文分词 + 同义概念扩展 + BM25 排序，支持 语言:/日期:/仓库: 过滤。 */
export function searchRepositories(index: SearchIndex, rawQuery: string, limit?: number): SearchRepository[] {
  const query = parseQuery(rawQuery);
  const hasQuery = Boolean(query.groups.length || query.language || query.date || query.repository);
  if (!hasQuery) return limit === undefined ? index.repositories : index.repositories.slice(0, limit);

  const data = getIndexData(index);
  const groups = pruneSynonyms(query.groups, data);
  const ranked: RankedRepository[] = [];
  for (const doc of data.docs) {
    if (!matchesFilters(doc.repository, query)) continue;
    if (groups.length > 0) {
      if (!passesGate(doc, groups, data)) continue;
    }
    const score = groups.length > 0 ? scoreDocument(doc, groups, data) : 0;
    if (limit === undefined) {
      ranked.push({ repository: doc.repository, score });
      continue;
    }
    const candidate = { repository: doc.repository, score };
    const position = ranked.findIndex(current => compareRanked(candidate, current) < 0);
    if (position >= 0) ranked.splice(position, 0, candidate);
    else if (ranked.length < limit) ranked.push(candidate);
    if (ranked.length > limit) ranked.pop();
  }

  if (limit === undefined) ranked.sort(compareRanked);
  return ranked.map(result => result.repository);
}

/** 供界面展示查询理解结果：命中了哪些概念、识别出哪些过滤条件。 */
export function interpretQuery(rawQuery: string): QueryInterpretation {
  const query = parseQuery(rawQuery);
  return {
    concepts: [...new Set(query.groups.map(group => group.label))],
    language: query.language,
    date: query.date,
    repository: query.repository,
  };
}

export function repositoryPostHref(repository: SearchRepository, rawQuery = ''): string {
  const dateFilter = rawQuery ? parseQuery(rawQuery).date : '';
  const matchedDate = dateFilter ? repository.dates.find(date => date.startsWith(dateFilter)) : undefined;
  const slug = matchedDate ? `trending-${matchedDate}` : repository.slug;
  return `/posts/${encodeURIComponent(slug)}?q=${encodeURIComponent(repository.name)}`;
}
