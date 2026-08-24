const assert = require('node:assert/strict');
const index = require('../public/search-data.json');

assert.ok(Array.isArray(index.repositories), 'repositories must be an array');
assert.ok(index.repositories.every(repository => (
  typeof repository.name === 'string' && repository.name.includes('/')
  && typeof repository.description === 'string' && repository.description.length > 0
  && /^trending-\d{4}-\d{2}-\d{2}$/.test(repository.slug)
  && /^\d{4}-\d{2}-\d{2}$/.test(repository.date)
  && Array.isArray(repository.dates) && repository.dates.includes(repository.date)
  && Array.isArray(repository.languages)
  && typeof repository.searchText === 'string' && repository.searchText.length > 0
)), 'every entry must contain a repository name, intro, note link, date and searchable text');
assert.equal(
  new Set(index.repositories.map(repository => repository.name.toLowerCase())).size,
  index.repositories.length,
  'repository names must be unique (case-insensitive)',
);
const recurring = index.repositories.find(repository => repository.name.toLowerCase() === 'mattpocock/skills');
assert.ok(recurring?.description && recurring.appearances > 1, 'recurring repositories must keep an intro and appearance count');

console.log(`Search data check passed: ${index.repositories.length} unique repositories`);
