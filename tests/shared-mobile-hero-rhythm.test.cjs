'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Research and Playbooks share Discover compact first-content rhythm at mobile width', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-mobile-first-content-alignment:begin */')[1]
    ?.split('/* atlas-mobile-first-content-alignment:end */')[0];
  assert.ok(block, 'one shared style block owns native mobile intro rhythm');
  assert.match(block, /@media \(max-width:650px\)/);
  assert.match(block, /:root\{--atlas-workspace-intro-inset:29px\}/);
  assert.match(block, /\.app-shell \.workspace > main\{padding-top:var\(--atlas-workspace-intro-inset\)\}/);
  assert.match(block, /\.shell:has\(> \.site-chrome:is\(\.top,\.nav,\.research-site-chrome\)\) > main,\s*body:has\(> \.site-chrome\.demo-site-chrome\) > main\{padding-top:calc\(var\(--atlas-workspace-intro-inset\) - 1px\)\}/);
  assert.match(block, /\.shell:has\(> \.site-chrome:is\(\.top,\.nav\)\) > main > header,\s*body:has\(> \.site-chrome\.demo-site-chrome\) > main > header\{padding-top:0\}/);
  assert.match(block, /\.shell:has\(> \.site-chrome\.research-site-chrome\) > main > \.hero\{margin-top:0\}/);
  assert.match(block, /\.playbook-shell:has\(> \.site-chrome\.playbook-top\) > main > \.playbook-hero\{margin-top:calc\(var\(--atlas-workspace-intro-inset\) - 1px\)\}/);
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'));
  for (const [page, nav, heading, name] of [
    ['research.html','research-site-chrome','hero','Follow the evidence.'],
    ['playbooks.html','playbook-top','playbook-hero','Start with the problem, not the framework.'],
  ]) {
    const html=read(page);
    assert.ok(html.includes('site-chrome ' + nav),page + ' keeps shared rail');
    assert.ok(html.includes('class="' + heading + '" id="main"'),page + ' keeps first content skip target');
    assert.ok(html.includes(name),page + ' retains editorial headline');
    assert.ok(html.includes('href="index.html#/search"'),page + ' keeps working search route with no JS');
    assert.equal((html.match(/class="[^"]*site-mobile-chrome__nav/g)||[]).length,1,page + ' has one mobile drawer');
  }
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css),'offline standalone reproduces the shared style exactly');
});
