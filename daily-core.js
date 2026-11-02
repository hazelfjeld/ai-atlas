/* Pure daily-edition helpers shared by the static news page and Node tests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.AtlasDailyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KINDS=['news','technologies','terms','site_changes','corrections'];
const MATCH_PATH=/^data\/daily\/editions\/(\d{4}-\d{2}-\d{2})-v([1-9]\d*)\.json$/;
const HEX=/^[0-9a-f]{64}$/;
function assert(ok,message){if(!ok)throw new Error(message);}
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
function validTimestamp(value){
 if(typeof value!=='string')return false;
 const m=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/);
 if(!m||!validDate(m[1]))return false;
 if(Number(m[2])>23||Number(m[3])>59||Number(m[4])>59)return false;
 if(m[5]!=='Z'&&(Number(m[6])>14||Number(m[7])>59||(Number(m[6])===14&&Number(m[7])!==0)))return false;
 return Number.isFinite(Date.parse(value));
}
function chicagoDate(value=new Date()){
 const d=value instanceof Date?value:new Date(value);
 assert(Number.isFinite(d.valueOf()),'Invalid date');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function safeSource(url){
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}
}
function safeCatalogPath(path){
 if(typeof path!=='string')return '';
 if(/^(terms\/MLD-\d{4}-[a-z0-9-]+\.html|technology\/TECH-\d{4}-[a-z0-9-]+\.html|index\.html#\/(technologies|dictionary|papers|safety|playbooks)\?record=[A-Za-z0-9-]+|index\.html#\/(overview|technologies|dictionary|papers|safety|playbooks|sources))$/.test(path))return path;
 return '';
}
function validateIndex(index){
 assert(index&&typeof index==='object'&&!Array.isArray(index),'Daily index must be an object');
 assert(index.schema===1&&index.timezone==='America/Chicago','Unsupported daily index schema or timezone');
 assert(Array.isArray(index.editions),'Missing edition archive');
 assert(index.last_successful_publish_at===null||validTimestamp(index.last_successful_publish_at),'Invalid last successful publication date');
 const keys=new Set(),paths=new Set();
 for(const [i,e] of index.editions.entries()){
  assert(e&&validDate(e.date)&&Number.isSafeInteger(e.revision)&&e.revision>=1,'Invalid archive date or revision at '+i);
  const m=typeof e.path==='string'?e.path.match(MATCH_PATH):null;
  assert(m&&m[1]===e.date&&Number(m[2])===e.revision,'Invalid archive file path at '+i);
  assert(typeof e.sha256==='string'&&HEX.test(e.sha256),'Missing archive checksum');
  assert(Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=2000000,'Invalid edition size');
  assert(validTimestamp(e.published_at),'Invalid edition published timestamp');
  const key=e.date+'|'+e.revision;
  assert(!keys.has(key)&&!paths.has(e.path),'Duplicate edition date, revision or path');
  keys.add(key);paths.add(e.path);
 }
 return index;
}
function selection(index,today=chicagoDate()){
 validateIndex(index);
 assert(validDate(today),'Invalid selected date');
 const sorted=[...index.editions].sort((a,b)=>b.date.localeCompare(a.date)||b.revision-a.revision);
 const byDate=sorted.filter(e=>e.date===today);
 return {today,todayEntry:byDate[0]||null,latest:sorted[0]||null,archive:sorted};
}
function fallbackOrder(index,today=chicagoDate()){
 return selection(index,today).archive.filter(e=>e.date<=today);
}
function validateEdition(edition,indexEntry){
 assert(edition&&typeof edition==='object'&&!Array.isArray(edition),'Invalid edition');
 assert(edition.schema===1&&edition.timezone==='America/Chicago'&&validDate(edition.edition_date),'Invalid edition schema/date');
 if(indexEntry){
  assert(edition.edition_date===indexEntry.date,'Edition date differs from archive index');
  assert(Date.parse(edition.published_at)===Date.parse(indexEntry.published_at),'Publication timestamp differs from archive index');
 }
 assert(validTimestamp(edition.published_at),'Invalid edition publication timestamp');
 assert(edition.coverage&&typeof edition.coverage==='object'&&['complete','partial','failed'].includes(edition.coverage.status),'Invalid collection status');
 assert(validTimestamp(edition.coverage.start)&&validTimestamp(edition.coverage.end)&&Date.parse(edition.coverage.end)>=Date.parse(edition.coverage.start),'Invalid collection window');
 assert(Array.isArray(edition.coverage.sources_checked)&&Array.isArray(edition.coverage.sources_failed),'Missing source health');
 for(const source of [...edition.coverage.sources_checked,...edition.coverage.sources_failed]){
  const url=typeof source==='string'?source:source?.url;
  assert(!url||safeSource(url),'Invalid collection source URL');
 }
 assert(Array.isArray(edition.tldr)&&edition.tldr.length>=1&&edition.tldr.length<=3&&edition.tldr.every(x=>typeof x==='string'&&x.trim()),'Missing editorial summary');
 const seen=new Set();
 for(const kind of KINDS){
  assert(Array.isArray(edition[kind]),'Missing '+kind+' records');
  for(const item of edition[kind]){
   assert(item&&typeof item.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/.test(item.id),'Invalid record ID');
   assert(typeof item.title==='string'&&item.title.trim()&&typeof item.summary==='string'&&item.summary.trim(),'Missing title or summary');
   assert(typeof item.review_status==='string'&&item.review_status.trim(),'Missing evidence status');
   assert(!item.source_url||safeSource(item.source_url),'Invalid source URL');
   if(kind==='news')assert(safeSource(item.source_url),'News item requires an HTTPS source URL');
   assert(!item.catalog_path||safeCatalogPath(item.catalog_path),'Unsafe internal record link');
   assert(Array.isArray(item.tags||[]),'Invalid topic tags');
   assert(!item.publication_date||validDate(item.publication_date),'Invalid source publication date');
   assert(!item.event_date||validDate(item.event_date),'Invalid event date');
   assert(!item.discovered_at||validTimestamp(item.discovered_at),'Invalid discovery timestamp');
   assert(!item.added_to_atlas_at||validTimestamp(item.added_to_atlas_at),'Invalid Atlas addition timestamp');
   const key=kind+'|'+item.id;
   assert(!seen.has(key),'Duplicate '+kind+' ID');
   seen.add(key);
  }
 }
 return edition;
}
return {KINDS,validDate,validTimestamp,chicagoDate,safeSource,safeCatalogPath,validateIndex,validateEdition,selection,fallbackOrder};
});
