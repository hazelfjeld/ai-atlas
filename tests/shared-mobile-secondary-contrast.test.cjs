'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function luminance(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi).map(part => parseInt(part, 16) / 255);
  const linear = rgb.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
}

test('enhanced native More sections is readable in both themes across page families', () => {
  const css = read('site-chrome.css'), brand = read('brand.css');
  assert.ok(brand.includes('--ink:#18211E') && brand.includes('--ink:#F6F6F2'),
    'Shared theme foregrounds must remain explicit');
  assert.ok(contrast('#18211E', '#FFFFFF') >= 4.5);
  assert.ok(contrast('#F6F6F2', '#222D27') >= 4.5);
  // Script-free native dropdowns use a theme-matched surface; enhanced mobile
  // drawers always use the dark Discover sidebar, even in the light theme.
  for (const rail of ['#18211E', '#111A15']) {
    assert.ok(contrast('#C5CFC6', rail) >= 4.5, 'closed More label must meet WCAG AA');
    assert.ok(contrast('#F5F7EF', rail) >= 4.5, 'open More label must meet WCAG AA');
  }
  assert.ok(contrast('#F5F7EF', '#374B3C') >= 4.5,
    'highlighted More label must meet WCAG AA');
  assert.ok(css.includes('.site-mobile-chrome__more>summary{display:flex;align-items:center;min-height:44px;padding:10px 12px;border-radius:7px;list-style:none;cursor:pointer;color:var(--ink,#202b28)'),
    'script-free dropdown must retain theme-aware ink');
  assert.ok(css.includes('html.atlas-enhanced .site-mobile-chrome__more{border-top-color:#405043}'));
  assert.ok(css.includes('html.atlas-enhanced .site-mobile-chrome__more>summary{color:#c5cfc6;font-size:14px}'));
  assert.ok(css.includes('html.atlas-enhanced .site-mobile-chrome__more[open]>summary{background:#374b3c;color:#f5f7ef}'));
  assert.ok(css.includes('html.atlas-enhanced .site-mobile-chrome__more:has(.site-mobile-chrome__more-links a[aria-current]) > summary{\n    color:#f5f7ef;\n    background:#374b3c;'),
    'selected More section must remain readable on the enhanced dark drawer');
  for (const file of ['index.html', 'whats-new.html', 'research.html',
                      'playbooks.html', 'games.html', 'about.html',
                      'terms/index.html', 'technology/TECH-0288-vllm.html',
                      'terms/MLD-0001-a-b-test.html']) {
    const html = read(file);
    assert.ok(html.includes('site-mobile-chrome__more'), file + ' has a shared secondary disclosure');
    assert.ok(html.includes('site-chrome.css') || file === 'index.html',
      file + ' must load the same shared chrome');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'Single-file fallback must embed the exact updated shared stylesheet');
});
