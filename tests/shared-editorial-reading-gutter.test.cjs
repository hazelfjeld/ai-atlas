'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Discover, Playbooks and News use a single desktop reading gutter owner', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-shared-editorial-reading-gutter:begin */')[1]
    ?.split('/* atlas-shared-editorial-reading-gutter:end */')[0];
  assert.ok(block);
  assert.ok(block.includes('@media (min-width:651px)'));
  assert.ok(block.includes('--atlas-workspace-content-gutter:40px'));
  assert.ok(block.includes('@media (min-width:651px) and (max-width:1200px)'));
  assert.ok(block.includes('--atlas-workspace-content-gutter:26px'));
  for (const selector of ['.app-shell .workspace > main',
    '.playbook-shell:has(> .site-chrome.playbook-top)',
    '.shell:has(> .site-chrome.top)']) assert.ok(block.includes(selector));
  assert.ok(block.includes('padding-inline:var(--atlas-workspace-content-gutter)!important'));
  assert.ok(block.includes('> main{\n    padding-inline:0;'));
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css));
  for (const file of ['playbooks.html','whats-new.html']) {
    const html = read(file);
    assert.ok(html.includes('href="index.html#/overview"'));
    assert.ok(html.includes('href="index.html#/search"'));
  }
  assert.ok(read('tests/site-deployment-browser.py').includes('Shared editorial reading gutter'));
});
