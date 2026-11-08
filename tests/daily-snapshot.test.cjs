'use strict';
// The snapshot is computed from validated immutable edition records, never from
// today's clock, collector discovery times or unpublished candidate queues.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../daily-core.js');
const root=path.resolve(__dirname,'..');
const editionPath=path.join(root,'data/daily/editions/2026-11-03-v4.json');
const published=()=>JSON.parse(fs.readFileSync(editionPath,'utf8'));

test('Dated November 3 snapshot separates real publisher dates from catch-up and website changes',()=>{
 const e=published(),s=D.editionSnapshot(e);
 assert.equal(s.editionDate,'2026-11-03');
 assert.equal(s.newsReports,8);
 assert.equal(s.publishedOnEditionDate,4);
 assert.equal(s.earlierReports,4);
 assert.equal(s.postdatedReports,0);
 assert.equal(s.undatedReports,0);
 assert.equal(s.catalogAdditions,e.technologies.length+e.terms.length);
 assert.equal(s.siteChanges,e.site_changes.length);
 assert.equal(s.corrections,e.corrections.length);
 assert.equal(s.sourceFailures,3);
 assert.equal(s.coverageStatus,'partial');
});

test('Snapshot uses publisher publication_date, never event, discovery or Atlas edit dates',()=>{
 const e=published();
 const row={...e.news[0],id:'TEST-DATE-SEMANTICS',
  publication_date:null,event_date:'2026-11-03',
  discovered_at:'2026-11-03T15:00:00Z',added_to_atlas_at:'2026-11-03T15:00:00Z'};
 e.news=[row];
 const s=D.editionSnapshot(e);
 assert.equal(s.newsReports,1);
 assert.equal(s.publishedOnEditionDate,0);
 assert.equal(s.earlierReports,0);
 assert.equal(s.postdatedReports,0);
 assert.equal(s.undatedReports,1);
});

test('Snapshot handles postdated and earlier publisher dates without implying new launches',()=>{
 const e=published();
 e.news=[{...e.news[0],id:'TEST-OLD',publication_date:'2026-11-02'},
  {...e.news[0],id:'TEST-LATER',publication_date:'2026-11-04'}];
 const s=D.editionSnapshot(e);
 assert.deepEqual([s.newsReports,s.publishedOnEditionDate,s.earlierReports,s.postdatedReports,s.undatedReports],[2,0,1,1,0]);
});

test('Snapshot refuses invalid dates and stays hidden before checksum-verified edition render',()=>{
 const e=published();e.news[0].publication_date='2026-11-31';
 assert.throws(()=>D.editionSnapshot(e),/Invalid source publication date/);
 const html=fs.readFileSync(path.join(root,'whats-new.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'whats-new.js'),'utf8');
 assert.match(html,/<section id="edition-snapshot"[^>]* hidden><\/section>/);
 assert.match(js,/host\.hidden=!edition/);
 assert.match(js,/const s=C\.editionSnapshot\(edition\)/);
 assert.match(js,/metadata\(\);sourceCoverage\(\);renderSnapshot\(\);render\(\)/);
 assert.match(js,/This is a dated archive, not today/);
 assert.match(js,/Failed source lookups/);
});

// The publisher must not convert partial catch-up into same-day launches.
test('November 8 source-reviewed edition separates same-day reporting from older discoveries',()=>{
 const item=JSON.parse(fs.readFileSync(path.join(root,'data/daily/editions/2026-11-08-v1.json'),'utf8'));
 const snapshot=D.editionSnapshot(item);
 assert.deepEqual([snapshot.newsReports,snapshot.publishedOnEditionDate,snapshot.earlierReports,snapshot.coverageStatus],[9,2,7,'partial']);
 assert.equal(item.technologies.length+item.terms.length,0);
 assert.equal(item.news.filter(x=>x.summary.includes('948 working local privilege-escalation exploits')).length,1);
 assert.equal(item.news.filter(x=>x.summary.includes('948 distinct patches')).length,0);
 assert.ok(item.news.every(x=>x.review_status.startsWith('publisher_checked_')));
});
