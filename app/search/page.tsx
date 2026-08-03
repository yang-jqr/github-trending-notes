'use client';

import { useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { scoreDoc, getSnippet, highlightSnippet, highlightWords, type SearchDoc, type SearchIndex } from '@/lib/search';

const PAGE_SIZE = 20;

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get('q') || '';
  const lang = searchParams.get('lang') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const sort = searchParams.get('sort') || 'relevance';

  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [input, setInput] = useState(q);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    fetch('/search-data.json')
      .then(r => r.json())
      .then(setIndex)
      .catch(() => {});
  }, []);

  const setParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const s = params.toString();
    router.replace(s ? `/search?${s}` : '/search', { scroll: false });
  }, [searchParams, router]);

  // 输入防抖写回 URL（可分享/可回退）
  useEffect(() => {
    const id = setTimeout(() => {
      if (input === q) return;
      const params = new URLSearchParams(searchParams.toString());
      if (input) params.set('q', input);
      else params.delete('q');
      setVisible(PAGE_SIZE);
      const s = params.toString();
      router.replace(s ? `/search?${s}` : '/search', { scroll: false });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  // 语言过滤下拉选项（来自全量索引 top langs）
  const topLangs = useMemo(() => {
    if (!index) return [];
    const counts = new Map<string, number>();
    for (const d of index.docs) for (const l of d.langs) counts.set(l, (counts.get(l) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([l]) => l);
  }, [index]);

  // 先按 lang/日期范围过滤，再搜索或按日期排序
  const filtered = useMemo(() => {
    if (!index) return [];
    let docs = index.docs;
    if (lang) docs = docs.filter(d => d.langs.includes(lang));
    if (from) docs = docs.filter(d => d.date >= from);
    if (to) docs = docs.filter(d => d.date <= to);
    return docs;
  }, [index, lang, from, to]);

  const results = useMemo(() => {
    if (!index) return [];
    let list: SearchDoc[];
    if (q.trim()) {
      const termMap = new Map<string, number>();
      index.vocab.forEach((t, i) => termMap.set(t, i));
      list = filtered
        .map(doc => ({ doc, score: scoreDoc(doc, q, termMap, index.idf, index.vocab) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(s => s.doc);
      if (sort === 'date') list = [...list].sort((a, b) => b.date.localeCompare(a.date));
    } else {
      list = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    }
    return list;
  }, [index, filtered, q, sort]);

  const shown = results.slice(0, visible);
  const words = highlightWords(q);
  const hasQuery = q.trim().length > 0;

  const repoHit = (name: string) => words.some(w => name.toLowerCase().includes(w));

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-sm text-muted hover:text-accent transition-colors">← 返回首页</Link>
        <h1 className="text-2xl font-bold text-[#f0f6fc] mt-3 mb-4">搜索</h1>

        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setVisible(PAGE_SIZE); }}
          placeholder="搜索仓库、内容、日期…"
          autoFocus
          className="w-full px-4 py-2.5 text-base bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] placeholder:text-muted focus:outline-none focus:border-accent transition-colors mb-4"
        />

        <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
          <select
            value={lang}
            onChange={e => { setParam('lang', e.target.value); setVisible(PAGE_SIZE); }}
            className="px-2 py-1.5 bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] focus:outline-none focus:border-accent"
          >
            <option value="">全部语言</option>
            {topLangs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-muted text-xs">
            从
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={e => { setParam('from', e.target.value); setVisible(PAGE_SIZE); }}
              className="px-2 py-1.5 bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] text-xs focus:outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-1.5 text-muted text-xs">
            至
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={e => { setParam('to', e.target.value); setVisible(PAGE_SIZE); }}
              className="px-2 py-1.5 bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] text-xs focus:outline-none focus:border-accent"
            />
          </label>
          <select
            value={sort}
            onChange={e => { setParam('sort', e.target.value); setVisible(PAGE_SIZE); }}
            className="px-2 py-1.5 bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] focus:outline-none focus:border-accent"
          >
            <option value="relevance">按相关度</option>
            <option value="date">按日期</option>
          </select>
          {(lang || from || to) && (
            <button
              onClick={() => {
                // 一次构建新 params，避免多次 setParam 用同一份 searchParams 互相覆盖
                const params = new URLSearchParams(searchParams.toString());
                ['lang', 'from', 'to'].forEach(k => params.delete(k));
                setVisible(PAGE_SIZE);
                const s = params.toString();
                router.replace(s ? `/search?${s}` : '/search', { scroll: false });
              }}
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              清除筛选 ✕
            </button>
          )}
        </div>
        <p className="text-xs text-muted">
          {hasQuery || lang || from || to
            ? <>共 <span className="text-accent">{results.length}</span> 篇笔记{lang && ` · 语言: ${lang}`}</>
            : '输入关键词，或选择语言/日期范围浏览'}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">未找到匹配结果</div>
      ) : (
        <div className="space-y-3">
          {shown.map(doc => {
            const repos = doc.repos;
            const hits = repos.filter(repoHit);
            return (
              <Link
                key={doc.slug}
                href={`/posts/${encodeURIComponent(doc.slug)}${hasQuery ? `?q=${encodeURIComponent(q)}` : ''}`}
                className="block bg-surface border border-border rounded-lg p-4 hover:border-accent hover:shadow-lg hover:shadow-accent/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-accent text-sm shrink-0">{doc.date}</span>
                  <span className="text-xs text-muted">{repos.length} 个仓库</span>
                  {doc.langs.length > 0 && (
                    <span className="text-xs text-muted ml-auto">{doc.langs.join(' · ')}</span>
                  )}
                </div>
                {repos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {repos.slice(0, 6).map(r => (
                      <span
                        key={r}
                        className={`px-2 py-0.5 rounded text-xs border ${
                          repoHit(r)
                            ? 'bg-yellow-500/20 border-yellow-500/30 text-[#fbbf24]'
                            : 'bg-[#0d1117] border-border text-muted'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                    {repos.length > 6 && <span className="text-xs text-muted self-center">+{repos.length - 6}</span>}
                  </div>
                )}
                {hasQuery && doc.content && (
                  <div
                    className="text-sm text-[#8b949e] leading-relaxed line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: highlightSnippet(getSnippet(doc.content, q), q) }}
                  />
                )}
              </Link>
            );
          })}
          {results.length > visible && (
            <button
              onClick={() => setVisible(v => v + PAGE_SIZE)}
              className="w-full py-2.5 text-sm text-accent bg-surface border border-border rounded-lg hover:border-accent transition-colors"
            >
              加载更多（还有 {results.length - visible} 篇）
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-muted text-sm">加载中…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}
