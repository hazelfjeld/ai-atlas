"""SEO and source preservation at the actual generated-publication boundary."""
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import struct
import sys
import unittest
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from site_seo import ORIGIN, absolute, technology_path
from build_term_pages import rows, term_path
from site_chrome import DESTINATIONS, render_discover_primary, normalize_discover_sidebar


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.canonicals, self.descriptions, self.schemas, self.titles = [], [], [], []
        self.links, self.headings = [], []
        self.capture = None
        self.value = ''
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonicals.append(a['href'])
        if tag == 'meta' and a.get('name') == 'description': self.descriptions.append(a['content'])
        if tag == 'a': self.links.append(a.get('href', ''))
        if tag in ('title','h1') or tag == 'script' and a.get('type') == 'application/ld+json':
            self.capture, self.value = tag, ''

    def handle_data(self, data):
        if self.capture: self.value += data

    def handle_endtag(self, tag):
        if tag != self.capture: return
        if tag == 'script': self.schemas.append(json.loads(self.value))
        elif tag == 'title': self.titles.append(self.value)
        elif tag == 'h1': self.headings.append(self.value)
        self.capture = None


class SEOPublication(unittest.TestCase):
    def test_sitemap_only_lists_real_canonical_pages_with_unique_metadata(self):
        urls = [node.text for node in ET.parse(ROOT/'sitemap.xml').findall('{*}url/{*}loc')]
        self.assertEqual(len(urls), len(set(urls)))
        self.assertEqual(len(urls), len(rows('terms')) + len(rows('technologies')) + 12)
        self.assertIn(ORIGIN+'/catalog-review.html', urls)
        titles = set()
        for url in urls:
            self.assertTrue(url.startswith(ORIGIN+'/'))
            self.assertFalse(urlsplit(url).fragment or urlsplit(url).query)
            path = url.removeprefix(ORIGIN+'/') or 'index.html'
            source = (ROOT/path).read_text(encoding='utf-8')
            page = Page(source)
            self.assertEqual(page.canonicals, [url], path)
            self.assertEqual(len(page.titles), 1, path)
            self.assertIn('AI Updates', page.titles[0], path)
            self.assertNotIn(page.titles[0], titles, path)
            titles.add(page.titles[0])
            self.assertEqual(len(page.descriptions), 1, path)
            self.assertGreater(len(page.descriptions[0]), 25, path)
            self.assertEqual(len(page.headings), 1, path)
            self.assertNotIn('noindex', source.split('</head>')[0], path)
        self.assertIn('Sitemap: '+ORIGIN+'/sitemap.xml', (ROOT/'robots.txt').read_text())

    def test_technology_profiles_preserve_original_claims_caveats_and_sources(self):
        techs = rows('technologies')
        release_updates = json.loads((ROOT/'content/technology-release-updates.json').read_bytes())['updates']
        self.assertEqual(len(techs), json.loads((ROOT/'publication.json').read_bytes())['published_counts']['technologies'])
        for row in techs:
            path = technology_path(row)
            source = (ROOT/path).read_text(encoding='utf-8')
            for key in ('name','what','edge','best_for','watch_out','test_before_choice','runtime','access','evidence_status'):
                self.assertIn(escape(row[key]), source, (row['id'],key))
            self.assertIn(escape(row['source_url'],quote=True), source)
            self.assertIn('technologies?record='+row['id'], source)
            for update in release_updates.get(row['id'], []):
                self.assertIn('Reviewed release update', source, row['id'])
                for key in ('version', 'summary', 'compatibility', 'status_note', 'caveat', 'published_at', 'reviewed_on'):
                    self.assertIn(escape(update[key]), source, (row['id'], key))
                self.assertIn('href="'+escape(update['source_url'], quote=True)+'"', source, row['id'])

    def test_reviewed_release_overlay_is_pinned_to_primary_evidence_and_existing_ids(self):
        import hashlib
        from urllib.parse import urlsplit
        blob = (ROOT / 'content/technology-release-updates.json').read_bytes()
        self.assertEqual(len(blob), 1984)
        self.assertEqual(hashlib.sha256(blob).hexdigest(), 'bce8af000eb5b765177ebb62ca7b5be09b3931679152ee7d59cc5e0faebd4e2c')
        overlay = json.loads(blob)
        self.assertEqual(overlay['schema'], 1)
        original = {r['id'] for r in rows('technologies')}
        self.assertEqual(set(overlay['updates']), {'TECH-0288'})
        self.assertLessEqual(set(overlay['updates']), original)
        for updates in overlay['updates'].values():
            versions = [u['version'] for u in updates]
            self.assertEqual(len(versions), len(set(versions)))
            for u in updates:
                source = urlsplit(u['source_url'])
                self.assertEqual(source.scheme, 'https')
                self.assertFalse(source.username or source.password)
                self.assertIn('release', u['evidence_level'].lower())
                self.assertIn('not reproduced', u['review_status'].replace('_', ' ').lower())

    def test_every_term_has_matching_semantic_definition_and_actual_reference(self):
        for row in rows('terms'):
            path = term_path(row)
            page = Page((ROOT/path).read_text(encoding='utf-8'))
            term = page.schemas[0][0]
            self.assertEqual(term['@type'], 'DefinedTerm')
            self.assertEqual(term['name'], row['term'])
            self.assertEqual(term['description'], row['definition'])
            self.assertEqual(term['url'], absolute(path))
            self.assertEqual(term['termCode'], row['id'])
            self.assertIn(row['reference_url'], page.links)

    def test_discover_primary_nav_is_generated_from_the_shared_canonical_routes(self):
        source = (ROOT / 'index.html').read_text(encoding='utf-8')
        pub = json.loads((ROOT / 'publication.json').read_text(encoding='utf-8'))['published_counts']
        begin = '<nav id="navigation" aria-label="Main navigation">'
        primary = source.split(begin, 1)[1].split('<details class="nav-more"', 1)[0]
        self.assertEqual(len(DESTINATIONS), 7)
        self.assertEqual(primary, render_discover_primary(pub['terms'], pub['technologies']))
        self.assertEqual(normalize_discover_sidebar(source, pub['terms'], pub['technologies']), source)
        # Editing a stale first-paint label or URL must not create a second source
        # of truth: rebuilding restores the generated canonical destinations.
        drifted = source.replace('>What’s New Today</span>', '>Different news</span>', 1)
        drifted = drifted.replace('href="whats-new.html"', 'href="incorrect.html"', 1)
        self.assertNotEqual(drifted, source)
        self.assertEqual(normalize_discover_sidebar(drifted, pub['terms'], pub['technologies']), source)
        self.assertIn('<details class="nav-more" id="additional-navigation">', source)

    def test_discovery_is_in_the_initial_html_and_has_crawlable_content_links(self):
        source = (ROOT/'index.html').read_text(encoding='utf-8')
        page = Page(source)
        self.assertEqual(page.headings, ['Discover'])
        self.assertIn('Why AI can get the reward', source)
        self.assertIn('terms/MLD-1039-reward-hacking.html', page.links)
        self.assertIn('technology/TECH-0216-pytorch.html', page.links)
        self.assertIn('about.html', page.links)
        self.assertIn('curated learning and research collection', source)
        self.assertIn('noindex,follow', (ROOT/'downloads/Atlas_Demo_Offline.html').read_text(encoding='utf-8'))
        png = (ROOT/'social-card.png').read_bytes()
        self.assertEqual(png[:8], b'\x89PNG\r\n\x1a\n')
        self.assertEqual(struct.unpack('>II',png[16:24]), (1200,630))


if __name__ == '__main__': unittest.main()
