import type { Metadata } from 'next';
import Link from 'next/link';
import Search from '@/components/Search';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'GitHub Trending 学习笔记',
    template: '%s｜GitHub Trending 学习笔记',
  },
  description: '每日整理 GitHub Trending 热门仓库，用 AI 生成中文学习笔记。',
  keywords: ['GitHub Trending', '开源项目', 'AI 学习笔记', '开发者'],
};

const navItems = [
  { href: '/', label: '首页' },
  { href: '/search', label: '搜索' },
  { href: '/archive', label: '归档' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <a href="#main-content" className="skip-link">跳到主要内容</a>
        <header className="site-header">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
            <Link href="/" className="brand shrink-0 no-underline" aria-label="GitHub Trending 学习笔记首页">
              <span className="brand-mark" aria-hidden="true">✦</span>
              <span>Trending 学园</span>
            </Link>
            <nav className="ml-auto flex items-center gap-1 text-sm font-semibold" aria-label="主导航">
              {navItems.map(item => (
                <Link key={item.href} href={item.href} className="nav-link">{item.label}</Link>
              ))}
              <a
                href="https://github.com/yang-jqr/github-trending-notes"
                target="_blank"
                rel="noopener noreferrer"
                className="nav-link hidden md:inline-flex"
              >
                GitHub ↗
              </a>
            </nav>
            <div className="order-3 w-full sm:order-none sm:ml-2 sm:w-auto">
              <Search />
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto min-h-[70vh] max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="site-footer">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <div className="font-bold text-ink">✦ Trending 学园</div>
              <p className="mt-1 text-muted">把每天的开源热榜，变成读得懂的学习地图。</p>
            </div>
            <div className="flex flex-wrap gap-4 font-semibold">
              <Link href="/search">仓库搜索</Link>
              <Link href="/archive">全部归档</Link>
              <a href="https://github.com/yang-jqr/github-trending-notes" target="_blank" rel="noopener noreferrer">项目源码 ↗</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
