'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cases = [
  ['checkpoint.js', 'loading-status', 'data/papers-01.json'],
  ['playbooks.js', 'status', 'data/playbooks-01.json'],
  ['technologies.js', 'tech-status', 'technology/index.html']
];

for (const [file, statusId, recoveryHref] of cases) {
  test(file + ' offers a retry and an honest reachable route when catalog loading fails', async () => {
    const nodes = new Map();
    const makeNode = (tag = 'div') => ({
      tagName: tag.toUpperCase(),
      children: [],
      textContent: '',
      href: '',
      onclick: null,
      addEventListener() {},
      append(...children) { this.children.push(...children); },
      setAttribute() {}
    });
    const document = {
      getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, makeNode());
        return nodes.get(id);
      },
      createElement: makeNode,
      createTextNode(text) { const node = makeNode('#text'); node.textContent = text; return node; },
      addEventListener() {},
      body: makeNode('body')
    };
    let reloads = 0;
    const location = {hash: '', reload() { reloads++; }};
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const context = {
      document,
      window: {addEventListener() {}},
      location,
      setTimeout,
      clearTimeout,
      AbortController,
      URL,
      URLSearchParams,
      crypto: {subtle: {digest: async () => new ArrayBuffer(32)}},
      fetch: async () => { throw new Error('Simulated unavailable catalog <script>'); },
      console
    };
    vm.runInNewContext(source, context, {filename: file, timeout: 2000});
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    const status = document.getElementById(statusId);
    assert.match(status.textContent, /could not load|could not be verified|unavailable/i);
    assert.match(status.textContent, /No (?:incomplete catalog|partial data|unverified partial data)/);
    const button = status.children.find(el => el.tagName === 'BUTTON' && el.textContent === 'Retry loading');
    const link = status.children.find(el => el.tagName === 'A' && el.href === recoveryHref);
    assert.ok(button && typeof button.onclick === 'function', 'Recovery must offer a working retry action');
    assert.ok(link, 'Recovery must preserve a navigation route to accessible records');
    assert.ok(link.textContent.includes('not verified') || link.textContent.includes('static technology'),
      'A failed checksum must never be described as independently verified');
    assert.ok(fs.existsSync(path.join(__dirname, '..', recoveryHref)), 'Recovery route must exist in repository');
    button.onclick();
    assert.equal(reloads, 1);
    assert.ok(!source.includes('innerHTML = error.message'), 'Untrusted error text must not become markup');
  });
}
