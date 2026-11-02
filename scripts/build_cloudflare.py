#!/usr/bin/env python3
"""Package only validated public Atlas assets; never deploy the repository root."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tempfile

from validate_checkpoint import validate

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/cloudflare'
MAX_FILES, MAX_BYTES = 20_000, 25 * 1024 * 1024


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def source_path(relative):
    rel = PurePosixPath(relative)
    assert relative and not rel.is_absolute() and '..' not in rel.parts and '\\' not in relative
    assert re.fullmatch(r'[A-Za-z0-9_./-]+', relative), relative
    path = ROOT / relative
    assert path.resolve().is_relative_to(ROOT) and path.is_file(), relative
    assert not any(p.is_symlink() for p in [path, *path.parents]), relative
    return path


def public_files():
    config = json.loads((ROOT / 'deploy/public-files.json').read_bytes())
    files = set(config['root_files'])
    actual_root = {p.name for pattern in ('*.html', '*.css', '*.js') for p in ROOT.glob(pattern)}
    assert actual_root == files - {'publication.json'}, 'Update the explicit public root allowlist before publishing a new root asset'
    publication = json.loads((ROOT / 'publication.json').read_bytes())
    batches = publication['files'] + [f for group in publication['extensions'].values() for f in group]
    for item in batches + publication['support_files']:
        assert re.fullmatch(r'(data|downloads)/[A-Za-z0-9_.-]+', item['path']), item['path']
        files.add(item['path'])
    files.update(config['extra_downloads'])
    pages = json.loads((ROOT / 'terms/manifest.json').read_bytes())
    files.update(('terms/index.html', 'terms/manifest.json'))
    for item in pages.values():
        assert re.fullmatch(r'terms/MLD-\d{4}-[a-z0-9-]+\.html', item['path']), item['path']
        files.add(item['path'])
    files.update(('data/daily/index.json', 'data/daily/published-batches.json'))
    daily = json.loads((ROOT / 'data/daily/index.json').read_bytes())
    files.update(item['path'] for item in daily['editions'])
    return sorted(files)


def build(revision=None):
    validation = validate()
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    revision = revision or head
    assert revision == head and re.fullmatch('[0-9a-f]{40}', revision), 'Build must identify the checked-out commit'
    files = public_files()
    assert len(files) + 3 <= MAX_FILES, 'Workers Free static asset file limit exceeded'
    # The only recursive replacement is this fixed, checked workspace output directory.
    assert OUTPUT.resolve() == ROOT / 'dist/cloudflare' and not OUTPUT.is_symlink()
    OUTPUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-package-', dir=OUTPUT.parent) as temporary:
        stage = Path(temporary)
        metadata = []
        for name in files:
            blob = source_path(name).read_bytes()
            assert len(blob) <= MAX_BYTES, f'Workers Free per-asset limit exceeded: {name}'
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(blob)
            metadata.append({'path': name, 'bytes': len(blob), 'sha256': sha(blob)})
        # Keep literal .html routes and every hash route; only / is internally rewritten.
        (stage / '_redirects').write_bytes(b'/ /index.html 200\n')
        (stage / '_headers').write_bytes((f'/*\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Content-Type-Options: nosniff\n  X-Atlas-Revision: {revision}\n').encode())
        report = {'schema': 1, 'revision': revision, 'files': metadata,
                  'counts': validation['counts'], 'term_pages': validation['term_pages'],
                  'daily': validation['daily'], 'cache_policy': 'public, max-age=0, must-revalidate'}
        (stage / 'deployment.json').write_bytes((json.dumps(report, indent=2) + '\n').encode())
        if OUTPUT.exists():
            shutil.rmtree(OUTPUT)
        shutil.copytree(stage, OUTPUT)
    print(json.dumps({'revision': revision, 'public_files': len(files), 'bytes': sum(x['bytes'] for x in metadata), 'output': str(OUTPUT)}))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision')
    build(parser.parse_args().revision)
