#!/usr/bin/env python3
"""Stage deterministic, lossless Atlas glossary/technology chunks from approved ZIP."""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import zipfile

SOURCE_SHA256 = '1f1b648e113cec13583217e9ae363def0028506706eed28a7f1f6b9cd4793125'
SOURCE_ROOT = 'ai-atlas/app/public/data'
ID_REGEX = {
    'technologies': re.compile(r'TECH-[0-9]{4}\Z'),
    'terms': re.compile(r'MLD-[0-9]{4}\Z'),
}


def sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def build(archive: Path, kind: str, first: int, count: int) -> tuple[bytes, dict]:
    archive_bytes = archive.read_bytes()
    if sha256(archive_bytes) != SOURCE_SHA256:
        raise ValueError('Source ZIP checksum mismatch; refuse to import a different edition')
    with zipfile.ZipFile(archive) as source:
        rows = json.loads(source.read(f'{SOURCE_ROOT}/{kind}.json'))
    if not isinstance(rows, list) or first < 1 or count < 1 or first - 1 + count > len(rows):
        raise ValueError('Requested batch exceeds source catalog bounds')
    subset = rows[first - 1:first - 1 + count]
    pattern = ID_REGEX[kind]
    if any(not isinstance(item, dict) or not pattern.fullmatch(str(item.get('id', ''))) for item in subset):
        raise ValueError('One or more record IDs are malformed')
    if len({item['id'] for item in subset}) != len(subset):
        raise ValueError('Duplicate IDs in source batch')
    raw = (json.dumps(subset, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    meta = {
        'kind': kind,
        'count': len(subset),
        'first_id': subset[0]['id'],
        'last_id': subset[-1]['id'],
        'bytes': len(packed),
        'sha256': sha256(packed),
        'expanded_bytes': len(raw),
        'expanded_sha256': sha256(raw),
        'format': 'gzip-json',
    }
    assert json.loads(gzip.decompress(packed)) == subset
    return packed, meta


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True, help='Exact approved Atlas_GitHub_GitHack_Ready.zip')
    parser.add_argument('--kind', choices=sorted(ID_REGEX), required=True)
    parser.add_argument('--first', type=int, required=True, help='1-based first source record')
    parser.add_argument('--count', type=int, required=True)
    parser.add_argument('--output', type=Path, required=True, help='Destination .json.gz outside published data path')
    args = parser.parse_args()
    if args.output.suffixes[-2:] != ['.json', '.gz']:
        parser.error('--output must end in .json.gz')
    packed, meta = build(args.archive, args.kind, args.first, args.count)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('xb') as out:
        out.write(packed)
    meta['staged_path'] = str(args.output)
    print(json.dumps(meta, indent=2))
    print('NOTE: This is only a staged source chunk, not a published site catalog.')


if __name__ == '__main__':
    main()
