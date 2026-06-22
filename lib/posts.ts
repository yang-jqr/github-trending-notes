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
export interface BlogStats {
  totalDays: number;
  totalRepos: number;
  uniqueRepos: number;
  topLanguages: { lang: string; count: number }[];
  recurringRepos: RepoStats[];
}

function getAllSlugs(): string[] {
  if (!fs.existsSync(VAULT_PATH)) return [];
  return fs.readdirSync(VAULT_PATH).filter(f => f.endsWith(".md")).map(f => f.replace(/\.md$/, ""));
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

/** Normalize repo name: strip trailing decorators, normalize spaces around / */
function normalizeRepoName(raw: string): string {
  return raw
    .replace(/\s*[⭐\|].*$/, "")      // strip trailing ⭐ or | content
    .replace(/\s*\/\s*/g, "/")        // normalize "a / b" → "a/b"
    .trim();
}

export function extractRepoNames(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split("\n")) {
    let m = line.match(/^## \d+\. (.+)/);              // ## 1. repo/name
    if (!m) m = line.match(/^\*\*\d+\. (.+?)\*\*/);    // **1. repo/name**
    if (!m) m = line.match(/^\*\*#\d+\s+(.+?)\*\*/);   // **#1 repo/name**
    if (m) {
      const name = normalizeRepoName(m[1]);
      if (name && name.length > 2 && name.includes("/")) names.push(name);
    }
  }
  return names;
}

export function extractLanguages(content: string): string[] {
  const langs = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    let m: RegExpMatchArray | null = null;

    // Format A: **#1 repo/name** | Language · ...  (current)
    m = line.match(/^\*\*#\d+\s+.+?\*\*\s*\|\s*([A-Za-z][\w\s+#.-]*?)\s*·/);
    // Format B: **1. repo/name**（Language · ...） (old)
    if (!m) m = line.match(/^\*\*\d+\. .+?\*\*[（(]\s*([A-Za-z][\w\s+#.-]*?)\s*·/);
    // Format C: two-pipe after ⭐ pattern (legacy)
    if (!m) m = line.match(/⭐[^|]+\|[^|]*\|\s*(\w[\w\s+#.-]*)/);
    // Format D: "today | Language" (legacy)
    if (!m) m = line.match(/today\s*\|\s*(\w[\w+#.-]+)/);

    if (m) {
      const lang = m[1].trim();
      if (lang && /^[A-Z]/.test(lang) && lang.length < 20) langs.add(lang);
    } else {
      // Fallback: split by · and check last segment
      const parts = line.split("·");
      const last = parts[parts.length - 1]?.trim();
      if (last && /^[A-Z]/.test(last) && last.length < 20) langs.add(last);
    }
  }
  return Array.from(langs).slice(0, 10);
}

export function getStats(): BlogStats {
  const posts = getAllPosts().filter(p => p.meta.date);
  const repoMap = new Map<string, string[]>();
  const langMap = new Map<string, number>();
  let totalRepos = 0;
  for (const post of posts) {
    const names = extractRepoNames(post.content);
    const langs = extractLanguages(post.content);
    totalRepos += names.length;
    for (const name of names) {
      const dates = repoMap.get(name) || [];
      if (!dates.includes(post.meta.date)) dates.push(post.meta.date);
      repoMap.set(name, dates);
    }
    for (const lang of langs) {
      langMap.set(lang, (langMap.get(lang) || 0) + 1);
    }
  }
  const recurring = Array.from(repoMap.entries())
    .map(([name, dates]) => ({ name, count: dates.length, dates: dates.sort().reverse() }))
    .filter(r => r.count >= 2).sort((a, b) => b.count - a.count);
  const topLanguages = Array.from(langMap.entries())
    .map(([lang, count]) => ({ lang, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  return { totalDays: posts.length, totalRepos, uniqueRepos: repoMap.size, topLanguages, recurringRepos: recurring };
}

export function getRecurringRepos(): RepoStats[] { return getStats().recurringRepos; }

/**
 * 把内容中的 owner/repo 转为可点击的 GitHub 链接。
 * 跳过代码块和内联代码，跳过已经在 [text](url) 里的链接。
 */
export function linkifyRepoNames(content: string): string {
  const names = extractRepoNames(content);
  if (names.length === 0) return content;

  const unique = [...new Set(names)].sort((a, b) => b.length - a.length);
  const segments = splitCodeSegments(content);

  return segments.map(seg => {
    if (seg.isCode) return seg.text;
    return linkifyText(seg.text, unique);
  }).join('');
}

/** 对非代码文本做仓库名链接化 */
function linkifyText(text: string, names: string[]): string {
  for (const name of names) {
    let result = '';
    let remaining = text;
    while (remaining.length > 0) {
      const idx = remaining.indexOf(name);
      if (idx === -1) { result += remaining; break; }

      result += remaining.slice(0, idx);
      const before = result;

      // 检查是否已在 markdown 链接文本内（[text](url)），排除 wiki 链接 [[text]]
      const lastClose = before.lastIndexOf('](');
      const lastOpen = before.lastIndexOf('[');
      const isWikiLink = lastOpen > 0 && before[lastOpen - 1] === '[';
      const insideLink = !isWikiLink && lastOpen > lastClose;

      if (insideLink) {
        // 在链接文本内，不转换
        result += name;
      } else {
        result += '[' + name + '](https://github.com/' + name + ')';
      }
      remaining = remaining.slice(idx + name.length);
    }
    text = result;
  }
  return text;
}

/** 拆分为代码段（内联代码 + 围栏代码块）和非代码段 */
function splitCodeSegments(content: string): { text: string; isCode: boolean }[] {
  const regex = /(`[^`]+`|```[\s\S]*?```)/g;
  const segments: { text: string; isCode: boolean }[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ text: content.slice(lastIdx, m.index), isCode: false });
    }
    segments.push({ text: m[0], isCode: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < content.length) {
    segments.push({ text: content.slice(lastIdx), isCode: false });
  }
  return segments;
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
