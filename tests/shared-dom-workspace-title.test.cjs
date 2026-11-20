'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const script = read('site-theme.js');
const start = script.indexOf('function ensureSharedWorkspaceTitle(');
const end = script.indexOf('\n// The main workspace consumes', start);
assert.ok(start >= 0 && end > start, 'shared title renderer is defined once');
const implementation = script.slice(start, end);

function render({existing = false, native = true, label = 'Zero-shot prompting', hasDrawer = true} = {}) {
  const added = [];
  const title = existing ? {textContent: 'Existing page title'} : null;
  const drawer = hasDrawer ? {insertAdjacentElement(position, node) {
    assert.equal(position, 'afterend');
    added.push(node);
  }} : null;
  const chrome = {querySelector(selector) {
    if (selector === ':scope > .site-mobile-chrome__title') return title || added[0] || null;
    if (selector === ':scope > details.site-mobile-chrome__nav') return drawer;
    throw new Error('Unexpected selector: ' + selector);
  }};
  let made = 0;
  const document = {
    querySelector(selector) {
      assert.equal(selector, '.site-chrome');
      return native ? {} : null;
    },
    createElement(tag) {
      assert.equal(tag, 'span');
      made++;
      return {className:'', textContent:''};
    },
  };
  vm.runInNewContext(implementation + '\nensureSharedWorkspaceTitle(chrome, label);\nensureSharedWorkspaceTitle(chrome, label);',
    {document, chrome, label});
  return {added, made};
}

test('generated concept and technology pages gain exactly one real workspace title', () => {
  for (const label of ['Zero-shot prompting', 'PyTorch', 'Concept encyclopedia']) {
    const {added, made} = render({label});
    assert.equal(made, 1);
    assert.equal(added.length, 1);
    assert.equal(added[0].className, 'site-mobile-chrome__title');
    assert.equal(added[0].textContent, label);
  }
});

test('shared renderer preserves native editorial headings, no-JS fallback and Discover', () => {
  assert.equal(render({existing:true}).made, 0, 'no second heading on a native editorial page');
  assert.equal(render({native:false}).made, 0, 'Discover keeps its original topbar');
  assert.equal(render({label:''}).made, 0, 'no blank heading');
  assert.equal(render({hasDrawer:false}).made, 0, 'no insertion without a native drawer');
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome:has\(> \.site-mobile-chrome__title\)::before\{display:none\}/,
    'the real text replaces the pseudo heading without a duplicate');
  assert.match(read('terms/MLD-1345-zero-shot-prompting.html'), /data-page-label="Zero-shot prompting"/);
  assert.match(read('terms/index.html'), /data-page-label="Concept encyclopedia"/);
  assert.match(read('whats-new.html'), /<span class="site-mobile-chrome__title">What.s New Today<\/span>/);
  assert.match(script, /chrome\.dataset\.pageLabel = label;\s*ensureSharedWorkspaceTitle\(chrome, label\)/);
});

test('offline fallback embeds identical title behavior without another title implementation', () => {
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(script));
  assert.equal((script.match(/function ensureSharedWorkspaceTitle\(/g) || []).length, 1);
  assert.doesNotMatch(script.slice(0, start), /titleNode\.className = 'site-mobile-chrome__title'/,
    'reference detail special case no longer maintains a second renderer');
});
