'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('eleven native/editorial/reference landings share canonical script-free Research navigation', () => {
  const roots = ['whats-new.html', 'research.html', 'technologies.html',
    'playbooks.html', 'games.html', 'catalog-review.html', 'hardware-review.html',
    'demo.html', 'about.html'];
  const pages = [...roots, 'terms/index.html', 'technology/index.html'];
  for (const file of pages) {
    const html = read(file);
    const prefix = file.includes('/') ? '../' : '';
    const target = 'href="' + prefix + 'research.html"';
    const mobile = html.match(/<details class="site-mobile-chrome__more"[^>]*>[\s\S]*?<\/details>/)?.[0];
    const desktop = html.match(/<details class="site-chrome__more"[^>]*>[\s\S]*?<\/details>/)?.[0];
    assert.ok(mobile && desktop, file + ' must keep both real More disclosures');
    assert.equal((mobile.match(new RegExp(target, 'g')) || []).length, 1, file + ' mobile');
    assert.equal((desktop.match(new RegExp(target, 'g')) || []).length, 1, file + ' desktop');
    assert.ok(!html.includes('href="' + prefix + 'index.html#/papers"'),
      file + ' must not require hydration to enter the canonical Research workspace');
  }
  assert.equal((read('index.html').match(/href="research\.html"/g) || []).length, 3,
    'Discover remains canonical in desktop, mobile and the reading desk');
});

test('shared generator, legacy details and bundled offline research routes remain intact', () => {
  const generator = read('scripts/site_chrome.py');
  assert.ok(generator.includes('def secondary_destination_href('));
  assert.ok(generator.includes('canonical_research=True'));
  assert.ok(generator.includes('canonical_research=(path == \'technology/index.html\')') === false,
    'technology landing switch is selected by the SEO builder, not duplicated in the nav source');
  assert.ok(read('scripts/build_seo.py').includes("canonical_research=(path == 'technology/index.html')"));
  assert.ok(read('scripts/build_term_pages.py').includes("canonical_research=(path == 'terms/index.html')"));
  for (const file of ['terms/MLD-1179-structured-output.html', 'technology/TECH-0216-pytorch.html']) {
    assert.ok(read(file).includes('href="../index.html#/papers"'),
      file + ' retains the original generated detail link until its whole family is rebuilt');
  }
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes('href="#/papers">Research library</a>'));
  assert.ok(offline.includes('href="#/papers">Open the library'));
});
