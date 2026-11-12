'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = ['research.html', 'demo.html', 'hardware-review.html', 'about.html', 'terms/index.html', 'technology/index.html'];

test('six native page families expose a global footer outside their article landmark', () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const mainStart = html.indexOf('<main');
    const mainEnd = html.indexOf('</main>');
    const footerStart = html.indexOf('<footer class="site-chrome__footer">');
    const footerEnd = html.indexOf('</footer>');
    assert.ok(mainStart >= 0 && mainEnd > mainStart, page + ': main');
    assert.equal((html.match(/<main\b/g) || []).length, 1, page + ': one main');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, page + ': one footer');
    assert.ok(footerStart > mainEnd && footerEnd > footerStart, page + ': global contentinfo');
    assert.ok(footerEnd < html.indexOf('</body>'), page + ': footer retained in body');
    const prefix = page.includes('/') ? '../' : '';
    assert.ok(html.includes('href="' + prefix + 'about.html"'), page + ': editorial policy link');
    assert.ok(html.includes('href="' + prefix + 'index.html#/sources"'), page + ': source link');
    assert.ok(html.includes('href="#main"'), page + ': native skip link');
    assert.ok(html.includes('aria-label="AI Updates primary navigation"'), page + ': shared nav');
  }
});

test('all migrated footers share one responsive light/dark reading-column treatment', () => {
  const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
  assert.ok(css.includes('/* atlas-global-contentinfo:'));
  assert.ok(css.includes('main:has(+ .site-chrome__footer)'));
  assert.ok(css.includes('.site-chrome__footer{'));
  assert.ok(css.includes('var(--line'));
  assert.ok(css.includes('var(--muted'));
  assert.ok(css.includes('var(--accent'));
  assert.ok(css.includes('@media(max-width:650px){.site-chrome__footer'));
  assert.ok(css.includes('@media print{.site-chrome__footer'));
});

test('shared reference generator promotes only landing footers; detail URLs retain their article content', () => {
  const generator = fs.readFileSync(path.join(root, 'scripts/site_chrome.py'), 'utf8');
  assert.match(generator, /if path in REFERENCE_LANDING_PATHS:/);
  assert.match(generator, /footer class="site-chrome__footer"/);
  for (const detail of ['terms/MLD-0001-a-b-test.html', 'technology/TECH-0301-nvidia-auto-ontology.html']) {
    const file = path.join(root, detail);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.indexOf('<footer>') > html.indexOf('<main'), detail + ': reference footer retained');
    assert.ok(html.indexOf('<footer>') < html.indexOf('</main>'), detail + ': detail page unchanged');
  }
});
