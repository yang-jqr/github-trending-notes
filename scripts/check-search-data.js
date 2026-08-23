const assert = require('node:assert/strict');
const index = require('../public/search-data.json');

assert.ok(Array.isArray(index.repositories), 'repositories must be an array');
assert.ok(index.repositories.every(name => typeof name === 'string' && name.includes('/')), 'every entry must be owner/repo');
assert.equal(
  new Set(index.repositories.map(name => name.toLowerCase())).size,
  index.repositories.length,
  'repository names must be unique (case-insensitive)',
);

console.log(`Search data check passed: ${index.repositories.length} unique repositories`);
