import { getAllPosts, getRecurringRepos, type Post } from "@/lib/posts";
import Link from "next/link";

export default function HomePage() {
  const posts = getAllPosts();
  const recurring = getRecurringRepos();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-[#f0f6fc] mb-2">📋 GitHub Trending 学习笔记</h1>
        <p className="text-muted">
          每日自动抓取 GitHub 热榜前 10，AI 分析技术趋势与学习价值。
          已记录 {posts.length} 天，{recurring.length} 个仓库多次上榜。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#f0f6fc] mb-4">📅 按日期浏览</h2>
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.meta.slug} post={post} />
          ))}
        </div>
      </section>

      {recurring.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[#f0f6fc] mb-4">🔁 反复上榜仓库</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recurring.slice(0, 10).map((repo) => (
              <div key={repo.name} className="flex items-center justify-between bg-surface border border-border rounded-md px-3 py-2 text-sm">
                <span className="text-accent truncate mr-2">{repo.name}</span>
                <span className="text-muted shrink-0">{repo.count} 次</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const repoCount = (post.content.match(/^## \d+\./gm) || []).length;
  return (
    <Link href={`/posts/${encodeURIComponent(post.meta.slug)}`} className="block bg-surface border border-border rounded-lg px-4 py-3 hover:border-accent transition-colors no-underline">
      <div className="flex items-center justify-between">
        <span className="text-[#f0f6fc] font-medium">{post.meta.date ? `GitHub Trending — ${post.meta.date}` : post.meta.slug}</span>
        <span className="text-muted text-sm">{repoCount > 0 ? `${repoCount} 个仓库` : ""}</span>
      </div>
    </Link>
  );
}