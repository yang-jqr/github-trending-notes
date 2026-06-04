import { getPost, getAllPosts, resolveWikiLinks } from "@/lib/posts";
import { notFound } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.meta.slug }));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const post = getPost(decodedSlug);
  if (!post) notFound();
  const allSlugs = new Set(getAllPosts().map((p) => p.meta.slug));
  const text = resolveWikiLinks(post.content, allSlugs);
  const all = getAllPosts();
  const i = all.findIndex((p) => p.meta.slug === decodedSlug);
  const prev = i < all.length - 1 ? all[i + 1] : null;
  const next = i > 0 ? all[i - 1] : null;
  return (
    <article>
      <div className="flex justify-between mb-6 text-sm">
        <Link href="/" className="text-muted hover:text-accent">← 全部笔记</Link>
        <div className="flex gap-3">
          {prev && <Link href={`/posts/${encodeURIComponent(prev.meta.slug)}`} className="text-accent">← {prev.meta.date||prev.meta.slug}</Link>}
          {next && <Link href={`/posts/${encodeURIComponent(next.meta.slug)}`} className="text-accent">{next.meta.date||next.meta.slug} →</Link>}
        </div>
      </div>
      <h1 className="text-2xl font-bold text-[#f0f6fc] mb-4">GitHub Trending — {post.meta.date}</h1>
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({href,children,...p}) => <a href={href} target={href?.startsWith("http")?"_blank":undefined} rel={href?.startsWith("http")?"noopener noreferrer":undefined} {...p}>{children}</a>,
          del: ({children}) => <span className="text-muted line-through">{children}</span>,
          pre: ({children}) => <pre className="bg-surface border border-border rounded-md p-3 overflow-x-auto text-sm">{children}</pre>,
          code: ({className,children,...p}) => !className ? <code className="bg-surface border border-border rounded px-1 py-0.5 text-sm" {...p}>{children}</code> : <code className={className} {...p}>{children}</code>,
          hr: () => <hr className="border-border my-6" />,
          h2: ({children}) => <h2 className="text-lg font-semibold text-[#f0f6fc] mt-6 mb-3 border-b border-border pb-2">{children}</h2>
        }}>{text}</ReactMarkdown>
      </div>
      <div className="mt-8 pt-4 border-t border-border text-sm text-muted">
        <div className="flex justify-between">
          {prev ? <Link href={`/posts/${encodeURIComponent(prev.meta.slug)}`} className="text-accent">← {prev.meta.date}</Link> : <span />}
          {next ? <Link href={`/posts/${encodeURIComponent(next.meta.slug)}`} className="text-accent">{next.meta.date} →</Link> : <span />}
        </div>
      </div>
    </article>
  );
}