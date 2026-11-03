(() => {
'use strict';
const $ = id => document.getElementById(id);
const records = [], selected = new Set();
let releaseUpdates = Object.create(null);
let matches = [], visible = 40, prepared = 300, snapshot = '';
const norm = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
function el(tag, value, className) { const node = document.createElement(tag); if (value !== undefined) node.textContent = value; if (className) node.className = className; return node; }
function safeLink(raw, label) { try { const url = new URL(raw); if (url.protocol !== 'https:') throw 0; const a = el('a',label); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; } catch { return el('span',label + ' · unavailable'); } }
async function bytes(path) {
 const controller = new AbortController(), timer = setTimeout(() => controller.abort(),30000);
 try { const r = await fetch(path,{signal:controller.signal,cache:'no-cache'}); if (!r.ok) throw new Error(path + ': HTTP ' + r.status); return await r.arrayBuffer(); }
 finally { clearTimeout(timer); }
}
function hex(buffer) { return Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2,'0')).join(''); }
async function hash(bytes) { return hex(await crypto.subtle.digest('SHA-256',bytes)); }
async function verifyBatch(file) {
 if (file.kind !== 'technologies' || !/^data\/technologies-\d{2}\.json(?:\.gz)?$/.test(file.path) || !Number.isInteger(file.count)) throw new Error('Invalid technology manifest path.');
 const payload = await bytes(file.path);
 const packed = payload.byteLength === file.bytes && await hash(payload) === file.sha256;
 const expandedDirect = payload.byteLength === file.expanded_bytes && await hash(payload) === file.expanded_sha256;
 if (!packed && !expandedDirect) throw new Error('Checksum/size mismatch for ' + file.path);
 let uncompressed = payload;
 if (packed && new Uint8Array(payload)[0] === 0x1f && new Uint8Array(payload)[1] === 0x8b) {
   if (typeof DecompressionStream !== 'function') throw new Error('A browser with gzip DecompressionStream support is needed.');
   uncompressed = await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 }
 if (uncompressed.byteLength !== (file.expanded_bytes ?? file.bytes) || await hash(uncompressed) !== (file.expanded_sha256 ?? file.sha256)) throw new Error('Decoded checksum mismatch for ' + file.path);
 const batch = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(uncompressed));
 if (!Array.isArray(batch) || batch.length !== file.count || batch.some(r => !/^TECH-\d{4}$/.test(r.id) || !r.name || !r.what || !r.edge || !r.best_for || !r.watch_out || !Array.isArray(r.tags) || !Array.isArray(r.stages) || !Array.isArray(r.alternatives) || !r.source_url)) throw new Error('Record validation failed for ' + file.path);
 return batch;
}
function line(dl,key,value) {
 if (value === undefined || value === null || value === '' || Array.isArray(value) && !value.length) return;
 dl.append(el('dt',key),el('dd',Array.isArray(value) ? value.join(' · ') : String(value)));
}
function card(r) {
 const a = el('article',undefined,'tech-card'); a.id = r.id;
 a.append(el('span',r.id + ' · ' + r.kind,'meta'));
 const h = el('h2'), route = el('a',r.name); route.href = '#' + r.id; h.append(route); a.append(h);
 a.append(el('p',r.what,'lede'));
 const advantage = el('p',r.edge,'advantage'); a.append(advantage);
 const tags = el('div',undefined,'tags'); for(const t of r.tags.slice(0,7)) tags.append(el('span',t,'tag')); a.append(tags);
 const details = el('details'); details.append(el('summary','Explore use cases, risks & references'));
 const dl = el('dl'); for (const [label,value] of [
  ['Best for',r.best_for],['Watch out',r.watch_out],['How to test the choice',r.test_before_choice],
  ['Alternatives',r.alternatives],['Comparison basis',r.comparison_basis],['Execution',r.execution],
  ['Runtime',r.runtime],['Access',r.access],['Complexity',r.complexity],['Lifecycle',r.lifecycle],
  ['Related concepts',r.linked_concepts || r.concepts],['Stages',r.stages],
  ['Evidence status',r.evidence_status],['Reviewed on',r.reviewed_on || 'Not independently re-audited']]) line(dl,label,value);
 details.append(dl);
 for (const u of releaseUpdates[r.id] || []) {
  const review=el('section',undefined,'release-update');
  review.append(el('h3','Reviewed release update · '+u.version),el('p',u.summary),el('p','Compatibility: '+u.compatibility),el('p','Publication status: '+u.status_note),el('p','Evidence limitation: '+u.caveat),el('p','Source published: '+u.published_at+' · Reviewed: '+u.reviewed_on),safeLink(u.source_url,'First-party release notes ↗'));
  details.append(review);
 }
 const raw = el('details'); raw.append(el('summary','Inspect all original source fields'),el('pre',JSON.stringify(r,null,2)));
 details.append(raw); a.append(details);
 const actions = el('div',undefined,'card-actions');
 const toggle = el('button',selected.has(r.id) ? 'Remove from comparison' : 'Add to comparison');
 toggle.type = 'button'; toggle.setAttribute('aria-pressed',selected.has(r.id) ? 'true':'false');
 toggle.disabled = !selected.has(r.id) && selected.size >= 3;
 toggle.onclick = () => { if (selected.has(r.id)) selected.delete(r.id); else if(selected.size < 3) selected.add(r.id); render(false); };
 actions.append(toggle,safeLink(r.source_url,'Original documentation ↗')); a.append(actions);
 return a;
}
function anchor() {
 const id = decodeURIComponent(location.hash.slice(1)); if (!/^TECH-\d{4}$/.test(id)) return;
 const index = matches.findIndex(r => r.id === id);
 if (index < 0) return;
 if (index >= visible) { visible = Math.ceil((index+1)/40)*40; draw(); }
 const target = document.getElementById(id);
 if (target) { const details = target.querySelector('details'); if(details) details.open = true; target.scrollIntoView({block:'start'}); }
}
function draw() {
 $('tech-results').replaceChildren(...matches.slice(0,visible).map(card));
 if (!matches.length) $('tech-results').append(el('p','No matching technologies. Try broader terms or reset the filters.'));
 $('show-more').hidden = matches.length <= visible;
 $('tech-status').textContent = matches.length + ' matching of ' + records.length + ' published profiles · ' + prepared + ' prepared · snapshot ' + snapshot;
 $('compare-button').textContent = 'Compare selected (' + selected.size + ')';
 $('compare-button').disabled = selected.size < 2;
 $('tech-export').disabled = records.length === 0;
}
function render(reset=true) {
 if(reset) visible=40;
 const words = norm($('tech-search').value).trim().split(/\s+/).filter(Boolean);
 const section=$('tech-section').value,tag=$('tech-tag').value,stage=$('tech-stage').value;
 matches=records.filter(r => (!section || r.section === section) && (!tag || r.tags.includes(tag)) && (!stage || r.stages.includes(stage)) && words.every(w => norm([r.name,r.kind,r.what,r.edge,r.best_for,r.watch_out,r.section,r.source_url,...r.tags,...r.stages,...r.alternatives,...(r.concepts||[]),...(releaseUpdates[r.id]||[]).flatMap(u=>[u.summary,u.compatibility,u.version,u.status_note])].join(' ')).includes(w)));
 draw();
 if(!reset) anchor();
}
function compare() {
 if(selected.size < 2) return;
 const chosen=Array.from(selected).map(id=>records.find(r=>r.id===id)).filter(Boolean);
 const table=el('table'), thead=el('thead'), hdr=el('tr'); hdr.append(el('th','Criterion'));
 for(const r of chosen) hdr.append(el('th',r.name)); thead.append(hdr); table.append(thead);
 const tbody=el('tbody');
 for(const [label,key] of [['What it does','what'],['Distinct advantage','edge'],['Best-fit use','best_for'],['Tradeoffs','watch_out'],['Alternatives','alternatives'],['Validation','test_before_choice'],['Evidence','evidence_status']]) {
  const row=el('tr');row.append(el('th',label));
  for(const r of chosen) row.append(el('td',Array.isArray(r[key])?r[key].join(' · '):r[key]||'Not specified'));
  tbody.append(row);
 }
 table.append(tbody);$('compare-content').replaceChildren(table);
 $('compare-dialog').showModal();
}
function download() {
 const url=URL.createObjectURL(new Blob([JSON.stringify(matches,null,2)],{type:'application/json'}));
 const a=el('a');a.href=url;a.download='atlas-technologies.json';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function start() {
 try {
  if (!globalThis.crypto?.subtle) throw new Error('Open over HTTPS or localhost to verify this catalog.');
  const manifest=JSON.parse(new TextDecoder().decode(await bytes('publication.json')));
  const files=manifest.extensions?.technologies || [];
  if(manifest.schema!==1 || !Array.isArray(files) || !files.length) throw new Error('The technology extension is not published yet.');
  const batches=await Promise.all(files.map(verifyBatch)); records.push(...batches.flat());
  if(records.length!==manifest.published_counts.technologies || new Set(records.map(r=>r.id)).size!==records.length) throw new Error('Published count or ID mismatch.');
  // Original source fields stay frozen. Show the additive review only after exact integrity verification.
  try {
    const payload=await bytes('content/technology-release-updates.json');
    if(payload.byteLength!==1984 || await hash(payload)!=='bce8af000eb5b765177ebb62ca7b5be09b3931679152ee7d59cc5e0faebd4e2c') throw new Error('Release annotation checksum mismatch');
    const overlay=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(payload));
    if(overlay.schema!==1 || !overlay.updates || Object.keys(overlay.updates).some(id=>!records.some(r=>r.id===id))) throw new Error('Invalid release annotation catalog IDs');
    for(const updates of Object.values(overlay.updates)) for(const u of updates) {
      if(!u.version || !u.summary || !u.compatibility || !u.caveat || !u.source_url || new URL(u.source_url).protocol!=='https:') throw new Error('Invalid release annotation');
    }
    releaseUpdates=overlay.updates;
  } catch(error){ console.warn('Verified technology release annotations unavailable; showing original catalog only:',error.message); }
  records.sort((a,b)=>a.name.localeCompare(b.name));
  prepared=manifest.prepared_counts.technologies; snapshot=manifest.snapshot_date;
  const added = records.length - prepared;
  $('coverage-note').textContent = prepared + ' preserved original profiles, all checksum-verified.' + (added > 0 ? ' Plus ' + added + ' new-to-Atlas source-reviewed profiles (not independently benchmarked).' : '');
  for(const [id,field] of [['tech-section','section'],['tech-tag','tags'],['tech-stage','stages']]) {
    const values=new Set();
    for(const r of records) for(const v of (Array.isArray(r[field])?r[field]:[r[field]])) if(v) values.add(v);
    for(const v of [...values].sort()) $(''+id).add(new Option(v,v));
  }
  render(); anchor();
 } catch(error) {
  $('tech-status').textContent = 'Technology catalog unavailable: ' + error.message + ' No unverified partial data is displayed.';
 }
}
$('tech-search').addEventListener('input',()=>render());
for(const id of ['tech-section','tech-tag','tech-stage']) $(id).addEventListener('change',()=>render());
$('tech-reset').onclick=()=>{for(const id of ['tech-search','tech-section','tech-tag','tech-stage']) $(id).value='';render();};
$('compare-button').onclick=compare;
$('compare-close').onclick=()=>$('compare-dialog').close();
$('tech-export').onclick=download;
$('show-more').onclick=()=>{visible+=40;draw();};
window.addEventListener('hashchange',anchor);
start();
})();
