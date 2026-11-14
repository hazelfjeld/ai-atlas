'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Discover and native desktop rails use one sidebar-bottom style contract', () => {
  const app = read('app.css'), shared = read('site-chrome.css'), script = read('site-theme.js');
  const discover = read('index.html');
  assert.match(discover, /class="sidebar-bottom"/);
  assert.match(discover, /class="sidebar-actions"/);
  assert.match(script, /function buildSharedRailBottom\(rail\)/);
  assert.match(script, /bottom\.className = 'sidebar-bottom site-chrome__bottom'/);
  assert.match(script, /coverage\.href = prefix \+ 'index\.html#\/sources'/);
  assert.match(script, /const railBottom = buildSharedRailBottom\(rail\)/);
  assert.match(script, /container === desktopAction \? ' site-chrome__theme-toggle--rail icon-button'/);
  for (const selector of ['.sidebar-bottom{','.snapshot{','.sidebar-actions{']) {
    assert.ok(shared.includes(selector), 'shared stylesheet owns ' + selector);
    assert.ok(!app.includes(selector), 'Discover has no duplicate footer CSS: ' + selector);
  }
  for (const route of ['about.html','whats-new.html','research.html',
    'games.html','terms/MLD-0002-ablation-study.html',
    'technology/TECH-0216-pytorch.html']) {
    const html = read(route);
    assert.ok(html.includes('class="site-chrome'), route + ': script-free global rail');
    assert.ok(html.includes('site-mobile-chrome'), route + ': script-free mobile links');
  }
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(script), 'offline embeds current shared rail behavior');
  assert.ok(offline.includes(shared), 'offline embeds current rail CSS');
  assert.ok(offline.includes(app), 'offline embeds current Discover CSS');
});

test('standalone desktop uses one toggle while Games keeps its existing header control', () => {
  const script=read('site-theme.js');
  assert.match(script,/rail && !existing && desktopAction \? \[desktopAction, menu\]/);
  assert.match(script,/existing \? \[menu\] : \[\]/);
  assert.match(script,/syncSharedThemeAction\(button, theme\)/);
  assert.match(script,/button\.classList\.contains\('site-chrome__theme-toggle--rail'\)/);
});
