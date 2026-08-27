import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PostSearchHighlight from '@/components/PostSearchHighlight';
import { extractLanguages, extractRepoNames, getAllPosts, getPost, linkifyRepoNames, resolveWikiLinks, stripObsidianBreadcrumbs } from '@/lib/posts';

type PostPageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map(post => ({ slug: post.meta.slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(decodeURIComponent(slug));
  if (!post) return { title: '笔记不存在', robots: { index: false, follow: false } };

  const title = post.meta.date ? `Trending ${post.meta.date}` : post.meta.title;
  const description = `${post.meta.date} GitHub Trending 热门仓库学习笔记。`;
  const canonical = `/posts/${encodeURIComponent(post.meta.slug)}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'article', url: canonical },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);
  const post = getPost(decodedSlug);
  if (!post) notFound();

  const allPosts = getAllPosts();
  const allSlugs = new Set(allPosts.map(item => item.meta.slug));
  const text = linkifyRepoNames(resolveWikiLinks(stripObsidianBreadcrumbs(post.content), allSlugs));
  const datedPosts = allPosts.filter(item => item.meta.date);
  const index = datedPosts.findIndex(item => item.meta.slug === decodedSlug);
  const previous = index >= 0 && index < datedPosts.length - 1 ? datedPosts[index + 1] : null;
  const next = index > 0 ? datedPosts[index - 1] : null;
  const languages = extractLanguages(post.content);
  const names = extractRepoNames(post.content);

  return (
    <article className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/archive" className="back-link">← 全部归档</Link>
        <div className="flex gap-3 text-xs font-bold">
          {previous && <Link href={`/posts/${encodeURIComponent(previous.meta.slug)}`} className="text-accent">← {previous.meta.date || '上一期'}</Link>}
          {next && <Link href={`/posts/${encodeURIComponent(next.meta.slug)}`} className="text-accent">{next.meta.date || '下一期'} →</Link>}
        </div>
      </div>

      <header className="anime-card p-5 sm:p-7">
        <span className="kicker">TRENDING EPISODE</span>
        <h1 className="manga-title mt-2 text-3xl font-black text-ink sm:text-4xl">GitHub Trending</h1>
        <p className="mt-2 text-lg font-black text-accent">{post.meta.date || post.meta.title}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-muted">
          <span className="rounded-full bg-[#f3edff] px-3 py-1">{names.length} 个仓库</span>
          <span className="rounded-full bg-[#fff0d4] px-3 py-1">{languages.length} 种语言</span>
          {languages.slice(0, 4).map(language => <span key={language} className="rounded-full bg-[#e8f8ff] px-3 py-1">{language}</span>)}
        </div>
      </header>

      <section className="anime-card mt-6 p-5 sm:p-8">
        <div id="post-content" className="prose max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            a: ({ href, children, ...props }) => (
              <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined} className="font-semibold text-accent hover:underline" {...props}>{children}</a>
            ),
            del: ({ children }) => <span className="text-muted line-through">{children}</span>,
            pre: ({ children }) => <pre className="overflow-x-auto bg-[#2b2740] p-4 text-sm leading-relaxed text-[#f8f5ff]">{children}</pre>,
            code: ({ className, children, ...props }) => !className
              ? <code className="rounded border border-border bg-[#f3edff] px-1.5 py-0.5 text-sm text-[#4d3e76]" {...props}>{children}</code>
              : <code className={className} {...props}>{children}</code>,
            hr: () => <hr className="my-8 border-border" />,
            h2: ({ children }) => <h2 className="mt-9 border-b-2 border-[#e5dcf5] pb-2 text-xl font-black text-ink">{children}</h2>,
            strong: ({ children }) => <strong className="text-ink">{children}</strong>,
          }}>{text}</ReactMarkdown>
        </div>
        <Suspense fallback={null}>
          <PostSearchHighlight />
        </Suspense>
      </section>

      <nav className="mt-8 flex items-center justify-between gap-3 text-sm font-bold" aria-label="文章导航">
        {previous ? <Link href={`/posts/${encodeURIComponent(previous.meta.slug)}`} className="secondary-button">← {previous.meta.date}</Link> : <span />}
        {next ? <Link href={`/posts/${encodeURIComponent(next.meta.slug)}`} className="secondary-button">{next.meta.date} →</Link> : <span />}
      </nav>
    </article>
  );
}
