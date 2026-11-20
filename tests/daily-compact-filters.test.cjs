'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('whats-new.html','utf8');
const js=fs.readFileSync('whats-new.js','utf8');

test('news archive keeps the date picker and working search outside native advanced filters',()=>{
 const panel=html.slice(html.indexOf('<div class="panel">'),html.indexOf('<div id="edition-content"'));
 const archive=panel.indexOf('id="edition-select"');
 const refine=panel.indexOf('id="edition-refine"');
 const search=panel.indexOf('id="edition-search"');
 assert.ok(archive>=0&&refine>archive&&search>refine);
 const details=panel.slice(refine,panel.indexOf('</details>',refine));
 for(const id of ['section-filter','topic-filter','publication-filter','evidence-filter','source-filter','export-verified']){
  assert.ok(details.includes('id="'+id+'"'),id+' is a real, revealed control');
 }
 assert.ok(!details.includes('id="edition-search"'));
 assert.match(panel,/<details class="edition-filter-disclosure" id="edition-refine" open>/);
 assert.match(html,/id="scriptfree-daily-archive"/);
});

test('compact mobile entry respects existing deep-linked archive filters',()=>{
 assert.match(js,/const advancedSelected=\['section','topic','review','source','publication'\]/);
 assert.match(js,/filters\[key\]!=='all'/);
 assert.match(js,/matchMedia\('\(max-width: 560px\)'\)/);
 assert.match(js,/refinements\.open=false/);
 assert.match(html,/\.edition-filter-disclosure>summary:focus-visible/);
 assert.match(html,/\.archive-picker select\{font-size:16px;min-height:44px\}/);
});
