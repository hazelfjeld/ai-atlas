"""Packaging boundaries and exact public bytes, without Cloudflare credentials."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_cloudflare as build


class Packaging(unittest.TestCase):
    def test_allowlist_preserves_all_public_sections_and_excludes_repository_controls(self):
        paths = set(build.public_files())
        for path in ('index.html', 'games-tab.js', 'games-tab.css', 'games-core.js', 'whats-new.html', 'data/daily/index.json', 'terms/MLD-0691-machine-learning.html', 'downloads/atlas_catalog.sqlite'):
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
