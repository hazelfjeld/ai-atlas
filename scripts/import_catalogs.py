#!/usr/bin/env python3
"""Recover original catalogs without replacing the working app. No archive code runs."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_SHA = '1f1b648e113cec13583217e9ae363def0028506706eed28a7f1f6b9cd4793125'
EXPECTED = {'terms': 1345, 'technologies': 300}


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('kind', choices=[*EXPECTED, 'support'])
    args = parser.parse_args()
    assert hashlib.sha256(args.archive.read_bytes()).hexdigest() == ARCHIVE_SHA, 'Wrong archive'
    with zipfile.ZipFile(args.archive) as archive:
        original = 'ai-atlas/app/public/'
        manifest = json.loads(archive.read('ai-atlas/publish-manifest.json'))
        for name, digest in manifest['files'].items():
            assert hashlib.sha256(archive.read('ai-atlas/' + name)).hexdigest() == digest, name
        # Prove that previously published content is preserved, including every field.
        publication = json.loads((ROOT / 'publication.json').read_text(encoding='utf-8'))
        for kind in ('papers', 'alerts', 'playbooks'):
            files = publication['files'] if kind != 'playbooks' else publication['extensions'][kind]
            actual = [r for f in files if f['kind'] == kind for r in json.loads((ROOT / f['path']).read_text(encoding='utf-8'))]
            assert actual == json.loads(archive.read(original + 'data/' + kind + '.json')), kind
        report_path = ROOT / 'release/catalog-import.json'
        report = json.loads(report_path.read_text()) if report_path.exists() else {'archive_sha256': ARCHIVE_SHA, 'catalogs': {}, 'support': []}
        if args.kind == 'support':
            names = ['data/' + n + '.json' for n in ('sections', 'dictionary-sources', 'technology-sources', 'sources', 'source-health', 'review-queue', 'meta')]
            names += ['downloads/' + n for n in ('AI_Technology_Hub.xlsx', 'ML_DL_SLM_LLM_Dictionary.xlsx', 'AI_Technology_Hub_Complete_Bundle.zip', 'atlas_catalog.sqlite')]
            for name in names:
                blob = archive.read(original + name)
                target = ROOT / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(blob)
                report['support'].append({'path': name, 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()})
            report['support'] = list({r['path']: r for r in report['support']}.values())
        else:
            kind = args.kind
            records = json.loads(archive.read(original + 'data/' + kind + '.json'))
            assert len(records) == EXPECTED[kind]
            assert len({r['id'] for r in records}) == len(records)
            batches = []
            for i in range(0, len(records), 50):
                path = f'data/{kind}-{i // 50 + 1:02}.json'
                blob = encoded(records[i:i + 50])
                (ROOT / path).write_bytes(blob)
                batches.append({'path': path, 'kind': kind, 'count': len(records[i:i + 50]), 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()})
            reconstructed = [r for f in batches for r in json.loads((ROOT / f['path']).read_bytes())]
            assert reconstructed == records, 'Lossy import'
            report['catalogs'][kind] = batches
        report_path.write_bytes((json.dumps(report, indent=2) + '\n').encode())
        print(json.dumps({'verified_archive': ARCHIVE_SHA, 'catalogs': {k: sum(f['count'] for f in v) for k, v in report['catalogs'].items()}, 'support_files': len(report['support'])}))


if __name__ == '__main__':
    main()
