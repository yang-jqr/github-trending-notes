const assert = require('node:assert/strict');
const { brotliCompressSync } = require('node:zlib');
const index = require('../public/search-data.json');

assert.equal(index.version, 1, 'search index version must be supported');
assert.ok(Array.isArray(index.repositories), 'repositories must be an array');
assert.ok(index.repositories.every(repository => (
  typeof repository.name === 'string' && /^[\w.-]+\/[\w.-]+$/i.test(repository.name)
  && typeof repository.description === 'string' && repository.description.length > 0
  && /^trending-\d{4}-\d{2}-\d{2}$/.test(repository.slug)
  && /^\d{4}-\d{2}-\d{2}$/.test(repository.date)
  && Number.isInteger(repository.stars) && repository.stars >= 0
  && Array.isArray(repository.dates) && repository.dates.includes(repository.date)
  && Array.isArray(repository.languages)
  && typeof repository.searchText === 'string' && repository.searchText.length > 0
)), 'every entry must contain a repository name, intro, note link, date and searchable text');
assert.ok(
  index.repositories.every(repository => repository.searchText.length <= 1600),
  'each repository search text must stay within the size budget',
);
assert.equal(
  new Set(index.repositories.map(repository => repository.name.toLowerCase())).size,
  index.repositories.length,
  'repository names must be unique (case-insensitive)',
);
const recurring = index.repositories.find(repository => repository.name.toLowerCase() === 'mattpocock/skills');
assert.ok(recurring?.description && recurring.appearances > 1 && recurring.stars > 0, 'recurring repositories must keep an intro, star count and appearance count');
assert.ok(index.repositories.some(repository => repository.name === 'hugohe3/ppt-master' && repository.searchText.includes('ppt')), 'ppt must find ppt-master');
assert.ok(index.repositories.some(repository => repository.name === 'mattpocock/skills' && repository.searchText.includes('skills')), 'skills must find mattpocock/skills');

const bytes = Buffer.byteLength(JSON.stringify(index));
const brotliBytes = brotliCompressSync(JSON.stringify(index)).length;
const bytesPerRepository = Math.round(bytes / Math.max(index.repositories.length, 1));
assert.ok(bytesPerRepository < 1800, `search index is too large: ${bytesPerRepository} bytes per repository`);
assert.ok(brotliBytes < 2 * 1024 * 1024, `compressed search index exceeded 2 MiB: migrate search to an API or worker`);

console.log(`Search data check passed: ${index.repositories.length} unique repositories, ${bytesPerRepository} bytes/repository, ${brotliBytes} bytes Brotli`);
