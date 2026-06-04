import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_PATHS = [path.join(process.cwd(), "content"), "/mnt/e/HermesWorkspace/github"];
function getContentDir(): string {
  for (const p of CONTENT_PATHS) { if (fs.existsSync(p)) return p; }
  return CONTENT_PATHS[0];
}
const VAULT_PATH = getContentDir();

export interface PostMeta { slug: string; title: string; date: string; }
export interface Post { meta: PostMeta; content: string; }
export interface RepoStats { name: string; count: number; dates: string[]; }

function getAllSlugs(): string[] {
  if (!fs.existsSync(VAULT_PATH)) return [];
  return fs.readdirSync(VAULT_PATH).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
}

export function getAllPosts(): Post[] {
  const posts: Post[] = [];
  for (const slug of getAllSlugs()) {
    const fp = path.join(VAULT_PATH, `${slug}.md`);
    if (!fs.existsSync(fp)) continue;
    const { data, content } = matter(fs.readFileSync(fp, "utf-8"));
    const m = slug.match(/trending-(\d{4}-\d{2}-\d{2})/);
    posts.push({ meta: { slug, title: data.title || slug, date: m ? m[1] : data.date || "" }, content });
  }
  return posts.sort((a, b) => b.meta.date.localeCompare(a.meta.date));
}

export function getPost(slug: string): Post | null {
  const fp = path.join(VAULT_PATH, `${slug}.md`);
  if (!fs.existsSync(fp)) return null;
  const { data, content } = matter(fs.readFileSync(fp, "utf-8"));
  const m = slug.match(/trending-(\d{4}-\d{2}-\d{2})/);
  return { meta: { slug, title: data.title || slug, date: m ? m[1] : data.date || "" }, content };
}

export function getRecurringRepos(): RepoStats[] {
  const repoMap = new Map<string, string[]>();
  for (const post of getAllPosts()) {
    if (!post.meta.date) continue;
    for (const line of post.content.split("\n")) {
      const m = line.match(/^## \d+\. (.+)/);
      if (m) {
        const name = m[1].trim();
        const dates = repoMap.get(name) || [];
        if (!dates.includes(post.meta.date)) dates.push(post.meta.date);
        repoMap.set(name, dates);
      }
    }
  }
  return Array.from(repoMap.entries()).map(([name, dates]) => ({ name, count: dates.length, dates: dates.sort().reverse() })).filter((r) => r.count >= 2).sort((a, b) => b.count - a.count);
}

export function resolveWikiLinks(content: string, allSlugs: Set<string>): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_, slug: string) => {
    const [target, alias] = slug.split("|");
    const t = (target || "").trim();
    const d = (alias || t).trim();
    if (allSlugs.has(t)) return `[${d}](/posts/${encodeURIComponent(t)})`;
    return `~~${d}~~`;
  });
}