'use client';

import { useEffect, useRef, useState } from 'react';
import { searchRepositories, type SearchIndex } from '@/lib/search';

const MAX_RESULTS = 8;

export default function Search() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = index && query.trim() ? searchRepositories(index, query, MAX_RESULTS) : [];

  useEffect(() => {
    fetch('/search-data.json')
      .then(response => {
        if (!response.ok) throw new Error('搜索数据加载失败');
        return response.json();
      })
      .then(setIndex)
      .catch(() => setIndex({ repositories: [] }));
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
      setOpen(false);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(value => Math.min(value + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(value => Math.max(value - 1, 0));
    }
    if (event.key === 'Enter' && results[selected]) {
      window.open(`https://github.com/${results[selected]}`, '_blank', 'noopener,noreferrer');
      close();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <label htmlFor="quick-repo-search" className="sr-only">搜索仓库</label>
      <input
        ref={inputRef}
        id="quick-repo-search"
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls="quick-repo-results"
        autoComplete="off"
        placeholder="搜索仓库…  /"
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
        <div id="quick-repo-results" role="listbox" className="search-popover absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl p-2">
          {results.length > 0 ? results.map((name, indexPosition) => (
            <a
              key={name.toLowerCase()}
              role="option"
              aria-selected={indexPosition === selected}
              href={`https://github.com/${name}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              onMouseEnter={() => setSelected(indexPosition)}
              className={`block rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition-colors ${
                indexPosition === selected ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-accent/10'
              }`}
            >
              {name}
            </a>
          )) : (
            <div className="px-3 py-5 text-center text-sm text-muted">没有找到这个仓库</div>
          )}
        </div>
      )}
    </div>
  );
}
