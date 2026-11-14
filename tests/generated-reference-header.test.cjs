'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const title = /<header class="hero"[^>]*>[\s\S]*?<h1>([^<]+)<\/h1>/;

test('all generated concept and technology profiles expose their article title without scripts', () => {
  let count = 0;
  for (const [folder, prefix, expectedCount] of [
    ['terms', 'MLD-', 1345],
    ['technology', 'TECH-', 303],
  ]) {
    const files = fs.readdirSync(path.join(root, folder))
      .filter(file => file.startsWith(prefix) && file.endsWith('.html'));
    assert.equal(files.length, expectedCount, folder + ' published catalog count');
    for (const file of files) {
      const html = fs.readFileSync(path.join(root, folder, file), 'utf8');
      const heading = html.match(title)?.[1];
      assert.ok(heading, file + ' must have an article h1');
      assert.ok(html.includes('data-page-label="' + heading + '"'),
        file + ' must announce the specific profile in the static workspace bar');
      assert.ok(html.includes('<span class="site-mobile-chrome__title">' + heading + '</span>'),
        file + ' must expose real static title text without JavaScript');
      assert.equal((html.match(/<main\b/g) || []).length, 1, file);
      if (folder === 'technology') {
        const rail = html.match(/<nav class="site-chrome term-nav"[^>]*>([\s\S]*?)<\/nav><main class="term-shell">/)?.[1];
        assert.ok(rail, file + ' must keep the primary rail outside article content');
        assert.equal((rail.match(/class="sidebar-bottom site-chrome__bottom"/g) || []).length, 1,
          file + ' needs exactly one script-free shared rail bottom on first paint');
        assert.ok(rail.includes('href="../index.html#/sources"'),
          file + ' needs the native coverage shortcut without JavaScript');
      }
      assert.ok(html.indexOf('<nav class="site-chrome term-nav"') < html.indexOf('<main'),
        file + ' must keep shared navigation outside main');
      count++;
    }
  }
  assert.equal(count, 1648);
});

test('generated directories retain their parent section titles', () => {
  for (const [route, label] of [
    ['terms/index.html', 'Concept encyclopedia'],
    ['technology/index.html', 'Technology profiles'],
  ]) {
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    assert.ok(html.includes('data-page-label="' + label + '"'), route);
    assert.ok(html.includes('<span class="site-mobile-chrome__title">' + label + '</span>'), route);
  }
});
