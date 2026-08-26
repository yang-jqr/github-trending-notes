'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import RepositoryGithubLink from '@/components/RepositoryGithubLink';

export interface ArchivePost {
  slug: string;
  date: string;
  repos: string[];
  langs: string[];
}

export default function ArchiveList({ posts }: { posts: ArchivePost[] }) {
  const [language, setLanguage] = useState('');
  const [month, setMonth] = useState('');

  const languages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) for (const lang of post.langs) counts.set(lang, (counts.get(lang) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const months = useMemo(
    () => [...new Set(posts.map(post => post.date.slice(0, 7)))].sort().reverse(),
    [posts],
  );

  const visible = useMemo(
    () => posts.filter(post => (!language || post.langs.includes(language)) && (!month || post.date.startsWith(month))),
    [posts, language, month],
  );

  const groups = useMemo(() => {
    const grouped = new Map<string, ArchivePost[]>();
    for (const post of visible) {
      const key = post.date.slice(0, 7);
      grouped.set(key, [...(grouped.get(key) || []), post]);
    }
    return [...grouped.entries()];
  }, [visible]);

  return (
    <section aria-labelledby="archive-list-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="kicker">EPISODE LIBRARY</span>
          <h2 id="archive-list-heading" className="mt-1 text-2xl font-black text-ink">按日期浏览</h2>
        </div>
        <span className="text-xs font-bold text-muted">共 {visible.length} 篇</span>
      </div>

      <div className="anime-card mb-6 flex flex-wrap items-center gap-3 p-4">
        <label className="text-xs font-bold text-muted">
          编程语言
          <select value={language} onChange={event => setLanguage(event.target.value)} className="site-search ml-2 rounded-xl px-2 py-1.5 text-sm">
            <option value="">全部</option>
            {languages.map(([lang, count]) => <option key={lang} value={lang}>{lang} ({count})</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-muted">
          月份
          <select value={month} onChange={event => setMonth(event.target.value)} className="site-search ml-2 rounded-xl px-2 py-1.5 text-sm">
            <option value="">全部</option>
            {months.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {(language || month) && (
          <button onClick={() => { setLanguage(''); setMonth(''); }} className="ml-auto text-xs font-bold text-accent">清除筛选 ✕</button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">这个筛选组合还没有笔记。</div>
      ) : (
        <div className="space-y-8">
          {groups.map(([groupMonth, list]) => (
            <section key={groupMonth} aria-labelledby={`month-${groupMonth}`}>
              <h3 id={`month-${groupMonth}`} className="mb-3 inline-flex rounded-full bg-[#eadeff] px-3 py-1 text-sm font-black text-accent">{groupMonth}</h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map(post => (
                  <article key={post.slug} className="episode-card group">
                    <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="flex items-center justify-between gap-3 no-underline">
                      <span className="font-black text-ink transition-colors group-hover:text-accent">{post.date}</span>
                      <span className="text-xs font-bold text-muted">{post.repos.length} 个仓库 · 查看笔记 →</span>
                    </Link>
                    {post.repos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {post.repos.slice(0, 4).map(repo => <RepositoryGithubLink key={repo} name={repo} className="repo-chip hover:border-accent hover:text-accent" />)}
                        {post.repos.length > 4 && <span className="repo-chip">+{post.repos.length - 4}</span>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
