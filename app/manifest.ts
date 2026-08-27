import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GitHub Trending 学习笔记',
    short_name: 'Trending 学园',
    description: '每日整理 GitHub Trending 热门仓库，用 AI 生成中文学习笔记。',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff8f6',
    theme_color: '#6c55d9',
    lang: 'zh-CN',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  };
}
