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
test('the real manifest loads 1705 original records plus three source-reviewed additions', async () => {
  const {promise} = await load();
  const d = await promise;
  assert.equal(d.terms.length, 1345); assert.equal(d.technologies.length, 303); assert.equal(d.technologies.at(-1).id, 'TECH-0303');
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
test('offline fallback embeds all records and valid JavaScript without external runtime assets', () => {
  const html = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/i);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length >= 2, 'Offline archive inlines both shared navigation and workspace runtime');
  for (const source of scripts) new vm.Script(source);
  const script = scripts.find(source => source.includes('window.ATLAS_READY=Promise.resolve('));
  assert.ok(script, 'Offline workspace must preserve the complete verified dataset');
  const value = script.split('window.ATLAS_READY=Promise.resolve(')[1].split(');\n')[0];
  const d = JSON.parse(value);
  assert.equal(['papers','alerts','playbooks','terms','technologies'].reduce((n,k) => n+d[k].length, 0), 1708);
  for (const kind of ['papers','alerts','playbooks','terms','technologies']) {
    const m = d.publication;
    const files = kind === 'papers' || kind === 'alerts' ? m.files.filter(f => f.kind === kind) : m.extensions[kind];
    const original = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(root, f.path))));
    assert.deepEqual(d[kind], original);
  }
});
