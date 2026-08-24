const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { getPost, getAllPosts } = require('../lib/posts.ts');
const publicSlug = /^trending-\d{4}-\d{2}-\d{2}$/;
const slugs = getAllPosts().map(post => post.meta.slug);

assert.equal(getPost('../README'), null, 'getPost must reject path traversal slugs');
assert.ok(slugs.every(slug => publicSlug.test(slug)), 'all public post slugs must be trending-YYYY-MM-DD');

console.log(`Post safety check passed: ${slugs.length} public slugs`);
