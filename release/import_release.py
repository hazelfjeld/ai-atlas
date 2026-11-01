#!/usr/bin/env python3
"""Restore the one-time, checksum-verified Atlas import; never fetch network data."""
from pathlib import Path, PurePosixPath
import base64
import hashlib
import io
import json
import lzma
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'release'

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def safe(name: str) -> str:
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name or any(x in p.parts for x in ('.git', '.github', 'release')):
        raise ValueError(f'Unsafe import path: {name}')
    return str(p)

def main() -> None:
    if (ROOT / '.atlas-imported.json').exists():
        print('This release was already imported. Existing files are not overwritten.')
        return
    m = json.loads((RELEASE / 'manifest.json').read_text())
    if m.get('schema') != 1 or len(m['parts']) > 100:
        raise ValueError('Invalid release manifest')
    pieces = []
    for entry in m['parts']:
        name = entry['path']
        if not name.startswith('release/part-') or not name.endswith('.bin') or '..' in name:
            raise ValueError('Invalid part path')
        piece = (ROOT / name).read_bytes()
        if len(piece) != entry['length'] or digest(piece) != entry['sha256']:
            raise ValueError(f'Corrupt transport part: {name}')
        pieces.append(piece)
    compressed = b''.join(pieces)
    if len(compressed) != m['decoded_bytes'] or digest(compressed) != m['payload_sha256']:
        raise ValueError('Release checksum mismatch')
    decoder = lzma.LZMADecompressor(memlimit=200_000_000)
    raw = decoder.decompress(compressed, max_length=50_000_001)
    if len(raw) != m['tar_bytes'] or len(raw) > 50_000_000 or not decoder.eof:
        raise ValueError('Invalid decompressed release size')
    with tempfile.TemporaryDirectory(prefix='atlas-import-') as folder:
        stage = Path(folder)
        with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as archive:
            for item in archive.getmembers():
                name = safe(item.name)
                if not item.isfile() or item.size > 12_000_000:
                    raise ValueError('Only bounded regular files may be imported')
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(item).read())
        package = json.loads((stage / '_package.json').read_text())
        if package.get('schema') != 1:
            raise ValueError('Unknown package schema')
        for name, sha in package['files'].items():
            if digest((stage / safe(name)).read_bytes()) != sha:
                raise ValueError(f'Package file checksum mismatch: {name}')
        # Recompress the original workbook XML without altering cells or formulas.
        for name, spec in package['workbooks'].items():
            dest = stage / safe(name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(dest, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as book:
                book.comment = base64.b64decode(spec['comment'])
                for entry in spec['members']:
                    data = (stage / safe(entry['blob'])).read_bytes()
                    if digest(data) != entry['sha256']:
                        raise ValueError('Workbook member mismatch')
                    props = entry['props']
                    info = zipfile.ZipInfo(props['filename'], tuple(props['date_time']))
                    for k, v in props.items():
                        if k not in ('filename', 'date_time', 'comment', 'extra'):
                            setattr(info, k, v)
                    info.comment = base64.b64decode(props['comment'])
                    info.extra = base64.b64decode(props['extra'])
                    book.writestr(info, data, compresslevel=9)
            with zipfile.ZipFile(dest) as book:
                for entry in spec['members']:
                    if digest(book.read(entry['props']['filename'])) != entry['sha256']:
                        raise ValueError('Rebuilt workbook failed verification')
        # All source validation precedes any workspace changes.
        for p in stage.rglob('*'):
            if not p.is_file():
                continue
            name = p.relative_to(stage).as_posix()
            if name == '_package.json' or name.startswith('_workbooks/'):
                continue
            dest = ROOT / safe(name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(p, dest)
    for group, expected in m['expected_counts'].items():
        rows = json.loads((ROOT / 'app/public/data' / (group + '.json')).read_text())
        if len(rows) != expected:
            raise ValueError(f'Unexpected {group} count')
    subprocess.run([sys.executable, str(ROOT / 'scripts/build_site.py')], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / 'publish.py'), '--check'], cwd=ROOT, check=True)
    report = {'schema': 1, 'payload_sha256': m['payload_sha256'], 'counts': m['expected_counts'], 'automatic_refresh_active': False, 'workbook_xml_checks': 'passed', 'index_sha256': digest((ROOT / 'index.html').read_bytes())}
    (ROOT / '.atlas-imported.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
