'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { searchRepositories, type SearchIndex } from '@/lib/search';

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => setInput(query), [query]);
  useEffect(() => {
    fetch('/search-data.json')
      .then(response => {
        if (!response.ok) throw new Error('搜索数据加载失败');
        return response.json();
      })
      .then(setIndex)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (input === query) return;
      router.replace(input.trim() ? `/search?q=${encodeURIComponent(input.trim())}` : '/search', { scroll: false });
    }, 200);
    return () => window.clearTimeout(id);
  }, [input, query, router]);

  const results = useMemo(() => index ? searchRepositories(index, query) : [], [index, query]);

  return (
    <div>
      <Link href="/" className="back-link">← 返回首页</Link>
      <section className="anime-card mt-4 p-5 sm:p-7">
        <span className="kicker">REPOSITORY FINDER</span>
        <h1 className="manga-title mt-2 text-3xl font-black text-ink">仓库搜索</h1>
        <p className="mt-2 text-sm text-muted">输入仓库名，只返回不重复的 owner/repo。</p>
        <label htmlFor="repository-search" className="sr-only">输入仓库名称</label>
        <div className="relative mt-5">
          <input
            id="repository-search"
            type="search"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="例如：openai/codex"
            autoFocus
            className="site-search w-full rounded-2xl px-5 py-3 text-base"
          />
          {input && (
            <button onClick={() => setInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-muted hover:text-accent" aria-label="清空搜索">
              ✕
            </button>
          )}
        </div>
      </section>

      <section className="mt-6" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{query ? '搜索结果' : '全部仓库'}</h2>
          {index && <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-muted">{results.length} 个</span>}
        </div>
        {failed ? (
          <div className="empty-state">搜索数据加载失败，请刷新页面重试。</div>
        ) : !index ? (
          <div className="empty-state">正在整理仓库目录…</div>
        ) : results.length === 0 ? (
          <div className="empty-state">没有找到匹配的仓库，换个关键词试试吧。</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map(name => (
              <a
                key={name.toLowerCase()}
                href={`https://github.com/${name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="repo-result"
              >
                {name}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="empty-state">正在打开搜索…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}
