/* Atlas's static, immutable daily-edition reader. No user data is stored. */
(()=>{
'use strict';
const C=window.AtlasDailyCore;
const $=id=>document.getElementById(id);
const kinds=[['news','AI news'],['technologies','New technologies'],['terms','New terms'],['site_changes','Updated in Atlas'],['corrections','Corrections & clarifications']];
let index=null,active=null,edition=null;
function element(tag,text,cls){
 const e=document.createElement(tag);
 if(text!==undefined)e.textContent=String(text);
 if(cls)e.className=cls;
 return e;
}
function status(text){$('edition-status').textContent=text;}
function humanDate(s){
 if(!s)return 'Not reported';
 const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T12:00:00Z':s);
 return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'numeric'}).format(d):'Not reported';
}
function stamp(s){
 if(!s)return 'Not reported';
 const d=new Date(s);
 return Number.isFinite(d.valueOf())?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d):'Not reported';
}
function line(label,value,container){
 if(value===undefined||value===null||value==='')return;
 const s=element('span');s.append(element('strong',label+': '),document.createTextNode(String(value)));container.append(s);
}
function href(url,label){
 const u=C.safeSource(url);
 if(!u)return null;
 const a=element('a',label+' ↗');a.href=u;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function localHref(path,label){
 const safe=C.safeCatalogPath(path);
 if(!safe)return null;
 const a=element('a',label+' →');a.href=safe;return a;
}
function card(item,kind){
 const article=element('article',undefined,'item');
 const top=element('div',undefined,'tags');
 top.append(element('span',item.review_status,'tag'));
 if(item.release_status)top.append(element('span',item.release_status,'tag'));
 if(item.category)top.append(element('span',item.category,'tag'));
 article.append(top,element('h3',item.title),element('p',item.summary));
 if(item.why_it_matters){const p=element('p');p.append(element('strong','Why it matters: '),document.createTextNode(item.why_it_matters));article.append(p);}
 if(item.caveat){const p=element('p',undefined,'caveat');p.append(element('strong','Limitation: '),document.createTextNode(item.caveat));article.append(p);}
 const dates=element('div',undefined,'fact');
 const bits=[];
 if(item.publication_date)bits.push('Source published '+humanDate(item.publication_date));
 if(item.event_date)bits.push('Event '+humanDate(item.event_date));
 if(item.discovered_at)bits.push('Discovered '+stamp(item.discovered_at));
 if(item.added_to_atlas_at)bits.push('Added to Atlas '+stamp(item.added_to_atlas_at));
 dates.textContent=bits.join(' · ')||'Dates not independently established';
 article.append(dates);
 if(Array.isArray(item.tags)&&item.tags.length){const tags=element('div',undefined,'tags');item.tags.slice(0,7).forEach(t=>tags.append(element('span',t,'tag')));article.append(tags);}
 const links=element('div',undefined,'links'),source=href(item.source_url,'Original source'),internal=localHref(item.catalog_path,'Explore in Atlas');
 if(source)links.append(source);
 if(internal)links.append(internal);
 if(links.childNodes.length)article.append(links);
 return article;
}
function metadata(){
 const m=$('edition-metadata');m.replaceChildren();
 const t=element('span');t.append(document.createTextNode('Last successful publication: '),element('b',index?.last_successful_publish_at?stamp(index.last_successful_publish_at):'none yet'));m.append(t);
 if(!edition){line('Collection','Awaiting first verified publication',m);return;}
 line('Edition published',stamp(edition.published_at),m);
 line('Window',stamp(edition.coverage.start)+' – '+stamp(edition.coverage.end),m);
 line('Collection',edition.coverage.status,m);
 line('Sources checked',edition.coverage.sources_checked.length,m);
 line('Source failures',edition.coverage.sources_failed.length,m);
}
function render(){
 if(!edition)return;
 const section=$('section-filter').value,topic=$('topic-filter').value;
 const summary=$('edition-summary');summary.hidden=false;
 $('summary-content').replaceChildren(...edition.tldr.map(s=>element('p',s)));
 const content=$('edition-content');content.replaceChildren();
 let visible=0;
 for(const [kind,label] of kinds){
  if(section!=='all'&&section!==kind)continue;
  const records=edition[kind].filter(item=>{
   if(topic==='all')return true;
   const tags=[item.category,...(item.tags||[])].filter(Boolean).map(s=>String(s).toLowerCase());
   return tags.some(t=>t.includes(topic));
  });
  if(!records.length)continue;
  visible+=records.length;
  const s=element('section'),heading=element('div',undefined,'heading'),title=element('h2',label);
  heading.append(title,element('span',records.length+' entries'));s.append(heading);
  const grid=element('div',undefined,'cards');records.forEach(x=>grid.append(card(x,kind)));s.append(grid);
  content.append(s);
 }
 if(!visible)content.append(element('div',section==='all'&&topic==='all'?'No items met the editorial threshold in this edition. This does not establish that no AI news occurred.':'No entries match those filters. Try a broader category.','empty'));
}
async function request(path){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
 try{const response=await fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('HTTP '+response.status+' for '+path);return await response.arrayBuffer();}
 finally{clearTimeout(timeout);}
}
function decode(bytes){return JSON.parse(new TextDecoder().decode(bytes));}
async function sha256(bytes){
 if(!globalThis.crypto?.subtle)throw new Error('HTTPS is required for publication checks');
 const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function readEdition(entry){
 status('Loading '+humanDate(entry.date)+' and checking its published SHA-256…');
 const bytes=await request(entry.path);
 if(bytes.byteLength!==entry.bytes)throw new Error('Edition size mismatch. A CDN cache may be stale.');
 if(await sha256(bytes)!==entry.sha256)throw new Error('Edition checksum mismatch. No partially updated content is shown.');
 return C.validateEdition(decode(bytes),entry);
}
async function switchEdition(entry){
 if(!entry)return;
 try{
  const e=await readEdition(entry);
  edition=e;active=entry;
  $('date-display').textContent=humanDate(entry.date);
  metadata();render();
  const today=C.chicagoDate();
  const prefix=entry.date===today?'Today’s verified edition':'Archived edition '+humanDate(entry.date);
  const caveat=e.coverage.status==='complete'?'':' · source coverage '+e.coverage.status;
  status(prefix+' · published '+stamp(entry.published_at)+caveat+'. AI coverage is curated, not exhaustive.');
  $('edition-select').value=entry.path;
 }catch(err){
  edition=null;active=null;metadata();$('edition-summary').hidden=true;
  $('edition-content').replaceChildren(element('div','Edition verification failed. The last known-good catalog remains available through Atlas.','empty'));
  status('Cannot display this edition: '+err.message);
 }
}
function populateArchive(selected){
 const select=$('edition-select');
 select.replaceChildren();
 const archive=C.selection(index).archive;
 if(!archive.length){select.add(new Option('Awaiting first edition',''));select.disabled=true;return;}
 select.disabled=false;
 for(const item of archive){
  const title=humanDate(item.date)+(item.revision>1?' · revision '+item.revision:'')+' · '+stamp(item.published_at);
  select.add(new Option(title,item.path));
 }
 select.value=selected.path;
}
async function start(){
 if(!C){status('Daily reader failed to initialize.');return;}
 const today=C.chicagoDate();$('date-display').textContent=humanDate(today);
 try{
  index=C.validateIndex(decode(await request('data/daily/index.json')));
  const found=C.selection(index,today);
  const chosen=found.todayEntry||found.latest;
  metadata();
  if(!chosen){
   status('Awaiting the first reviewed daily edition for '+humanDate(today)+'. No headlines have been published yet.');
   populateArchive(null);return;
  }
  populateArchive(chosen);
  await switchEdition(chosen);
  if(!found.todayEntry)status('Today’s edition ('+humanDate(today)+') has not been published. Showing '+humanDate(chosen.date)+' under its actual edition date.');
 }catch(err){
  status('Daily archive unavailable: '+err.message+'. Previously verified Atlas reference material remains accessible.');
  $('edition-content').replaceChildren(element('div','No unverified headlines are shown when the edition index cannot be validated.','empty'));
 }
}
$('edition-select').addEventListener('change',()=>{
 const entry=index?.editions.find(e=>e.path===$('edition-select').value);
 if(entry)void switchEdition(entry);
});
$('section-filter').addEventListener('change',render);
$('topic-filter').addEventListener('change',render);
void start();
})();
