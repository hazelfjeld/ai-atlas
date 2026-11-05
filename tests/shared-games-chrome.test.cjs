'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const primary = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
const links = html => [...html.matchAll(/<a href="([^"]+)"(?: aria-current="[^"]+")?>([^<]+)<\/a>/g)].map(m => [m[1],m[2]]);
test('standalone Games and daily archive reuse the same primary desktop and mobile destinations', () => {
  const games=read('games.html'), news=read('whats-new.html');
  const desktop=html => html.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
  const mobile=html => html.match(/<nav class="[^"]*site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
  for(const [route,html,active] of [['Games',games,'Games'],['News',news,'What’s New Today']]) {
    assert.match(html, /href="site-chrome\.css"/, route+' must load the shared styles');
    assert.match(html, /class="[^"]*site-mobile-chrome"/,route+' must use shared mobile controls');
    const d=desktop(html),m=mobile(html);
    assert.ok(d&&m,route+' must expose desktop and mobile menus before JavaScript');
    assert.deepEqual(links(d).map(x=>x[1]),primary);
    assert.deepEqual(links(m).map(x=>x[1]),primary);
    assert.equal((m.match(/aria-current="page"/g)||[]).length,1);
    assert.match(m,new RegExp('aria-current="page">'+active+'<\\/a>'));
    assert.match(html, /href="index\.html#\/search"/,route+' search must navigate to a real feature');
  }
  assert.ok(!games.includes('class="masthead"'),'Games must not retain disconnected alternate header');
  assert.match(games, /class="site-chrome games-site-chrome"/);
  assert.match(games, /id="games-mobile-nav"/);
});
test('shared mobile chrome has native keyboard controls and touch-sized navigation', () => {
  const css=read('site-chrome.css');
  for(const cls of ['site-mobile-chrome','site-mobile-chrome__toggle','site-mobile-chrome__menu','site-mobile-chrome__search'])
    assert.ok(css.includes('.'+cls+'{'),cls+' has shared styling');
  assert.match(css,/\.site-mobile-chrome__toggle\{[^}]*min-height:44px/);
  assert.match(css,/\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(css,/\.site-mobile-chrome__search\{[^}]*min-height:44px/);
  assert.match(css, /\.site-mobile-chrome a:focus-visible,\.site-mobile-chrome summary:focus-visible/);
  assert.match(css, /@media print\{\.site-mobile-chrome\{display:none!important\}\}/);
});
test('standalone Games participates in the workspace theme choice without depending on localStorage', () => {
  const games=read('games.js'),html=read('games.html');
  assert.match(games,/setAttribute\('aria-pressed', String\(document.documentElement.dataset.theme === 'dark'\)\)/);
  assert.match(html,/localStorage\.setItem\('atlas\.theme', document\.documentElement\.dataset\.theme\)/);
  assert.match(html,/document.addEventListener\('DOMContentLoaded'/);
  assert.match(html,/localStorage\.getItem\('atlas\.theme'\)/);
  assert.match(html,/if \(saved === 'dark' \|\| saved === 'light'\)/);
  assert.ok(html.indexOf('localStorage.getItem')<html.indexOf('href="games.css"'), 'saved theme is applied before CSS paint');
});
