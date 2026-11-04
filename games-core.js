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
  // Shared Techniques selection for dictionary and all game modes; original topics stay unchanged.
  const techniqueIds = new Set('MLD-0002 MLD-0014 MLD-0022 MLD-0028 MLD-0033 MLD-0037 MLD-0044 MLD-0089 MLD-0104 MLD-0105 MLD-0115 MLD-0131 MLD-0161 MLD-0177 MLD-0203 MLD-0214 MLD-0215 MLD-0247 MLD-0252 MLD-0255 MLD-0256 MLD-0267 MLD-0300 MLD-0302 MLD-0332 MLD-0338 MLD-0341 MLD-0429 MLD-0431 MLD-0447 MLD-0448 MLD-0475 MLD-0476 MLD-0477 MLD-0478 MLD-0485 MLD-0490 MLD-0491 MLD-0495 MLD-0499 MLD-0517 MLD-0518 MLD-0531 MLD-0535 MLD-0542 MLD-0566 MLD-0569 MLD-0591 MLD-0607 MLD-0611 MLD-0615 MLD-0618 MLD-0642 MLD-0675 MLD-0688 MLD-0699 MLD-0702 MLD-0735 MLD-0741 MLD-0744 MLD-0778 MLD-0790 MLD-0801 MLD-0802 MLD-0832 MLD-0833 MLD-0835 MLD-0838 MLD-0843 MLD-0853 MLD-0865 MLD-0870 MLD-0875 MLD-0876 MLD-0884 MLD-0885 MLD-0892 MLD-0900 MLD-0901 MLD-0914 MLD-0917 MLD-0933 MLD-0936 MLD-0942 MLD-0954 MLD-0955 MLD-0956 MLD-0959 MLD-0962 MLD-0968 MLD-0973 MLD-0975 MLD-0988 MLD-1009 MLD-1014 MLD-1033 MLD-1042 MLD-1046 MLD-1051 MLD-1065 MLD-1082 MLD-1090 MLD-1096 MLD-1097 MLD-1098 MLD-1099 MLD-1101 MLD-1113 MLD-1145 MLD-1151 MLD-1155 MLD-1159 MLD-1171 MLD-1180 MLD-1189 MLD-1199 MLD-1211 MLD-1216 MLD-1217 MLD-1219 MLD-1221 MLD-1249 MLD-1250 MLD-1263 MLD-1280 MLD-1284 MLD-1286 MLD-1289 MLD-1291 MLD-1328 MLD-1344 MLD-1345'.split(' '));
  const isTechnique = record => !!record && (techniqueIds.has(record.id) || record.topic === 'Techniques');
  function filterTerms(records, {topic = '', tag = '', level = '', query = ''} = {}) {
    const words = normalize(query).split(' ').filter(Boolean);
    return records.filter(r => (!topic || (topic === 'Techniques' ? isTechnique(r) : r.topic === topic)) && (!tag || (r.tags || []).includes(tag)) && (!level || r.level === level) && words.every(w => normalize([r.term, r.definition, ...(r.aliases || []), r.topic, ...(r.tags || [])].join(' ')).includes(w)));
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
  return {normalize, shuffle, prepareTerms, techniqueIds, isTechnique, filterTerms, acceptedNames, makeQuiz, answerQuestion, makeFlashcards, flipFlashcard, moveFlashcard, makeMatch, selectTile, matchTime};
});
