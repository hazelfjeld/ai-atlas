'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('native desktop navigation follows Discover type rhythm across page families', () => {
  const css = read('site-chrome.css');
  const app = read('app.css');
  assert.match(app, /\.nav-link\{[^}]*font-size:12px/);
  assert.match(css, /\.site-chrome,\.site-mobile-chrome\{\s*font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;/);
  assert.match(css, /\.site-chrome \.site-chrome__links a\{line-height:1\.6\}/);
  assert.match(css, /\.site-mobile-chrome\{font-size:15px;line-height:1\.6\}/);
  assert.ok(!css.includes('body:has(.site-chrome){font-family:'), 'content fonts stay independent');
  for (const route of ['whats-new.html', 'research.html', 'playbooks.html', 'about.html', 'terms/MLD-1039-reward-hacking.html']) {
    const html = read(route);
    assert.ok(html.includes('class="site-chrome'), route + ': shared desktop rail');
    assert.ok(html.includes('site-mobile-chrome'), route + ': shared workspace header');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css), 'offline embeds the same source CSS');
});
