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
  const chinese = text.match(/[\u4e00-\u9fff]/g);
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

const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));

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

// Pass 2: compute IDF, keep only terms appearing in ≥2 docs
// ponytail: singleton terms add noise, drop them
const MIN_DF = 2;
const idf = {};
const keepTerms = new Set();
for (const [term, docCount] of Object.entries(df)) {
  if (docCount >= MIN_DF) {
    idf[term] = Math.log(1 + totalDocs / (1 + docCount));
    keepTerms.add(term);
  }
}

// Build vocab only from kept terms
const vocab = Object.keys(idf);
const termIdx = {};
vocab.forEach((t, i) => { termIdx[t] = i; });

const outputDocs = docs.map(d => ({
  slug: d.slug,
  date: d.date,
  repos: d.repos,
  langs: d.langs,
  content: d.content,
  tf: Object.entries(d.tf)
    .filter(([t]) => keepTerms.has(t))
    .map(([t, c]) => [termIdx[t], c]),
}));

// ─── Embeddings (ponytail: try-catch, falls back to TF-IDF only) ──
async function generateEmbeddings() {
  try {
    const { pipeline } = await import('@xenova/transformers');
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded, generating vectors...');

    // Embed documents
    const docEmbeddings = [];
    for (let i = 0; i < outputDocs.length; i++) {
      const text = outputDocs[i].content.slice(0, 2000);
      const result = await extractor(text, { pooling: 'mean', normalize: true });
      docEmbeddings.push(Array.from(result.data));
      if ((i + 1) % 10 === 0) console.log(`  embedded ${i + 1}/${outputDocs.length} docs`);
    }
    console.log(`  embedded ${outputDocs.length}/${outputDocs.length} docs`);

    // Embed top vocab tokens (capped for build time)
    const TOP_TOKENS = Math.min(vocab.length, 3000);
    const rankedTokens = vocab
      .map(t => [t, idf[t] || 0])
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_TOKENS)
      .map(([t]) => t);
    
    const tokenEmbeddings = {};
    const BATCH = 50;
    for (let i = 0; i < rankedTokens.length; i += BATCH) {
      const batch = rankedTokens.slice(i, i + BATCH);
      for (const token of batch) {
        const result = await extractor(token, { pooling: 'mean', normalize: true });
        tokenEmbeddings[token] = Array.from(result.data);
      }
      if ((i + BATCH) % 200 === 0) console.log(`  embedded ${Math.min(i + BATCH, rankedTokens.length)}/${rankedTokens.length} tokens`);
    }

    return { docEmbeddings, tokenEmbeddings };
  } catch (e) {
    console.warn('Embedding generation skipped:', e.message);
    return null;
  }
}

// Wrap in async IIFE so embeddings are generated before write
(async () => {
  const embeddings = await generateEmbeddings();

  const output = {
    vocab,
    idf,
    docs: outputDocs,
    ...(embeddings ? { embeddings } : {}),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output));
  console.log(`Generated search index: ${outputDocs.length} posts, ${vocab.length} terms${embeddings ? ` + ${embeddings.docEmbeddings.length} doc vectors, ${Object.keys(embeddings.tokenEmbeddings).length} token vectors` : ''}`);
})();
