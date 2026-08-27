/** 站点 URL 唯一来源，供 metadata/robots/sitemap 共用。 */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://github-trending-notes.vercel.app').replace(/\/$/, '');
}
