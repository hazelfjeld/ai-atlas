'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Research and Technology use one Discover-aligned first-content inset', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-desktop-first-content-alignment:begin */')[1]
    ?.split('/* atlas-desktop-first-content-alignment:end */')[0];
  assert.ok(block, 'one shared source owns native desktop hero spacing');
  assert.match(block, /@media \(min-width:651px\)/);
  assert.match(block, /\.shell:has\(> \.site-chrome\.research-site-chrome\) > main\{padding-top:calc\(var\(--atlas-workspace-intro-inset\) - 8px\)\}/);
  assert.match(block, /\.shell:has\(> \.site-chrome\.research-site-chrome\) > main > \.hero\{margin-top:8px\}/);
  assert.match(block, /\.tech-shell:has\(> \.site-chrome\.tech-top\)\{padding-top:0\}/);
  assert.match(block, /\.tech-shell:has\(> \.site-chrome\.tech-top\) > main > \.tech-hero\{padding-top:var\(--atlas-workspace-intro-inset\)\}/);
  for (const [file, rail, hero] of [
    ['research.html', 'research-site-chrome', 'hero'],
    ['technologies.html', 'tech-top', 'tech-hero'],
  ]) {
    const html = read(file);
    assert.ok(html.includes('class="site-chrome ' + rail + '"'), file + ': shared rail');
    assert.ok(html.indexOf('class="site-chrome ' + rail + '"') < html.indexOf('<main'), file);
    assert.ok(html.includes('class="' + hero + '" id="main"'), file + ': real heading/skip target');
    assert.ok(html.includes('href="index.html#/search"'), file + ': working search route');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'offline fallback embeds exact shared CSS and not the old hero rhythm');
});

test('generated concept and technology articles use the same Discover desktop first-content baseline', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-desktop-first-content-alignment:begin */')[1]
    ?.split('/* atlas-desktop-first-content-alignment:end */')[0];
  assert.ok(block, 'existing shared desktop-alignment contract is present');
  assert.ok(block.includes('body:has(> nav.site-chrome.term-nav) > main.term-shell{padding-top:calc(var(--atlas-workspace-intro-inset) - 8px)}'),
    'hero-first reference articles share shared inset minus the 8px hero margin');
  assert.ok(block.includes('body:has(> nav.site-chrome.term-nav) > main.term-shell:has(> .breadcrumb-links){padding-top:var(--atlas-workspace-intro-inset)}'),
    'breadcrumb-first technology profiles share a shared first-content inset');
  for (const [file, breadcrumbs] of [
    ['terms/MLD-1345-zero-shot-prompting.html', false],
    ['technology/TECH-0303-tohoku-aisin-16-nm-stt-mram-edge-ai-soc.html', true],
    ['terms/index.html', false],
    ['technology/index.html', false],
    ['about.html', false],
  ]) {
    const html = read(file);
    assert.ok(html.includes('<nav class="site-chrome term-nav"'),
      file + ': native script-free primary rail remains present');
    assert.ok(html.indexOf('<nav class="site-chrome term-nav"') < html.indexOf('<main class="term-shell">'),
      file + ': rail precedes the article landmark');
    assert.equal(html.includes('class="breadcrumb-links"'), breadcrumbs,
      file + ': its existing first-content structure is unchanged');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'the single-file fallback embeds exactly the updated shared stylesheet');
});

test('generated reference first-content offsets are desktop-only, not leaked onto 320px/390px layouts', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-desktop-first-content-alignment:begin */')[1]
    ?.split('/* atlas-desktop-first-content-alignment:end */')[0];
  assert.ok(block, 'shared desktop alignment is present');
  const mediaStart = block.indexOf('@media (min-width:651px){');
  assert.notEqual(mediaStart, -1, 'desktop-only media query exists');
  let depth = 0;
  let mediaClose = -1;
  for (let i = mediaStart + '@media (min-width:651px)'.length; i < block.length; i++) {
    if (block[i] === '{') depth++;
    if (block[i] === '}') {
      depth--;
      if (depth === 0) { mediaClose = i; break; }
    }
  }
  assert.ok(mediaClose > mediaStart, 'desktop media block closes properly');
  for (const selector of [
    'body:has(> nav.site-chrome.term-nav) > main.term-shell{padding-top:calc(var(--atlas-workspace-intro-inset) - 8px)}',
    'body:has(> nav.site-chrome.term-nav) > main.term-shell:has(> .breadcrumb-links){padding-top:var(--atlas-workspace-intro-inset)}',
  ]) {
    const offset = block.indexOf(selector);
    assert.ok(offset > mediaStart && offset < mediaClose, selector + ' is within desktop media');
  }
  assert.equal(block.slice(mediaClose + 1).trim(), '', 'no reference offset can leak into mobile cascade');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'offline build carries the corrected desktop-only query');
});

test('remaining native editorial workspaces share the desktop first-content inset', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-desktop-first-content-alignment:begin */')[1]
    .split('/* atlas-desktop-first-content-alignment:end */')[0];
  const rules = [
    '.playbook-shell:has(> .site-chrome.playbook-top){padding-top:calc(var(--atlas-workspace-intro-inset) - 8px)}',
    '.playbook-shell:has(> .site-chrome.playbook-top) > main > .playbook-hero{margin-top:8px}',
    '.shell:has(> .site-chrome.nav){padding-top:0}',
    '.shell:has(> .site-chrome:is(.top,.nav)) > main{padding-top:calc(var(--atlas-workspace-intro-inset) - 8px)}',
    '.shell:has(> .site-chrome:is(.top,.nav)) > main > header{padding-top:8px}',
    'body:has(> .site-chrome.review-nav) > main.review-shell{padding-top:var(--atlas-workspace-intro-inset)}',
    'body:has(> .site-chrome.review-nav) > main.review-shell > header{padding-top:0}',
    'body:has(> .site-chrome.demo-site-chrome) > main{padding-top:calc(var(--atlas-workspace-intro-inset) - 8px)}',
    'body:has(> .site-chrome.demo-site-chrome) > main > header{padding-top:8px}',
  ];
  for (const rule of rules) assert.ok(block.includes(rule), rule);
  for (const [file, rail] of [
    ['whats-new.html','top'], ['catalog-review.html','nav'],
    ['playbooks.html','playbook-top'], ['hardware-review.html','review-nav'],
    ['demo.html','demo-site-chrome'],
  ]) {
    const html = read(file);
    assert.ok(html.includes('class="site-chrome ' + rail + '"'), file);
    assert.ok(html.indexOf('class="site-chrome ' + rail + '"') < html.indexOf('<main'), file);
    assert.ok(html.includes('id="main" tabindex="-1"'), file);
    assert.ok(html.includes('href="index.html#/search"'), file);
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css));
  assert.match(read('tests/site-deployment-browser.py'), /Editorial first-content inset/);
});

test('Discover and standalone Games consume the shared desktop inset without changing gameplay', () => {
  const block = read('site-chrome.css').split('/* atlas-desktop-first-content-alignment:begin */')[1].split('/* atlas-desktop-first-content-alignment:end */')[0];
  for (const rule of [
    ':root{--atlas-workspace-intro-inset:37px}',
    '@media (max-width:1150px){:root{--atlas-workspace-intro-inset:30px}}',
    '.app-shell .workspace > main{padding-top:var(--atlas-workspace-intro-inset)}',
    'body:has(> .games-header):not(.is-playing) > main{padding-top:var(--atlas-workspace-intro-inset)}',
    'body:has(> .games-header) > main > .hero{padding-top:0}',
  ]) assert.ok(block.includes(rule), rule);
  assert.ok(read('games.css').includes('.is-playing main{padding-top:28px}'));
});
