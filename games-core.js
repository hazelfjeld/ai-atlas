/* Dependency-free game rules. The browser and regression tests use the same code. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AtlasGames = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/\s+/g, ' ');
  function shuffle(values, random = Math.random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const n = random();
      if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Random values must be in [0, 1).');
      const j = Math.floor(n * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function prepareTerms(records) {
    const ids = new Set(), names = new Set(), definitions = new Set();
    return records.filter(r => {
      if (!r || typeof r.id !== 'string' || !/^MLD-\d{4,}$/.test(r.id) || typeof r.term !== 'string' || typeof r.definition !== 'string') return false;
      const name = normalize(r.term), definition = normalize(r.definition);
      if (!name || !definition || ids.has(r.id) || names.has(name) || definitions.has(definition)) return false;
      ids.add(r.id); names.add(name); definitions.add(definition);
      return true;
    });
  }
  function filterTerms(records, {topic = '', tag = '', level = '', query = ''} = {}) {
    const words = normalize(query).split(' ').filter(Boolean);
    return records.filter(r => (!topic || r.topic === topic) && (!tag || (r.tags || []).includes(tag)) && (!level || r.level === level) && words.every(w => normalize([r.term, r.definition, ...(r.aliases || []), r.topic, ...(r.tags || [])].join(' ')).includes(w)));
  }
  const acceptedNames = r => [r.term, ...(Array.isArray(r.aliases) ? r.aliases : [])].map(normalize).filter(Boolean);
  function sharesName(a, b) { const names = new Set(acceptedNames(a)); return acceptedNames(b).some(n => names.has(n)); }
  function makeQuiz(pool, {count = 10, direction = 'definition', answerMode = 'choice', focusIds = null, random = Math.random} = {}) {
    if (!pool.length) throw new Error('No concepts match these filters.');
    if (!['definition', 'term'].includes(direction) || !['choice', 'typed'].includes(answerMode)) throw new Error('Invalid quiz mode.');
    if (answerMode === 'typed' && direction !== 'definition') throw new Error('Typed recall uses a definition prompt.');
    const size = Math.max(1, Math.min(pool.length, Math.floor(Number(count) || 10)));
    const targets = focusIds ? pool.filter(r => focusIds.includes(r.id)) : pool;
    const candidates = shuffle(targets, random), questions = [];
    for (const target of candidates) {
      let options = [];
      if (answerMode === 'choice') {
        const distractors = pool.filter(r => r.id !== target.id && !sharesName(target, r) && normalize(r.definition) !== normalize(target.definition));
        // Prefer same-topic distractors without making a narrow filter unplayable.
        const same = shuffle(distractors.filter(r => r.topic === target.topic), random);
        const other = shuffle(distractors.filter(r => r.topic !== target.topic), random);
        const selected = [], used = new Set();
        for (const r of [...same, ...other]) {
          const label = normalize(direction === 'definition' ? r.term : r.definition);
          if (used.has(label) || selected.some(s => sharesName(s, r))) continue;
          used.add(label); selected.push(r);
          if (selected.length === 3) break;
        }
        if (!selected.length) continue;
        options = shuffle([target, ...selected], random).map(r => ({id: r.id, label: direction === 'definition' ? r.term : r.definition}));
      }
      questions.push({target, prompt: direction === 'definition' ? target.definition : target.term, options, direction, answerMode, answered: false, correct: false, answer: ''});
      if (questions.length === size) break;
    }
    if (!questions.length) throw new Error('Choose at least two distinct concepts for multiple choice, or use typed recall.');
    return questions;
  }
  function answerQuestion(question, answer, skip = false) {
    if (question.answered) return null;
    const text = String(answer ?? '').trim();
    if (!skip && !text) return null;
    question.answered = true;
    question.answer = skip ? '' : text;
    question.correct = !skip && (question.answerMode === 'typed' ? acceptedNames(question.target).includes(normalize(text)) : text === question.target.id);
    return {correct: question.correct, skipped: skip, target: question.target};
  }

  function makeFlashcards(pool, {count = 20, random = Math.random} = {}) {
    if (!Array.isArray(pool) || !pool.length) throw new Error('No concepts match these filters.');
    const requested = count === 'all' ? pool.length : Math.floor(Number(count) || 20);
    return {cards: shuffle(pool, random).slice(0, Math.max(1, Math.min(pool.length, requested))), index: 0, flipped: false};
  }
  function flipFlashcard(deck) {
    if (!deck?.cards?.length) return false;
    deck.flipped = !deck.flipped; return deck.flipped;
  }
  function moveFlashcard(deck, step) {
    if (!deck?.cards?.length || ![-1, 1].includes(step)) return false;
    const next = deck.index + step;
    if (next < 0 || next >= deck.cards.length) return false;
    deck.index = next; deck.flipped = false; return true;
  }
  function makeMatch(pool, {count = 6, random = Math.random, now = 0} = {}) {
    const records = shuffle(pool, random).slice(0, Math.max(1, Math.min(6, Math.floor(Number(count) || 6))));
    if (records.length < 2) throw new Error('Choose at least two concepts to play Match.');
    const tiles = shuffle(records.flatMap(r => [{key: r.id + ':term', id: r.id, side: 'term', label: r.term}, {key: r.id + ':definition', id: r.id, side: 'definition', label: r.definition}]), random);
    return {records, tiles, selected: null, matched: new Set(), mistakes: 0, penaltyMs: 0, startedAt: now, finishedAt: null, locked: false};
  }
  function matchTime(game, now) { return Math.max(0, (game.finishedAt ?? now) - game.startedAt) + game.penaltyMs; }
  function selectTile(game, key, now) {
    if (game.locked || game.finishedAt !== null) return {type: 'ignored'};
    const tile = game.tiles.find(t => t.key === key);
    if (!tile || game.matched.has(tile.id)) return {type: 'ignored'};
    if (game.selected === key) { game.selected = null; return {type: 'deselected'}; }
    if (!game.selected) { game.selected = key; return {type: 'selected'}; }
    const first = game.tiles.find(t => t.key === game.selected);
    game.selected = null;
    if (first.id === tile.id && first.side !== tile.side) {
      game.matched.add(tile.id);
      if (game.matched.size === game.records.length) game.finishedAt = now;
      return {type: game.finishedAt === null ? 'matched' : 'complete', keys: [first.key, tile.key], id: tile.id};
    }
    game.mistakes++; game.penaltyMs += 1000; game.locked = true;
    return {type: 'mismatch', keys: [first.key, tile.key]};
  }
  return {normalize, shuffle, prepareTerms, filterTerms, acceptedNames, makeQuiz, answerQuestion, makeFlashcards, flipFlashcard, moveFlashcard, makeMatch, selectTile, matchTime};
});
