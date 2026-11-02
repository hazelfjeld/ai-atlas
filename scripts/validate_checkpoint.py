#!/usr/bin/env python3
"""Validate Atlas's incremental publication and optionally compare GitHack bytes."""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
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
    for kind in ('technologies', 'terms'):
        assert manifest['published_counts'][kind] == 0, f'Unpublished catalog claimed: {kind}'
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'checkpoint.css' in html and 'checkpoint.js' in html, 'Checkpoint entry point missing'
    for path in ('checkpoint.css', 'checkpoint.js'):
        assert (ROOT / path).stat().st_size > 100, path
    if counts['playbooks']:
        assert 'playbooks.html' in html, 'No route to published playbooks'
        page = (ROOT / 'playbooks.html').read_text(encoding='utf-8')
        assert 'playbooks.js' in page and 'checkpoint.css' in page, 'Missing playbook assets'
        assert (ROOT / 'playbooks.js').stat().st_size > 100, 'Missing playbook loader'
    return {'catalog_checks': 'passed', 'counts': dict(counts), 'files': len(paths), 'automatic_refresh_active': False}


def check_remote(base: str, manifest: dict) -> dict:
    parsed = urllib.parse.urlparse(base)
    assert parsed.scheme == 'https' and parsed.hostname in ('raw.githack.com', 'rawcdn.githack.com'), 'Unsupported host'
    assert parsed.path.startswith('/hazelfjeld/ai-atlas/'), 'Unexpected repository'
    base = base.rstrip('/') + '/'
    files = ['index.html', 'checkpoint.css', 'checkpoint.js', 'publication.json'] + [f['path'] for f in manifest['files']]
    if manifest.get('published_counts', {}).get('playbooks'):
        files += ['playbooks.html', 'playbooks.js'] + [f['path'] for f in manifest.get('extensions', {}).get('playbooks', [])]
    checked = []
    for path in files:
        request = urllib.request.Request(base + path, headers={'User-Agent': 'Atlas-publication-integrity-check/1.1'})
        with urllib.request.urlopen(request, timeout=25) as response:
            assert response.status == 200, f'HTTP error: {path}'
            body = response.read(2_000_001)
            content_type = response.headers.get_content_type()
        assert body == (ROOT / path).read_bytes(), f'Remote bytes differ or confirmation page returned: {path}'
        if path.endswith('.html'):
            assert content_type == 'text/html', f'Wrong HTML content type: {content_type}'
        if path.endswith('.js'):
            assert content_type in ('text/javascript', 'application/javascript'), f'Wrong JS content type: {content_type}'
        checked.append(path)
        print(f'OK {base + path}', flush=True)
    return {'remote_http_checks': 'passed', 'base': base, 'verified_files': checked, 'browser_interaction_tested': False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--remote-base')
    args = parser.parse_args()
    report = validate()
    if args.remote_base:
        report.update(check_remote(args.remote_base, json.loads((ROOT / 'publication.json').read_text())))
    else:
        report['remote_http_checks'] = 'not run'
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
