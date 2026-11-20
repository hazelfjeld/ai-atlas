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
  assert.match(block, /\.shell:has\(> \.site-chrome\.research-site-chrome\) > main\{padding-top:8px\}/);
  assert.match(block, /\.shell:has\(> \.site-chrome\.research-site-chrome\) > main > \.hero\{margin-top:8px\}/);
  assert.match(block, /\.tech-shell:has\(> \.site-chrome\.tech-top\)\{padding-top:0\}/);
  assert.match(block, /\.tech-shell:has\(> \.site-chrome\.tech-top\) > main > \.tech-hero\{padding-top:16px\}/);
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
