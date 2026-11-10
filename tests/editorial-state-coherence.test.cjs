'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('About and Research describe the same published editorial state as the dated archive', () => {
  const archive = JSON.parse(read('data/daily/index.json'));
  const ledger = JSON.parse(read('data/daily/published-batches.json'));
  assert.ok(archive.editions.length > 0 && archive.last_successful_publish_at,
    'The corrected editorial copy is only valid after the first verified edition');
  const latest = archive.editions.at(-1);
  assert.ok(ledger.receipts.some(item => item.publication_edition === latest.date + '-v' + latest.revision),
    'The latest dated edition must have a durable source-batch receipt');
  const about = read('about.html');
  const template = read('scripts/build_seo.py');
  const research = read('research.html');
  for (const [name, content] of [['About page', about], ['About generator', template]]) {
    assert.ok(content.includes('Reviewed daily editions are available in the dated archive.'),
      name + ' must identify the already-published archive');
    assert.ok(!content.includes('Until the first reviewed edition is published'),
      name + ' must not revert to pre-publication placeholder copy');
  }
  assert.match(about, /href="whats-new\.html">Read the edition archive/);
  assert.match(research, /href="whats-new\.html">dated What’s New archive<\/a>/);
  assert.ok(!research.includes('Automatic collection remains off.'),
    'Research must not contradict the authorized daily editorial pipeline');
  assert.ok(research.includes('not a continuously live news feed'),
    'Research must not imply that the site crawls or verifies continuously');
});
