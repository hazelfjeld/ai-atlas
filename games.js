/* Atlas practice UI. No network calls beyond the existing verified catalog loader. */
(async () => {
  'use strict';
  const $ = id => document.getElementById(id), G = window.AtlasGames, C = window.AtlasCore;
  const E = C.escapeHTML;
  let terms = [], pool = [], lastPool = [], questions = [], questionIndex = 0;
  let mode = 'setup', game = null, clock = null, mismatchTimeout = null, bestStreak = 0, streak = 0;
  let lastQuizOptions = {}, matchKey = '', flashDeck = null;
  const bestTimes = new Map();
  const unique = key => [...new Set(terms.flatMap(r => Array.isArray(r[key]) ? r[key] : [r[key]]).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  const announce = message => { $('announcement').textContent = message; };
  const seconds = ms => (Math.max(0, ms) / 1000).toFixed(1) + 's';
  function termPath(r) { return C.termPath(r); }
  function termLink(r, text = 'Explore concept ↗') { return `<a href="${E(termPath(r))}" target="_blank" rel="noopener noreferrer">${E(text)}</a>`; }
  function countCorrect() { return questions.filter(q => q.answered && q.correct).length; }
  function clearTimers() { clearInterval(clock); clearTimeout(mismatchTimeout); clock = null; mismatchTimeout = null; }
  function showSetup() {
    clearTimers(); mode = 'setup'; game = null; flashDeck = null; document.body.classList.remove('is-playing');
    $('setup').hidden = false; $('play').hidden = true;
    $('setup-title').setAttribute('tabindex', '-1'); $('setup-title').focus();
  }
  function showPlay() { document.body.classList.add('is-playing'); $('setup').hidden = true; $('play').hidden = false; }
  function selection() { return {topic: $('topic').value, tag: $('tag').value, level: $('level').value, query: $('query').value}; }
  function refreshPool() {
    pool = G.filterTerms(terms, selection());
    const typed = $('answer-mode').value === 'typed';
    if (typed) $('direction').value = 'definition';
    $('direction').disabled = typed;
    $('pool-count').textContent = `${pool.length.toLocaleString()} concepts in your deck`;
    $('start-quiz').disabled = pool.length < (typed ? 1 : 2);
    $('start-match').disabled = pool.length < 2;
    $('start-flashcards').disabled = pool.length < 1;
    $('quiz-help').textContent = typed ? 'Accepts the concept name or a listed alias. Not AI-graded.' : pool.length < 2 ? 'Choose at least two concepts, or switch to typed recall.' : 'Up to four choices. No repeat questions within a round.';
    $('match-help').textContent = pool.length < 2 ? 'Choose at least two concepts to match.' : `${Math.min(6, pool.length)} pairs this round · personal best stays in this tab.`;
    $('flashcard-help').textContent = pool.length ? 'Shuffle up to ' + pool.length.toLocaleString() + ' filtered terms.' : 'Choose at least one concept to make flashcards.';
    $('filter-help').textContent = pool.length ? 'Filters apply to all three modes. Every round is freshly shuffled.' : 'No concepts match. Broaden your filters or reset them.';
  }
  function bar(title, stats = '') {
    return `<div class="play-bar"><div><p class="eyebrow">THE PRACTICE ROOM</p><h2 id="round-title" tabindex="-1">${E(title)}</h2></div><div class="scoreboard">${stats}<button class="button" type="button" data-action="menu">Change deck / exit</button></div></div>`;
  }
  function startQuiz(focusIds = null) {
    clearTimers();
    if (!focusIds) {
      lastPool = [...pool];
      lastQuizOptions = {count: Number($('quiz-count').value), direction: $('direction').value, answerMode: $('answer-mode').value};
    }
    try { questions = G.makeQuiz(lastPool, {...lastQuizOptions, ...(focusIds ? {count: focusIds.length, focusIds} : {})}); }
    catch (error) { announce(error.message); $('filter-help').textContent = error.message; return; }
    questionIndex = 0; streak = 0; bestStreak = 0; mode = 'quiz';
    showPlay(); renderQuestion();
  }
  function renderQuestion() {
    const q = questions[questionIndex];
    const options = q.answerMode === 'typed'
      ? `<form id="typed-form" class="typed"><label for="typed-answer">Concept name or listed alias<input id="typed-answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200" required></label><button class="button primary" type="submit">Check answer</button></form><p class="hint">Case, spacing and most punctuation do not matter. Other spellings or paraphrases are not automatically accepted.</p>`
      : `<div class="options" role="group" aria-label="Answer choices">${q.options.map((o,i) => `<button type="button" class="answer" data-answer="${E(o.id)}"><span class="key" aria-hidden="true">${i + 1}</span><span>${E(o.label)}</span></button>`).join('')}</div><p class="hint">Use 1–${q.options.length}, or Tab and Enter. Select the best fit for the dictionary definition.</p>`;
    $('play').innerHTML = bar('Quiz', `<span class="pill" id="quiz-score">${countCorrect()} correct</span>`) + `<div class="game-panel"><div class="progress" role="progressbar" aria-label="Questions answered" aria-valuemin="0" aria-valuemax="${questions.length}" aria-valuenow="${questionIndex}"><span style="width:${questionIndex / questions.length * 100}%"></span></div><p class="eyebrow">QUESTION ${questionIndex + 1} / ${questions.length} · ${E(q.target.topic)}</p><h3 id="question-title" class="question" tabindex="-1"><small>${q.direction === 'definition' ? 'Which concept fits this definition?' : 'Which definition fits this concept?'}</small>${E(q.prompt)}</h3>${options}<div id="feedback" hidden></div><div class="question-actions"><button class="text-button" type="button" data-action="skip">I’m not sure — show me</button><button class="button primary" type="button" data-action="next" hidden>${questionIndex + 1 === questions.length ? 'See results' : 'Next question'} →</button></div></div>`;
    $('question-title').focus();
    if ($('typed-form')) $('typed-form').addEventListener('submit', event => { event.preventDefault(); submitAnswer($('typed-answer').value); });
  }
  function submitAnswer(value, skip = false) {
    if (mode !== 'quiz') return;
    const q = questions[questionIndex], result = G.answerQuestion(q, value, skip);
    if (!result) return;
    streak = result.correct ? streak + 1 : 0; bestStreak = Math.max(bestStreak, streak);
    document.querySelectorAll('[data-answer]').forEach(button => {
      button.disabled = true;
      if (button.dataset.answer === q.target.id) button.classList.add('correct');
      else if (button.dataset.answer === q.answer) button.classList.add('wrong');
    });
    if ($('typed-answer')) { $('typed-answer').disabled = true; $('typed-form').querySelector('button').disabled = true; }
    $('quiz-score').textContent = `${countCorrect()} correct · streak ${streak}`;
    const feedback = $('feedback'), title = result.correct ? 'Correct.' : result.skipped ? 'A concept to come back to.' : 'Not this one — here’s the connection.';
    feedback.hidden = false; feedback.className = 'feedback' + (result.correct ? '' : ' incorrect');
    feedback.innerHTML = `<h3>${E(title)} ${E(q.target.term)}</h3><p>${E(q.target.definition)}</p><p class="example"><strong>Example:</strong> ${E(q.target.example || 'See the linked concept page.')}</p>${q.target.caveat ? `<p class="example"><strong>Watch for:</strong> ${E(q.target.caveat)}</p>` : ''}${termLink(q.target)}`;
    $('play').querySelector('[data-action=skip]').hidden = true;
    const next = $('play').querySelector('[data-action=next]'); next.hidden = false; next.focus();
    announce(`${result.correct ? 'Correct' : result.skipped ? 'Skipped' : 'Incorrect'}. ${q.target.term}. ${q.target.definition}`);
  }
  function reviewItem(r, extra = '') {
    return `<article class="review-item"><div class="review-title"><h4>${E(r.term)}</h4>${termLink(r)}</div>${extra}<p>${E(r.definition)}</p><p class="subtle"><strong>Example:</strong> ${E(r.example || '')}</p>${r.caveat ? `<p class="subtle"><strong>Caveat:</strong> ${E(r.caveat)}</p>` : ''}</article>`;
  }
  function finishQuiz() {
    mode = 'quiz-results';
    const correct = countCorrect(), missed = questions.filter(q => !q.correct);
    $('play').innerHTML = bar('Round complete') + `<div class="game-panel result-panel"><p class="eyebrow">CONNECTIONS MADE</p><h3 id="result-title" tabindex="-1">${missed.length ? 'Keep the good ones. Revisit the rest.' : 'Every concept connected.'}</h3><div class="result-score">${correct}<span style="font-size:.4em"> / ${questions.length}</span></div><p class="subtle">${Math.round(correct / questions.length * 100)}% correct · longest streak ${bestStreak}${lastQuizOptions.answerMode === 'typed' ? ' · exact name / alias grading' : ''}</p><div class="actions">${missed.length ? '<button class="button primary" type="button" data-action="retry-missed">Retry missed concepts</button>' : ''}<button class="button" type="button" data-action="quiz-again">Shuffle a new quiz</button><button class="button" type="button" data-action="menu">Change deck</button></div></div>${missed.length ? `<section class="review" aria-label="Missed concepts"><h3>Worth another look · ${missed.length}</h3>${missed.map(q => reviewItem(q.target, `<p class="subtle">${q.answer ? 'Your answer: ' + E(q.answerMode === 'typed' ? q.answer : (q.options.find(o => o.id === q.answer)?.label || q.answer)) : 'Skipped — no answer selected.'}</p>`)).join('')}</section>` : ''}`;
    $('result-title').focus(); announce(`Quiz complete. ${correct} out of ${questions.length} correct.`);
  }
  function startMatch() {
    clearTimers();
    try { game = G.makeMatch(pool, {now: performance.now()}); } catch(error) { announce(error.message); return; }
    mode = 'match'; matchKey = JSON.stringify(pool.map(r => r.id).sort()); showPlay();
    $('play').innerHTML = bar('Match', `<span class="score"><strong id="pairs-count">0 / ${game.records.length}</strong> pairs</span><span class="timer" id="match-time" aria-label="Elapsed time, including penalties">0.0s</span>`) + `<p class="match-status" id="match-status" role="status">Choose a term and its definition. Wrong pairs add 1 second.</p><div class="match-grid" role="group" aria-label="Term and definition tiles">${game.tiles.map(t => `<button class="tile" type="button" data-key="${E(t.key)}" data-side="${t.side}" aria-pressed="false">${E(t.label)}</button>`).join('')}</div><p class="hint">Click or tap any two tiles, or use Tab and Enter. The clock keeps running if you leave this tab. No countdown.</p>`;
    $('round-title').focus();
    clock = setInterval(() => { if (mode === 'match') $('match-time').textContent = seconds(G.matchTime(game, performance.now())); }, 100);
  }
  function updateTiles() {
    $('play').querySelectorAll('[data-key]').forEach(button => {
      const tile = game.tiles.find(t => t.key === button.dataset.key), matched = game.matched.has(tile.id);
      button.classList.toggle('matched', matched); button.disabled = matched;
      button.setAttribute('aria-pressed', String(game.selected === tile.key));
      if (matched) button.setAttribute('aria-hidden', 'true');
    });
    $('pairs-count').textContent = `${game.matched.size} / ${game.records.length}`;
    $('match-time').textContent = seconds(G.matchTime(game, performance.now()));
  }
  function tileClick(key) {
    if (mode !== 'match') return;
    const activeGame = game, result = G.selectTile(game, key, performance.now());
    if (result.type === 'ignored') return;
    updateTiles();
    if (result.type === 'mismatch') {
      $('play').querySelectorAll('[data-key]').forEach(b => { if (result.keys.includes(b.dataset.key)) b.classList.add('mismatch'); });
      $('match-status').textContent = `Not a pair. +1 second · ${game.mistakes} incorrect ${game.mistakes === 1 ? 'match' : 'matches'}.`;
      mismatchTimeout = setTimeout(() => {
        if (mode !== 'match' || game !== activeGame) return;
        game.locked = false; $('play').querySelectorAll('.mismatch').forEach(b => b.classList.remove('mismatch'));
      }, 450);
    } else if (result.type === 'matched' || result.type === 'complete') {
      const record = game.records.find(r => r.id === result.id);
      $('match-status').textContent = `${record.term} matched. ${game.records.length - game.matched.size} pairs left.`;
      if (result.type === 'complete') finishMatch();
      else $('play').querySelector('[data-key]:not(:disabled)')?.focus({preventScroll: true});
    }
  }
  function finishMatch() {
    clearTimers(); mode = 'match-results';
    const total = G.matchTime(game, performance.now()), prior = bestTimes.get(matchKey), best = prior === undefined || total < prior;
    if (best) bestTimes.set(matchKey, total);
    $('play').innerHTML = bar('Board cleared') + `<div class="game-panel result-panel"><p class="eyebrow">${best ? 'PERSONAL BEST THIS TAB' : 'ALL PAIRS CONNECTED'}</p><h3 id="result-title" tabindex="-1">${game.records.length} concepts. All connected.</h3><div class="result-score">${seconds(total)}</div><p class="subtle">${seconds(total - game.penaltyMs)} elapsed + ${seconds(game.penaltyMs)} penalties · ${game.mistakes} incorrect ${game.mistakes === 1 ? 'match' : 'matches'}</p><p class="subtle">Best for this filtered deck: ${seconds(bestTimes.get(matchKey))}. Random boards vary in difficulty.</p><div class="actions"><button class="button primary" type="button" data-action="match-again">Shuffle a new board</button><button class="button" type="button" data-action="menu">Change deck</button></div></div><section class="review" aria-label="Concepts in this round"><h3>Your ${game.records.length} connections</h3>${game.records.map(r => reviewItem(r)).join('')}</section>`;
    $('result-title').focus(); announce(`Board cleared in ${seconds(total)}, including ${seconds(game.penaltyMs)} penalties.`);
  }

  function startFlashcards() {
    clearTimers();
    try { flashDeck = G.makeFlashcards(pool, {count: $('flashcard-count').value}); }
    catch (error) { announce(error.message); $('filter-help').textContent = error.message; return; }
    mode = 'flashcards'; showPlay(); renderFlashcard();
  }
  function renderFlashcard() {
    const r = flashDeck.cards[flashDeck.index], position = flashDeck.index + 1, total = flashDeck.cards.length;
    $('play').innerHTML = bar('Flashcards', `<span class="pill">Card ${position} / ${total}</span>`) +
      `<div class="game-panel flash-panel">
        <div class="progress" role="progressbar" aria-label="Position in deck" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${position}"><span style="width:${position / total * 100}%"></span></div>
        <p class="eyebrow">CARD ${position} / ${total} · ${E(r.topic || 'AI concepts')}</p>
        <button class="flip-card" id="flip-card" type="button" data-action="flip-card" aria-pressed="false" aria-label="${E('Term: ' + r.term + '. Activate to reveal definition.')}">
          <span class="flip-card-inner">
            <span class="flip-face flip-front" id="flashcard-front" aria-hidden="false"><span class="flip-meta">TERM</span><strong>${E(r.term)}</strong><small>Tap to reveal definition ↻</small></span>
            <span class="flip-face flip-back" id="flashcard-back" aria-hidden="true"><span class="flip-meta">DEFINITION</span><span class="flip-definition">${E(r.definition)}</span><small>Tap to see term ↻</small></span>
          </span>
        </button>
        <p class="hint" id="flash-status" role="status">Tap the card, or press Enter/Space to flip. Use ← and → to navigate.</p>
        <div class="flash-source" id="flashcard-link" hidden>${termLink(r)}</div>
        <div class="question-actions flash-actions">
          <button class="button" type="button" data-action="flash-prev" ${position === 1 ? 'disabled' : ''}>← Previous</button>
          <button class="button primary" type="button" data-action="flash-next">${position === total ? 'Finish deck ✓' : 'Next card →'}</button>
        </div>
      </div>`;
    $('flip-card').focus();
  }
  function flipCurrentFlashcard() {
    if (mode !== 'flashcards') return;
    const flipped = G.flipFlashcard(flashDeck), r = flashDeck.cards[flashDeck.index], button = $('flip-card');
    button.classList.toggle('flipped', flipped);
    button.setAttribute('aria-pressed', String(flipped));
    button.setAttribute('aria-label', flipped ? 'Definition: ' + r.definition + '. Activate to see the term.' : 'Term: ' + r.term + '. Activate to reveal definition.');
    $('flashcard-front').setAttribute('aria-hidden', String(flipped));
    $('flashcard-back').setAttribute('aria-hidden', String(!flipped));
    $('flashcard-link').hidden = !flipped;
    $('flash-status').textContent = flipped ? 'Definition revealed. Tap to show term, or go to the next card.' : 'Term shown. Tap to reveal definition.';
    announce(flipped ? r.term + ': ' + r.definition : 'Term: ' + r.term);
  }
  function navigateFlashcards(step) {
    if (mode !== 'flashcards') return;
    if (G.moveFlashcard(flashDeck, step)) renderFlashcard();
    else if (step === 1 && flashDeck.index === flashDeck.cards.length - 1) finishFlashcards();
  }
  function finishFlashcards() {
    const total = flashDeck.cards.length; mode = 'flashcards-results';
    $('play').innerHTML = bar('Deck complete') + `<div class="game-panel result-panel"><p class="eyebrow">FLASHCARDS</p><h3 id="result-title" tabindex="-1">You reached the end of your deck.</h3><div class="result-score">${total}</div><p class="subtle">Cards in this round · no automatic score or grading.</p><div class="actions"><button class="button primary" type="button" data-action="flash-again">Shuffle another deck</button><button class="button" type="button" data-action="menu">Change filters</button></div></div>`;
    $('result-title').focus(); announce('Flashcard deck complete. ' + total + ' cards.');
  }
  $('play').addEventListener('click', event => {
    const answer = event.target.closest('[data-answer]'); if (answer) { submitAnswer(answer.dataset.answer); return; }
    const tile = event.target.closest('[data-key]'); if (tile) { tileClick(tile.dataset.key); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'menu') showSetup();
    else if (action === 'flip-card') flipCurrentFlashcard();
    else if (action === 'flash-prev') navigateFlashcards(-1);
    else if (action === 'flash-next') navigateFlashcards(1);
    else if (action === 'flash-again') startFlashcards();
    else if (action === 'skip') submitAnswer('', true);
    else if (action === 'next' && mode === 'quiz' && questions[questionIndex].answered) { if (++questionIndex < questions.length) renderQuestion(); else finishQuiz(); }
    else if (action === 'retry-missed') startQuiz(questions.filter(q => !q.correct).map(q => q.target.id));
    else if (action === 'quiz-again') startQuiz();
    else if (action === 'match-again') startMatch();
  });
  document.addEventListener('keydown', event => {
    if (mode === 'flashcards' && !document.querySelector('dialog[open]') && !event.altKey && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); navigateFlashcards(event.key === 'ArrowLeft' ? -1 : 1); return;
    }
    if (mode !== 'quiz' || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const q = questions[questionIndex];
    if (!q.answered && q.answerMode === 'choice' && /^[1-4]$/.test(event.key) && q.options[Number(event.key) - 1]) { event.preventDefault(); submitAnswer(q.options[Number(event.key) - 1].id); }
  });
  $('theme-toggle').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; };
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
  window.addEventListener('pagehide', clearTimers);
  window.addEventListener('pageshow', event => { if (event.persisted && mode === 'match') { game.locked = false; $('play').querySelectorAll('.mismatch').forEach(b => b.classList.remove('mismatch')); clock = setInterval(() => { if (mode === 'match') $('match-time').textContent = seconds(G.matchTime(game, performance.now())); }, 100); } });
  try {
    const data = await window.ATLAS_READY;
    if (!Array.isArray(data?.terms)) throw new Error('The dictionary is unavailable.');
    terms = G.prepareTerms(data.terms);
    $('catalog-count').textContent = terms.length.toLocaleString();
    $('catalog-date').textContent = 'Dictionary snapshot · ' + (data.publication?.snapshot_date || 'date unavailable');
    $('load-status').textContent = `${data.terms.length.toLocaleString()} published records checked. ${terms.length.toLocaleString()} distinct playable concepts${data.terms.length > terms.length ? '; identical prompts and incomplete entries excluded for fairer rounds' : ''}.`;
    for (const [id, key] of [['topic','topic'], ['tag','tags'], ['level','level']]) for (const value of unique(key)) $(id).add(new Option(value, value));
    for (const id of ['topic','tag','level','answer-mode']) $(id).addEventListener('change', refreshPool);
    $('query').addEventListener('input', refreshPool);
    $('reset-filters').onclick = () => { for (const id of ['topic','tag','level','query']) $(id).value = ''; refreshPool(); };
    $('start-quiz').onclick = () => startQuiz(); $('start-match').onclick = startMatch; $('start-flashcards').onclick = startFlashcards;
    $('games').hidden = false; refreshPool();
  } catch(error) {
    $('load-status').textContent = 'Games could not load: ' + error.message + ' No partial deck is shown. ';
    const retry = document.createElement('button'); retry.className = 'button'; retry.textContent = 'Retry'; retry.onclick = () => location.reload(); $('load-status').append(retry);
  }
})();
