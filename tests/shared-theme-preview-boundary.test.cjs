'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');
const script = read('site-theme.js');

// Exercise the real pre-paint script, rather than treating comment text as a fix.
const prePaint = script.slice(0, script.indexOf('// Generated term'));
assert.ok(prePaint.includes('themePersistenceAllowed'), 'theme guard must execute before reading saved state');

function initialize(host, saved) {
  const storage = {reads:0};
  const document = {documentElement:{classList:{add(name){assert.equal(name, 'atlas-enhanced')}},dataset:{}}};
  const sandbox = {
    location:{hostname:host}, document,
    localStorage:{getItem(key){assert.equal(key,'atlas.theme');storage.reads++;return saved}}
  };
  vm.runInNewContext(prePaint,sandbox);
  return {theme:document.documentElement.dataset.theme,reads:storage.reads};
}

test('saved appearance is read on the actual AI Updates origin, never on the shared GitHack origin', () => {
  assert.deepEqual(initialize('aiupdates.app','dark'),{theme:'dark',reads:1});
  assert.deepEqual(initialize('www.aiupdates.app','light'),{theme:'light',reads:1});
  for(const host of ['raw.githack.com','rawcdn.githack.com']) {
    assert.deepEqual(initialize(host,'dark'),{theme:undefined,reads:0}, host);
  }
});

test('native appearance controls, BFCache and cross-tab synchronization share the preview boundary', () => {
  assert.match(script,/function restoreSharedThemeAfterHistory\(\) \{\s*if \(!themePersistenceAllowed\) return;/);
  assert.match(script,/themePersistenceAllowed && event\.key === 'atlas\.theme'/);
  assert.match(script,/if \(themePersistenceAllowed\) \{\s*try \{ localStorage\.setItem\('atlas\.theme', chosen\)/);
  const games = read('games.html');
  assert.match(games,/\['raw\.githack\.com','rawcdn\.githack\.com'\]/);
  const app = read('app.js');
  assert.match(app,/SHARED_HOST=/);
  assert.match(app,/if\(!SHARED_HOST\)localStorage\.setItem\('atlas\.theme',theme\)/);
});

test('offline demo embeds exactly the same site-wide appearance script', () => {
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(script), 'single-file fallback must include the new shared boundary');
});
