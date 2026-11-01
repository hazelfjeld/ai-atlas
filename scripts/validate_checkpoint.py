#!/usr/bin/env python3
"""Validate the incremental snapshot; optionally compare GitHack bytes to this commit."""
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


def validate() -> dict:
    manifest = json.loads((ROOT / 'publication.json').read_text(encoding='utf-8'))
    assert manifest['schema'] == 1, 'Unsupported schema'
    assert manifest['automatic_refresh_active'] is False, 'Do not claim a live collector'
    counts = collections.Counter()
    ids = set()
    paths = set()
    for item in manifest['files']:
        path = item['path']
        assert re.fullmatch(r'data/(papers|alerts)-[0-9]{2}\.json', path), path
        assert path not in paths, f'Duplicate path: {path}'
        paths.add(path)
        blob = (ROOT / path).read_bytes()
        assert len(blob) == item['bytes'], f'Byte count mismatch: {path}'
        assert hashlib.sha256(blob).hexdigest() == item['sha256'], f'Checksum mismatch: {path}'
        records = json.loads(blob)
        assert isinstance(records, list) and len(records) == item['count'], path
        assert item['kind'] in ('papers', 'alerts'), item['kind']
        for record in records:
            assert record['id'] not in ids, f'Duplicate ID: {record["id"]}'
            ids.add(record['id'])
            for field in ('id', 'title', 'summary', 'caveat', 'source_url', 'review_status'):
                assert isinstance(record[field], str) and record[field], f'{path}: {field}'
            assert isinstance(record['tags'], list), path
            assert urllib.parse.urlparse(record['source_url']).scheme == 'https', path
        counts[item['kind']] += len(records)
    for kind in ('papers', 'alerts'):
        assert counts[kind] == manifest['published_counts'][kind], f'Wrong count: {kind}'
    for kind in ('technologies', 'terms', 'playbooks'):
        assert manifest['published_counts'][kind] == 0, f'Unpublished catalog claimed: {kind}'
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'checkpoint.css' in html and 'checkpoint.js' in html, 'Checkpoint entry point missing'
    for path in ('checkpoint.css', 'checkpoint.js'):
        assert (ROOT / path).stat().st_size > 100, path
    return {'catalog_checks': 'passed', 'counts': dict(counts), 'files': len(paths), 'automatic_refresh_active': False}


def check_remote(base: str, manifest: dict) -> dict:
    parsed = urllib.parse.urlparse(base)
    assert parsed.scheme == 'https' and parsed.hostname in ('raw.githack.com', 'rawcdn.githack.com'), 'Unsupported host'
    assert parsed.path.startswith('/hazelfjeld/ai-atlas/'), 'Unexpected repository'
    base = base.rstrip('/') + '/'
    files = ['index.html', 'checkpoint.css', 'checkpoint.js', 'publication.json'] + [f['path'] for f in manifest['files']]
    checked = []
    for path in files:
        request = urllib.request.Request(base + path, headers={'User-Agent': 'Atlas-publication-integrity-check/1.0'})
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
