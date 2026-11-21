'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');

test('shared desktop hover cannot impersonate the current navigation section', () => {
  const start = '/* atlas-rail-hover-not-current:begin */';
  const end = '/* atlas-rail-hover-not-current:end */';
  assert.equal(css.split(start).length, 2);
  assert.equal(css.split(end).length, 2);
  const rule = css.slice(css.indexOf(start), css.indexOf(end) + end.length);
  assert.match(rule, /#navigation > \.site-chrome__links a\.nav-link/);
  assert.match(rule, /\.site-chrome \.site-chrome__links a/);
  assert.match(rule, /:hover:not\(\[aria-current\]\):not\(\.active\)/);
  assert.match(rule, /background:transparent!important/);
  assert.match(rule, /text-decoration:underline!important/);
  // The offline single-file build must carry exactly the same shared rule.
  assert.equal(offline.split(rule).length, 2);
});
