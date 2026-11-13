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
  assert.ok(contrast('#C5CFC6', '#FFFFFF') < 4.5,
    'The previous pale foreground must not be reintroduced');
  assert.match(css, /html\.atlas-enhanced \.site-mobile-chrome__more>summary\{color:var\(--ink,#202b28\);font-size:14px\}/);
  assert.match(css, /html\.atlas-enhanced \.site-mobile-chrome__more\{border-top-color:var\(--line,#dce1d7\)\}/);
  assert.match(css, /html\.atlas-enhanced \.site-mobile-chrome__more>summary:hover,html\.atlas-enhanced \.site-mobile-chrome__more\[open\]>summary\{background:var\(--soft,#eaf1ea\);color:var\(--ink,#202b28\)\}/);
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
