import { getAllPosts, getStats, extractRepoNames, extractLanguages } from "@/lib/posts";
import ArchiveList, { type ArchivePost } from "@/components/ArchiveList";

export default function ArchivePage() {
  const posts = getAllPosts().filter(p => p.meta.date); // 只显示 trending 笔记
  const stats = getStats();

  const list: ArchivePost[] = posts.map(p => ({
    slug: p.meta.slug,
    date: p.meta.date,
    repos: extractRepoNames(p.content),
    langs: extractLanguages(p.content),
  }));

  return (
    <div>
      <div className="mb-6">
        <a href="/" className="text-sm text-muted hover:text-accent transition-colors">← 返回首页</a>
        <h1 className="text-2xl font-bold text-[#f0f6fc] mt-3">📚 归档</h1>
        <p className="text-muted text-sm mt-2">
          共 <span className="text-accent">{stats.totalDays}</span> 天 ·{' '}
          <span className="text-accent">{stats.totalRepos}</span> 个上榜仓库（去重{' '}
          <span className="text-accent">{stats.uniqueRepos}</span>）
        </p>
      </div>

      {/* 语言统计 */}
      {stats.topLanguages.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#f0f6fc] mb-3">🗂 语言统计</h2>
          <div className="flex flex-wrap gap-2">
            {stats.topLanguages.map(({ lang, count }) => (
              <a
                key={lang}
                href={`/search?lang=${encodeURIComponent(lang)}`}
                className="px-3 py-1 bg-surface border border-border rounded-full text-sm text-muted hover:border-accent hover:text-accent transition-colors"
              >
                {lang} <span className="text-accent">{count}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 反复上榜仓库 */}
      {stats.recurringRepos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[#f0f6fc] mb-3">🔁 反复上榜</h2>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            {stats.recurringRepos.slice(0, 10).map((repo, i) => (
              <div
                key={repo.name}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <a
                  href={`https://github.com/${repo.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent truncate hover:underline"
                >
                  {repo.name}
                </a>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-muted text-xs">{repo.dates.length} 次</span>
                  <a
                    href={`/search?q=${encodeURIComponent(repo.name.split('/').pop() || '')}`}
                    className="text-muted text-xs hover:text-accent transition-colors"
                  >
                    查看笔记 →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 按月分组的笔记列表（client 组件处理语言过滤） */}
      <ArchiveList posts={list} />
    </div>
  );
}
