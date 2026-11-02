'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../discovery.js'),C=require('../core.js');
const data={};
for(const kind of ['terms','technologies','alerts','papers','playbooks'])data[kind]=fs.readdirSync(path.join(__dirname,'../data')).filter(f=>new RegExp('^'+kind+'-\\d+\\.json$').test(f)).sort().flatMap(f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',f))));
test('Discovery filtering changes the collection and preserves direct content links',()=>{
  const all=D.render(data),tools=D.render(data,{topic:'tools'}),research=D.render(data,{topic:'research'});
  assert.equal((all.match(/class="discovery-card"/g)||[]).length,6);
  assert.equal((tools.match(/class="discovery-card"/g)||[]).length,2);
  assert.equal((research.match(/class="discovery-card"/g)||[]).length,1);
  assert.ok(tools.includes('technology/TECH-0216-pytorch.html'));
  assert.ok(!research.includes('A closer look at PyTorch'));
  assert.ok(D.render(data,{topic:'unknown'}).includes('Worth understanding'));
});
test('Offline discovery links remain inside the embedded workspace',()=>{
  const html=D.render(data,{offline:true});
  assert.ok(html.includes('#/dictionary?record=MLD-1039'));
  assert.ok(html.includes('#/technologies?record=TECH-0216'));
  assert.ok(!html.includes('href="terms/'));
  assert.ok(!html.includes('href="technology/'));
  assert.ok(!html.includes('<img'));
});
test('Technology URL generation resolves every preserved profile to its direct HTML page',()=>{
  for(const row of data.technologies)assert.ok(fs.existsSync(path.join(__dirname,'..',C.technologyPath(row))),row.id);
});
test('Catalog text cannot inject executable markup into discovery output',()=>{
  const hostile={...data,terms:data.terms.map(r=>r.id==='MLD-1149'?{...r,term:'<script>alert(1)</script>'}:r)};
  const html=D.render(hostile);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
});
