'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Games reuses its real appearance action in the canonical desktop rail without a second topbar', () => {
  const js = read('site-theme.js'), css = read('site-chrome.css'), html = read('games.html');
  assert.equal((html.match(/id="theme-toggle"/g) || []).length, 1, 'retain one existing Games theme action');
  assert.match(js, /document\.querySelector\('\.games-header__inner > #theme-toggle'\) === existing/);
  assert.match(js, /desktopAction\.prepend\(existing\)/, 'move the existing DOM button, do not duplicate it');
  assert.match(js, /existing\.classList\.add\('site-chrome__theme-toggle--rail'\)/);
  assert.match(css, /\.games-header__inner > #theme-toggle\{display:none\}\s*@media\(max-width:650px\)/,
    'the original Games header button is hidden on desktop and mobile before enhancement');
  assert.ok(!css.includes('position:fixed;top:17px;right:40px;z-index:26'),
    'the abandoned independent topbar placement must not return');
  assert.match(css, /\.sidebar-bottom \.sidebar-actions > button\.icon-button\{[^}]*width:44px;height:44px;min-height:44px/s);
  assert.match(css, /\.site-mobile-chrome__menu > \.site-chrome__theme-toggle/);
});

test('single-file offline fallback embeds the exact shared chrome sources', () => {
  const offline = read('downloads/Atlas_Demo_Offline.html');
  for (const file of ['site-theme.js', 'site-chrome.css']) {
    assert.ok(offline.includes(read(file).replaceAll('</script', '<\\/script')),
      'offline fallback must keep '+file+' byte-identical to the checked-in source');
  }
});
