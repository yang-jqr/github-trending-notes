import type { Metadata } from 'next';
import Link from 'next/link';
import { extractLanguages, extractRepoNames, getAllPosts, getStats } from '@/lib/posts';
import ArchiveList, { type ArchivePost } from '@/components/ArchiveList';

export const metadata: Metadata = {
  title: '学习笔记归档',
  description: '按月份和编程语言浏览全部 GitHub Trending 学习笔记。',
};

export default function ArchivePage() {
  const posts = getAllPosts().filter(post => post.meta.date);
  const stats = getStats();
  const list: ArchivePost[] = posts.map(post => ({
    slug: post.meta.slug,
    date: post.meta.date,
    repos: extractRepoNames(post.content),
    langs: extractLanguages(post.content),
  }));

  return (
    <div>
      <Link href="/" className="back-link">← 返回首页</Link>
      <section className="anime-card mt-4 p-5 sm:p-7">
        <span className="kicker">THE COMPLETE COLLECTION</span>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="manga-title text-3xl font-black text-ink">学习笔记归档</h1>
            <p className="mt-2 text-sm leading-6 text-muted">按语言和月份回看每一期 GitHub Trending。</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <ArchiveStat value={stats.totalDays} label="天" />
            <ArchiveStat value={stats.totalRepos} label="次上榜" />
            <ArchiveStat value={stats.uniqueRepos} label="个仓库" />
          </div>
        </div>
      </section>

      {stats.topLanguages.length > 0 && (
        <section className="mt-8" aria-labelledby="archive-languages">
          <h2 id="archive-languages" className="text-lg font-black text-ink">语言图鉴</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.topLanguages.map(({ lang, count }) => (
              <Link key={lang} href={`/search?q=${encodeURIComponent(`语言:${lang}`)}`} className="language-chip">{lang} <span>{count}</span></Link>
            ))}
          </div>
        </section>
      )}

      {stats.recurringRepos.length > 0 && (
        <section className="anime-card mt-8 p-5 sm:p-6" aria-labelledby="archive-recurring">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="archive-recurring" className="text-lg font-black text-ink">人气返场仓库</h2>
            <span aria-hidden="true">⭐</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.recurringRepos.slice(0, 12).map(repo => (
              <Link key={repo.name} href={`/posts/${encodeURIComponent(`trending-${repo.dates[0]}`)}?q=${encodeURIComponent(repo.name)}`} className="mini-repo">
                <span className="truncate">{repo.name}</span>
                <span className="shrink-0 text-xs text-muted">{repo.count} 次</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10">
        <ArchiveList posts={list} />
      </div>
    </div>
  );
}

function ArchiveStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-16 rounded-xl bg-[#f4efff] px-3 py-2">
      <div className="font-black text-accent">{value}</div>
      <div className="text-[10px] font-bold text-muted">{label}</div>
    </div>
  );
}
