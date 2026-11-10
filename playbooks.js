(() => {
'use strict';
const $ = id => document.getElementById(id);
let records = [], matching = [];
const norm = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
function el(tag, value, className) { const n = document.createElement(tag); if (value !== undefined) n.textContent = value; if (className) n.className = className; return n; }
async function getBytes(path) {
 const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
 try { const response = await fetch(path, {signal: controller.signal, cache: 'no-cache'}); if (!response.ok) throw new Error(path + ": HTTP " + response.status); return await response.arrayBuffer(); }
 finally { clearTimeout(timer); }
}
function text(bytes) { return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
function field(parent, label, content) { const s = el('section'); s.append(el('h3', label), el('p', content)); parent.append(s); }
function drawRecord(record) {
 const article = el('article', undefined, 'playbook'); article.id = record.id;
 const title = el('h2'); const anchor = el('a', record.title); anchor.href = '#' + record.id; title.append(anchor);
 const tags = el('div', undefined, 'tags'); record.tags.forEach(tag => tags.append(el('span', tag, 'tag')));
 article.append(el('span', record.id, 'pill'), title, el('p', record.problem), tags);
 const details = el('details'); const summary = el('summary', 'Read steps, checks and tradeoffs'); details.append(summary);
 field(details, 'Recommended starting point', record.rationale);
 field(details, 'First step', record.first_step);
 field(details, 'How to validate', record.validation);
 field(details, 'Limitations and risks', record.caveat);
 const options=el('section'); options.append(el('h3','Technology options')); record.technologies.forEach((name,i)=>{const a=el('a',name);a.href='index.html#/technologies?record='+encodeURIComponent(record.technology_ids[i]);options.append(a,document.createTextNode(' · '));});details.append(options);
 field(details, 'Review status', record.status);
 article.append(details); return article;
}
function restoreAnchor() { const id = decodeURIComponent(location.hash.slice(1)); if (!/^PB-\d{2}$/.test(id)) return; const record = document.getElementById(id); if (record) { const details = record.querySelector('details'); if (details) details.open = true; record.scrollIntoView({block:'start'}); } }
function render() {
 const words = norm($('search').value).trim().split(/\s+/).filter(Boolean);
 const tag = $('tag').value;
 matching = records.filter(r => (!tag || r.tags.includes(tag)) && words.every(w => norm([r.title,r.problem,r.rationale,r.first_step,r.validation,r.caveat,...r.technologies,...r.tags].join(' ')).includes(w)));
 $('playbook-results').replaceChildren(...matching.map(drawRecord));
 if (!matching.length) $('playbook-results').append(el('p', 'No matches. Clear filters or try another phrase.'));
 $('status').textContent = matching.length + " of " + records.length + " playbooks · source snapshot November 1, 2026 · integrity checked";
 restoreAnchor();
}
async function load() {
 try {
  const manifest = JSON.parse(text(await getBytes('publication.json')));
  const files = manifest.extensions?.playbooks;
  if (manifest.schema !== 1 || !Array.isArray(files) || !files.length) throw new Error('Playbooks are not yet marked as published.');
  if (!globalThis.crypto?.subtle) throw new Error('HTTPS (or localhost) is needed for content integrity verification.');
  const batches = await Promise.all(files.map(async f => {
   if (!/^data\/playbooks-\d{2}\.json$/.test(f.path) || f.kind !== 'playbooks' || !Number.isInteger(f.count)) throw new Error('Invalid catalog manifest.');
   const bytes = await getBytes(f.path);
   if (bytes.byteLength !== f.bytes) throw new Error('Incomplete transfer: ' + f.path);
   const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2,'0')).join('');
   if (hash !== f.sha256) throw new Error('Catalog checksum mismatch: ' + f.path);
   const part = JSON.parse(text(bytes));
   if (!Array.isArray(part) || part.length !== f.count || part.some(x => !/^PB-\d{2}$/.test(x.id) || !x.title || !x.problem || !x.rationale || !x.first_step || !x.validation || !x.caveat || !Array.isArray(x.tags) || !Array.isArray(x.technologies) || !Array.isArray(x.technology_ids) || x.technologies.length !== x.technology_ids.length)) throw new Error('Invalid playbook batch: ' + f.path);
   return part;
  }));
  const all = batches.flat();
  if (all.length !== manifest.published_counts.playbooks || new Set(all.map(x => x.id)).size !== all.length) throw new Error('Catalog count or ID mismatch.');
  records = all.sort((a,b) => a.id.localeCompare(b.id));
  const tags = [...new Set(records.flatMap(r => r.tags))].sort();
  for (const tag of tags) $('tag').add(new Option(tag,tag));
  $('export').disabled = false;
  render();
 } catch(error) {
  $('status').textContent = 'The published playbook catalog could not be verified: ' + error.message + ' No partial data is shown.';
  const retry = el('button', 'Retry loading'); retry.type = 'button'; retry.onclick = () => location.reload();
  const raw = el('a', 'Open preserved playbook records (raw JSON; not verified in this session)'); raw.href = 'data/playbooks-01.json';
  $('status').append(document.createTextNode(' '), retry, document.createTextNode(' '), raw);
 }
}
$('search').addEventListener('input', render);
$('tag').addEventListener('change', render);
$('reset').onclick = () => { $('search').value = ''; $('tag').value = ''; render(); };
$('export').onclick = () => {
 const url = URL.createObjectURL(new Blob([JSON.stringify(matching,null,2)],{type:'application/json'})); const a = el('a'); a.download = 'atlas-playbooks.json'; a.href = url; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),3000);
};
window.addEventListener('hashchange', restoreAnchor);
load();
})();
