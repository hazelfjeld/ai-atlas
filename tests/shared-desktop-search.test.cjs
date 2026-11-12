'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'site-theme.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');

test('native desktop rail gets one live Discover search route, including ../ detail pages', () => {
  const block = js.split('/* atlas-desktop-search:begin */')[1]
    ?.split('/* atlas-desktop-search:end */')[0];
  assert.ok(block, 'shared desktop search installer is required');
  for (const prefix of ['', '../']) {
    const added = [];
    const primary = {insertAdjacentElement(where, node) {
      assert.equal(where, 'beforebegin');
      added.push(node);
    }};
    const native = {getAttribute(name) {
      assert.equal(name, 'href');
      return prefix + 'index.html#/search';
    }};
    const rail = {querySelector() { return added[0] || null; }};
    const doc = {querySelector(selector) {
      assert.equal(selector, 'a.site-mobile-chrome__search[href]');
      return native;
    }, createElement(name) {
      assert.equal(name, 'a');
      return {attrs:{},setAttribute(key, val){this.attrs[key]=val;}};
    }};
    const ctx = {desktopPrimary:primary,desktopRail:rail,document:doc};
    vm.runInNewContext(block, ctx);
    vm.runInNewContext(block, ctx);
    assert.equal(added.length, 1, 'do not duplicate after rehydration');
    assert.equal(added[0].className, 'site-chrome__search');
    assert.equal(added[0].attrs.href, prefix + 'index.html#/search');
    assert.equal(added[0].attrs['aria-label'], 'Search AI Updates');
  }
  assert.ok(js.includes("closest?.('a.site-mobile-chrome__search[href],a.site-chrome__search[href]')"),
    'desktop and native mobile search both hand off focus to the real field');
});

test('all major site families retain their script-free routes and use shared styling', () => {
  const examples = [
    'whats-new.html', 'research.html', 'playbooks.html', 'games.html',
    'technologies.html', 'about.html', 'terms/index.html', 'technology/index.html',
    'terms/MLD-0001-a-b-test.html',
    'technology/TECH-0001-adversarial-robustness-toolbox.html',
  ];
  for (const route of examples) {
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    const prefix = route.includes('/') ? '../' : '';
    assert.ok(html.includes('href="' + prefix + 'index.html#/search"'),
      route + ': keep working search link without JS');
    assert.ok(html.includes('site-chrome__links'), route + ': keep the original desktop rail');
    assert.ok(html.includes('site-mobile-chrome__nav'), route + ': keep native mobile navigation');
  }
  assert.ok(css.includes('/* atlas-desktop-search:begin */'));
  assert.match(css, /\.site-chrome > a\.site-chrome__search:focus-visible/);
  assert.ok(offline.includes(css), 'single-file offline download uses the exact shared CSS');
  assert.ok(offline.includes(js), 'single-file offline download uses the exact shared script');
});
