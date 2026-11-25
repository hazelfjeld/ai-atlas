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

test('playbook disclosures reuse the shared action frame and retain native summary and deep links', () => {
  const reader = read('playbooks.js');
  const page = read('playbooks.html');
  assert.ok(reader.includes("el('div', undefined, 'story-footer playbook-disclosure')"));
  assert.ok(reader.includes("const details = el('details'); const summary = el('summary', 'Read steps, checks and tradeoffs'); details.append(summary)"));
  assert.ok(reader.includes('actions.append(details); article.append(actions)'));
  assert.ok(reader.includes("record.querySelector('details')"));
  assert.ok(page.includes('.playbook .playbook-disclosure>details{flex:1 1 100%;min-width:0;margin:0}'));
  assert.ok(page.includes('.playbook .playbook-disclosure summary{font-weight:600;min-height:44px;padding:10px 0;line-height:1.5}'));
  assert.ok(!page.includes('.playbook details[open]{margin-top:16px}'));
  assert.ok(page.includes('data/playbooks-01.json'));
});

test('catalog review evidence links reuse the shared action frame without changing static routes', () => {
  const page = read('catalog-review.html');
  const rows = [...page.matchAll(/<div class="links story-footer">([\s\S]*?)<\/div>/g)];
  assert.equal(rows.length,7);
  assert.ok(rows.every(row => (row[1].match(/<a href="/g)||[]).length >= 2));
  assert.equal(rows.reduce((n,row) => n+(row[1].match(/<a href="/g)||[]).length,0),21);
  assert.ok(rows.some(row => row[1].includes('href="terms/MLD-0110-benchmark.html"')));
  assert.ok(rows.some(row => row[1].includes('href="https://gdpx.semianalysis.com/" rel="noopener noreferrer"')));
  assert.ok(page.includes('.card .links{font-size:14px;margin-top:14px}'));
  assert.ok(page.includes('.card .links a{white-space:normal;margin-left:0}'));
  assert.ok(!page.includes('.links{display:flex;flex-wrap:wrap;gap:8px 18px'));
});
