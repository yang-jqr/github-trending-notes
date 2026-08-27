import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/posts';
import { getSiteUrl } from '@/lib/site';

const siteUrl = getSiteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/search`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/archive`, changeFrequency: 'daily', priority: 0.8 },
    ...getAllPosts().map(({ meta }) => ({
      url: `${siteUrl}/posts/${encodeURIComponent(meta.slug)}`,
      lastModified: meta.date || undefined,
      changeFrequency: 'never' as const,
      priority: 0.7,
    })),
  ];
}
