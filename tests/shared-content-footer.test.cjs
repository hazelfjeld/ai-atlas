'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = ['research.html', 'demo.html', 'hardware-review.html'];

test('three native page families expose a global footer outside their article landmark', () => {
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
    assert.ok(html.includes('href="about.html"'), page + ': editorial policy link');
    assert.ok(html.includes('href="index.html#/sources"'), page + ': source link');
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
