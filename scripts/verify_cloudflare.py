#!/usr/bin/env python3
"""Verify actual deployed bytes, catalog coherence, caching, downloads and routing."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.client import RemoteDisconnected
import hashlib
import json
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def open_with_retry(url, headers, attempts=3, pause=time.sleep, opener=None):
    """Retry only transient transport failures; never conceal HTTP errors or bad bytes.

    CDN edge connections may close before a response arrives under parallel
    verification. A bounded new connection is safe, unlike accepting stale data.
    """
    assert attempts >= 1
    opener = opener or urlopen
    for attempt in range(attempts):
        try:
            return opener(Request(url, headers=headers), timeout=40)
        except HTTPError:
            raise  # 404 and 304 are intentional assertions downstream.
        except (URLError, RemoteDisconnected, ConnectionError, TimeoutError):
            if attempt + 1 == attempts:
                raise
            pause(0.5 * (attempt + 1))


def await_provenance(request, expected, attempts=12, interval=4, pause=time.sleep):
    """Wait briefly for exact Cloudflare edge propagation; never accept stale bytes."""
    assert attempts >= 1
    last = 'not yet checked'
    for attempt in range(attempts):
        try:
            with request('deployment.json', {'Cache-Control': 'no-cache'}) as response:
                remote = json.loads(response.read())
            if remote == expected:
                return
            last = 'remote revision ' + repr(remote.get('revision') if isinstance(remote, dict) else '<invalid>')
        except (HTTPError, URLError, ValueError) as error:
            last = type(error).__name__ + ': ' + str(error)
        if attempt + 1 < attempts:
            print('Awaiting exact deployment provenance: check '
                  + str(attempt + 1) + '/' + str(attempts)
                  + ', observed ' + last, flush=True)
            pause(interval)
    raise AssertionError('Deployment provenance differs from the tested artifact after '
                         + str(attempts) + ' checks: ' + last)


def open_current_revision(request, path, revision, attempts=5, interval=2, pause=time.sleep):
    """Retry a stale edge revision, but never accept one or skip byte verification."""
    assert attempts >= 1
    observed = None
    for attempt in range(attempts):
        response = request(path, {'Cache-Control': 'no-cache'} if attempt else None)
        observed = response.headers.get('X-Atlas-Revision')
        if observed == revision:
            return response
        response.close()
        if attempt + 1 < attempts:
            print('Stale asset revision for ' + (path or '/') + ': '
                  + repr(observed) + '; retry ' + str(attempt + 1)
                  + '/' + str(attempts), flush=True)
            pause(interval)
    raise AssertionError('Asset revision still stale after ' + str(attempts)
                         + ' checks: ' + (path or '/') + ', observed ' + repr(observed))


def verify(base, directory, revision):
    u = urlsplit(base)
    assert u.scheme == 'https' or (u.scheme == 'http' and u.hostname in ('localhost', '127.0.0.1'))
    assert not u.username and not u.password and not u.query and not u.fragment
    base = base.rstrip('/') + '/'
    manifest = json.loads((directory / 'deployment.json').read_bytes())
    assert manifest['revision'] == revision
    entries = {f['path']: f for f in manifest['files']}

    def request(path, extra=None):
        headers = {'User-Agent': 'Atlas-Cloudflare-verification/1.0', 'Accept-Encoding': 'identity'}
        headers.update(extra or {})
        return open_with_retry(base + path, headers)

    await_provenance(request, manifest)

    def check(path):
        expected = entries[path]
        with open_current_revision(request, path, revision) as response:
            body = response.read(expected['bytes'] + 1)
            assert response.status == 200 and response.url == base + path, path
            assert len(body) == expected['bytes'] and hashlib.sha256(body).hexdigest() == expected['sha256'], 'Mixed/incomplete asset: ' + path
            cache = response.headers.get('Cache-Control', '')
            assert 'max-age=0' in cache and 'must-revalidate' in cache and 'no-transform' in cache, (path, cache)
            assert response.headers.get('X-Atlas-Revision') == revision, path
            assert response.headers.get('ETag'), 'Missing ETag: ' + path
            mime = response.headers.get_content_type()
            if path.endswith('.html'):
                assert mime == 'text/html', (path, mime)
            if path.endswith('.js'):
                assert mime in ('text/javascript', 'application/javascript'), (path, mime)
        return path

    # Every catalog/support/download/runtime file; all expanded guides plus two references.
    paths = [p for p in entries if not p.startswith('terms/')]
    pages = json.loads((directory / 'terms/manifest.json').read_bytes())
    paths += ['terms/index.html', 'terms/manifest.json']
    paths += [p['path'] for p in pages.values() if p['expanded']]
    paths += [list(pages.values())[0]['path'], list(pages.values())[-1]['path']]
    with ThreadPoolExecutor(max_workers=4) as pool:
        checked = list(pool.map(check, dict.fromkeys(paths)))
    with request('') as response:
        assert response.status == 200 and response.read() == (directory / 'index.html').read_bytes(), 'Homepage rewrite failed'
    with request('publication.json') as response:
        etag = response.headers['ETag']
    try:
        with request('publication.json', {'If-None-Match': etag}) as response:
            raise AssertionError('ETag revalidation did not return 304')
    except HTTPError as error:
        assert error.code == 304, error.code
    for missing in ('atlas-nonexistent-file.txt', 'README.md', 'package.json', 'wrangler.json', '.github/workflows/deploy-cloudflare.yml', 'daily-queue/index.json'):
        try:
            request(missing).close()
            raise AssertionError('Non-public or missing path was served: ' + missing)
        except HTTPError as error:
            assert error.code == 404, (missing, error.code)
    return {'revision': revision, 'base': base, 'verified_files': checked, 'http_checks': 'passed',
            'cache_revalidation': '304', 'private_paths': '404', 'counts': manifest['counts'],
            'daily': manifest['daily'], 'browser_checks': 'reported separately'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--directory', type=Path, default=ROOT / 'dist/cloudflare')
    parser.add_argument('--output', type=Path, default=ROOT / 'deployment-validation/http.json')
    args = parser.parse_args()
    report = verify(args.base, args.directory, args.revision)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({**report, 'verified_files': len(report['verified_files'])}, indent=2))
