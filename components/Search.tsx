'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { repositoryPostHref, searchRepositories, type SearchIndex } from '@/lib/search';

const MAX_RESULTS = 8;

export default function Search() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = index && query.trim() ? searchRepositories(index, query, MAX_RESULTS) : [];

  useEffect(() => {
    fetch('/search-data.json')
      .then(response => {
        if (!response.ok) throw new Error('搜索数据加载失败');
        return response.json();
      })
      .then(data => { setIndex(data); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);

  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleShortcut = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if ((event.key === '/' && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleShortcut);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleShortcut);
    };
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (open) setOpen(false);
      else setQuery('');
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(value => Math.min(value + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(value => Math.max(value - 1, 0));
    }
    if (event.key === 'Enter') {
      router.push(repositoryPostHref(results[selected]));
      close();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-80">
      <label htmlFor="quick-repo-search" className="sr-only">搜索仓库、技术或学习需求</label>
      <input
        ref={inputRef}
        id="quick-repo-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="quick-repo-results"
        autoComplete="off"
        placeholder="搜仓库、技术或需求…  /"
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setSelected(0);
          setOpen(Boolean(event.target.value.trim()));
        }}
        onKeyDown={handleKey}
        onFocus={() => query.trim() && setOpen(true)}
        className="site-search w-full rounded-full px-4 py-2 text-sm"
      />
      {open && (
        <div id="quick-repo-results" role="listbox" className="search-popover absolute left-0 top-full z-50 mt-2 max-h-[26rem] w-full overflow-y-auto rounded-2xl p-2 sm:left-auto sm:right-0 sm:w-[30rem]">
          {status === 'loading' ? (
            <div className="px-3 py-6 text-center text-sm text-muted">正在读取仓库索引…</div>
          ) : status === 'error' ? (
            <div className="px-3 py-6 text-center text-sm text-muted">搜索暂时不可用，请刷新重试。</div>
          ) : results.length > 0 ? (
            <>
              {results.map((repository, position) => (
                <Link
                  key={repository.name.toLowerCase()}
                  id={`quick-result-${position}`}
                  role="option"
                  aria-selected={position === selected}
                  href={repositoryPostHref(repository)}
                  onClick={close}
                  onMouseEnter={() => setSelected(position)}
                  className={`block rounded-xl px-3 py-3 no-underline transition-colors ${position === selected ? 'bg-accent/10' : 'hover:bg-accent/10'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-black text-ink">{repository.name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-muted">{repository.language || repository.date}</span>
                  </div>
                  <p className="repo-description mt-1 text-xs leading-5 text-muted">{repository.description}</p>
                </Link>
              ))}
              <Link href={`/search?q=${encodeURIComponent(query)}`} onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-3 py-2 text-center text-xs font-black text-accent hover:bg-accent/10">
                查看全部搜索结果 →
              </Link>
            </>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted">没有匹配结果，试试技术名或需求描述。</div>
          )}
        </div>
      )}
    </div>
  );
}
