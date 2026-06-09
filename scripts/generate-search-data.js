const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const contentDir = path.resolve(__dirname, '..', 'content');
const outputPath = path.resolve(__dirname, '..', 'public', 'search-data.json');

const results = [];

if (!fs.existsSync(contentDir)) {
  console.warn('Content directory not found, generating empty search index');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, '[]');
  process.exit(0);
}

const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(contentDir, file), 'utf-8');
  const { data } = matter(raw);
  const m = slug.match(/trending-(\d{4}-\d{2}-\d{2})/);
  const date = m ? m[1] : data.date || '';

  const repos = [];
  const langs = new Set();

  for (const line of raw.split('\n')) {
    let rm = line.match(/^## \d+\. (.+)/);
    if (!rm) rm = line.match(/^\*\*\d+\. (.+?)\*\*/);
    if (rm) {
      const name = rm[1].trim().replace(/\s*⭐.*$/, '').trim();
      if (name && name.length > 2) repos.push(name);
    }

    let lm = line.match(/⭐[^|]+\|[^|]*\|\s*(\w[\w\s+#.-]*)/);
    if (!lm) lm = line.match(/today\s*\|\s*(\w[\w+#.-]+)/);
    if (lm) {
      const lang = lm[1].trim();
      if (lang && /^[A-Z]/.test(lang) && lang.length < 20) langs.add(lang);
    }
  }

  results.push({ slug, date, repos, langs: Array.from(langs) });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(results));
console.log(`Generated search index: ${results.length} posts`);
