#!/usr/bin/env python3
"""Deterministically build direct, script-free pages from preserved records and authored guides."""
import hashlib
from html import escape as e
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote, urlsplit
from site_seo import metadata, breadcrumbs, absolute, technology_path
from site_chrome import render_directory_nav, render_directory_hero, DIRECTORY_MOBILE_CSS, native_directory_article_skip, REFERENCE_LANDING_PATHS, REFERENCE_LANDING_HERO_CSS, wrap_reference_shell

ROOT = Path(__file__).resolve().parents[1]


def rows(kind):
    return [r for p in sorted((ROOT / 'data').glob(kind + '-*.json')) for r in json.loads(p.read_bytes())]


def term_path(r):
    slug = unicodedata.normalize('NFKD', r['term']).encode('ascii', 'ignore').decode().lower()
    slug = re.sub('[^a-z0-9]+', '-', slug).strip('-') or 'concept'
    return f"terms/{r['id']}-{slug}.html"


def external(url, title):
    u = urlsplit(url)
    assert u.scheme in ('http', 'https') and not u.username and not u.password, url
    return f'<a href="{e(url, quote=True)}" rel="noopener noreferrer" target="_blank">{e(title)} ↗</a>'


def section(title, body, extra=''):
    return f'<section class="detail-block {extra}"><h2>{e(title)}</h2>{body}</section>'


def shell(title, body, path, description, structured=None, *, native_concept_article=False):
    # Every concept detail URL shares the native, script-free article skip
    # and navigation source used by the technology directories and profiles.
    # All concept detail pages now ship the same eight mobile secondary links
    # as the A-Z directory and technology profiles, even without JavaScript.
    directory_nav = render_directory_nav('../', (None if path == 'terms/index.html' else 'Concept dictionary'), mobile_brand=True, native_secondary=True, mobile_secondary=True, secondary_current=('encyclopedia' if path == 'terms/index.html' else None), page_label=('Concept encyclopedia' if path == 'terms/index.html' else None), topbar_title=('Concept encyclopedia' if path == 'terms/index.html' else None))
    # Fail during generation if the common native mobile disclosure disappears.
    assert directory_nav.count('class="site-mobile-chrome__more"') == 1, path
    assert directory_nav.count('class="site-mobile-chrome__more-links"') == 1, path
    directory_css = DIRECTORY_MOBILE_CSS
    directory_assets = '<link rel="stylesheet" href="../site-chrome.css"><script src="../site-theme.js"></script>'
    heading_css = '' if path == 'terms/index.html' else '.term-shell h1{font-size:clamp(32px,6vw,58px)}'
    body, main_id = native_directory_article_skip(body, path, native_concept_article=native_concept_article)
    landing_css = REFERENCE_LANDING_HERO_CSS if path in REFERENCE_LANDING_PATHS else ''
    footer = '<footer>Prepared catalog snapshot: November 1, 2026. Imported references retain their prior review labels. These pages work without JavaScript; external references require internet. <a href="../about.html">Editorial policy</a> · <a href="../index.html#/sources">Sources & downloads</a></footer>'
    article = wrap_reference_shell(directory_nav, body + footer, path, main_id)
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
{metadata(title + ' | AI Updates', description, path, structured)}
<link rel="stylesheet" href="../checkpoint.css"><link rel="stylesheet" href="../brand.css"><style>.term-shell{{max-width:1000px;margin:auto;padding:30px 24px 70px}}.term-nav{{display:flex;flex-wrap:wrap;gap:18px;font-size:13px}}{heading_css}.term-shell h2{{font-size:20px;margin:0 0 12px}}.term-shell p,.term-shell li{{font-size:15px;line-height:1.75}}.term-shell .lead{{font-size:20px;max-width:850px}}.term-shell li{{margin:7px 0}}.term-shell a{{overflow-wrap:anywhere}}.term-shell .hero{{margin:38px 0 24px}}{directory_css}{landing_css}@media print{{.term-nav,.skip{{display:none}}.term-shell{{padding:0}}.detail-block{{break-inside:avoid}}}}</style>{directory_assets}</head><body><a class="skip" href="#main">Skip to content</a>{article}</body></html>'''


def main():
    terms, technologies = rows('terms'), rows('technologies')
    by_id = {r['id']: r for r in terms}
    guides = json.loads((ROOT / 'content/term-guides.json').read_bytes())
    assert set(guides) <= set(by_id)
    refs = json.loads((ROOT / 'data/dictionary-sources.json').read_bytes())
    out = ROOT / 'terms'
    out.mkdir(exist_ok=True)
    manifest = {}
    def links(ids):
        return '<ul>' + ''.join(f'<li><a href="{e(Path(term_path(by_id[i])).name)}">{e(by_id[i]["term"])}</a></li>' for i in ids) + '</ul>'
    for r in terms:
        guide = guides.get(r['id'])
        body = f'<header class="hero"><p class="eyebrow">{e(r["topic"])} · {e(r["id"])}</p><h1>{e(r["term"])}</h1><p class="lead">{e(r["definition"])}</p></header>'
        label = f'Expanded guide · editorial review {guide["reviewed_on"]}' if guide else 'Original reference page · detailed expansion pending'
        body += f'<p class="notice">{e(label)}. Original definitions, examples, notes and citations are preserved below. New examples are illustrative, not benchmark results.</p>'
        if guide:
            body += section('Prerequisites', links(guide['prerequisites']))
            for title, text in guide['sections']:
                body += section(title, '<p>' + e(text) + '</p>')
            body += section('Sources for the expanded explanation', '<ul>' + ''.join('<li>' + external(url, title) + '</li>' for title, url in guide['citations']) + '</ul><p>Editorial synthesis checked against the linked primary material; no independent replication is claimed.</p>')
        body += section('Original example', '<p>' + e(r['example']) + '</p>')
        body += section('Original caveat', '<p>' + e(r['caveat']) + '</p>', 'caveat')
        body += section('Context and aliases', '<p>Level: ' + e(r['level']) + '. Stages: ' + e(' · '.join(r['stages'])) + '.</p><p>Tags: ' + e(' · '.join(r['tags'])) + '.</p><p>Aliases: ' + e(' · '.join(r['aliases']) or 'None recorded') + '.</p>')
        if r['notes']:
            body += section('Original notes', '<p>' + e(r['notes']) + '</p>')
        body += section('Related concepts', links(r['related_ids']) if r['related_ids'] else '<p>No related IDs recorded.</p>')
        incoming = [t['id'] for t in terms if r['id'] in t['related_ids']]
        if incoming:
            body += section('Concepts linking here', links(incoming))
        tech = [t for t in technologies if r['id'] in t['concept_ids']]
        if tech:
            body += section('Technology connections', '<ul>' + ''.join(f'<li><a href="../{technology_path(t)}">{e(t["name"])}</a> — {e(t["what"])}</li>' for t in tech) + '</ul>')
        citations = [s for s in refs if s['id'] in r['source_ids']]
        body += section('Original references', '<ul>' + ''.join('<li>' + external(s['url'], s['title']) + ' · ' + e(s['review_status']) + '</li>' for s in citations) + '<li>' + external(r['reference_url'], 'Original reference URL') + '</li></ul>')
        body += f'<p><a href="../index.html#/dictionary?record={quote(r["id"])}">Open original record, export or annotate →</a></p>'
        path = term_path(r)
        structured = [{'@context':'https://schema.org', '@type':'DefinedTerm', '@id':absolute(path)+'#term', 'name':r['term'], 'termCode':r['id'], 'description':r['definition'], 'url':absolute(path), 'inDefinedTermSet':{'@type':'DefinedTermSet', 'name':'AI Updates Concept Dictionary', 'url':absolute('terms/index.html')}}, breadcrumbs([('AI Updates','index.html'), ('Concept dictionary','terms/index.html'), (r['term'],path)])]
        blob = shell(r['term'], body, path, (r['term'] + ': ' + r['definition'])[:170], structured, native_concept_article=True).encode('utf-8')
        (ROOT / path).write_bytes(blob)
        manifest[r['id']] = {'path': path, 'sha256': hashlib.sha256(blob).hexdigest(), 'expanded': bool(guide)}
    (out / 'manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode())
    intro = render_directory_hero('CONCEPT ENCYCLOPEDIA', 'Follow the connections.', f'{len(terms):,} permanent reference pages · {len(guides)} expanded guides. Every reference page preserves its original definition, example, caveat, context and sources. The remaining detailed expansions are visibly pending.')
    intro += section('Start with an expanded guide', links(list(guides)))
    intro += section('All concepts, A–Z', links([t['id'] for t in sorted(terms, key=lambda r: r['term'].casefold())]))
    (out / 'index.html').write_bytes(shell('AI Concept Dictionary: 1,345 Terms', intro, 'terms/index.html', 'Explore 1,345 AI, machine learning and language-model concepts with definitions, examples, caveats, sources and connected technology profiles.', {'@context':'https://schema.org','@type':'DefinedTermSet','name':'AI Updates Concept Dictionary','url':absolute('terms/index.html'),'description':f'{len(terms):,} preserved concept references and {len(guides)} expanded educational guides.'}).encode())
    p = ROOT / 'publication.json'
    publication = json.loads(p.read_bytes())
    publication['encyclopedia'] = {'imported_term_count': len(terms), 'linked_term_count': len(terms), 'detailed_page_count': len(guides), 'editorially_reviewed_guide_count': len(guides), 'reviewed_on': max((g['reviewed_on'] for g in guides.values()), default=publication['snapshot_date']), 'page_manifest': 'terms/manifest.json'}
    p.write_bytes((json.dumps(publication, indent=2) + '\n').encode())
    print(json.dumps(publication['encyclopedia'], indent=2))


if __name__ == '__main__':
    main()
