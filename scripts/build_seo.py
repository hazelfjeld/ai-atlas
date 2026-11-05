#!/usr/bin/env python3
"""Build crawlable discovery/profile pages, canonical metadata and the sitemap.

No new catalog writer: read only the completed publication and original records.
"""
from html import escape as e
import json
from pathlib import Path
import re
import subprocess
from xml.etree.ElementTree import Element, SubElement, tostring
from site_seo import absolute, metadata, breadcrumbs, replace_head, technology_path, ORIGIN
from build_term_pages import rows, term_path, external

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    'index.html': ('AI Updates — AI Research, Tools & Concepts', 'Explore AI research, 300 technology profiles and 1,345 concepts. Source-linked guides, safety research, practice games and reviewed daily editions.'),
    'whats-new.html': ('AI News & Daily Editions | AI Updates', 'Read the AI Updates edition archive: AI news, research, technology releases, concepts and corrections with actual dates, sources and editorial review.'),
    'research.html': ('AI Safety Research Library | AI Updates', 'Explore 30 indexed AI research papers and 10 safety report records. Search the evidence, distinguish report types, and inspect sources and limitations.'),
    'technologies.html': ('Search AI Tools & Technologies | AI Updates', 'Search and compare 300 AI technology profiles by workload, strengths, runtime and tradeoffs. Explore linked concepts and original sources.'),
    'playbooks.html': ('AI Project Playbooks | AI Updates', 'Explore 20 practical AI project playbooks with suggested technologies, first experiments, validation steps, caveats and linked source material.'),
    'games.html': ('AI Learning Games: Quiz, Match & Flashcards | AI Updates', 'Practice 1,345 machine learning and AI concepts with Quiz, Match and Flashcards. Filter by topic or level, revisit missed answers and follow concept explanations.'),
    'demo.html': ('A Guided Tour of AI Updates', 'Take a guided tour of AI Updates: concept guides, technology comparisons, safety evidence, Quiz and Match, and the reviewed daily edition archive.'),
    'about.html': ('About & Editorial Policy | AI Updates', 'How AI Updates selects, explains and labels AI research, tools and concepts. Read our source policy, review levels, coverage limits and correction process.'),
}


def nav(prefix=''):
    return f'<nav class="term-nav" aria-label="Site navigation"><a href="{prefix}index.html">AI Updates</a><a href="{prefix}whats-new.html">Daily editions</a><a href="{prefix}terms/index.html">Concepts</a><a href="{prefix}technology/index.html">Technologies</a><a href="{prefix}index.html#/games">Games</a><a href="{prefix}about.html">About</a></nav>'


# Only the editorial-policy page receives the lightweight mobile header; every
# generated term/technology URL and its existing layout remain byte-identical.
ABOUT_MOBILE_CSS = '''
/* Keep the editorial-policy page in the same compact mobile shell as Discover and the archive. */
.about-mobile-topbar{display:none}
@media(max-width:650px){
 .term-shell{padding:0 20px 65px}
 .term-shell .term-nav{display:none}
 .about-mobile-topbar{display:flex;align-items:center;gap:12px;position:relative;z-index:5;margin:0 -20px;padding:14px 20px;border-bottom:1px solid var(--line)}
 .about-mobile-nav{flex:0 0 44px}
 .about-menu-toggle{display:grid;place-items:center;min-height:44px;width:44px;list-style:none;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:9px;color:var(--ink);font-size:20px;line-height:1}
 .about-menu-toggle::-webkit-details-marker{display:none}
 .about-menu-toggle:focus-visible,.about-search-link:focus-visible{outline:3px solid var(--orange);outline-offset:3px}
 .about-menu-panel{position:absolute;left:20px;top:calc(100% - 2px);width:min(310px,calc(100vw - 40px));max-height:calc(100vh - 96px);overflow-y:auto;padding:9px;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 26px #0002}
 .about-menu-panel a{display:block;min-height:44px;padding:10px 12px;border-radius:6px;color:var(--ink);text-decoration:none;font-size:15px;font-weight:600}
 .about-menu-panel a:hover,.about-menu-panel a[aria-current=page]{background:var(--soft);color:var(--green)}
 .about-search-link{display:flex;align-items:center;gap:12px;flex:1;min-width:0;min-height:44px;padding:8px 13px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--muted);text-decoration:none;font-size:16px}
 .about-search-link:hover{border-color:var(--green);color:var(--ink)}
 .about-search-icon{flex-shrink:0;font-size:22px;line-height:1}
 .about-search-placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
}
'''
ABOUT_MOBILE_NAV = '''<div class="about-mobile-topbar"><details class="about-mobile-nav" id="about-mobile-nav"><summary class="about-menu-toggle" aria-label="Toggle navigation"><span aria-hidden="true">☰</span></summary><nav class="about-menu-panel" aria-label="AI Updates sections"><a href="index.html#/overview">Discover</a><a href="whats-new.html">What’s New Today</a><a href="index.html#/dictionary">Concept dictionary</a><a href="index.html#/technologies">Technology profiles</a><a href="index.html#/safety">AI safety</a><a href="index.html#/papers">Research library</a><a href="index.html#/games">Games</a><a href="demo.html">Guided demo</a><a href="about.html" aria-current="page">About</a></nav></details><a class="about-search-link" href="index.html#/search" aria-label="Search AI Updates in the main collection"><span class="about-search-icon" aria-hidden="true">⌕</span><span class="about-search-placeholder">Search tools, research, concepts…</span></a></div>'''

def shell(title, description, path, body, structured=None):
    prefix = '../' if '/' in path else ''
    mobile_css = ABOUT_MOBILE_CSS if path == 'about.html' else ''
    mobile_nav = ABOUT_MOBILE_NAV if path == 'about.html' else ''
    print_nav = ',.about-mobile-topbar' if path == 'about.html' else ''
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
{metadata(title, description, path, structured)}
<link rel="stylesheet" href="{prefix}checkpoint.css"><link rel="stylesheet" href="{prefix}brand.css">
<style>.term-shell{{max-width:1000px;margin:auto;padding:32px 24px 70px}}.term-nav{{display:flex;flex-wrap:wrap;gap:18px;font-size:13px}}.term-shell h1{{font:400 clamp(34px,6vw,58px)/1.12 Georgia,serif;letter-spacing:-.04em}}.term-shell h2{{font-size:22px}}.term-shell p,.term-shell li{{font-size:15px;line-height:1.8}}.term-shell .hero{{margin:38px 0 24px}}.term-shell .hero .eyebrow{{font:600 11px/1.6 system-ui,sans-serif}}.term-shell .lead{{margin-top:18px}}{mobile_css}@media print{{.term-nav{print_nav},.skip{{display:none}}.term-shell{{padding:0}}}}</style>
</head><body><a class="skip" href="#main">Skip to content</a><main class="term-shell" id="main">{mobile_nav}{nav(prefix)}{body}<footer>AI Updates is a curated learning and research project. Imported evidence labels are preserved. <a href="{prefix}about.html">Editorial policy & coverage</a> · <a href="{prefix}index.html#/sources">Source registers & downloads</a></footer></main></body></html>'''


def main():
    terms, techs = rows('terms'), rows('technologies')
    new_count = len(techs) - 300
    assert new_count >= 0
    PAGES['index.html'] = (PAGES['index.html'][0], PAGES['index.html'][1].replace('300 technology profiles', f'{len(techs)} technology profiles'))
    PAGES['technologies.html'] = (PAGES['technologies.html'][0], PAGES['technologies.html'][1].replace('300 AI technology profiles', f'{len(techs)} AI technology profiles'))
    by_term = {r['id']: r for r in terms}
    by_tech = {r['id']: r for r in techs}
    release_path = ROOT / 'content/technology-release-updates.json'
    release_bytes = release_path.read_bytes()
    from hashlib import sha256
    assert len(release_bytes) == 1984 and sha256(release_bytes).hexdigest() == 'bce8af000eb5b765177ebb62ca7b5be09b3931679152ee7d59cc5e0faebd4e2c', 'Release evidence digest mismatch'
    review_data = json.loads(release_bytes)
    assert review_data['schema'] == 1
    release_updates = review_data['updates']
    assert all(key in by_tech for key in release_updates), 'Release update references missing catalog profile'
    out = ROOT / 'technology'
    out.mkdir(exist_ok=True)
    profile_paths = []
    for r in techs:
        path = technology_path(r)
        profile_paths.append(path)
        origin = ('Added after the original November 1 snapshot; not a new product launch or independent benchmark replication.' if int(r['id'][5:]) > 300 else 'This profile preserves the prepared catalog’s original descriptions. Advantages depend on the workload; comparisons are editorial, not benchmark results.')
        body = f'<p class="breadcrumb-links"><a href="../index.html">Home</a> / <a href="index.html">Technologies</a> / {e(r["name"])}</p><header class="hero"><p class="eyebrow">TECHNOLOGY PROFILE · {e(r["id"])}</p><h1>{e(r["name"])}</h1><p class="lead">{e(r["what"])}</p></header><p class="notice">{e(r["evidence_status"])}. {e(origin)}</p>'
        fields = [('Where it has an edge', 'edge'), ('Best-fit problems', 'best_for'), ('Tradeoffs & cautions', 'watch_out'), ('What to test before choosing', 'test_before_choice'), ('Runtime & hardware', 'runtime'), ('Access & licensing', 'access'), ('Execution', 'execution'), ('Lifecycle', 'lifecycle'), ('Comparison basis', 'comparison_basis'), ('Original notes', 'notes')]
        for title, key in fields:
            if r.get(key):
                body += f'<section class="profile-section"><h2>{e(title)}</h2><p>{e(r[key])}</p></section>'
        for update in release_updates.get(r['id'], []):
            body += '<section class="profile-section"><h2>Reviewed release update · ' + e(update['version']) + '</h2><p>' + e(update['summary']) + '</p><p><strong>Compatibility:</strong> ' + e(update['compatibility']) + '</p><p><strong>Publication status:</strong> ' + e(update['status_note']) + '</p><p><strong>Evidence limitation:</strong> ' + e(update['caveat']) + '</p><p><strong>Source published:</strong> ' + e(update['published_at']) + ' · <strong>Reviewed:</strong> ' + e(update['reviewed_on']) + '</p><p>' + external(update['source_url'], 'First-party release notes') + '</p></section>'
        body += '<section class="profile-section"><h2>Connected concepts</h2><ul>' + ''.join(f'<li><a href="../{term_path(by_term[i])}">{e(by_term[i]["term"])}</a></li>' for i in r['concept_ids']) + '</ul></section>'
        body += '<section class="profile-section"><h2>Alternatives to investigate</h2><p>' + e(' · '.join(r['alternatives']) or 'None recorded') + '</p><ul>' + ''.join(f'<li><a href="{Path(technology_path(by_tech[i])).name}">{e(by_tech[i]["name"])}</a></li>' for i in r['alternative_ids']) + '</ul></section>'
        body += '<section class="profile-section"><h2>Original source</h2><p>' + external(r['source_url'], r['name'] + ' — original reference') + '</p></section>'
        body += f'<p><a href="../index.html#/technologies?record={r["id"]}">Compare, save or annotate this profile in the workspace →</a></p>'
        data = [{'@context': 'https://schema.org', '@type': 'WebPage', 'name': r['name'] + ' technology profile', 'description': r['what'], 'url': absolute(path), 'isPartOf': {'@type': 'WebSite', 'name': 'AI Updates', 'url': ORIGIN + '/'}, 'about': {'@type': 'Thing', 'name': r['name']}}, breadcrumbs([('AI Updates','index.html'), ('Technologies','technology/index.html'), (r['name'],path)])]
        description = (r['name'] + ': ' + r['what'] + ' Explore uses, tradeoffs and linked concepts.')[:170]
        (ROOT / path).write_bytes(shell(r['name'] + ' — Uses & Tradeoffs | AI Updates', description, path, body, data).encode())
    body = f'<header class="hero"><p class="eyebrow">THE TECHNOLOGY FIELD GUIDE</p><h1>Tools, with context.</h1><p class="lead">{len(techs)} AI technology profiles. Explore what each does, where it fits, its tradeoffs and the ideas behind it.</p></header><p class="notice">The original 300 profiles are preserved; added profiles are separately source-reviewed, not independently benchmarked. <a href="../technologies.html">Open searchable technology filters →</a></p><div class="reference-grid">' + ''.join(f'<a href="{Path(technology_path(r)).name}">{e(r["name"])}</a>' for r in sorted(techs,key=lambda r:r['name'].casefold())) + '</div>'
    (out / 'index.html').write_bytes(shell(f'AI Technology Directory: {len(techs)} Profiles | AI Updates', f'Browse {len(techs)} profiles: 300 preserved originals plus {new_count} source-reviewed addition(s), with context and limitations.', 'technology/index.html', body).encode())
    about = '''<header class="hero"><p class="eyebrow">ABOUT AI UPDATES</p><h1>The frontier, in context.</h1><p class="lead">AI is easier to understand when the explanation comes with its evidence, connections and limits.</p></header>
<section class="profile-section"><h2>A place to learn, investigate and build.</h2><p>AI Updates brings together an AI concept dictionary, technology field guide, research library, safety observatory and practical project playbooks. It began as Atlas; the original catalog, permanent IDs, citations and downloadable workbooks are retained.</p><p>The prepared November 1, 2026 snapshot contains 1,345 concepts, 300 technologies, 30 papers, 10 safety report records and 20 playbooks. Sixteen concept guides have expanded editorial explanations. The other references clearly mark their detailed expansion as pending.</p></section>
<section class="profile-section"><h2>Sources first. Claims in context.</h2><p>Source links and review labels stay with the records. “Primary report reviewed” means the report was read; it does not mean its findings were independently reproduced. A metadata-only entry is not a full methods review. Tool comparisons describe possible problem fit and are not experimental rankings.</p><p>Incident reports, controlled evaluations, misuse reports and mitigation updates are distinguished. Ten report records do not necessarily represent ten distinct incidents. Examples in educational guides are illustrative.</p></section>
<section class="profile-section"><h2>What appears in the daily edition?</h2><p>Reviewed editions can include AI news, technologies, terms, site updates and corrections. They retain their actual edition dates, publication times, collection windows, source coverage and failed-source status. “New to AI Updates” does not mean newly invented or newly released.</p><p>Until the first reviewed edition is published, the archive says so. Featured guides on Discover are evergreen educational selections, not fabricated breaking news. The website does not run a continuous crawler.</p><p><a href="whats-new.html">Read the edition archive →</a></p></section>
<section class="profile-section"><h2>Corrections and limitations</h2><p>Coverage is curated, incomplete and may become outdated. Imported review labels do not constitute a new audit. External sources can change. Corrected daily editions are published as new immutable revisions with change notes, preserving the earlier edition.</p><p>To report a factual issue or broken source, <a href="https://github.com/hazelfjeld/ai-atlas/issues" rel="noopener noreferrer">open an issue in the source repository</a> with the record ID, disputed claim and supporting primary material.</p></section>
<section class="profile-section"><h2>Your notebook stays in your browser.</h2><p>AI Updates has no account backend, advertising tracker or paid news API. Bookmarks and notes are browser-local on this domain; export a backup to move them between devices or addresses. On shared GitHack origins, the notebook is session-only.</p><p><a href="index.html#/sources">Inspect source registers, coverage and original downloads →</a></p></section>'''
    guide_count = len(json.loads((ROOT / 'content/term-guides.json').read_bytes()))
    about = about.replace('Sixteen concept guides', str(guide_count) + ' concept guides')
    about = about.replace('The other references clearly mark their detailed expansion as pending.', f'The other references clearly mark their detailed expansion as pending. {new_count} technology profile(s) were source-reviewed and added after the original snapshot.')
    demo = ROOT / 'demo.html'
    demo.write_bytes(re.sub(r'only \d+ guides are expanded', 'only ' + str(guide_count) + ' guides are expanded', demo.read_text(encoding='utf-8')).encode())
    (ROOT / 'about.html').write_bytes(shell(*PAGES['about.html'], 'about.html', about).encode())
    # Same view code on the server and in the browser: no crawler-only alternative.
    rendered = subprocess.check_output(['node', str(ROOT / 'scripts/render_discovery.cjs')], cwd=ROOT).decode('utf-8')
    index = (ROOT / 'index.html').read_text(encoding='utf-8')
    index, count = re.subn(r'<!-- discovery:start -->.*?<!-- discovery:end -->', lambda _: '<!-- discovery:start -->' + rendered + '<!-- discovery:end -->', index, flags=re.S)
    assert count == 1
    # First-paint counts must match the verified catalog before JavaScript hydrates.
    index, count = re.subn(
        r'(<a class="nav-link" data-view="technologies" href="#/technologies">.*?<span class="nav-count">)[0-9]+(</span></a>)',
        lambda match: match.group(1) + str(len(techs)) + match.group(2), index, count=1, flags=re.S,
    )
    assert count == 1, 'Missing static technology navigation badge'
    (ROOT / 'index.html').write_bytes(index.encode())
    for path, (title, description) in PAGES.items():
        data = None
        if path == 'index.html':
            data = [{'@context':'https://schema.org', '@type':'WebSite', '@id':ORIGIN+'/#website', 'name':'AI Updates', 'alternateName':'Atlas', 'url':ORIGIN+'/', 'description':description, 'inLanguage':'en'}, {'@context':'https://schema.org','@type':'Organization','@id':ORIGIN+'/#publisher','name':'AI Updates','url':ORIGIN+'/','logo':ORIGIN+'/favicon.svg','sameAs':['https://github.com/hazelfjeld/ai-atlas']}]
        p = ROOT / path
        p.write_bytes(replace_head(p.read_text(encoding='utf-8'), metadata(title, description, path, data)).encode())
    paths = ['index.html', 'catalog-review.html', 'hardware-review.html', 'terms/index.html', 'technology/index.html', *[p for p in PAGES if p != 'index.html'], *[term_path(r) for r in terms], *profile_paths]
    urlset = Element('urlset', {'xmlns':'http://www.sitemaps.org/schemas/sitemap/0.9'})
    for path in sorted(set(paths)):
        SubElement(SubElement(urlset, 'url'), 'loc').text = absolute(path)
    (ROOT / 'sitemap.xml').write_bytes(b'<?xml version="1.0" encoding="UTF-8"?>\n' + tostring(urlset, encoding='utf-8') + b'\n')
    (ROOT / 'robots.txt').write_bytes(f'User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n'.encode())
    print(json.dumps({'technology_profiles':len(profile_paths), 'sitemap_urls':len(set(paths)), 'brand':'AI Updates'}))


if __name__ == '__main__':
    main()
