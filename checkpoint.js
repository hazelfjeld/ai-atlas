(() => {
'use strict';
const $ = id => document.getElementById(id);
const rows = {papers: [], alerts: []};
let manifest, current = [], view = 'papers';
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
function element(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function link(url, text) { try { const u = new URL(url); if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Unsafe link'); const a = element('a', text); a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; } catch { return element('span', text + ' · link unavailable'); } }
function routeState() { const [name, query] = location.hash.replace(/^#\/?/, '').split('?'); return {name: ['papers', 'alerts', 'coverage'].includes(name) ? name : 'papers', params: new URLSearchParams(query || '')}; }
function download(name, value) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: 'application/json'})); const a = element('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000); }
function block(title, text, cls = '') { const b = element('section', undefined, 'detail-block ' + cls); b.append(element('h3', title), element('p', text)); return b; }
function showRecord(record) {
 const body = $('detail-body'); body.replaceChildren();
 const tags = element('div', undefined, 'tags'); (record.tags || []).forEach(t => tags.append(element('span', t, 'tag')));
 const title = element('h2', record.title); title.id = 'detail-title';
 body.append(element('span', record.kind || 'Research paper', 'pill'), title, tags);
 body.append(element('p', 'Published: ' + record.published_at + ' · Updated: ' + record.updated_at, 'metadata'));
 if (Object.hasOwn(record, 'event_date')) body.append(element('p', 'Event date: ' + (record.event_date || 'Not specified') + ' · ' + record.event_date_precision, 'metadata'));
 if (record.authors) body.append(block('Authors', record.authors.join(', ') + (record.authors_complete ? '' : ' et al. (partial author list)')));
 if (record.publisher) body.append(block('Reporting organization', record.publisher));
 body.append(block('Summary', record.summary));
 if (record.why_it_matters) body.append(block('Why it matters', record.why_it_matters));
 body.append(block('Limitations & context', record.caveat, 'caveat'));
 if (record.environment) body.append(block('Environment', record.environment));
 body.append(block('Imported evidence label', (record.review_status || 'Not reviewed') + ' · ' + (record.reviewed_on || 'No review date') + '. ' + (record.review_scope || '') + ' These labels come from the prepared snapshot; this publication step does not constitute a new source audit.'));
 if (record.publication_status) body.append(block('Publication status', record.publication_status));
 if (record.timeline?.length) { const b = block('Timeline', ''); record.timeline.forEach(t => b.append(element('p', t.date + ' — ' + t.label))); body.append(b); }
 const sources = block('Original sources', '');
 const entries = record.sources || [{label: 'Primary abstract / metadata', url: record.source_url}, {label: 'Paper PDF', url: record.pdf_url}];
 entries.filter(s => s.url).forEach(s => { const p = element('p'); p.append(link(s.url, s.label), document.createTextNode(s.role ? ' · ' + s.role : '')); sources.append(p); });
 body.append(sources);
 const exportButton = element('button', 'Export this complete record ↓'); exportButton.type = 'button'; exportButton.onclick = () => download(record.id + '.json', record); body.append(exportButton);
 const raw = element('details'); raw.append(element('summary', 'Inspect all original record fields'), element('pre', JSON.stringify(record, null, 2))); body.append(raw);
 if (!$('detail').open) $('detail').showModal(); $('detail').scrollTop = 0;
}
function card(record) {
 const c = element('article', undefined, 'card');
 const top = element('div', undefined, 'card-top'); const date = element('time', record.published_at); date.dateTime = record.published_at;
 top.append(element('span', record.kind || 'Research paper', 'pill'), date);
 const h = element('h2'), button = element('button', record.title, 'title-button'); button.type = 'button'; button.onclick = () => showRecord(record); h.append(button);
 const tags = element('div', undefined, 'tags'); (record.tags || []).forEach(t => tags.append(element('span', t, 'tag')));
 const bottom = element('div', undefined, 'card-bottom'), details = element('button', 'Read record ↗'); details.type = 'button'; details.onclick = () => showRecord(record);
 bottom.append(link(record.source_url, 'Original source ↗'), details);
 c.append(top, h, element('p', record.summary), tags, bottom); return c;
}
function render() {
 if (!manifest || view === 'coverage') return;
 const words = normalize($('query').value).trim().split(/\s+/).filter(Boolean), topic = $('topic').value, kind = $('kind').value;
 current = rows[view].filter(r => (!topic || r.tags.includes(topic)) && (view !== 'alerts' || !kind || r.kind === kind) && words.every(w => normalize(JSON.stringify(r)).includes(w)));
 current.sort((a, b) => b.published_at.localeCompare(a.published_at) || a.title.localeCompare(b.title));
 $('result-count').textContent = `${current.length} of ${rows[view].length} ${view === 'papers' ? 'papers' : 'report records'} · newest publication first`;
 $('results').replaceChildren(...current.map(card));
 if (!current.length) $('results').append(element('p', 'No matches. Try a broader search or reset the filters.', 'empty'));
}
function coverage() {
 const box = $('coverage'); box.replaceChildren(element('h2', 'A checkpoint you can inspect.'));
 box.append(element('p', 'Research and safety catalogs are online alongside the complete set of 20 original playbooks. The 1,345 dictionary terms and 300 technology profiles still await transfer.'));
 const grid = element('div', undefined, 'progress-grid');
 for (const [key, title] of [['papers','Research papers'],['alerts','Safety report records'],['technologies','Technology profiles'],['terms','Dictionary concepts'],['playbooks','Problem playbooks']]) {
  const tile = element('div', undefined, 'progress-tile'); const count = manifest.published_counts[key];
  tile.append(element('small', title), element('strong', count.toLocaleString() + ' / ' + manifest.prepared_counts[key].toLocaleString()), element('p', count ? 'Published in this checkpoint' : 'Prepared · transfer pending')); grid.append(tile);
 }
 box.append(grid, block('Collection status', 'Automatic refresh is OFF. No background collector is running. This is a curated seed snapshot, not comprehensive coverage.'), block('Evidence policy', manifest.coverage), block('Privacy', 'This checkpoint stores no notes, bookmarks, API keys, or account information. GitHack is a shared hosting origin; do not enter secrets.'));
 const p = element('p'); p.append(link('https://github.com/hazelfjeld/ai-atlas/blob/main/publication.json', 'Inspect the manifest and file checksums ↗')); box.append(p);
}
function route() {
 if (!manifest) return;
 const state = routeState(); view = state.name;
 document.querySelectorAll('[data-nav]').forEach(a => { const active = a.dataset.nav === view; a.classList.toggle('active', active); if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
 const names = {papers:['RESEARCH LIBRARY','Follow the evidence.','Search the research, inspect the caveats, and go straight to the original source.'],alerts:['SAFETY OBSERVATORY','Signals, with context.','Real-world reports, controlled tests, and mitigations — kept distinct, with their limitations attached.'],coverage:['PUBLICATION PROGRESS','Small steps. Real progress.','A transparent inventory of what is published, what is prepared, and what is not running.']};
 const [label,title,desc] = names[view]; $('section-label').textContent = label; $('view-title').textContent = title; $('view-description').textContent = desc; document.title = label.toLowerCase() + ' · Atlas';
 $('collection').hidden = view === 'coverage'; $('coverage').hidden = view !== 'coverage';
 if ($('detail').open) $('detail').close();
 if (view === 'coverage') { coverage(); return; }
 $('query').value = state.params.get('q') || ''; $('kind-label').hidden = view !== 'alerts';
 for (const [id, values] of [['topic', [...new Set(rows[view].flatMap(r => r.tags))]], ['kind', [...new Set(rows.alerts.map(r => r.kind))]]]) {
  const select = $(id); select.replaceChildren(new Option(id === 'topic' ? 'All topics' : 'All types', '')); values.sort().forEach(value => select.add(new Option(value, value)));
 }
 render(); const selected = state.params.get('record'); if (selected) { const r = rows[view].find(r => r.id === selected); if (r) showRecord(r); }
}
async function request(path) {
 const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
 try { const response = await fetch(path, {signal: controller.signal}); if (!response.ok) throw new Error(path + ' returned HTTP ' + response.status); return await response.arrayBuffer(); } finally { clearTimeout(timer); }
}
async function start() {
 try {
  const m = JSON.parse(new TextDecoder().decode(await request('publication.json')));
  if (m.schema !== 1 || !Array.isArray(m.files)) throw new Error('Unsupported publication manifest.');
  const batches = await Promise.all(m.files.map(async file => {
   if (!/^data\/(papers|alerts)-\d{2}\.json$/.test(file.path) || !Object.hasOwn(rows, file.kind)) throw new Error('Unexpected catalog path.');
   const bytes = await request(file.path);
   if (bytes.byteLength !== file.bytes) throw new Error('Incomplete transfer: ' + file.path);
   if (!globalThis.crypto?.subtle) throw new Error('Open this site over HTTPS (or localhost) to verify its catalog.');
   const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
   if (hash !== file.sha256) throw new Error('Checksum mismatch: ' + file.path + '. A cached version may be stale; try the commit-pinned link.');
   const records = JSON.parse(new TextDecoder().decode(bytes));
   if (!Array.isArray(records) || records.length !== file.count || records.some(r => typeof r.id !== 'string' || typeof r.title !== 'string' || !Array.isArray(r.tags))) throw new Error('Invalid records: ' + file.path);
   return {kind: file.kind, records};
  }));
  const loaded = {papers: [], alerts: []}; batches.forEach(b => loaded[b.kind].push(...b.records));
  const all = [...loaded.papers, ...loaded.alerts]; if (new Set(all.map(r => r.id)).size !== all.length) throw new Error('Duplicate record IDs.');
  for (const kind of Object.keys(rows)) { if (loaded[kind].length !== m.published_counts[kind]) throw new Error('Catalog count mismatch.'); rows[kind] = loaded[kind]; $(kind + '-count').textContent = rows[kind].length; }
  manifest = m; $('loading-status').textContent = `${all.length} research/safety records loaded · ${m.files.length} checksums verified · snapshot ${m.snapshot_date}`; route();
 } catch (error) {
  $('loading-status').textContent = 'Catalog could not load: ' + error.message + ' No incomplete catalog is being presented as complete.';
  const retry = element('button', 'Retry loading'); retry.type = 'button'; retry.onclick = () => location.reload(); $('loading-status').append(document.createTextNode(' '), retry);
 }
}
$('query').addEventListener('input', render); $('topic').addEventListener('change', render); $('kind').addEventListener('change', render);
$('reset').onclick = () => { $('query').value = ''; $('topic').value = ''; $('kind').value = ''; render(); };
$('export').onclick = () => download('atlas-' + view + '.json', current);
$('close-detail').onclick = () => $('detail').close();
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !$('detail').open && view !== 'coverage' && manifest) { e.preventDefault(); $('query').focus(); } });
start();
})();
