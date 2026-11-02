'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../games-core.js');
const records = Array.from({length: 20}, (_, i) => ({id: 'MLD-' + String(i + 1).padStart(4, '0'), term: 'Concept ' + i, definition: 'Definition for concept ' + i, aliases: ['Alias ' + i], topic: i < 10 ? 'Neural networks' : 'Safety', tags: i < 10 ? ['DL'] : ['Safety','LLM'], level: i < 10 ? 'Foundational' : 'Advanced', example: 'Example ' + i, caveat: 'Caveat ' + i}));
function rng(seed = 8) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('shuffle preserves entries and input while using deterministic injected randomness', () => {
  const before = [...records], shuffled = G.shuffle(records, rng());
  assert.deepEqual(records, before); assert.equal(new Set(shuffled).size, 20); assert.notDeepEqual(shuffled, before);
  assert.deepEqual(shuffled, G.shuffle(records, rng()));
});
test('shuffle rejects invalid random output', () => { assert.throws(() => G.shuffle([1,2], () => 1)); });
test('playable pool rejects malformed, duplicate ID/name and duplicate definition records', () => {
  const rows = [...records, records[0], {...records[0], id:'MLD-1000'}, {...records[0], id:'MLD-1001',term:'Another name'}, {id:'bad',term:'Bad',definition:'Bad'}, null, {id:'MLD-1003',term:' ',definition:'x'}];
  assert.equal(G.prepareTerms(rows).length, 20);
});
test('filters combine topic, exact tag, level and searchable aliases', () => {
  assert.equal(G.filterTerms(records, {tag:'LLM', level:'Advanced'}).length, 10);
  assert.equal(G.filterTerms(records, {query:'Alias 11'})[0].id, 'MLD-0012');
  assert.equal(G.filterTerms(records, {topic:'Safety', tag:'DL'}).length, 0);
  assert.equal(G.filterTerms(records, {query:'absent'}).length, 0);
});
test('quiz questions do not repeat and every choice set contains exactly one correct answer', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const quiz = G.makeQuiz(records, {count:10,random:rng(seed)});
    assert.equal(quiz.length, 10); assert.equal(new Set(quiz.map(q => q.target.id)).size, 10);
    for (const q of quiz) { assert.equal(q.options.length, 4); assert.equal(q.options.filter(o => o.id === q.target.id).length, 1); assert.equal(new Set(q.options.map(o=>o.label)).size, 4); }
  }
});
test('correct answer position varies', () => {
  const positions = new Set();
  for (let seed = 1; seed <= 20; seed++) for (const q of G.makeQuiz(records, {random:rng(seed)})) positions.add(q.options.findIndex(o=>o.id===q.target.id));
  assert.equal(positions.size, 4);
});
test('reverse direction displays concept and definition choices', () => {
  const q = G.makeQuiz(records, {direction:'term',random:rng()})[0];
  assert.equal(q.prompt, q.target.term); assert.equal(q.options.find(o=>o.id===q.target.id).label,q.target.definition);
});
test('same-topic distractors preferred', () => {
  const q = G.makeQuiz(records, {random:rng()})[0];
  for (const o of q.options) assert.equal(records.find(r=>r.id===o.id).topic,q.target.topic);
});
test('aliases of the target are never distractors', () => {
  const clone = {...records[0], id:'MLD-1001',term:'Alias 0',definition:'Alternate definition'};
  const q = G.makeQuiz([...records,clone], {focusIds:[records[0].id],random:rng()})[0];
  assert.ok(!q.options.some(o=>o.id===clone.id));
});
test('small pools use fewer options, while invalid quiz settings fail clearly', () => {
  const quiz = G.makeQuiz(records.slice(0,2), {count:50}); assert.equal(quiz.length,2); assert.equal(quiz[0].options.length,2);
  assert.throws(()=>G.makeQuiz([])); assert.throws(()=>G.makeQuiz(records.slice(0,1)));
  assert.throws(()=>G.makeQuiz(records,{answerMode:'invented'})); assert.throws(()=>G.makeQuiz(records,{answerMode:'typed',direction:'term'}));
});
test('typed recall supports single-term decks, aliases, case and punctuation normalization', () => {
  const q = G.makeQuiz(records.slice(0,1),{answerMode:'typed'})[0];
  assert.equal(G.answerQuestion(q,'  ALIAS-0 ' ).correct,true);
  assert.equal(G.normalize('LoRA (low-rank)'), 'lora low rank');
  assert.notEqual(G.normalize('C++'), G.normalize('C'));
});
test('typed recall does not guess or pretend to semantically grade paraphrases', () => {
  const q = G.makeQuiz(records.slice(0,1),{answerMode:'typed'})[0]; assert.equal(G.answerQuestion(q,'something close').correct,false);
});
test('questions score once, blank answers do not submit, skips count as incorrect', () => {
  const q = G.makeQuiz(records)[0]; assert.equal(G.answerQuestion(q,''),null); assert.equal(q.answered,false);
  assert.equal(G.answerQuestion(q,q.target.id).correct,true); assert.equal(G.answerQuestion(q,q.target.id),null);
  const skipped = G.makeQuiz(records)[0]; assert.equal(G.answerQuestion(skipped,'',true).skipped,true); assert.equal(skipped.correct,false);
});
test('retry missed targets keeps full deck available for distractors', () => {
  const quiz = G.makeQuiz(records,{focusIds:[records[3].id], count:1}); assert.equal(quiz.length,1); assert.equal(quiz[0].target.id,records[3].id); assert.equal(quiz[0].options.length,4);
});
test('match generates exactly six distinct pairs and twelve shuffled tiles', () => {
  const m = G.makeMatch(records,{random:rng()}); assert.equal(m.records.length,6); assert.equal(m.tiles.length,12); assert.equal(new Set(m.tiles.map(t=>t.key)).size,12);
  for(const r of m.records) { const ts=m.tiles.filter(t=>t.id===r.id); assert.equal(ts.length,2); assert.deepEqual(ts.map(t=>t.side).sort(),['definition','term']); }
});
test('match allows two-term decks and rejects empty or single-term decks', () => {
  assert.equal(G.makeMatch(records.slice(0,2)).tiles.length,4); assert.throws(()=>G.makeMatch([])); assert.throws(()=>G.makeMatch(records.slice(0,1)));
});
test('deselecting the same tile is not a mistake', () => {
  const m = G.makeMatch(records); const key=m.tiles[0].key;
  assert.equal(G.selectTile(m,key,10).type,'selected'); assert.equal(G.selectTile(m,key,20).type,'deselected'); assert.equal(m.penaltyMs,0);
});
test('wrong pairs add exactly one second and lock rapid duplicate clicks', () => {
  const m=G.makeMatch(records,{now:100}); const a=m.tiles[0], b=m.tiles.find(t=>t.id!==a.id);
  G.selectTile(m,a.key,200); assert.equal(G.selectTile(m,b.key,300).type,'mismatch');
  assert.equal(m.penaltyMs,1000); assert.equal(m.mistakes,1); assert.equal(G.matchTime(m,400),1300);
  assert.equal(G.selectTile(m,a.key,400).type,'ignored'); assert.equal(m.penaltyMs,1000);
});
test('clearing the board freezes elapsed time and cannot award a pair twice', () => {
  const m=G.makeMatch(records,{now:100}); let now=200;
  for(const r of m.records) {
    G.selectTile(m,r.id+':term',now); const result=G.selectTile(m,r.id+':definition',now+10);
    assert.ok(['matched','complete'].includes(result.type)); assert.equal(G.selectTile(m,r.id+':term',now+20).type,'ignored'); now+=100;
  }
  assert.equal(m.matched.size,6); assert.equal(m.finishedAt,710); assert.equal(G.matchTime(m,99999),610);
});
test('unsafe unknown tiles are ignored', () => { const m=G.makeMatch(records); assert.equal(G.selectTile(m,'<script>',3).type,'ignored'); assert.equal(m.mistakes,0); });
