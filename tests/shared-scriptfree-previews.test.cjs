'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync('whats-new.html','utf8'),r=fs.readFileSync('research.html','utf8'),c=fs.readFileSync('site-chrome.css','utf8'),j=fs.readFileSync('checkpoint.js','utf8');
const manifest=JSON.parse(fs.readFileSync('data/daily/index.json','utf8'));
const entry=manifest.editions.find(x=>x.date==='2026-11-20'&&x.revision===1);
const raw=fs.readFileSync(entry.path),edition=JSON.parse(raw.toString('utf8'));
const papers=JSON.parse(fs.readFileSync('data/papers-01.json','utf8'));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
test('script-free news headlines come from a verified immutable edition',()=>{
 assert.equal(raw.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),entry.sha256);
 const html=h.slice(h.indexOf('<section class="site-static-fallback" id="scriptfree-daily-archive"'),h.indexOf('<p class="status" id="edition-status"'));
 assert.ok(html.includes('data-edition-date="'+edition.edition_date+'"'));
 assert.ok(html.indexOf('site-static-fallback__stories')<html.indexOf('Browse immutable editions'));
 for(const row of edition.news.slice(0,3)){
  assert.ok(row.review_status.startsWith('publisher_reviewed_'));
  assert.ok(html.includes('<a href="'+esc(row.source_url)+'" rel="noopener noreferrer">'+esc(row.title)+'</a>'));
  assert.ok(html.includes(esc(row.summary)));
  assert.ok(html.includes('Source published '+row.publication_date));
 }
 for(const date of ['2026-11-20','2026-11-19','2026-11-18'])assert.ok(html.includes('href="data/daily/editions/'+date+'-v1.json"'));
 assert.ok(html.includes('href="data/daily/index.json"'));
 assert.match(h,/html\.atlas-daily-ready #scriptfree-daily-archive\{display:none!important\}/);
});
test('research shares native cards and preserves script-free source/archive links',()=>{
 const html=r.slice(r.indexOf('<section class="site-static-fallback" id="scriptfree-research-catalog"'),r.indexOf('</section><div class="site-js-only">')); 
 assert.ok(html.startsWith('<section class="site-static-fallback"'));
 assert.ok(!r.includes('<noscript><section class="site-static-fallback"'));
 assert.match(r,/html\.atlas-research-ready #scriptfree-research-catalog\{display:none!important\}/);
 assert.match(j,/manifest = m;[^\n]*route\(\);[\s\S]*?document\.documentElement\.classList\.add\('atlas-research-ready'\);/);
 assert.ok(j.indexOf("classList.add('atlas-research-ready')") < j.indexOf('} catch (error)'));
 assert.ok(j.indexOf("classList.add('atlas-research-ready')") > j.indexOf('route();'));
 assert.ok(html.includes('data-catalog-date="2026-11-01"'));
 assert.ok(html.indexOf('site-static-fallback__stories')<html.indexOf('Browse the full research catalog'));
 for(const row of papers.slice(0,3)){
  assert.equal(row.review_status,'Abstract reviewed');
  assert.ok(html.includes('<a href="'+esc(row.source_url)+'" rel="noopener noreferrer">'+esc(row.title)+'</a>'));
  assert.ok(html.includes(esc(row.summary)));
 }
 for(const path of ['data/papers-01.json','data/papers-06.json','data/alerts-02.json','publication.json'])
  assert.ok(html.includes('href="'+path+'"'));
 assert.match(c,/\.site-static-fallback__stories\{list-style:none/);
 assert.match(c,/@media\(max-width:650px\)\{\.site-static-fallback__stories/);
 assert.ok(h.includes('class="site-static-fallback__stories"'));
});
