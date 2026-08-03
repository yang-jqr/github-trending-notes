// 共享搜索逻辑：tokenize、TF-IDF 余弦、字段加权评分、snippet 高亮。
// 被 components/Search.tsx（下拉框）和 app/search/page.tsx（搜索页）复用。

export interface SearchDoc {
  slug: string;
  date: string;
  repos: string[];
  repoNames: string[];
  langs: string[];
  content: string;
  tf: [number, number][];
}

export interface SearchIndex {
  vocab: string[];
  idf: Record<string, number>;
  docs: SearchDoc[];
}

// ─── Tokenization (same as build script) ────────────────────────
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const words = text.toLowerCase().match(/[a-z]{2,}|[a-z][a-z0-9]+/g) || [];
  tokens.push(...words);
  const chinese = text.match(/[一-鿿]/g);
  if (chinese) {
    for (let i = 0; i < chinese.length - 1; i++) {
      tokens.push(chinese[i] + chinese[i + 1]);
    }
    tokens.push(...chinese);
  }
  return tokens;
}

// ─── TF-IDF cosine similarity ───────────────────────────────────
function tfidfSimilarity(
  queryVec: Map<number, number>,
  docTf: [number, number][],
  idf: Record<string, number>,
  vocab: string[],
): number {
  let dot = 0;
  let docMagSq = 0;
  for (const [ti, tf] of docTf) {
    const term = vocab[ti];
    if (!term) continue;
    const weight = tf * (idf[term] || 0);
    docMagSq += weight * weight;
    const qw = queryVec.get(ti);
    if (qw !== undefined) dot += qw * weight;
  }
  if (docMagSq === 0) return 0;
  let qMagSq = 0;
  for (const w of queryVec.values()) qMagSq += w * w;
  return qMagSq === 0 ? 0 : dot / (Math.sqrt(qMagSq) * Math.sqrt(docMagSq));
}

// ─── Field-weighted scoring ─────────────────────────────────────
// 分数 = 内容 TF-IDF + repo 名精确/子串匹配 + 语言匹配 + 日期匹配。
// repo/语言/日期是结构化字段，命中权重高于正文，解决"搜 repo 名排错"。

function queryTokens(query: string): string[] {
  return tokenize(query.toLowerCase().trim()).filter(t => t.length > 0);
}

function scoreRepos(doc: SearchDoc, tokens: string[]): number {
  let score = 0;
  const full = doc.repos.map(r => r.toLowerCase());
  const short = doc.repoNames.map(r => r.toLowerCase());
  for (const t of tokens) {
    if (full.includes(t)) score += 2.0;
    else if (short.includes(t)) score += 2.0;
    else if (full.some(r => r.includes(t))) score += 0.8;
    else if (short.some(r => r.includes(t))) score += 0.8;
  }
  return score;
}

function scoreLangs(doc: SearchDoc, tokens: string[]): number {
  const langs = doc.langs.map(l => l.toLowerCase());
  let score = 0;
  for (const t of tokens) {
    if (langs.includes(t)) score += 1.5;
  }
  return score;
}

function scoreDate(doc: SearchDoc, rawQuery: string, tokens: string[]): number {
  const date = doc.date;
  if (!date) return 0;
  const q = rawQuery.toLowerCase();
  if (q === date) return 2.0;
  if (date.startsWith(q)) return 1.5;   // "2026-08" → 当月笔记
  for (const t of tokens) {
    if (date.startsWith(t)) return 1.5;
  }
  return 0;
}

export function scoreDoc(doc: SearchDoc, rawQuery: string, termMap: Map<string, number>, idf: Record<string, number>, vocab: string[]): number {
  const q = rawQuery.trim();
  if (!q) return 0;
  const tokens = queryTokens(q);

  // 日期前缀类查询（如 "2026-08"）分词结果为空，但能匹配 date 字段
  const dateScore = scoreDate(doc, q, tokens);
  if (tokens.length === 0) return dateScore;

  // 内容 TF-IDF
  const queryVec = new Map<number, number>();
  for (const t of tokens) {
    const ti = termMap.get(t);
    if (ti === undefined) continue;
    queryVec.set(ti, (queryVec.get(ti) || 0) + 1);
  }
  for (const [ti, tf] of queryVec) {
    const term = vocab[ti];
    queryVec.set(ti, tf * (idf[term] || 0));
  }
  const contentScore = tfidfSimilarity(queryVec, doc.tf, idf, vocab);

  return contentScore + scoreRepos(doc, tokens) + scoreLangs(doc, tokens) + dateScore;
}

export function searchPosts(index: SearchIndex, query: string): SearchDoc[] {
  const q = query.trim();
  if (!q) return [];
  const termMap = new Map<string, number>();
  index.vocab.forEach((t, i) => termMap.set(t, i));
  return index.docs
    .map(doc => ({ doc, score: scoreDoc(doc, q, termMap, index.idf, index.vocab) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.doc);
}

// ─── Snippet extraction ─────────────────────────────────────────
export function getSnippet(content: string, query: string, maxLen = 120): string {
  const lower = content.toLowerCase();
  // try each query word, find first match
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let bestIdx = -1;
  let bestWord = '';
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i !== -1 && (bestIdx === -1 || i < bestIdx)) {
      bestIdx = i;
      bestWord = w;
    }
  }
  if (bestIdx === -1) return content.slice(0, maxLen);
  const start = Math.max(0, bestIdx - 40);
  const end = Math.min(content.length, bestIdx + bestWord.length + 80);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < content.length) snippet += '…';
  return snippet;
}

/** 返回 <mark> 包裹的 HTML snippet（用于 dangerouslySetInnerHTML） */
export function highlightSnippet(snippet: string, query: string): string {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 0) return snippet;
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return snippet.replace(re, '<mark class="bg-yellow-500/30 text-[#f0f6fc] rounded px-0.5">$1</mark>');
}

/** 高亮词列表：query 中能命中 content 的词（含中文单字补全），供结果卡片做纯文本高亮标记 */
export function highlightWords(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const all = [...words];
  // 补全中文单字：把单字补成可能出现的双字 bigram
  const singles = query.match(/[一-鿿]/g) || [];
  for (let i = 0; i < singles.length - 1; i++) all.push(singles[i] + singles[i + 1]);
  return all.filter(w => w.length >= 2);
}
