'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Games is an original workspace hash route, not a second website link', () => {
  const html = read('index.html'), app = read('app.js');
  assert.ok(!html.includes('href="games.html"'));
  assert.match(app, /games:'Games'/);
  assert.match(app, /'playbooks','games','compare'/);
  assert.ok(app.includes("else if(view==='games')"));
  assert.ok(app.includes('AtlasGamesTab.mount'));
  for(const name of ['games-core.js','games-tab.js']) assert.ok(html.includes('src="'+name+'"'));
  assert.ok(html.includes('href="games-tab.css"'));
});
test('Native Games reuses catalog, cleans up listeners/timers, and opens Atlas concept dialogs', () => {
  const ui = read('games-tab.js'), app = read('app.js');
  new vm.Script(ui);
  assert.ok(ui.includes('mount(root, data, options'));
  assert.ok(ui.includes('lifecycle.abort(); clearTimers();'));
  assert.ok(!ui.includes('await window.ATLAS_READY'));
  assert.ok(!ui.includes('document.body.classList'));
  assert.ok(app.includes('disposeGames();disposeGames=null;'));
  assert.ok(app.includes('openConcept:openRecord'));
  assert.ok(!ui.includes('<iframe'));
});
test('Standalone game links still work with shared game engine', () => {
  const html = read('games.html');
  for(const name of ['catalog-loader.js','core.js','games-core.js','games.js']) assert.ok(html.includes('src="'+name+'"'));
});
test('Offline fallback embeds Games without redirecting learners to another site', () => {
  const html = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(html.includes('window.AtlasGamesTab'));
  assert.ok(html.includes("else if(view==='games')"));
  assert.ok(!html.includes('<span>Games (online)</span>'));
  assert.ok(!html.includes('href="https://raw.githack.com/hazelfjeld/ai-atlas/main/games.html"'));
  assert.ok(!html.includes('src="games-tab.js"'));
  assert.ok(!html.includes('href="games-tab.css"'));
});
