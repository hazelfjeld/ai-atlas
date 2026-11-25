const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Discover and four editorial card families share one responsive inline inset', () => {
  const css = read('site-chrome.css');
  const start = '/* atlas-shared-editorial-card-inset:begin */';
  const end = '/* atlas-shared-editorial-card-inset:end */';
  assert.equal(css.split(start).length, 2);
  assert.equal(css.split(end).length, 2);
  const block = css.split(start)[1].split(end)[0];
  for (const selector of ['.story-body', '.playbook-shell .playbook', '.tech-shell .tech-card',
    '.shell:has(> .site-chrome.nav) article.card',
    '.shell:has(> .site-chrome.research-site-chrome) .cards > .card']) {
    assert.ok(block.includes(selector), selector);
  }
  for (const declaration of [':root{--atlas-editorial-card-inset:17px}',
    '@media(max-width:1150px){:root{--atlas-editorial-card-inset:16px}}',
    '@media(max-width:650px){:root{--atlas-editorial-card-inset:13px}}',
    '@media(max-width:520px){:root{--atlas-editorial-card-inset:20px}}']) assert.ok(block.includes(declaration), declaration);
  assert.equal((block.match(/padding-inline:var\(--atlas-editorial-card-inset\)/g) || []).length, 1);
  assert.doesNotMatch(block, /padding-block:|padding:|display:|overflow:/);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css), 'Offline must contain the exact shared stylesheet');
});
