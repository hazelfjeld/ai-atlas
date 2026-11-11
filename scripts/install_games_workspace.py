#!/usr/bin/env python3
"""Generate a native Games view from the shared UI and integrate Atlas routing.
Idempotent and dependency-free. Preserve the legacy games.html compatibility page.
"""
from pathlib import Path
import json
import re
ROOT = Path(__file__).resolve().parents[1]

def replace_once(text, old, new):
    if old not in text:
        if new in text:
            return text
        raise RuntimeError('Expected integration anchor changed: ' + old[:100])
    if text.count(old) != 1:
        raise RuntimeError('Ambiguous integration anchor: ' + old[:100])
    return text.replace(old, new, 1)

def scope_css(css):
    """Scope known brace-balanced game CSS, including its nested media rules."""
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    result, offset = [], 0
    while offset < len(css):
        opening = css.find('{', offset)
        if opening < 0:
            if css[offset:].strip():
                raise ValueError('Unparsed CSS suffix')
            break
        header = css[offset:opening].strip()
        depth, cursor = 1, opening + 1
        while depth and cursor < len(css):
            depth += (css[cursor] == '{') - (css[cursor] == '}')
            cursor += 1
        if depth:
            raise ValueError('Unbalanced stylesheet')
        body = css[opening + 1:cursor - 1]
        if header.startswith('@media'):
            result.append(header + '{' + scope_css(body) + '}')
        elif header.startswith('@'):
            raise ValueError('Unsupported CSS rule: ' + header)
        else:
            selectors = []
            for selector in header.split(','):
                selector = selector.strip()
                if selector in (':root', 'body', 'main'):
                    selector = '.atlas-games'
                elif selector.startswith('html[data-theme=dark]'):
                    selector = selector.replace('html[data-theme=dark]', 'html[data-theme=dark] .atlas-games', 1)
                elif selector.startswith('.is-playing '):
                    selector = '.atlas-games.is-playing' + ('' if selector == '.is-playing main' else ' ' + selector[len('.is-playing '):])
                else:
                    selector = '.atlas-games ' + selector
                selectors.append(selector)
            result.append(','.join(selectors) + '{' + body + '}')
        offset = cursor
    return '\n'.join(result)

def build_tab():
    html = (ROOT / 'games.html').read_text(encoding='utf-8')
    match = re.search(r'<main id="main"(?: tabindex="-1")?>(.*?)</main>', html, re.S)
    if not match:
        raise RuntimeError('Standalone game template changed')
    body = match.group(1).replace('href="index.html#/', 'href="#/')
    body = body.replace('Scores and missed concepts stay in this tab’s memory.', 'Leaving Games ends the current round. Best times stay in this browser tab’s memory.')
    # The standalone page needs its own script-free policy link; the native
    # workspace already has the canonical app-shell policy footer. Avoid duplicates
    # and retain byte-identical generated Games/offline artifacts.
    body = body.replace(' · <a href="about.html">Editorial policy & coverage</a>', '')
    template = '<div class="atlas-games">' + body + '</div>'
    ui = (ROOT / 'games.js').read_text(encoding='utf-8')
    ui = replace_once(ui, '(async () => {', '''(function () {
  const bestTimes = new Map();
  window.AtlasGamesTab = {
    html: () => TEMPLATE_LITERAL,
    mount(root, data, options = {}) {
  const lifecycle = new AbortController();'''.replace('TEMPLATE_LITERAL', json.dumps(template, ensure_ascii=False)))
    ui = replace_once(ui, 'const $ = id => document.getElementById(id)', 'const $ = id => root.querySelector("#" + id)')
    ui = replace_once(ui, '  const bestTimes = new Map();\n  const unique', '  const unique')
    ui = ui.replace('document.body.classList', 'root.classList')
    ui = ui.replace("document.querySelectorAll('[data-answer]')", "root.querySelectorAll('[data-answer]')")
    ui = replace_once(ui, "    if (mode !== 'quiz' || event.altKey", "    if (mode !== 'quiz' || document.querySelector('dialog[open]') || event.altKey")
    ui = replace_once(ui, "  });\n  $('theme-toggle').onclick", "  }, {signal: lifecycle.signal});\n  $('theme-toggle').onclick")
    start = ui.index("  $('theme-toggle').onclick")
    end = ui.index('  try {\n    const data = await window.ATLAS_READY;', start)
    ui = ui[:start] + '''  window.addEventListener('pagehide', clearTimers, {signal: lifecycle.signal});
  window.addEventListener('pageshow', event => {
    if (event.persisted && mode === 'match') {
      game.locked = false;
      $('play').querySelectorAll('.mismatch').forEach(b => b.classList.remove('mismatch'));
      clearInterval(clock);
      clock = setInterval(() => { if (mode === 'match' && root.isConnected) $('match-time').textContent = seconds(G.matchTime(game, performance.now())); }, 100);
    }
  }, {signal: lifecycle.signal});
  root.addEventListener('click', event => {
    const link = event.target.closest('[data-game-concept]');
    if (link && typeof options.openConcept === 'function' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); options.openConcept(link.dataset.gameConcept);
    }
  }, {signal: lifecycle.signal});
''' + ui[end:]
    ui = replace_once(ui, '    const data = await window.ATLAS_READY;\n', '')
    ui = replace_once(ui,
        'return `<a href="${E(termPath(r))}" target="_blank" rel="noopener noreferrer">${E(text)}</a>`;',
        'return `<a href="#/dictionary?record=${encodeURIComponent(r.id)}" data-game-concept="${E(r.id)}">${E(text)}</a>`;')
    ui = replace_once(ui, '\n})();', '''
  return () => { lifecycle.abort(); clearTimers(); mode = 'disposed'; game = null; root.classList.remove('is-playing'); };
    }
  };
})();''')
    (ROOT / 'games-tab.js').write_text('/* Generated by scripts/install_games_workspace.py. Shared UI, native Atlas route. */\n' + ui, encoding='utf-8')
    css = scope_css((ROOT / 'games.css').read_text(encoding='utf-8'))
    css += '''
/* The Atlas shell, global theme switch and navigation remain untouched. */
.atlas-games{max-width:none;padding:0;margin:0;background:transparent;min-width:0}
.atlas-games.is-playing{padding:0}
.atlas-games .hero{padding-top:0;min-height:0;background:transparent;border:0;border-radius:0;margin:0;box-shadow:none}
.atlas-games footer{margin-bottom:0}
@media(max-width:600px){.atlas-games{padding:0}.atlas-games .hero{flex-wrap:wrap}.atlas-games .catalog-badge{margin-top:0}}
'''
    (ROOT / 'games-tab.css').write_text(css, encoding='utf-8')

def integrate():
    index = ROOT / 'index.html'
    html = index.read_text(encoding='utf-8')
    html = re.sub(r'<nav aria-label="Practice">(?:(?!</nav>).)*data-atlas-games="true".*?</nav>', '', html, flags=re.S)
    if 'href="games-tab.css"' not in html:
        html = replace_once(html, '<link rel="stylesheet" href="app.css">', '<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="games-tab.css">')
    if 'src="games-tab.js"' not in html:
        html = replace_once(html, '<script defer src="app.js"></script>', '<script defer src="games-core.js"></script><script defer src="games-tab.js"></script><script defer src="app.js"></script>')
    index.write_text(html, encoding='utf-8')
    app_path = ROOT / 'app.js'
    app = app_path.read_text(encoding='utf-8')
    # Accept the shared, generated primary-label map as an already-installed
    # native Games route. Do not try to reinject a legacy Overview label.
    if "games:'Games'" not in app and '"games":"Games"' not in app:
        app = replace_once(app, "const labels={overview:'Overview',", "const labels={overview:'Overview',games:'Games',")
    if "games:'M7 7h10" not in app:
        app = replace_once(app, 'const icons={overview:', "const icons={games:'M7 7h10a3 3 0 0 1 3 3l1 7a2 2 0 0 1-3 2l-3-3H9l-3 3a2 2 0 0 1-3-2l1-7a3 3 0 0 1 3-3z M7 10v4 M5 12h4 M16 11h.01 M18 13h.01',overview:")
    if "nav.querySelectorAll('a[data-view]')" not in app and "'playbooks','games','compare'" not in app:
        app = replace_once(app, "'playbooks','compare','saved','sources']", "'playbooks','games','compare','saved','sources']")
    if 'let disposeGames = null;' not in app:
        app = replace_once(app, 'function route(){parse();', 'let disposeGames = null;\nfunction route(){if(disposeGames){disposeGames();disposeGames=null;}parse();')
    if "else if(view==='games')" not in app:
        app = replace_once(app, "else if(view==='compare')page.innerHTML=comparePage();", "else if(view==='games'){page.innerHTML=window.AtlasGamesTab.html();disposeGames=window.AtlasGamesTab.mount(page.querySelector('.atlas-games'),D,{openConcept:openRecord});}else if(view==='compare')page.innerHTML=comparePage();")
    app_path.write_text(app, encoding='utf-8')
    builder = ROOT / 'scripts/build_offline.py'
    code = builder.read_text(encoding='utf-8')
    if "('catalog-loader.js', 'core.js', 'games-core.js', 'games-tab.js', 'discovery.js', 'app.js')" not in code:
        code = replace_once(code, "('catalog-loader.js', 'core.js', 'app.js')", "('catalog-loader.js', 'core.js', 'games-core.js', 'games-tab.js', 'discovery.js', 'app.js')")
    if "for filename in ('core.js', 'games-core.js', 'games-tab.js', 'discovery.js', 'app.js')" not in code:
        code = replace_once(code, "    script += (ROOT / 'core.js').read_text(encoding='utf-8') + '\\n' + (ROOT / 'app.js').read_text(encoding='utf-8')", "    for filename in ('core.js', 'games-core.js', 'games-tab.js', 'discovery.js', 'app.js'):\n        script += (ROOT / filename).read_text(encoding='utf-8') + '\\n'")
    css_line = "    html = html.replace('<link rel=\"stylesheet\" href=\"games-tab.css\">', '<style>' + (ROOT / 'games-tab.css').read_text(encoding='utf-8') + '</style>')\n"
    if css_line not in code:
        code = replace_once(code, "    for name in ('catalog-loader.js'", css_line + "    for name in ('catalog-loader.js'")
    code = '\n'.join(line for line in code.split('\n') if '# Games run in the hosted edition' not in line and "html = html.replace('href=\"games.html\"'" not in line)
    code = code.replace('search, comparisons and JSON exports work without internet.', 'search, comparisons, Games and JSON exports work without internet.')
    builder.write_text(code, encoding='utf-8')

def main():
    build_tab()
    integrate()
    print('Native Games route installed at index.html#/games. No iframe or second catalog loader.')

if __name__ == '__main__':
    main()
