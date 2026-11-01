#!/usr/bin/env python3
"""Import the explicitly approved Atlas ZIP after a browser upload to this repo.
No downloads, secrets, arbitrary archives, or remote code execution endpoints.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APPROVED_SHA256 = '1f1b648e113cec13583217e9ae363def0028506706eed28a7f1f6b9cd4793125'
APPROVED_BYTES = 11980402
EXPECTED = {'technologies': 300, 'terms': 1345, 'playbooks': 20, 'papers': 30, 'alerts': 10}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    marker = ROOT / '.atlas-imported.json'
    if marker.exists():
        print('The approved package was already imported; no files changed.')
        return
    candidates = [ROOT / name for name in ('Atlas_GitHub_GitHack_Ready.zip', 'source-upload.zip')]
    existing = [p for p in candidates if p.is_file()]
    if len(existing) != 1:
        raise ValueError('Upload exactly one Atlas_GitHub_GitHack_Ready.zip at the repository root.')
    archive = existing[0]
    if archive.stat().st_size != APPROVED_BYTES or sha256(archive) != APPROVED_SHA256:
        raise ValueError('Archive differs from the approved ChatGPT package. Nothing was imported.')
    with tempfile.TemporaryDirectory(prefix='atlas-approved-import-') as folder:
        stage = Path(folder)
        with zipfile.ZipFile(archive) as z:
            if len(z.infolist()) > 100 or sum(i.file_size for i in z.infolist()) > 50_000_000:
                raise ValueError('Unexpected archive size.')
            seen = set()
            for item in z.infolist():
                source = PurePosixPath(item.filename)
                if source.is_absolute() or '..' in source.parts or '\\' in item.filename or ':' in item.filename:
                    raise ValueError('Unsafe archive path.')
                if not source.parts or source.parts[0] != 'ai-atlas':
                    raise ValueError('Unexpected archive root.')
                rel = PurePosixPath(*source.parts[1:])
                if any(p in ('.git', '.github', 'release') for p in rel.parts):
                    raise ValueError('Archive cannot replace repository controls.')
                if item.is_dir():
                    continue
                if not rel.parts or str(rel) in seen or stat.S_ISLNK(item.external_attr >> 16):
                    raise ValueError('Duplicate or unsafe archive entry.')
                seen.add(str(rel))
                target = stage / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(z.read(item))
        manifest = json.loads((stage / 'publish-manifest.json').read_text())
        if manifest.get('schema') != 1:
            raise ValueError('Unknown publication manifest.')
        for name, expected in manifest['files'].items():
            rel = PurePosixPath(name)
            if rel.is_absolute() or '..' in rel.parts or name not in seen:
                raise ValueError('Manifest points outside the approved package.')
            if sha256(stage / rel) != expected:
                raise ValueError('Manifest mismatch: ' + name)
        for group, expected in EXPECTED.items():
            rows = json.loads((stage / 'app/public/data' / (group + '.json')).read_text())
            if len(rows) != expected:
                raise ValueError('Unexpected catalog count: ' + group)
        subprocess.run([sys.executable, str(stage / 'publish.py'), '--check'], cwd=stage, check=True)
        # Validation completes before any repository files are replaced.
        for path in stage.rglob('*'):
            if not path.is_file():
                continue
            rel = path.relative_to(stage)
            # Keep the current deployment README; retain the original separately.
            if rel.as_posix() == 'README.md':
                rel = Path('docs/ORIGINAL_PACKAGE_README.md')
            target = ROOT / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
    meta_path = ROOT / 'app/public/data/meta.json'
    meta = json.loads(meta_path.read_text())
    meta['deployment_status'] = 'Published to GitHub for static GitHack serving; automatic refresh inactive'
    meta['automatic_refresh_active'] = False
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_site.py')], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / 'publish.py'), '--check'], cwd=ROOT, check=True)
    report = {'schema': 2, 'archive_sha256': APPROVED_SHA256, 'counts': EXPECTED,
              'index_sha256': sha256(ROOT / 'index.html'), 'automatic_refresh_active': False,
              'status': 'Imported and locally validated; workflow must still pass tests and push.'}
    marker.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
