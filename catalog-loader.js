/* Load one coherent, checksummed edition before the interface can render. */
window.ATLAS_READY = (async () => {
 'use strict';
 async function bytes(path) {
  const response = await fetch(path, {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.arrayBuffer();
 }
 const decode = b => JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(b));
 const manifest = decode(await bytes('publication.json'));
 if (manifest.schema !== 1 || manifest.automatic_refresh_active !== false) throw new Error('Unsupported publication manifest.');
 if (!crypto.subtle) throw new Error('Open Atlas over HTTPS or localhost to verify the catalog.');
 async function checked(file) {
  if (!/^data\/[a-z0-9-]+\.json$/.test(file.path)) throw new Error('Invalid data path.');
  const buffer = await bytes(file.path);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (buffer.byteLength !== file.bytes || digest !== file.sha256) throw new Error(`Integrity mismatch: ${file.path}. Use a commit-pinned URL or retry.`);
  return decode(buffer);
 }
 const data = {}, seen = new Set();
 const kinds = ['papers', 'alerts', 'playbooks', 'terms', 'technologies'];
 await Promise.all(kinds.map(async kind => {
  const files = kind === 'papers' || kind === 'alerts' ? manifest.files.filter(f => f.kind === kind) : manifest.extensions[kind];
  if (!Array.isArray(files) || !files.length) throw new Error(`Missing ${kind} catalog.`);
  const batches = await Promise.all(files.map(async file => {
   if (file.kind !== kind || !new RegExp(`^data/${kind}-\\d{2}\\.json$`).test(file.path)) throw new Error('Invalid catalog manifest.');
   const rows = await checked(file);
   if (!Array.isArray(rows) || rows.length !== file.count) throw new Error(`Count mismatch: ${file.path}`);
   return rows;
  }));
  data[kind] = batches.flat();
  if (data[kind].length !== manifest.published_counts[kind]) throw new Error(`Wrong ${kind} total.`);
  for (const row of data[kind]) {
   if (typeof row.id !== 'string' || seen.has(row.id) || !Array.isArray(row.tags)) throw new Error(`Invalid or duplicate ID: ${row.id}`);
   seen.add(row.id);
  }
 }));
 const mapping = {meta:'meta', sections:'sections', sources:'sources', sourceHealth:'source-health', reviewQueue:'review-queue', technologySources:'technology-sources', dictionarySources:'dictionary-sources'};
 await Promise.all(Object.entries(mapping).map(async ([key, name]) => {
  const file = manifest.support_files.find(f => f.path === `data/${name}.json`);
  if (!file) throw new Error(`Missing ${name} integrity metadata.`);
  data[key] = await checked(file);
 }));
 data.publication = manifest;
 window.OBSERVATORY_DATA = data;
 return data;
})();
