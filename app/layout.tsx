import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Trending 笔记",
  description: "每日自动抓取 GitHub Trending，AI 分析趋势",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="border-b border-border bg-surface">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-[#f0f6fc] no-underline">
              🔥 GitHub Trending 笔记
            </a>
            <span className="text-sm text-muted">每日自动 · AI 分析</span>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}