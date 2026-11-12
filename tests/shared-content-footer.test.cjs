'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = ['research.html', 'demo.html', 'hardware-review.html', 'about.html', 'terms/index.html', 'technology/index.html', 'games.html'];

test('seven native page families expose a global footer outside their article landmark', () => {
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

test('all 303 generated technology profiles use the shared global footer landmark', () => {
  const generator = fs.readFileSync(path.join(root, 'scripts/site_chrome.py'), 'utf8');
  assert.match(generator, /if path in REFERENCE_LANDING_PATHS or is_tech_detail:/);
  const directory = path.join(root, 'technology');
  const files = fs.readdirSync(directory).filter(name => /^TECH-\d+-.+\.html$/.test(name));
  assert.equal(files.length, 303, 'canonical published technology profile count');
  for (const file of files) {
    const route = 'technology/' + file;
    const html = fs.readFileSync(path.join(directory, file), 'utf8');
    const main = html.indexOf('<main class="term-shell">');
    const endMain = html.indexOf('</main>', main);
    const footer = html.indexOf('<footer class="site-chrome__footer">');
    assert.ok(main > 0 && endMain > main && footer > endMain &&
              footer < html.indexOf('</body>'), route + ': global footer outside main');
    assert.equal((html.match(/<main\b/g) || []).length, 1, route + ': one main');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, route + ': one footer');
    assert.ok(html.indexOf('<nav class="site-chrome term-nav"') < main,
              route + ': native desktop navigation outside main');
    assert.ok(html.includes('<header class="hero" id="main" tabindex="-1">'),
              route + ': focusable article title');
    assert.ok(html.includes('href="#main"'), route + ': no-script skip link');
    assert.ok(html.includes('href="../about.html"'), route + ': editorial policy');
    assert.ok(html.includes('href="../index.html#/sources"'), route + ': source coverage');
    assert.ok(html.includes('href="../index.html#/search"'), route + ': live search destination');
  }
});

test('concept profiles retain their hash-indexed source footers until their own migration', () => {
  for (const route of ['terms/MLD-0001-a-b-test.html', 'terms/MLD-0002-ablation-study.html']) {
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    const footer = html.indexOf('<footer>');
    assert.ok(footer > html.indexOf('<main'), route + ': footer retained');
    assert.ok(footer < html.indexOf('</main>'), route + ': unchanged concept article');
  }
});

test('daily archive and editorial catalog review reuse the global native footer', () => {
  for (const page of ['whats-new.html', 'catalog-review.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.equal((html.match(/<main\b/g) || []).length, 1, page + ': one main');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, page + ': one footer');
    const mainEnd = html.indexOf('</main>');
    const footer = html.indexOf('<footer class="site-chrome__footer">');
    assert.ok(mainEnd !== -1 && footer > mainEnd, page + ': footer is global contentinfo');
    assert.ok(footer < html.indexOf('</body>'), page + ': footer remains in body');
    assert.ok(html.includes('href="about.html"'), page + ': editorial policy preserved');
    assert.ok(html.includes('href="index.html#/sources"'), page + ': evidence policy preserved');
    assert.ok(html.includes('aria-label="AI Updates primary navigation"'), page + ': shared navigation preserved');
  }
  const generator = fs.readFileSync(path.join(root, 'scripts/site_chrome.py'), 'utf8');
  assert.match(generator, /if path in \("whats-new\.html", "catalog-review\.html"\):/);
});
