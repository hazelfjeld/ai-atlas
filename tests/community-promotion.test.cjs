'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');
const invite = 'https://discord.gg/mvRJjgdM4R';
const occurrences = (text, needle) => text.split(needle).length - 1;

test('Discord invitation is a discoverable, descriptive link in existing site content', () => {
  const home = read('index.html'), about = read('about.html'), readme = read('README.md');
  assert.equal(occurrences(home, invite), 1, 'Discover first paint must contain exactly one invite');
  assert.equal(occurrences(about, invite), 1, 'About must contain exactly one invite');
  assert.equal(occurrences(readme, invite), 1, 'GitHub README must expose the invite');
  assert.match(home, /<section class="rail-section" id="community" aria-labelledby="community-title">/);
  assert.match(home, /<h2 id="community-title">Continue the conversation\.<\/h2>/);
  assert.match(home, /<a href="https:\/\/discord\.gg\/mvRJjgdM4R" rel="noopener noreferrer">Join the AI Updates Discord discussion/);
  assert.match(about, /Join the AI Updates Discord discussion/);
});

test('Community invitation remains available in the dynamic and offline Discover views', () => {
  const script = read('discovery.js'), offline = read('downloads/Atlas_Demo_Offline.html');
  assert.equal(occurrences(script, invite), 1, 'Only one source invitation in the Discover renderer');
  assert.equal(occurrences(offline, invite), 2,
    'The offline file includes the pre-rendered HTML and the embedded Discover renderer');
  assert.equal(occurrences(offline, 'id="community-title"'), 2);
  assert.match(offline, /<meta name="robots" content="noindex,follow">/);
});
