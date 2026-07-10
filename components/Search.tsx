'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────
interface SearchDoc {
  slug: string;
  date: string;
  repos: string[];
  langs: string[];
  content: string;
  tf: [number, number][];
}

interface EmbeddingsData {
  docEmbeddings: number[][];
  tokenEmbeddings: Record<string, number[]>;
}

interface SearchIndex {
  vocab: string[];
  idf: Record<string, number>;
  docs: SearchDoc[];
  embeddings?: EmbeddingsData;
}

// ─── Tokenization (same as build script) ────────────────────────
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const words = text.toLowerCase().match(/[a-z]{2,}|[a-z][a-z0-9]+/g) || [];
  tokens.push(...words);
  const chinese = text.match(/[\u4e00-\u9fff]/g);
  if (chinese) {
    for (let i = 0; i < chinese.length - 1; i++) {
      tokens.push(chinese[i] + chinese[i + 1]);
    }
    tokens.push(...chinese);
  }
  return tokens;
}

// ─── TF-IDF cosine similarity (existing logic) ──────────────────
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

// ─── Embedding cosine similarity ────────────────────────────────
function dotProduct(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d;
}

function composeQueryEmbedding(
  queryTokens: string[],
  tokenEmbeddings: Record<string, number[]>,
  idf: Record<string, number>,
): number[] | null {
  const dim = Object.values(tokenEmbeddings)[0]?.length;
  if (!dim) return null;

  const vec = new Array(dim).fill(0);
  let totalWeight = 0;

  for (const t of queryTokens) {
    const emb = tokenEmbeddings[t];
    if (!emb) continue;
    const w = idf[t] || 1;
    for (let i = 0; i < dim; i++) vec[i] += emb[i] * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return null;
  // L2 normalize
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (mag === 0) return null;
  return vec.map(v => v / mag);
}

// ─── Snippet extraction ─────────────────────────────────────────
function getSnippet(content: string, query: string, maxLen = 120): string {
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

function highlightSnippet(snippet: string, query: string): string {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 0) return snippet;
  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return snippet.replace(re, '<mark class="bg-yellow-500/30 text-[#f0f6fc] rounded px-0.5">$1</mark>');
}

// ─── Component ──────────────────────────────────────────────────
// ponytail: embedding vector dim from build-time model (384 for all-MiniLM-L6-v2)
const EMBEDDING_DIM = 384;

export default function Search() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [termMap, setTermMap] = useState<Map<string, number>>(new Map());
  const [results, setResults] = useState<SearchDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/search-data.json')
      .then(r => r.json())
      .then((data: SearchIndex) => {
        setIndex(data);
        const map = new Map<string, number>();
        data.vocab.forEach((t, i) => map.set(t, i));
        setTermMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim() || !index) {
      setResults([]);
      setOpen(false);
      return;
    }

    const queryTokens = tokenize(query.trim());
    if (queryTokens.length === 0) {
      setResults([]);
      setOpen(false);
      return;
    }

    // ── TF-IDF scoring (always runs, baseline) ──
    const queryVec = new Map<number, number>();
    for (const t of queryTokens) {
      const ti = termMap.get(t);
      if (ti === undefined) continue;
      queryVec.set(ti, (queryVec.get(ti) || 0) + 1);
    }
    for (const [ti, tf] of queryVec) {
      const term = index.vocab[ti];
      queryVec.set(ti, tf * (index.idf[term] || 0));
    }

    const tfidfScores = new Map<string, number>();
    for (const doc of index.docs) {
      const s = tfidfSimilarity(queryVec, doc.tf, index.idf, index.vocab);
      if (s > 0) tfidfScores.set(doc.slug, s);
    }

    // ── Semantic scoring (if embeddings available) ──
    const semScores = new Map<string, number>();
    if (index.embeddings) {
      const queryEmb = composeQueryEmbedding(
        queryTokens,
        index.embeddings.tokenEmbeddings,
        index.idf,
      );
      if (queryEmb) {
        for (let i = 0; i < index.docs.length; i++) {
          const docEmb = index.embeddings.docEmbeddings[i];
          if (!docEmb || docEmb.length !== EMBEDDING_DIM) continue;
          const sim = dotProduct(queryEmb, docEmb); // both already normalized
          if (sim > 0) semScores.set(index.docs[i].slug, sim);
        }
      }
    }

    // ── Hybrid scoring ──
    const scored = index.docs
      .map(doc => {
        const tfidf = tfidfScores.get(doc.slug) || 0;
        const sem = semScores.get(doc.slug) || 0;
        // ponytail: 0.6 semantic + 0.4 tfidf; pure tfidf if no semantic
        const hasSem = semScores.size > 0;
        const score = hasSem ? 0.6 * sem + 0.4 * tfidf : tfidf;
        return { doc, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => s.doc);

    // ── Dedup by repo (slug fallback when repos empty) ──
    const seenRepos = new Set<string>();
    const deduped: SearchDoc[] = [];
    for (const doc of scored) {
      if (doc.repos.length > 0) {
        const fresh = doc.repos.filter(r => !seenRepos.has(r.toLowerCase()));
        if (fresh.length > 0) {
          deduped.push(doc);
          fresh.forEach(r => seenRepos.add(r.toLowerCase()));
        }
      } else {
        // ponytail: no repos extracted → fallback to slug dedup (always unique)
        if (!seenRepos.has(doc.slug)) {
          deduped.push(doc);
          seenRepos.add(doc.slug);
        }
      }
    }
    const final = deduped.slice(0, 10);
    setResults(final);
    setOpen(query.trim().length > 0);
    setSelected(0);
  }, [query, index, termMap]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (open) { setOpen(false); return; }
      setQuery('');
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') {
      if (results[selected]) {
        router.push(`/posts/${encodeURIComponent(results[selected].slug)}?q=${encodeURIComponent(query)}`);
        setOpen(false);
        setQuery('');
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-56 sm:w-72">
      <input
        type="text"
        placeholder="搜索仓库、内容、日期…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        className="w-full px-3 py-1.5 text-sm bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.length > 0 ? results.map((entry, i) => (
            <button
              key={entry.slug}
              onClick={() => {
                router.push(`/posts/${encodeURIComponent(entry.slug)}?q=${encodeURIComponent(query)}`);
                setOpen(false);
                setQuery('');
              }}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-border last:border-0 transition-colors ${
                i === selected ? 'bg-accent/10 text-[#f0f6fc]' : 'text-[#c9d1d9] hover:bg-[#1c2128]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-accent text-xs">{entry.date}</span>
                <span className="text-xs text-muted">{entry.repos.length} repos</span>
                {entry.langs.length > 0 && (
                  <span className="text-xs text-muted">{entry.langs.slice(0, 2).join(' · ')}</span>
                )}
              </div>
              {entry.content && (
                <div
                  className="text-xs text-[#8b949e] leading-relaxed line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: highlightSnippet(getSnippet(entry.content, query), query) }}
                />
              )}
            </button>
          )) : (
            <div className="px-3 py-4 text-sm text-muted text-center">未找到匹配结果</div>
          )}
        </div>
      )}
    </div>
  );
}
