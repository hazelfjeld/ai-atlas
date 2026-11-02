'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','demo.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const news=fs.readFileSync(path.join(__dirname,'..','whats-new.html'),'utf8');
test('Three-minute tour links real, existing Atlas features without a second application',()=>{
  for(const token of ['id="quick-tour"','href="index.html#/games"','href="index.html#/technologies?q=pytorch"','href="index.html#/safety"','href="whats-new.html"','href="terms/MLD-0691-machine-learning.html"'])
    assert.ok(html.includes(token),'Missing route or target: '+token);
  assert.match(app,/games:'Games'/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','scripts','validate_checkpoint.py'),'utf8'), /routes\s*=\s*\{[^}]*'games'/);
  assert.match(news,/id="edition-select"/);
  assert.equal((html.match(/class="step">0[0-3]:/g)||[]).length,4);
});
test('Demo stays printable, accessible, and honest about the published baseline',()=>{
  assert.match(html,/<a class="skip" href="#quick-tour">/);
  assert.match(html,/@media print/);
  const count=Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'..','content/term-guides.json')))).length;
  assert.ok(html.includes('1,345 concepts have stable pages, but only '+count+' guides are expanded'));
  assert.match(html,/An empty news archive means the first reviewed edition is pending/);
  assert.match(html,/imported review labels are not newly audited/i);
  assert.match(html,/no AI grades free-form paraphrases/i);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size,'IDs must be unique');
});
test('Every local demo link resolves to a file or a defined intra-page fragment',()=>{
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const links=[...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]);
  for(const href of links){
    if(href.startsWith('https://'))continue;
    assert.ok(!href.startsWith('//')&&!href.includes('..'),'Unsafe relative URL: '+href);
    const [target,fragment='']=href.split('#');
    if(target)assert.ok(fs.existsSync(path.join(__dirname,'..',target)),'Missing destination: '+href);
    if(!target&&fragment)assert.ok(ids.has(fragment),'Missing demo fragment: '+href);
  }
});
