# Native Games workspace

Hazel clarified that Quiz and Match belong in the ORIGINAL Atlas interface as one extra tab, not on a separate standalone destination.

## Canonical interface

Open `index.html#/overview`, then **Games** in the existing sidebar. The direct route is `index.html#/games`. The original sidebar, global search, color-theme control, mobile menu, dictionary, safety records, daily news and other sections remain in place. This is native DOM content, not an iframe or a second web application. Switching tabs does not reload the page or fetch another dictionary.

Both existing game modes and their filters are retained. Concept links open the original Atlas record dialog over the current round. Leaving Games ends the current round and disposes timers and keyboard handlers. Best matching times remain in memory for this browser tab until reload. The original `games.html` route remains a compatibility entry point, but it is no longer the main navigation destination.

## Build and maintenance

`python scripts/install_games_workspace.py` generates `games-tab.js` and `games-tab.css` from the existing `games.js`, `games.css` and `games.html`, then idempotently integrates the native route. `scripts/integrate_games.py` delegates to this installer for compatibility; do not restore its obsolete standalone shortcut. The game rules remain shared in `games-core.js`.

`python scripts/build_offline.py` now embeds the native game runtime and scoped stylesheet. The single-file fallback contains both playable modes; its former 'Games (online)' link is obsolete. These instructions supersede the old navigation and offline limitations in `docs/GAMES.md`.

Run `node --test tests/*.test.cjs`, `python scripts/validate_checkpoint.py`, and `python tests/games-workspace-browser.py --base http://127.0.0.1:8765/`. The workspace test exercises original-shell navigation, both modes, concept dialogs, cleanup during active matches, repeated navigation, theme continuity, mobile layout, browser back/reload, and offline play with other network requests blocked.

## Links and versioning

The previously shared URL containing commit `3694cfd81702ae88f09054839623c3159a94a026` is an immutable older snapshot. No new commit can add a tab to that historical commit's files. Publish a newly verified commit-pinned URL, or use the moving `https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html#/overview` address for future revisions. A different commit in the URL is a new version of the same Atlas site, not a separate project.
