import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import RepositoryGithubLink from '@/components/RepositoryGithubLink';
import { extractLanguages, extractRepoNames, getAllPosts, getStats, type Post } from '@/lib/posts';

const HOME_POST_COUNT = 12;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const posts = getAllPosts().filter(post => post.meta.date);
  const stats = getStats();
  const latest = posts[0];

  return (
    <div>
      <section className="hero-panel anime-card overflow-hidden p-5 sm:p-8">
        <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className="kicker">DAILY OPEN-SOURCE ADVENTURE</span>
            <h1 className="manga-title mt-3 text-4xl font-black leading-tight text-ink sm:text-5xl">
              今天，去开源世界<br className="hidden sm:block" />发现什么？
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted sm:text-lg">
              每日收集 GitHub Trending 热门仓库，用 AI 拆解技术亮点、学习价值与上手方向。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {latest && (
                <Link href={`/posts/${encodeURIComponent(latest.meta.slug)}`} className="primary-button">
                  阅读最新一期
                </Link>
              )}
              <Link href="/search" className="secondary-button">搜索仓库</Link>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard value={stats.totalDays} label="天笔记" />
              <StatCard value={stats.totalRepos} label="次上榜" />
              <StatCard value={stats.uniqueRepos} label="个仓库" />
              <StatCard value={stats.recurringRepos.length} label="再次登场" />
            </div>
          </div>
          <div className="hero-art-wrap">
            <Image
              src="/anime-coder.png"
              alt="戴眼镜的动漫开发者与机器人猫一起探索开源仓库"
              width={1536}
              height={1024}
              priority
              className="h-auto w-full rounded-[1.5rem] object-cover"
              sizes="(max-width: 1024px) 100vw, 45vw"
            />
            <span className="hero-sticker sticker-one" aria-hidden="true">NEW!</span>
            <span className="hero-sticker sticker-two" aria-hidden="true">★</span>
          </div>
        </div>
      </section>

      {stats.topLanguages.length > 0 && (
        <section className="mt-8" aria-labelledby="languages-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <span className="kicker">TREND RADAR</span>
              <h2 id="languages-heading" className="mt-1 text-xl font-black text-ink">热门语言</h2>
            </div>
            <Link href="/archive" className="text-sm font-bold text-accent">查看统计 →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.topLanguages.map(({ lang, count }) => (
              <Link key={lang} href={`/search?q=${encodeURIComponent(`语言:${lang}`)}`} className="language-chip">
                {lang} <span>{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="latest-heading">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <span className="kicker">LATEST EPISODES</span>
            <h2 id="latest-heading" className="mt-1 text-2xl font-black text-ink">最新学习笔记</h2>
          </div>
          <Link href="/archive" className="text-sm font-bold text-accent">全部归档 →</Link>
        </div>
        {posts.length === 0 ? (
          <div className="empty-state">今天的冒险笔记还在整理中。</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {posts.slice(0, HOME_POST_COUNT).map(post => <PostCard key={post.meta.slug} post={post} />)}
          </div>
        )}
      </section>

      {stats.recurringRepos.length > 0 && (
        <section className="anime-card mt-10 p-5 sm:p-7" aria-labelledby="recurring-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <span className="kicker">ENCORE REPOSITORIES</span>
              <h2 id="recurring-heading" className="mt-1 text-xl font-black text-ink">反复上榜</h2>
            </div>
            <span className="text-2xl" aria-hidden="true">🔁</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {stats.recurringRepos.slice(0, 8).map(repo => (
              <div key={repo.name} className="mini-repo">
                <RepositoryGithubLink name={repo.name} className="truncate text-accent hover:underline" />
                <Link href={`/posts/${encodeURIComponent(`trending-${repo.dates[0]}`)}?q=${encodeURIComponent(repo.name)}`} className="shrink-0 text-xs text-muted hover:text-accent">
                  笔记 {repo.count} 次 →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat-card">
      <div className="text-2xl font-black text-accent">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-muted">{label}</div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const names = extractRepoNames(post.content);
  const languages = extractLanguages(post.content);

  return (
    <article className="episode-card group">
      <Link href={`/posts/${encodeURIComponent(post.meta.slug)}`} className="block no-underline">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-black tracking-[.16em] text-accent">EP. {post.meta.date}</span>
            <h3 className="mt-1 text-lg font-black text-ink transition-colors group-hover:text-accent">
              GitHub Trending 学习笔记
            </h3>
          </div>
          <span className="episode-arrow" aria-hidden="true">↗</span>
        </div>
        <p className="mt-2 text-sm text-muted">{names.length} 个仓库 · {languages.length || 0} 种语言</p>
      </Link>
      {names.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {names.slice(0, 4).map(name => <RepositoryGithubLink key={name} name={name} className="repo-chip hover:border-accent hover:text-accent" />)}
          {names.length > 4 && <span className="repo-chip">+{names.length - 4}</span>}
        </div>
      )}
    </article>
  );
}
