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
    html = html.replace('<link rel="stylesheet" href="games-tab.css">', '<style>' + (ROOT / 'games-tab.css').read_text(encoding='utf-8') + '</style>')
    html = html.replace('<link rel="stylesheet" href="brand.css">', '<style>' + (ROOT / 'brand.css').read_text(encoding='utf-8') + '</style>')
    html = html.replace('<link rel="stylesheet" href="site-chrome.css">', '<style>' + (ROOT / 'site-chrome.css').read_text(encoding='utf-8') + '</style>')
    html = html.replace('<script src="site-theme.js"></script>', '<script>' + (ROOT / 'site-theme.js').read_text(encoding='utf-8').replace('</script', '<\\/script') + '</script>')
    for name in ('catalog-loader.js', 'core.js', 'games-core.js', 'games-tab.js', 'discovery.js', 'app.js'):
        html = html.replace(f'<script defer src="{name}"></script>', '')
    script = 'window.ATLAS_OFFLINE=true;window.ATLAS_READY=Promise.resolve(' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ');\n'
    for filename in ('core.js', 'games-core.js', 'games-tab.js', 'discovery.js', 'app.js'):
        script += (ROOT / filename).read_text(encoding='utf-8') + '\n'
    script = script.replace('</script', '<\\/script').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    html = html.replace('</body>', '<script>' + script + '</script></body>')
    count = sum(len(data[k]) for k in ('papers','alerts','terms','technologies','playbooks'))
    html = html.replace('<main id="main" tabindex="-1">', f'<main id="main" tabindex="-1"><p class="notice">Offline demonstration fallback: all {count:,} catalog records (1,705 preserved originals), search, comparisons, Games and JSON exports work without internet. Term explanations open as record dialogs here. Expanded web pages, original downloads and external citations require the served edition.</p>')
    html = html.replace('href="playbooks.html"', 'href="#/playbooks"').replace('href="about.html"', 'href="#/sources"').replace('href="technology/index.html"', 'href="#/technologies"')
    html = html.replace('href="demo.html"', 'href="#/overview"').replace('href="terms/index.html"', 'href="#/dictionary"')
    # Unlike self-contained workspace routes, daily editions are not bundled.
    # Resolve the shared nav to the real archive, not a nonexistent sibling of
    # the downloaded single-file HTML (which otherwise produces a file:// 404).
    html = html.replace('href="whats-new.html"',
                        'href="https://aiupdates.app/whats-new.html" title="Online daily archive; internet required"')
    html = html.replace('<meta name="robots" content="index,follow,max-image-preview:large">', '<meta name="robots" content="noindex,follow">')
    (ROOT / 'downloads/Atlas_Demo_Offline.html').write_bytes(html.encode('utf-8'))
    print('Built downloads/Atlas_Demo_Offline.html from the complete catalog.')


if __name__ == '__main__':
    main()
