#!/usr/bin/env python3
"""Validate Atlas's incremental publication and optionally compare GitHack bytes."""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import os
from functools import lru_cache
import sqlite3
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE_KINDS = ('papers', 'alerts')


def read_batch(item: dict, kind: str, ids: set[str], paths: set[str]) -> list[dict]:
    path = item['path']
    assert re.fullmatch(rf'data/{kind}-[0-9]{{2}}\.json', path), path
    assert path not in paths, f'Duplicate path: {path}'
    assert item['kind'] == kind, f'Unexpected catalog kind: {path}'
    paths.add(path)
    blob = (ROOT / path).read_bytes()
    assert len(blob) == item['bytes'], f'Byte count mismatch: {path}'
    assert hashlib.sha256(blob).hexdigest() == item['sha256'], f'Checksum mismatch: {path}'
    records = json.loads(blob)
    assert isinstance(records, list) and len(records) == item['count'], path
    for record in records:
        assert isinstance(record, dict) and isinstance(record.get('id'), str), path
        assert record['id'] not in ids, f'Duplicate ID: {record["id"]}'
        ids.add(record['id'])
        if kind == 'playbooks':
            assert re.fullmatch(r'PB-[0-9]{2}', record['id']), path
            for key in ('title', 'problem', 'rationale', 'first_step', 'validation', 'caveat', 'status'):
                assert isinstance(record.get(key), str) and record[key], f'{path}: {key}'
            for key in ('tags', 'technologies', 'technology_ids'):
                assert isinstance(record.get(key), list), f'{path}: {key}'
            assert len(record['technologies']) == len(record['technology_ids']), path
            assert all(isinstance(t, str) and t for t in record['technologies']), path
            assert all(re.fullmatch(r'TECH-[0-9]{4}', t) for t in record['technology_ids']), path
        elif kind == 'terms':
            assert re.fullmatch(r'MLD-[0-9]{4}', record['id']), path
            for key in ('term', 'definition', 'topic', 'example', 'caveat', 'reference_url'):
                assert isinstance(record.get(key), str) and record[key], f'{path}: {key}'
            for key in ('aliases', 'related_ids', 'source_ids'):
                assert isinstance(record.get(key), list), f'{path}: {key}'
        elif kind == 'technologies':
            assert re.fullmatch(r'TECH-[0-9]{4}', record['id']), path
            for key in ('name', 'what', 'edge', 'best_for', 'watch_out', 'source_url', 'evidence_status'):
                assert isinstance(record.get(key), str) and record[key], f'{path}: {key}'
            for key in ('concept_ids', 'alternative_ids'):
                assert isinstance(record.get(key), list), f'{path}: {key}'
        else:
            for key in ('title', 'summary', 'caveat', 'source_url', 'review_status'):
                assert isinstance(record.get(key), str) and record[key], f'{path}: {key}'
            assert isinstance(record.get('tags'), list), path
            assert urllib.parse.urlparse(record['source_url']).scheme == 'https', path
    return records


def validate() -> dict:
    manifest = json.loads((ROOT / 'publication.json').read_text(encoding='utf-8'))
    assert manifest['schema'] == 1, 'Unsupported schema'
    assert manifest['automatic_refresh_active'] is False, 'Do not claim a live collector'
    counts = collections.Counter()
    ids: set[str] = set()
    paths: set[str] = set()
    assert isinstance(manifest.get('files'), list), 'Missing research catalog'
    for item in manifest['files']:
        kind = item['kind']
        assert kind in BASE_KINDS, f'Unexpected kind in main catalog: {kind}'
        counts[kind] += len(read_batch(item, kind, ids, paths))
    for kind in BASE_KINDS:
        assert counts[kind] == manifest['published_counts'][kind], f'Wrong count: {kind}'
    extensions = manifest.get('extensions', {})
    assert isinstance(extensions, dict), 'Invalid extension catalog'
    playbook_files = extensions.get('playbooks', [])
    assert isinstance(playbook_files, list), 'Invalid playbook extension'
    for item in playbook_files:
        counts['playbooks'] += len(read_batch(item, 'playbooks', ids, paths))
    assert counts['playbooks'] == manifest['published_counts']['playbooks'], 'Wrong playbook count'
    catalogs = {}
    for kind in ('technologies', 'terms'):
        catalogs[kind] = [r for item in extensions.get(kind, []) for r in read_batch(item, kind, ids, paths)]
        counts[kind] = len(catalogs[kind])
        assert counts[kind] == manifest['published_counts'][kind], f'Wrong {kind} count'
    for file in manifest.get('support_files', []):
        assert re.fullmatch(r'(data|downloads)/[A-Za-z0-9_.-]+', file['path']), file['path']
        blob = (ROOT / file['path']).read_bytes()
        assert len(blob) == file['bytes'] and hashlib.sha256(blob).hexdigest() == file['sha256'], file['path']
    if counts['terms']:
        term_ids = {r['id'] for r in catalogs['terms']}
        tech_ids = {r['id'] for r in catalogs['technologies']}
        for r in catalogs['terms']:
            assert set(r['related_ids']) <= term_ids, r['id']
        for r in catalogs['technologies']:
            assert set(r['concept_ids']) <= term_ids and set(r['alternative_ids']) <= tech_ids, r['id']
        for item in playbook_files:
            for r in json.loads((ROOT / item['path']).read_bytes()):
                assert set(r['technology_ids']) <= tech_ids, r['id']
        with sqlite3.connect('file:' + (ROOT / 'downloads/atlas_catalog.sqlite').as_posix() + '?mode=ro', uri=True) as db:
            assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            assert not db.execute('PRAGMA foreign_key_check').fetchall()
            assert db.execute('SELECT count(*) FROM records').fetchone()[0] == sum(counts.values())
            for kind, rows in catalogs.items():
                for r in rows:
                    assert json.loads(db.execute('SELECT record_json FROM records WHERE id=?', (r['id'],)).fetchone()[0]) == r, r['id']
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'app.css' in html and 'catalog-loader.js' in html and 'app.js' in html, 'Workspace entry point missing'
    for path in ('app.css', 'app.js', 'core.js', 'catalog-loader.js'):
        assert (ROOT / path).stat().st_size > 100, path
    if counts['playbooks']:
        page = (ROOT / 'playbooks.html').read_text(encoding='utf-8')
        assert 'playbooks.js' in page and 'checkpoint.css' in page, 'Missing playbook assets'
        assert (ROOT / 'playbooks.js').stat().st_size > 100, 'Missing playbook loader'
    report = {'catalog_checks': 'passed', 'counts': dict(counts), 'files': len(paths), 'automatic_refresh_active': False}
    if manifest.get('encyclopedia'):
        pages = json.loads((ROOT / 'terms/manifest.json').read_bytes())
        assert len(pages) == counts['terms'] == manifest['encyclopedia']['linked_term_count']
        assert set(pages) == {r['id'] for r in catalogs['terms']}
        for item in pages.values():
            assert re.fullmatch(r'terms/MLD-[0-9]{4}-[a-z0-9-]+\.html', item['path'])
            assert hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
        assert sum(p['expanded'] for p in pages.values()) == manifest['encyclopedia']['detailed_page_count']
        report['term_pages'] = len(pages)
        report['expanded_guides'] = sum(p['expanded'] for p in pages.values())
    report['internal_links_checked'] = validate_links()
    return report


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if 'id' in values:
            assert values['id'] not in self.ids, 'Duplicate HTML ID: ' + values['id']
            self.ids.add(values['id'])
        for key in ('href', 'src'):
            if key in values:
                self.links.append(values[key])


def validate_links():
    parsed = {}
    for path in [*ROOT.glob('*.html'), *ROOT.glob('terms/*.html')]:
        page = Links()
        page.feed(path.read_text(encoding='utf-8'))
        parsed[path.absolute()] = page
    checked = 0
    routes = {'papers', 'alerts', 'coverage', 'overview', 'technologies', 'dictionary', 'safety', 'playbooks', 'compare', 'saved', 'sources', 'search', 'queue', 'terms'}
    @lru_cache(maxsize=None)
    def local_target(parent, relative):
        target = Path(os.path.abspath(parent / urllib.parse.unquote(relative)))
        assert target.is_relative_to(ROOT), target
        assert target.is_file(), f'Missing local destination: {target}'
        return target
    for path, page in parsed.items():
        for link in page.links:
            u = urllib.parse.urlsplit(link)
            assert u.scheme in ('', 'http', 'https', 'data'), (path, link)
            if u.scheme or u.netloc:
                continue
            target = local_target(path.parent, u.path) if u.path else path
            if u.fragment and target in parsed:
                route = u.fragment.lstrip('/').split('?')[0]
                assert u.fragment in parsed[target].ids or route in routes, f'Broken anchor: {path.name}: {link}'
            checked += 1
    return checked


def check_remote(base: str, manifest: dict) -> dict:
    parsed = urllib.parse.urlparse(base)
    assert parsed.scheme == 'https' and parsed.hostname in ('raw.githack.com', 'rawcdn.githack.com'), 'Unsupported host'
    assert parsed.path.startswith('/hazelfjeld/ai-atlas/'), 'Unexpected repository'
    base = base.rstrip('/') + '/'
    files = ['index.html', 'app.css', 'app.js', 'core.js', 'catalog-loader.js', 'checkpoint.css', 'checkpoint.js', 'research.html', 'demo.html', 'publication.json', 'downloads/Atlas_Demo_Offline.html'] + [f['path'] for f in manifest['files']]
    if manifest.get('published_counts', {}).get('playbooks'):
        files += ['playbooks.html', 'playbooks.js'] + [f['path'] for f in manifest.get('extensions', {}).get('playbooks', [])]
    for kind in ('terms', 'technologies'):
        files += [f['path'] for f in manifest['extensions'].get(kind, [])]
    files += [f['path'] for f in manifest.get('support_files', [])]
    if manifest.get('encyclopedia'):
        files += ['terms/index.html', 'terms/manifest.json']
        pages = json.loads((ROOT / 'terms/manifest.json').read_bytes())
        files += [v['path'] for v in pages.values() if v['expanded']]
        files += [list(pages.values())[0]['path'], list(pages.values())[-1]['path']]
    def check(path):
        request = urllib.request.Request(base + path, headers={'User-Agent': 'Atlas-publication-integrity-check/1.1'})
        with urllib.request.urlopen(request, timeout=25) as response:
            assert response.status == 200, f'HTTP error: {path}'
            body = response.read((ROOT / path).stat().st_size + 1)
            content_type = response.headers.get_content_type()
        assert body == (ROOT / path).read_bytes(), f'Remote bytes differ or confirmation page returned: {path}'
        if path.endswith('.html'):
            assert content_type == 'text/html', f'Wrong HTML content type: {content_type}'
        if path.endswith('.js'):
            assert content_type in ('text/javascript', 'application/javascript'), f'Wrong JS content type: {content_type}'
        print(f'OK {base + path}', flush=True)
        return path
    with ThreadPoolExecutor(max_workers=6) as pool:
        checked = list(pool.map(check, dict.fromkeys(files)))
    return {'remote_http_checks': 'passed', 'base': base, 'verified_files': checked, 'browser_interaction_tested': False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remote-base')
    parser.add_argument('--report', type=Path, help='Save the completed verification report as JSON')
    args = parser.parse_args()
    report = validate()
    if args.remote_base:
        report.update(check_remote(args.remote_base, json.loads((ROOT / 'publication.json').read_text())))
    else:
        report['remote_http_checks'] = 'not run'
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
