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
