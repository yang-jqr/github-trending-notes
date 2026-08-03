const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const contentDir = path.resolve(__dirname, '..', 'content');
const outputPath = path.resolve(__dirname, '..', 'public', 'search-data.json');

// ─── Tokenization ───────────────────────────────────────────────
function tokenize(text) {
  const tokens = [];
  // English words (≥2 chars, skip pure numbers)
  const words = text.toLowerCase().match(/[a-z]{2,}|[a-z][a-z0-9]+/g) || [];
  tokens.push(...words);
  // Chinese bigrams
  const chinese = text.match(/[一-鿿]/g);
  if (chinese) {
    for (let i = 0; i < chinese.length - 1; i++) {
      tokens.push(chinese[i] + chinese[i + 1]);
    }
    // single chars for short queries
    tokens.push(...chinese);
  }
  return tokens;
}

function stripMarkdown(raw) {
  return raw
    .replace(/^---[\s\S]*?---/, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')       // wiki links: [[slug]] → slug
    .replace(/[<>]{2}/g, '')                  // navigation arrows: << >>
    .replace(/\n{2,}/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildTfMap(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  return tf;
}

// ─── Main ────────────────────────────────────────────────────────
if (!fs.existsSync(contentDir)) {
  console.warn('Content directory not found, generating empty search index');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ idf: {}, docs: [] }));
  process.exit(0);
}

const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md') && !f.includes('MOC'));

// Pass 1: collect all docs + global document frequency
const docs = [];
const df = {}; // term → doc count
const totalDocs = files.length;

for (const file of files) {
  const slug = file.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(contentDir, file), 'utf-8');
  const { data } = matter(raw);
  const m = slug.match(/trending-(\d{4}-\d{2}-\d{2})/);
  const date = m ? m[1] : data.date || '';

  // Extract repos and langs (keep existing logic)
  const repos = [];
  const langs = new Set();
  for (const line of raw.split('\n')) {
    let rm = line.match(/^## \d+\. (.+)/);
    if (!rm) rm = line.match(/^\*\*\d+\. (.+?)\*\*/);
    if (!rm) rm = line.match(/^\*\*#\d+ (.+?)\*\*/);
    if (!rm) rm = line.match(/^\*\*#\d+\s+(.+?)\*\*/);
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

  const plainText = stripMarkdown(raw);
  // ponytail: fold repo names + langs into tokens for direct name search
  const extraTokens = [
    ...repos.flatMap(r => r.split(/[\s/]+/).filter(Boolean)),
    ...Array.from(langs),
  ];
  const tokens = tokenize(plainText + ' ' + extraTokens.join(' '));
  const tf = buildTfMap(tokens);

  // Content snippet for display (max 1000 chars)
  const content = plainText.slice(0, 1000);

  // Track DF: count each unique term per document
  const uniqueTerms = new Set(tokens);
  for (const t of uniqueTerms) {
    df[t] = (df[t] || 0) + 1;
  }

  docs.push({ slug, date, repos, langs: Array.from(langs), content, tf });
}

// Pass 2: compute IDF, keep ALL terms (singletons too — cold repos/tech words
// appear once and must stay searchable; the corpus is small, so noise is limited)
const idf = {};
for (const [term, docCount] of Object.entries(df)) {
  idf[term] = Math.log(1 + totalDocs / (1 + docCount));
}

// Build vocab from all terms
const vocab = Object.keys(idf);
const termIdx = {};
vocab.forEach((t, i) => { termIdx[t] = i; });

const outputDocs = docs.map(d => ({
  slug: d.slug,
  date: d.date,
  repos: d.repos,
  // repo short names (repo part of owner/repo) — client matches against these
  // with substring/equality for precise name hits
  repoNames: d.repos.map(r => r.split('/').pop()).filter(Boolean),
  langs: d.langs,
  content: d.content,
  tf: Object.entries(d.tf).map(([t, c]) => [termIdx[t], c]),
}));

const output = {
  vocab,
  idf,
  docs: outputDocs,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output));
console.log(`Generated search index: ${outputDocs.length} posts, ${vocab.length} terms`);
