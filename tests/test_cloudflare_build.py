"""Packaging boundaries and exact public bytes, without Cloudflare credentials."""
import io
from http.client import RemoteDisconnected
from urllib.error import HTTPError
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_cloudflare as build
import verify_cloudflare as verifier


class Packaging(unittest.TestCase):
    def test_allowlist_preserves_all_public_sections_and_excludes_repository_controls(self):
        paths = set(build.public_files())
        for path in ('index.html', 'games-tab.js', 'games-tab.css', 'games-core.js', 'whats-new.html', 'data/daily/index.json', 'terms/MLD-0691-machine-learning.html', 'downloads/atlas_catalog.sqlite', 'content/technology-release-updates.json'):
            self.assertIn(path, paths)
        for path in paths:
            self.assertFalse(path.startswith(('.git', 'scripts/', 'tests/', 'release/', 'docs/', 'daily-queue/', 'node_modules/')))
        self.assertNotIn('README.md', paths)
        self.assertNotIn('package.json', paths)

    def test_source_paths_reject_traversal_and_absolute_paths(self):
        for path in ('../README.md', '/etc/passwd', 'C:/secret', 'data/../../secret', 'data\\secret'):
            with self.assertRaises(AssertionError):
                build.source_path(path)

    def test_incomplete_uploads_are_not_published_and_new_root_assets_require_allowlisting(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ('deploy', 'data/daily', 'terms', 'daily-queue'):
                (root / name).mkdir(parents=True, exist_ok=True)
            fixtures = {
                'deploy/public-files.json': {'root_files': ['index.html', 'publication.json'], 'extra_downloads': []},
                'publication.json': {'files': [], 'extensions': {}, 'support_files': []},
                'terms/manifest.json': {}, 'data/daily/index.json': {'editions': []},
                'data/uncommitted-batch.json': {'private': True}, 'daily-queue/index.json': {'pending': True}}
            for name, value in fixtures.items():
                (root / name).write_text(json.dumps(value))
            (root / 'index.html').write_text('<h1>Atlas</h1>')
            with patch.object(build, 'ROOT', root):
                paths = build.public_files()
                self.assertNotIn('data/uncommitted-batch.json', paths)
                self.assertNotIn('daily-queue/index.json', paths)
                (root / 'unfinished.html').write_text('incomplete')
                with self.assertRaisesRegex(AssertionError, 'allowlist'):
                    build.public_files()

    def test_provenance_retries_stale_cloudflare_edge_without_accepting_it(self):
        expected = {'revision': 'new', 'files': [{'path': 'index.html'}]}
        observed = [{'revision': 'old'}, expected]
        calls, pauses = [], []
        def request(path, headers):
            self.assertEqual(path, 'deployment.json')
            self.assertEqual(headers.get('Cache-Control'), 'no-cache')
            calls.append(path)
            return io.BytesIO(json.dumps(observed.pop(0)).encode())
        verifier.await_provenance(request, expected, attempts=3, interval=0, pause=pauses.append)
        self.assertEqual(len(calls), 2)
        self.assertEqual(pauses, [0])

    def test_provenance_rejects_persistent_incorrect_revision(self):
        expected = {'revision': 'new'}
        calls = []
        def stale(path, headers):
            calls.append(path)
            return io.BytesIO(b'{"revision":"old"}')
        with self.assertRaisesRegex(AssertionError, 'Deployment provenance differs'):
            verifier.await_provenance(stale, expected, attempts=3, interval=0, pause=lambda _: None)
        self.assertEqual(len(calls), 3)

    def test_stale_asset_header_retries_and_requires_exact_revision(self):
        attempts, pauses, responses = [], [], []

        class EdgeResponse(io.BytesIO):
            def __init__(self, revision):
                super().__init__(b'validated-later')
                self.headers = {'X-Atlas-Revision': revision}

        def request(path, extra=None):
            attempts.append((path, extra))
            response = EdgeResponse('old' if len(attempts) < 2 else 'new')
            responses.append(response)
            return response

        with verifier.open_current_revision(request, 'app.js', 'new',
                                            attempts=3, interval=0, pause=pauses.append) as response:
            self.assertEqual(response.headers['X-Atlas-Revision'], 'new')
            self.assertEqual(response.read(), b'validated-later')
        self.assertEqual(attempts, [('app.js', None),
                                    ('app.js', {'Cache-Control': 'no-cache'})])
        self.assertTrue(responses[0].closed)
        self.assertEqual(pauses, [0])

    def test_persistent_stale_asset_header_never_passes(self):
        attempts, responses = [], []

        class StaleResponse(io.BytesIO):
            headers = {'X-Atlas-Revision': 'old'}

        def stale(path, extra=None):
            attempts.append((path, extra))
            response = StaleResponse(b'irrelevant-old-body')
            responses.append(response)
            return response

        with self.assertRaisesRegex(AssertionError, 'Asset revision still stale'):
            verifier.open_current_revision(stale, 'data/example.json', 'new',
                                           attempts=3, interval=0, pause=lambda _: None)
        self.assertEqual(len(attempts), 3)
        self.assertTrue(all(response.closed for response in responses))

    def test_transient_disconnects_retry_without_skipping_byte_verification(self):
        calls, sleeps = [], []
        def flaky(request, timeout):
            self.assertEqual(timeout, 40)
            self.assertEqual(request.full_url, 'https://aiupdates.app/app.js')
            calls.append(request.full_url)
            if len(calls) < 3:
                raise RemoteDisconnected('edge closed before HTTP response')
            return io.BytesIO(b'exact-byte-content')
        with verifier.open_with_retry(
            'https://aiupdates.app/app.js', {'Accept-Encoding': 'identity'},
            attempts=3, pause=sleeps.append, opener=flaky,
        ) as response:
            self.assertEqual(response.read(), b'exact-byte-content')
        self.assertEqual(len(calls), 3)
        self.assertEqual(sleeps, [0.5, 1.0])

    def test_transient_retry_exhaustion_and_http_errors_are_never_accepted(self):
        calls = []
        def disconnected(request, timeout):
            calls.append(request.full_url)
            raise RemoteDisconnected('edge closed connection')
        with self.assertRaises(RemoteDisconnected):
            verifier.open_with_retry('https://aiupdates.app/data/daily/index.json', {},
                                     attempts=2, pause=lambda _: None, opener=disconnected)
        self.assertEqual(len(calls), 2)
        failures = []
        def missing(request, timeout):
            failures.append(request.full_url)
            raise HTTPError(request.full_url, 404, 'Not Found', {}, None)
        with self.assertRaises(HTTPError):
            verifier.open_with_retry('https://aiupdates.app/not-served', {},
                                     attempts=3, pause=lambda _: None, opener=missing)
        self.assertEqual(len(failures), 1)

    def test_production_rerun_uses_original_validated_artifact(self):
        # A production-only rerun increments run_attempt, but the earlier
        # successful validation artifact retains its original attempt number.
        workflow = (ROOT / '.github/workflows/deploy-cloudflare.yml').read_text()
        upload = workflow.split('name: Preserve the exact tested deployment artifact', 1)[1].split(
            'name: Preserve pre-deployment verification', 1)[0]
        download = workflow.split('uses: actions/download-artifact@', 1)[1].split(
            '- id: current', 1)[0]
        self.assertIn('name: atlas-assets-${{ steps.revision.outputs.sha }}-${{ github.run_id }}', upload)
        self.assertIn('name: atlas-assets-${{ needs.validate.outputs.revision }}-${{ github.run_id }}', download)
        self.assertIn('overwrite: true', upload)
        self.assertNotIn('github.run_attempt', upload + download)

    def test_production_checks_worker_then_both_custom_domains(self):
        workflow = (ROOT / '.github/workflows/deploy-cloudflare.yml').read_text()
        block = workflow.split('name: Verify actual production assets, caching, navigation, Quiz and Match', 1)[1]
        worker = block.index('python3 scripts/verify_cloudflare.py --base https://ai-atlas.airheadhazelnut.workers.dev/')
        apex = block.index('python3 scripts/verify_cloudflare.py --base "$PRODUCTION_URL/"')
        www = block.index('python3 scripts/verify_cloudflare.py --base https://www.aiupdates.app/')
        self.assertLess(worker, apex)
        self.assertLess(apex, www)

    def test_config_is_static_only_and_keeps_literal_html_routes(self):
        config = json.loads((ROOT / 'wrangler.json').read_bytes())
        self.assertEqual(config['assets']['directory'], './dist/cloudflare')
        self.assertEqual(config['assets']['html_handling'], 'none')
        self.assertEqual(config['assets']['not_found_handling'], 'none')
        self.assertNotIn('main', config)
        for key in ('routes', 'route', 'triggers', 'r2_buckets', 'd1_databases'):
            self.assertNotIn(key, config)


if __name__ == '__main__':
    unittest.main()
