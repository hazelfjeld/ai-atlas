'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const terms=fs.readdirSync(path.join(root,'data'))
  .filter(name=>/^terms-\d{2}\.json$/.test(name)).sort()
  .flatMap(name=>JSON.parse(fs.readFileSync(path.join(root,'data',name),'utf8')));

test('Techniques is a real, curated Primary topic selection with deep links',()=>{
  new vm.Script(app);
  assert.ok(app.includes("['topic','Primary topic',['Techniques',...unique(rows,'topic')]]"));
  assert.ok(app.includes("href=\"#/dictionary?topic=Techniques\""));
  assert.ok(app.includes("key==='topic'&&view==='dictionary'&&val==='Techniques'"));
  assert.ok(app.includes("TECHNIQUE_IDS.has(r.id)"));
});
test('Curated techniques are distinct canonical dictionary records spanning subject areas',()=>{
  const match=app.match(/const TECHNIQUE_IDS=new Set\('([^']+)'\.split\(' '\)\);/);
  assert.ok(match,'Curated technique IDs must be defined');
  const ids=match[1].split(' '),idSet=new Set(ids),byId=new Map(terms.map(r=>[r.id,r]));
  assert.equal(ids.length,idSet.size,'Technique IDs must not repeat');
  assert.ok(ids.length>=100,'Technique view should show a useful breadth of methods');
  for(const id of ids){
    assert.ok(byId.has(id),'Unknown technique '+id);
    assert.ok(byId.get(id).topic,'Original classification missing '+id);
  }
  for(const id of ['MLD-0002','MLD-0161','MLD-0607','MLD-0688','MLD-0968','MLD-1033','MLD-1155'])
    assert.ok(idSet.has(id),'Missing flagship method '+id);
  for(const id of ['MLD-0001','MLD-0549','MLD-1236'])
    assert.ok(!idSet.has(id),'An unrelated concept was mislabeled as a method: '+id);
  assert.ok(new Set(ids.map(id=>byId.get(id).topic)).size>=10);
  assert.equal(terms.length,1345,'Baseline dictionary records must remain intact');
});
