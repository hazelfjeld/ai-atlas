/* Pure helpers shared by the browser and Node tests. No external dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function escapeHTML(value) {return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function safeURL(value) {try {const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }}
  function normalize(value) {return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function searchable(record) {return normalize(JSON.stringify(record));}
  function matches(record, query) {const text=record._search || searchable(record); return normalize(query).split(/\s+/).filter(Boolean).every(word=>text.includes(word));}
  function relevance(record, query) {const q=normalize(query).trim();if(!q)return 0;const title=normalize(record._title||record.name||record.term||record.title);const aliases=(record.aliases||[]).map(normalize);if(title===q)return 10000;if(aliases.includes(q))return 9000;if(title.startsWith(q))return 1000;if(title.includes(q))return 700;if(aliases.some(a=>a.includes(q)))return 600;return q.split(/\s+/).filter(word=>title.includes(word)).length*100;}
  function csv(rows) {const cells = v => {let s=Array.isArray(v)?v.join('; '):(v && typeof v==='object'?JSON.stringify(v):String(v??'')); if (/^[\s]*[=+@-]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"';}; const keys=[...new Set(rows.flatMap(r=>Object.keys(r).filter(k=>!k.startsWith('_'))))]; return '\uFEFF'+[keys.map(cells).join(','),...rows.map(r=>keys.map(k=>cells(r[k])).join(','))].join('\r\n');}
  function bibtex(p) {const clean=s=>String(s??'').replace(/[\\{}]/g, c=>({ '\\':'\\textbackslash{}','{':'\\{','}':'\\}'}[c])).replace(/\r?\n/g,' '); const aid=p.arxiv_id||p.id; const authors=[...(p.authors||[])];if(p.authors_complete===false)authors.push('others');return '@misc{arxiv'+aid.replace(/[^A-Za-z0-9]/g,'')+',\n  title={'+clean(p.title)+'},\n  author={'+clean(authors.join(' and '))+'},\n  year={'+String(p.published_at||'').slice(0,4)+'},\n  eprint={'+clean(aid)+'},\n  archivePrefix={arXiv},\n  url={'+clean(safeURL(p.source_url))+'}\n}';}
  function formatDate(s) {if(!s)return 'Not specified';if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return s;return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));}
  function isStale(lastSuccess, hours, now=Date.now()){if(!lastSuccess)return true;const t=Date.parse(lastSuccess);return !Number.isFinite(t)||now-t>hours*3600000*2;}
  function validateNotebook(value, validIDs) {if(!value || typeof value!=='object'||Array.isArray(value))throw new Error('Notebook must be a JSON object.');const out={schema:1,saved:[],notes:{},compare:[]};if(value.schema!==1)throw new Error('Unsupported notebook version.');for(const id of (Array.isArray(value.saved)?value.saved:[]).slice(0,5000))if(validIDs.has(id)&&!out.saved.includes(id))out.saved.push(id); if(value.notes&&typeof value.notes==='object'&&!Array.isArray(value.notes))for(const [id,text] of Object.entries(value.notes).slice(0,5000))if(validIDs.has(id)&&typeof text==='string')out.notes[id]=text.slice(0,20000);for(const id of (Array.isArray(value.compare)?value.compare:[]).slice(0,3))if(validIDs.has(id)&&id.startsWith('TECH-')&&!out.compare.includes(id))out.compare.push(id);return out;}
  function termPath(r) {const slug=String(r.term).normalize('NFKD').replace(/[^\x00-\x7F]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'concept';return 'terms/'+r.id+'-'+slug+'.html';}
  return {termPath,escapeHTML,safeURL,normalize,searchable,matches,relevance,csv,bibtex,formatDate,isStale,validateNotebook};
});
