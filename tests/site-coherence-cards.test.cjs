'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');

test('Playbooks, Technology, Research and editorial reviews reuse Discover card type', () => {
  const block = css.split('/* atlas-editorial-card-copy:begin */')[1]
    ?.split('/* atlas-editorial-card-copy:end */')[0];
  assert.ok(block, 'Missing shared card typography implementation');
  for (const selector of [
    '.playbook-shell .playbook > h2',
    '.tech-shell .tech-card > h3',
    '.shell:has(> .site-chrome.nav) article.card > h3',
    '.shell:has(> main > .site-chrome.research-site-chrome) .cards > .card > h3'
  ]) assert.ok(block.includes(selector), 'Missing card family: ' + selector);
  assert.match(block, /font:400 clamp\(20px,2vw,23px\)\/1\.25 Georgia/);
  assert.match(block, /color:var\(--ink\)/);
  assert.match(block, /\.playbook-shell \.playbook > p,[\s\S]*?color:var\(--muted\)/);
  assert.ok(!block.includes('display:none'), 'Do not hide page navigation or cards');
});

test('shared editorial cards match Discover hover and expose keyboard focus in either theme', () => {
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  const block = css.split('/* atlas-card-interactions:begin */')[1]
    ?.split('/* atlas-card-interactions:end */')[0];
  assert.ok(block, 'Missing single shared card interaction rule');
  assert.ok(brand.includes('.discovery-card:hover{border-color:#9AAD9C}'));
  for (const selector of [
    '.playbook-shell .playbook',
    '.tech-shell .tech-card',
    '.shell:has(> .site-chrome.nav) article.card',
    '.shell:has(> main > .site-chrome.research-site-chrome) .cards > .card'
  ]) assert.ok(block.includes(selector), 'Missing card family: ' + selector);
  assert.ok(block.includes(':is(:hover,:focus-within)'));
  assert.ok(block.includes(':root[data-theme="dark"]') && block.includes('prefers-color-scheme:dark'));
  assert.ok(!block.includes('pointer-events:none') && !block.includes('display:none'));
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline demo must embed the exact updated CSS');
});

test('generated concept and technology article headlines reuse Discover typography in both themes and mobile widths', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  const block = css.split('/* atlas-shared-headlines:begin */')[1]
    ?.split('/* atlas-shared-headlines:end */')[0];
  assert.ok(block, 'Missing shared reference-heading source');
  assert.ok(brand.includes('.discover-heading h1{font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'), 'Discover desktop heading token changed');
  assert.ok(block.includes('font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'), 'Reference desktop title must match Discover');
  assert.ok(block.includes('@media(max-width:650px)') && block.includes('h1{font-size:43px}'),
    'Reference mobile title must match Discover, including 320px');
  assert.ok(block.includes(':not(:has(.discover-heading))'), 'Do not override existing directory landing headings');
  assert.ok(!block.includes('display:none'), 'Do not conceal native article headings');
  for (const route of ['terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html']) {
    const html=fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /<header class="hero"[^>]*><p class="eyebrow">/);
    assert.ok(html.includes('<h1>') && html.includes('</h1>'), route + ' keeps a semantic article title');
    assert.match(html, /<a class="skip" href="#main">/, route + ' retains native skip');
  }
  const offline=fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the exact shared CSS');
});

test('native mobile header shares Discover height across directories, news, editorials and Games', () => {
  const block = css.split('/* atlas-mobile-chrome-rhythm:begin */')[1]
    ?.split('/* atlas-mobile-chrome-rhythm:end */')[0];
  assert.ok(block, 'Shared native mobile header rhythm missing');
  assert.match(block, /@media\(max-width:650px\)/);
  assert.ok(block.includes('.site-mobile-chrome:not(.discover-mobile-chrome)'));
  assert.ok(block.includes('padding-block:12px!important'));
  assert.ok(block.includes('min-height:68px'));
  assert.ok(block.includes('.games-header .site-mobile-chrome') && block.includes('padding-block:0!important'),
    'Do not duplicate Games containing-header padding');
  for (const route of ['terms/index.html','technology/index.html','whats-new.html',
                       'research.html','playbooks.html','games.html','about.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /class="[^"]*site-mobile-chrome/);
  }
  const offline = fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline workspace must carry exact shared styling');
});

test('Discover first paint keeps its useful content stable without perpetual loading', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const block = css.split('/* atlas-discover-first-paint:begin */')[1]
    ?.split('/* atlas-discover-first-paint:end */')[0];
  assert.ok(block, 'Missing shared first-paint correction');
  assert.match(home, /id="catalog-loading" class="catalog-loading" role="status"/,
    'Preserve the hydration sentinel for readiness tests and assistive technology');
  assert.match(home, /<div id="page"><!-- discovery:start -->/,
    'Preserve the server-rendered Discover preview');
  assert.ok(css.includes('.shell:has(> .site-chrome.top){padding-top:0!important}'),
    'Archive and Discover should share the same first-content workspace frame');
  assert.ok(block.includes('#catalog-loading{display:none}'),
    'Without JavaScript, never present a perpetual loading notice');
  assert.ok(block.includes('html.atlas-enhanced #catalog-loading') &&
    block.includes('position:absolute') && block.includes('clip-path:inset(50%)'),
    'Scripted status must announce loading without moving the article');
  assert.ok(theme.includes("classList?.add('atlas-enhanced')"),
    'Only enhanced pages announce pending catalog loading');
  assert.ok(app.includes("document.getElementById('catalog-loading').remove()"),
    'Remove the status when catalog hydration succeeds');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline demo must embed the exact shared stylesheet');
});

test('theme preference stays synchronized across open editorial and reference tabs', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  assert.ok(theme.includes("window.addEventListener('storage', (event) =>"));
  assert.ok(theme.includes("event.key === 'atlas.theme'"));
  assert.ok(theme.includes('syncSharedStoredTheme(event.newValue)'));
  assert.ok(theme.includes('syncSharedStoredTheme(savedTheme)'),
    'BFCache restoration and cross-tab updates must reuse the same theme state');
  assert.ok(theme.includes("button.setAttribute('aria-pressed'"),
    'Cross-tab updates must synchronize the visible theme controls');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes("window.addEventListener('storage', (event) =>"),
    'The offline fallback must embed the current shared theme script');
});


test('mobile news intro uses the same editorial content-start rhythm as directory landings',()=>{
  const block=css.split('/* atlas-mobile-news-intro-rhythm:begin */')[1]
    ?.split('/* atlas-mobile-news-intro-rhythm:end */')[0];
  assert.ok(block,'Shared news landing intro rhythm missing');
  assert.match(block,/@media \(max-width:650px\)/);
  assert.match(block,/\.shell:has\(> \.site-chrome\.top\) > main > header\{padding-top:8px\}/);
  const archive=fs.readFileSync(path.join(__dirname,'..','whats-new.html'),'utf8');
  const terms=fs.readFileSync(path.join(__dirname,'..','terms/index.html'),'utf8');
  const playbooks=fs.readFileSync(path.join(__dirname,'..','playbooks.html'),'utf8');
  assert.match(archive,/<nav class="site-chrome top"/);
  assert.match(archive,/<main>\s*<header id="main" tabindex="-1">/);
  assert.match(terms,/<header class="hero" id="main" tabindex="-1">/);
  assert.match(playbooks,/<section class="playbook-hero"/);
  assert.ok(!block.includes('display:none')&&!block.includes('pointer-events:none'));
  const offline=fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline snapshot must embed the exact shared chrome CSS');
});

test('script-free daily archive and catalog review skip links focus the editorial heading, not the main wrapper', () => {
  for (const route of ['whats-new.html', 'catalog-review.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /<a class="skip" href="#main">/);
    assert.match(html, /<main>\s*<header id="main" tabindex="-1">/);
    assert.doesNotMatch(html, /<main id="main"/);
    assert.equal((html.match(/id="main"/g) || []).length, 1, route + ' has one skip target');
    assert.match(html, /<header id="main" tabindex="-1">[\s\S]*?<h1[\s>]/);
  }
});
