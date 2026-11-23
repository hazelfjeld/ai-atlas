'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const read = p => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

test('reference landing families expose their workspace in the no-script mobile toggle', () => {
  for (const [file, label] of Object.entries({
    'about.html': 'About',
    'terms/index.html': 'Concept encyclopedia',
    'technology/index.html': 'Technology profiles',
  })) {
    const html = read(file);
    const expected = '<summary class="site-mobile-chrome__toggle" aria-label="Toggle navigation · ' + label + '">';
    assert.equal(html.split(expected).length - 1, 1, file + ': one contextual mobile toggle');
    assert.equal((html.match(/<details class="site-mobile-chrome__nav"/g) || []).length, 1,
      file + ': native disclosure remains available without scripts');
    assert.ok(html.includes('<span class="site-mobile-chrome__title">' + label + '</span>'),
      file + ': mobile toggle and visible workspace title agree');
    assert.ok(html.includes('href="' + (file.includes('/') ? '../' : '') + 'index.html#/search"'),
      file + ': original working search route remains');
  }
});

test('standalone and reference landings use the same contextual toggle renderer', () => {
  const script = [
    'import sys',
    'sys.path.insert(0, "scripts")',
    'from site_chrome import STANDALONE_NAVS, render_standalone_nav, render_directory_nav',
    'for page in STANDALONE_NAVS:',
    "    markup = render_standalone_nav(page)",
    "    assert markup.count('aria-label=\"Toggle navigation · ') == 1, page",
    'for label in ("About", "Concept encyclopedia", "Technology profiles"):',
    "    markup = render_directory_nav('', None, page_label=label, topbar_title=label, first_paint_context=True)",
    "    assert markup.count('aria-label=\"Toggle navigation · ' + label + '\"') == 1, label",
  ].join('\n');
  execFileSync('python3', ['-c', script], {cwd:path.resolve(__dirname, '..'), stdio:'pipe'});
});
