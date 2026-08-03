'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface ArchivePost {
  slug: string;
  date: string;
  repos: string[];
  langs: string[];
}

export default function ArchiveList({ posts }: { posts: ArchivePost[] }) {
  const [lang, setLang] = useState('');
  const [month, setMonth] = useState('');

  const allLangs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) for (const l of p.langs) counts.set(l, (counts.get(l) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) if (p.date) set.add(p.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [posts]);

  const visible = useMemo(
    () => posts.filter(p => (!lang || p.langs.includes(lang)) && (!month || p.date.startsWith(month))),
    [posts, lang, month],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, ArchivePost[]>();
    for (const p of visible) {
      const key = p.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-[#f0f6fc] mb-3">📅 按日期浏览</h2>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          className="px-2 py-1.5 bg-[#0d1117] border border-border rounded-md text-sm text-[#c9d1d9] focus:outline-none focus:border-accent"
        >
          <option value="">全部语言</option>
          {allLangs.map(([l, c]) => <option key={l} value={l}>{l} ({c})</option>)}
        </select>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-2 py-1.5 bg-[#0d1117] border border-border rounded-md text-sm text-[#c9d1d9] focus:outline-none focus:border-accent"
        >
          <option value="">全部月份</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        {(lang || month) && (
          <button
            onClick={() => { setLang(''); setMonth(''); }}
            className="text-xs text-muted hover:text-accent transition-colors"
          >
            清除筛选 ✕
          </button>
        )}
        <span className="text-xs text-muted ml-auto">共 {visible.length} 篇</span>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted text-sm text-center py-8">暂无笔记</p>
      ) : (
        <div className="space-y-6">
          {byMonth.map(([m, list]) => (
            <div key={m}>
              <h3 className="text-muted text-sm font-semibold mb-2">{m}</h3>
              <div className="space-y-2">
                {list.map(p => (
                  <Link
                    key={p.slug}
                    href={`/posts/${encodeURIComponent(p.slug)}`}
                    className="block bg-surface border border-border rounded-lg p-4 hover:border-accent hover:shadow-lg hover:shadow-accent/5 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2 text-sm">
                      <span className="font-semibold text-accent shrink-0">{p.date}</span>
                      <span className="text-xs text-muted">{p.repos.length} 个仓库</span>
                      <span className="text-xs text-muted ml-auto">{p.langs.join(' · ')}</span>
                    </div>
                    {p.repos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {p.repos.slice(0, 6).map(r => (
                          <span key={r} className="px-2 py-0.5 bg-[#0d1117] border border-border rounded text-xs text-muted">
                            {r}
                          </span>
                        ))}
                        {p.repos.length > 6 && <span className="text-xs text-muted self-center">+{p.repos.length - 6}</span>}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
