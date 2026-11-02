# Atlas Games

The Games navigation tab opens `games.html`. It shares the existing checksummed `catalog-loader.js` and stable `AtlasCore.termPath` helper. All playable cards come from the live `terms` catalog; there is no second dictionary to update and no AI service or API key.

## Modes

**Quiz** shuffles concepts without repetition in a round. Choose 5, 10, 20 or 50 questions (capped by the available deck), multiple-choice or typed recall, and definition-to-concept or concept-to-definition direction. Multiple choice has up to four options, preferring same-topic distractors and excluding canonical/alias collisions. Typed recall accepts the canonical term and listed aliases with case/whitespace/punctuation normalization; it does NOT semantically grade essays, paraphrases or arbitrary misspellings. Feedback includes the dictionary example, caveat, and a link to the concept page. The result screen shows score, longest streak, missed concepts and a retry-missed action that retains the full deck for distractors.

**Match** draws six term/definition pairs (fewer when a filtered deck is small), shuffles twelve visible buttons, and accepts click/tap or keyboard selection in either order. Correct pairs disappear without moving the remaining tiles. A wrong pair adds exactly one second. Re-selecting the same tile deselects it without penalty. The clock is elapsed time plus penalties, not a countdown; it continues while the tab is hidden. Completion freezes the score, shows the round's concepts, and tracks a personal best for the same filtered pool in the current tab. Random boards vary in difficulty; there is no competitive or tamper-proof leaderboard.

Both modes filter by topic, field, level and keyword. Identical normalized names/definitions, duplicate IDs and incomplete entries are excluded from the playable deck, with counts shown honestly. Quiz wording inherits the limitations of the dictionary: similar concepts can overlap, so this is study practice rather than a certification exam. No generated trivia, paid calls, accounts, analytics, persistent score storage, or server submissions. Session scores disappear on reload. The page offers dark mode, responsive layouts, full visible definitions, keyboard controls, status announcements, focus handling and no motion-dependent interactions.

## Implementation and checks

- `games-core.js`: pure shuffle/filter/quiz/match rules, also required by Node tests.
- `games.js`: UI and ephemeral round state; timers are cleared when leaving a round.
- `games.html`, `games.css`: standalone game route, with links back to the current release.
- `tests/games.test.cjs`: deterministic engine tests, including penalties, repeats, aliases, small pools and double-click protection.
- `tests/games-browser.py`: end-to-end UI checks using Playwright. Accepts `--base` for a local/hosted URL. The optional `--fixture` mode requires an original dictionary fixture and is explicitly NOT a hosted integration test.
- `scripts/integrate_games.py`: narrowly scoped, idempotent integration into the existing sidebar and offline builder. It refuses unexpected markup rather than overwriting it.

Run `node --test tests/*.test.cjs`, `node --check games.js`, and `python scripts/validate_checkpoint.py`. For browser tests, install Playwright, install its Chromium browser, serve this repository over localhost, then run `python tests/games-browser.py --base http://127.0.0.1:8765/ --output games-validation`. `CHROMIUM_PATH` can select an already-installed browser.

The offline single-file Atlas fallback links to Games **online**; it does not embed this game runtime. Rebuild it after navigation changes with `python scripts/build_offline.py`. Do not label the main research feed as live merely because games load the latest committed dictionary.

Matching mechanics are independently implemented for Atlas. Quizlet's official help documents six pairs and a one-second incorrect-match penalty: https://help.quizlet.com/hc/en-us/articles/360031183611-Playing-Match . No Quizlet code, artwork, brand identity, or user content is copied. Atlas is not affiliated with Quizlet.
