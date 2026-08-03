'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { tokenize, getSnippet, highlightSnippet, scoreDoc, type SearchDoc, type SearchIndex } from '@/lib/search';

// ─── Component ──────────────────────────────────────────────────
export default function Search() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [termMap, setTermMap] = useState<Map<string, number>>(new Map());
  const [results, setResults] = useState<SearchDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
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

    const scored = index.docs
      .map(doc => ({ doc, score: scoreDoc(doc, query, termMap, index.idf, index.vocab) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(s => s.doc);

    setResults(scored);
    setOpen(scored.length > 0);
    setSelected(0);
  }, [query, index, termMap]);

  // 外部点击关闭 + 全局快捷键（/ 聚焦，Cmd/Ctrl+K 聚焦）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
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

  const matchedRepos = (doc: SearchDoc, q: string): string[] => {
    const tokens = tokenize(q.toLowerCase()).filter(t => t.length > 0);
    return doc.repos.filter(r => {
      const rl = r.toLowerCase();
      return tokens.some(t => rl === t || rl.includes(t));
    });
  };

  return (
    <div ref={containerRef} className="relative w-56 sm:w-72">
      <input
        ref={inputRef}
        type="text"
        placeholder="搜索仓库、内容、日期… (/)"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => { if (query.trim() && results.length > 0) setOpen(true); }}
        className="w-full px-3 py-1.5 text-sm bg-[#0d1117] border border-border rounded-md text-[#c9d1d9] placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
      />
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-surface border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.length > 0 ? results.map((entry, i) => {
            const repos = matchedRepos(entry, query);
            return (
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
                  <span className="font-semibold text-accent text-xs shrink-0">{entry.date}</span>
                  {repos.length > 0 && (
                    <span className="text-xs text-accent truncate font-medium">{repos.slice(0, 2).join(' · ')}</span>
                  )}
                  {entry.langs.length > 0 && (
                    <span className="text-xs text-muted ml-auto shrink-0">{entry.langs.slice(0, 2).join(' · ')}</span>
                  )}
                </div>
                {entry.content && (
                  <div
                    className="text-xs text-[#8b949e] leading-relaxed line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: highlightSnippet(getSnippet(entry.content, query), query) }}
                  />
                )}
              </button>
            );
          }) : (
            <div className="px-3 py-4 text-sm text-muted text-center">未找到匹配结果</div>
          )}
        </div>
      )}
    </div>
  );
}
