const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Discover and catalog review overlines share readable metadata without changing badges', () => {
  const css = read('site-chrome.css'), brand = read('brand.css');
  const block = css.split('/* atlas-shared-card-metadata:begin */')[1].split('/* atlas-shared-card-metadata:end */')[0];
  assert.match(block, /\.story-body \.story-kicker,\s*\.shell:has\(> \.site-chrome\.nav\) article\.card > \.label\{/);
  for (const declaration of ['font-size:12px', 'font-weight:700', 'line-height:1.5', 'letter-spacing:.04em', 'overflow-wrap:anywhere']) {
    assert.ok(block.includes(declaration), declaration);
  }
  assert.doesNotMatch(brand, /\.story-body \.story-kicker\{[^}]*font-size/);
  assert.doesNotMatch(read('catalog-review.html'), /\.label\{[^}]*font-size/);
  assert.match(read('index.html'), /class="story-kicker"/);
  assert.match(read('discovery.js'), /class="story-kicker"/);
  assert.match(read('catalog-review.html'), /class="label"/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css) && offline.includes(brand));
});
