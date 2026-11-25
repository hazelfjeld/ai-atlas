const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
test('Discover, Technology and Research use the same action row source', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-shared-card-action-row:begin */')[1].split('/* atlas-shared-card-action-row:end */')[0];
  for (const selector of ['.story-footer', '.tech-shell .tech-card .card-actions', '.cards .card-bottom']) assert.ok(block.includes(selector));
  for (const rule of ['flex-wrap:wrap','gap:9px','padding-top:12px','border-top:1px solid var(--line)','font-weight:600','outline-offset:3px']) assert.ok(block.includes(rule),rule);
  const brand = read('brand.css');
  assert.ok(brand.includes('.story-footer{margin-top:auto;font-size:10px}'));
  assert.ok(read('technologies.html').includes('.tech-card .card-actions{margin-top:13px}'));
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css) && offline.includes(brand));
});

test('daily source links reuse the shared story action row without overriding its layout', () => {
  const reader = read('whats-new.js');
  const archive = read('whats-new.html');
  assert.ok(reader.includes("element('div',undefined,'links story-footer')"));
  assert.ok(reader.includes("a.target='_blank';a.rel='noopener noreferrer'"));
  assert.ok(reader.includes('if(links.childNodes.length)article.append(links)'));
  assert.ok(archive.includes('.item .links{margin-top:auto;font-size:13px}'));
  assert.ok(archive.includes('.item .links a{white-space:normal;margin-left:0}'));
  assert.equal([...archive.matchAll(/\.item \.links\{([^}]+)\}/g)].length, 1);
});
