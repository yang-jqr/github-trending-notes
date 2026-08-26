'use client';

import { Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loadSearchIndex, repositoryPostHref, searchRepositories, type SearchIndex } from '@/lib/search';
import RepositoryGithubLink from '@/components/RepositoryGithubLink';

const PAGE_SIZE = 24;
const EXAMPLES = ['Python RAG', 'agent 安全', '语言:Rust', '日期:2026-08', '仓库:codex'];

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const deferredInput = useDeferredValue(input);

  useEffect(() => setInput(query), [query]);
  useEffect(() => {
    loadSearchIndex()
      .then(setIndex)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => setVisible(PAGE_SIZE), [input]);

  const results = useMemo(() => {
    const matches = index ? searchRepositories(index, deferredInput) : [];
    return [...matches].sort((a, b) => b.stars - a.stars || b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }, [deferredInput, index]);
  const shown = results.slice(0, visible);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    router.replace(value ? `/search?q=${encodeURIComponent(value)}` : '/search', { scroll: false });
  };

  return (
    <div>
      <Link href="/" className="back-link">← 返回首页</Link>
      <section className="anime-card mt-4 p-5 sm:p-7">
        <span className="kicker">SMART REPOSITORY FINDER</span>
        <h1 className="manga-title mt-2 text-3xl font-black text-ink">按你的需求找仓库</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">搜索仓库名、技术栈、项目介绍或学习需求。结果保持去重，点击进入本站对应的学习笔记。</p>
        <label htmlFor="repository-search" className="sr-only">输入搜索需求</label>
        <form className="relative mt-5" role="search" onSubmit={submitSearch}>
          <input
            id="repository-search"
            type="search"
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="例如：Python RAG、agent 安全、语言:Rust"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className="site-search w-full rounded-2xl px-5 py-3 pr-12 text-base"
          />
          {input && (
            <button type="button" onClick={() => { setInput(''); router.replace('/search', { scroll: false }); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-muted hover:text-accent" aria-label="清空搜索">✕</button>
          )}
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">试试：</span>
          {EXAMPLES.map(example => (
            <button key={example} onClick={() => setInput(example)} className="rounded-full border border-border bg-white/80 px-3 py-1 text-xs font-bold text-accent transition hover:-translate-y-0.5 hover:border-accent">
              {example}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">高级输入：<code>语言:Python</code>、<code>日期:2026-08</code>、<code>仓库:openai</code>，也可以与普通关键词组合。</p>
      </section>

      <section className="mt-6" aria-live="polite">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">{input.trim() ? `“${input.trim()}” 的结果` : '最近收录的仓库'}</h2>
          {index && <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-muted">{results.length} 个</span>}
        </div>
        {failed ? (
          <div className="empty-state">搜索数据加载失败，请刷新页面重试。</div>
        ) : !index ? (
          <div className="empty-state">正在整理仓库介绍…</div>
        ) : results.length === 0 ? (
          <div className="empty-state">没有找到匹配仓库。可以减少关键词，或尝试仓库名、语言和用途。</div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((repository, position) => (
                <article key={repository.name.toLowerCase()} className="repo-result group">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 truncate font-black text-ink">#{position + 1} <RepositoryGithubLink name={repository.name} className="text-accent hover:underline" /></h3>
                    <Link href={repositoryPostHref(repository, input)} className="shrink-0 text-xs font-black text-accent">本站笔记 →</Link>
                  </div>
                  <Link href={repositoryPostHref(repository, input)} className="block no-underline">
                    <p className="repo-description mt-2 text-sm leading-6 text-muted">{repository.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-muted">
                      {(repository.language || repository.languages[0]) && <span className="rounded-full bg-[#e8f8ff] px-2.5 py-1">{repository.language || repository.languages[0]}</span>}
                      {repository.stars > 0 && <span className="rounded-full bg-[#fff0d4] px-2.5 py-1">⭐ {repository.stars.toLocaleString('en-US')}</span>}
                      <span className="rounded-full bg-[#f3edff] px-2.5 py-1">{repository.date}</span>
                      {repository.appearances > 1 && <span className="rounded-full bg-[#fff0d4] px-2.5 py-1">上榜 {repository.appearances} 次</span>}
                    </div>
                  </Link>
                </article>
              ))}
            </div>
            {results.length > visible && (
              <button onClick={() => setVisible(value => value + PAGE_SIZE)} className="secondary-button mx-auto mt-6 flex">加载更多（还有 {results.length - visible} 个）</button>
            )}
          </>
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
