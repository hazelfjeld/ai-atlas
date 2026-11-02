#!/usr/bin/env python3
"""Build a searchable single-file fallback from the same verified catalog chunks."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = json.loads((ROOT / 'publication.json').read_bytes())
    data = {}
    for kind in ('papers', 'alerts', 'terms', 'technologies', 'playbooks'):
        files = [f for f in manifest['files'] if f['kind'] == kind] if kind in ('papers', 'alerts') else manifest['extensions'][kind]
        data[kind] = [r for f in files for r in json.loads((ROOT / f['path']).read_bytes())]
    for key, name in {'meta':'meta', 'sections':'sections', 'sources':'sources', 'sourceHealth':'source-health', 'reviewQueue':'review-queue', 'technologySources':'technology-sources', 'dictionarySources':'dictionary-sources'}.items():
        data[key] = json.loads((ROOT / f'data/{name}.json').read_bytes())
    data['publication'] = manifest
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="app.css">', '<style>' + (ROOT / 'app.css').read_text(encoding='utf-8') + '</style>')
    for name in ('catalog-loader.js', 'core.js', 'app.js'):
        html = html.replace(f'<script defer src="{name}"></script>', '')
    script = 'window.ATLAS_OFFLINE=true;window.ATLAS_READY=Promise.resolve(' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ');\n'
    script += (ROOT / 'core.js').read_text(encoding='utf-8') + '\n' + (ROOT / 'app.js').read_text(encoding='utf-8')
    script = script.replace('</script', '<\\/script').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    html = html.replace('</body>', '<script>' + script + '</script></body>')
    html = html.replace('<main id="main" tabindex="-1">', '<main id="main" tabindex="-1"><p class="notice">Offline demonstration fallback: all 1,705 catalog records, search, comparisons and JSON exports work without internet. Term explanations open as record dialogs here. Expanded web pages, original downloads and external citations require the served edition.</p>')
    html = html.replace('href="demo.html"', 'href="#/overview"').replace('href="terms/index.html"', 'href="#/dictionary"')
    # Games run in the hosted edition; keep the single-file fallback link honest.
    html = html.replace('href="games.html"', 'href="https://raw.githack.com/hazelfjeld/ai-atlas/main/games.html"').replace('<span>Games</span>', '<span>Games (online)</span>')
    (ROOT / 'downloads/Atlas_Demo_Offline.html').write_bytes(html.encode('utf-8'))
    print('Built downloads/Atlas_Demo_Offline.html from the complete catalog.')


if __name__ == '__main__':
    main()
