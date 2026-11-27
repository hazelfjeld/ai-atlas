'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

test('Discover and native primary rail rows use the same desktop type and dimensions', () => {
  const css = read('site-chrome.css');
  const frame = css.split('/* atlas-unified-desktop-rail-frame:begin */')[1]
    ?.split('/* atlas-unified-desktop-rail-frame:end */')[0];
  assert.ok(frame);
  const shared = /#navigation > \.site-chrome__links > a\.nav-link,\s*\.site-chrome \.site-chrome__links a\{([^}]+)\}/g;
  const rules = [...frame.matchAll(shared)].map(m => m[1]);
  assert.equal(rules.length, 3);
  for (const declaration of ['min-height:44px', 'padding:11px 12px!important', 'font-size:13px!important', 'line-height:1.55!important', 'gap:4px'])
    assert.ok(rules[0].includes(declaration), declaration);
  assert.match(frame, /@media \(min-width:651px\) and \(max-width:1200px\)/);
  assert.ok(rules[1].includes('font-size:12px!important'));
  assert.ok(rules[2].includes('padding-inline:8px!important'));
  assert.match(frame, /a\.nav-link > \.nav-count\{\s*flex:none;padding:2px 3px;/);
  assert.match(read('index.html'), /<span class="nav-count">1,345<\/span>/);
  assert.match(read('index.html'), /<span class="nav-count">303<\/span>/);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css));
});
