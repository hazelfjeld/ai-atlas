'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('shared desktop rail distinguishes hovered from active destinations, as Discover does', () => {
  const css = read('site-chrome.css');
  const discover = read('brand.css');
  const hover = '.site-chrome .site-chrome__links a:hover{\n color:#fff!important;background:#ffffff0c!important\n}';
  const selected = '.site-chrome .site-chrome__links a[aria-current]{\n color:#fff!important;background:#ffffff13!important\n}';
  assert.ok(discover.includes('.nav-link:hover{background:#ffffff0C}'));
  assert.ok(discover.includes('.nav-link.active{background:#ffffff13;color:#fff}'));
  assert.ok(css.includes(hover), 'hover should be visually weaker than selected');
  assert.ok(css.includes(selected), 'current section remains clearly selected');
  assert.ok(css.indexOf(hover) < css.indexOf(selected), 'selected overrides simultaneous hover');
  assert.ok(!css.includes('a:hover,\n.site-chrome .site-chrome__links a[aria-current]'));
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(hover) && offline.includes(selected), 'single-file fallback matches shared rail');
});
test('the shared current-section contract survives across page families', () => {
  const routes = [
    'whats-new.html', 'playbooks.html', 'games.html', 'technologies.html',
    'about.html', 'terms/MLD-0002-ablation-study.html',
    'technology/TECH-0216-pytorch.html'
  ];
  for (const route of routes) {
    const html = read(route);
    const nav = html.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/);
    assert.ok(nav, route + ': shared primary rail');
    assert.equal((nav[1].match(/aria-current=/g) || []).length, 1,
      route + ': one and only one selected primary section');
  }
});
