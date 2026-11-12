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
  assert.match(generator, /if path in REFERENCE_LANDING_PATHS or is_tech_detail or is_concept_detail:/);
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

test('reference-depth concepts expose the same native global footer as expanded guides', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'terms/manifest.json'), 'utf8'));
  const crypto = require('node:crypto');
  assert.equal(Object.values(manifest).filter(entry => !entry.expanded).length, 1288);
  for (const entry of Object.values(manifest)) {
    const bytes = fs.readFileSync(path.join(root, entry.path));
    const html = bytes.toString('utf8');
    const main = html.indexOf('<main class="term-shell">');
    const endMain = html.indexOf('</main>', main);
    const footer = html.indexOf('<footer class="site-chrome__footer">');
    assert.ok(main > 0 && endMain > main && footer > endMain, entry.path + ': footer is global without scripts');
    assert.equal((html.match(/<main\b/g) || []).length, 1, entry.path + ': one main');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, entry.path + ': one footer');
    assert.ok(html.includes('href="../about.html"') && html.includes('href="../index.html#/sources"'),
      entry.path + ': existing policy and evidence links');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256,
      entry.path + ': published manifest matches exact bytes');
  }
});

test('all 57 expanded guides use the same global footer as technology profiles without JavaScript', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'terms/manifest.json'), 'utf8'));
  const guides = Object.values(manifest).filter(entry => entry.expanded);
  assert.equal(guides.length, 57, 'all existing expanded guides migrated together');
  for (const entry of guides) {
    const html = fs.readFileSync(path.join(root, entry.path), 'utf8');
    const main = html.indexOf('<main class="term-shell">');
    const mainEnd = html.indexOf('</main>', main);
    const footer = html.indexOf('<footer class="site-chrome__footer">');
    assert.ok(main > 0 && mainEnd > main && footer > mainEnd &&
              html.indexOf('</footer>', footer) < html.indexOf('</body>'),
              entry.path + ': global script-free contentinfo');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, entry.path + ': exactly one footer');
    assert.ok(html.includes('href="../about.html"') &&
              html.includes('href="../index.html#/sources"'),
              entry.path + ': source and editorial links retained');
  }
  const generator = fs.readFileSync(path.join(root, 'scripts/build_term_pages.py'), 'utf8');
  assert.ok(generator.includes('expanded_concept=bool(guide)'),
            'generator—not a page-specific patch—owns reviewed-guide migration');
});

test('daily archive, catalog review, technologies and playbooks share the global native footer', () => {
  for (const page of ['whats-new.html', 'catalog-review.html', 'technologies.html', 'playbooks.html']) {
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
  assert.match(generator, /if path in \("whats-new\.html", "catalog-review\.html", "technologies\.html", "playbooks\.html"\):/);
  const { execFileSync } = require('node:child_process');
  const check = [
    'import sys',
    'from pathlib import Path',
    'sys.path.insert(0, "scripts")',
    'from site_chrome import ensure_footer_resources',
    'for page in ("whats-new.html", "catalog-review.html", "technologies.html", "playbooks.html"):',
    '    html = Path(page).read_text(encoding="utf-8")',
    '    assert ensure_footer_resources(html, page) == html, page',
    '    assert ensure_footer_resources(ensure_footer_resources(html, page), page) == html, page',
  ].join('\n');
  execFileSync('python3', ['-c', check], { cwd: root, stdio: 'pipe' });
});

test('all concept details expose native global footers and retain non-duplicating legacy enhancement', () => {
  const runtime = fs.readFileSync(path.join(root, 'site-theme.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
  const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.match(runtime, /main\.after\(footer\)/,
    'move the existing footer after main, without duplicating its policy links');
  assert.match(runtime, /footer\.classList\.add\('site-chrome__footer'\)/);
  assert.match(runtime, /document\.querySelectorAll\('footer'\)\.length !== 1/);
  assert.ok(css.includes('main.term-shell > footer:not(.site-chrome__footer)'),
    'native no-JS concept footers keep the shared theme and reading-column treatment');
  assert.ok(offline.includes(runtime.replaceAll('</script', '<\\/script')),
    'the single-file offline fallback embeds the exact shared runtime');
  assert.ok(offline.includes(css),
    'the single-file offline fallback embeds the exact shared styling');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'terms/manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest).length, 1345, 'retain every stable concept URL');
  for (const route of ['terms/MLD-0001-a-b-test.html']) {
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, route + ': one existing footer');
    assert.ok(html.indexOf('</main>') < html.indexOf('<footer class="site-chrome__footer">') &&
              html.indexOf('<footer class="site-chrome__footer">') < html.indexOf('</body>'),
              route + ': native global footer keeps the original source links');
    assert.ok(html.includes('href="../about.html"') &&
              html.includes('href="../index.html#/sources"'), route + ': policy and sources');
  }
});

test('Discover and native pages expose sibling main and global footer landmarks, including offline', () => {
  const discover = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
  const pages = [discover, offline];
  for (const [index, html] of pages.entries()) {
    const name = index ? 'offline Discover' : 'hosted Discover';
    const main = html.indexOf('<main id="main" tabindex="-1">');
    const endMain = html.indexOf('</main>', main);
    const footer = html.indexOf('<footer class="main-footer site-chrome__footer">');
    const endFooter = html.indexOf('</footer>', footer);
    assert.ok(main > 0 && endMain > main && footer > endMain && endFooter > footer,
      name + ': site-wide footer is a sibling after main, not part of article');
    assert.ok(endFooter < html.indexOf('</div></div><dialog id="record-dialog"', endFooter),
      name + ': original app shell and record dialog remain in order');
    assert.ok(html.includes('href="#/sources"') && html.includes('Evidence & coverage'),
      name + ': functional evidence link remains');
    assert.ok(html.includes('id="navigation"') && html.includes('class="global-search"'),
      name + ': original desktop navigation and genuine search remain');
    const bodyStart = html.indexOf('</head>') + '</head>'.length;
    const dialogStart = html.indexOf('<dialog id="record-dialog"', bodyStart);
    assert.ok(bodyStart > 6 && dialogStart > bodyStart, name + ': valid body and dialog');
    assert.equal((html.slice(bodyStart, dialogStart).match(/<main\b/g) || []).length,
      1, name + ': exactly one visible app main landmark (excluding embedded CSS and scripts)');
  }
  assert.ok(css.includes('/* atlas-discover-global-footer:begin */'),
    'shared stylesheet provides one Discover footer-layout variant');
  for (const gutter of ['76px', '52px', '34px']) {
    assert.ok(css.includes('width:calc(100% - ' + gutter + ')'),
      'footer width must match desktop, tablet and mobile main gutters: ' + gutter);
  }
  assert.ok(offline.includes(css), 'offline fallback embeds the exact canonical shared stylesheet');
  const native = fs.readFileSync(path.join(root, 'about.html'), 'utf8');
  assert.ok(native.indexOf('<footer class="site-chrome__footer">') > native.indexOf('</main>'),
    'Discover matches the existing native global footer landmark');
});
