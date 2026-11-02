const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const loader = fs.readFileSync(path.join(root, 'catalog-loader.js'), 'utf8');
async function load(transform = (p, b) => b) {
  const window = {};
  const context = {window, crypto: webcrypto, TextDecoder, AbortSignal, URL, console, setTimeout,
    fetch: async p => {
      const bytes = transform(p, fs.readFileSync(path.join(root, p)));
      return {ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer};
    }};
  vm.runInNewContext(loader, context);
  return {promise: window.ATLAS_READY, window};
}
test('the real manifest loads 1705 complete records and original source registers', async () => {
  const {promise} = await load();
  const d = await promise;
  assert.equal(d.terms.length, 1345); assert.equal(d.technologies.length, 300);
  assert.equal(d.papers.length, 30); assert.equal(d.alerts.length, 10); assert.equal(d.playbooks.length, 20);
  assert.equal(d.sources.length, 19); assert.equal(d.meta.automatic_refresh_active, false);
});
test('a damaged chunk rejects the whole edition before exposing data', async () => {
  const {promise, window} = await load((p, b) => p === 'data/terms-01.json' ? Buffer.from(b.toString().replace('A/B test', 'X/B test')) : b);
  await assert.rejects(promise, /Integrity mismatch/); assert.equal(window.OBSERVATORY_DATA, undefined);
});
test('a truncated transfer rejects the whole edition', async () => {
  const {promise, window} = await load((p, b) => p === 'data/technologies-01.json' ? b.subarray(0, b.length - 1) : b);
  await assert.rejects(promise, /Integrity mismatch/); assert.equal(window.OBSERVATORY_DATA, undefined);
});
test('incorrect published counts cannot masquerade as a complete import', async () => {
  const {promise} = await load((p, b) => {
    if (p !== 'publication.json') return b;
    const m = JSON.parse(b); m.published_counts.terms++; return Buffer.from(JSON.stringify(m));
  });
  await assert.rejects(promise, /Wrong terms total/);
});
test('a transient fetch failure is retried without publishing a partial catalog', async () => {
  let failed = false;
  const {promise} = await load((p, b) => {
    if (p === 'data/terms-01.json' && !failed) { failed = true; throw new TypeError('Failed to fetch'); }
    return b;
  });
  assert.equal((await promise).terms.length, 1345);
  assert.equal(failed, true);
});
test('all browser-generated term URLs exactly match generated static pages', () => {
  const C = require('../core.js');
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'terms/manifest.json')));
  for (const name of fs.readdirSync(path.join(root, 'data')).filter(p => /^terms-\d\d.json$/.test(p))) {
    for (const r of JSON.parse(fs.readFileSync(path.join(root, 'data', name)))) assert.equal(C.termPath(r), pages[r.id].path);
  }
});
