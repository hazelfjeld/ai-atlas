#!/usr/bin/env python3
"""Idempotently add the Games tab, preserving the current dynamically rendered navigation.

Only used when installing the feature. Does not touch catalogs or news/term work.
"""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def main():
    index = ROOT / 'index.html'
    html = index.read_text(encoding='utf-8')
    if 'data-atlas-games' not in html:
        anchor = '</nav><div class="sidebar-bottom">'
        if html.count(anchor) != 1:
            raise RuntimeError('Navigation changed; reconcile the Games link instead of overwriting it.')
        link = '</nav><nav aria-label="Practice"><a class="nav-link" href="games.html" data-atlas-games="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h10a3 3 0 0 1 3 3l1 7a2 2 0 0 1-3 2l-3-3H9l-3 3a2 2 0 0 1-3-2l1-7a3 3 0 0 1 3-3z M7 10v4 M5 12h4 M16 11h.01 M18 13h.01"/></svg><span>Games</span></a></nav><div class="sidebar-bottom">'
        html = html.replace(anchor, link)
        index.write_bytes(html.encode('utf-8'))
    builder = ROOT / 'scripts/build_offline.py'
    source = builder.read_text(encoding='utf-8')
    marker = '    # Games run in the hosted edition; keep the single-file fallback link honest.\n'
    if marker not in source:
        anchor = "    (ROOT / 'downloads/Atlas_Demo_Offline.html').write_bytes(html.encode('utf-8'))"
        if source.count(anchor) != 1:
            raise RuntimeError('Offline builder changed; reconcile it explicitly.')
        replacement = marker + '    html = html.replace(\'href="games.html"\', \'href="https://raw.githack.com/hazelfjeld/ai-atlas/main/games.html"\').replace(\'<span>Games</span>\', \'<span>Games (online)</span>\')\n'
        source = source.replace(anchor, replacement + anchor)
        builder.write_bytes(source.encode('utf-8'))
    print('Games navigation installed; regenerate the offline fallback before committing.')

if __name__ == '__main__':
    main()
