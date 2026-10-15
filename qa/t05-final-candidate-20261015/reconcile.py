"""Read-only candidate/CI reconciliation; writes only this proof directory."""
import csv
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROOF = Path(__file__).resolve().parent
T1 = ROOT.parent / 'sutra-final-providers-20261013'
CANDIDATE = 'cb3f893c35599a6c9c50a4d23c82013c10c5f3ae'
AUTHOR = '44cbbab40e20f65d0506c18af253218055884c46'
CI = T1 / 'qa/t01-closure-20261015/ci-cb3f893-contract-artifacts'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def save(name, value):
    (PROOF / name).write_text(json.dumps(value, indent=2) + '\n')


old = json.loads((ROOT / 'qa/t05-integrated-retest-20261015/integration.json').read_text())
rows = []
for entry in old['files']:
    path = entry['path']
    author = git('show', f'{AUTHOR}:{path}')
    candidate = git('show', f'{CANDIDATE}:{path}')
    assert author == candidate == (ROOT / path).read_bytes() == (T1 / path).read_bytes(), path
    rows.append({'path': path, 'sha256': digest(candidate), 'equalAuthorCandidateOwnT1': True})
assert len(rows) == 82
producers = []
for entry in old['producersAndFixtures']:
    path = entry['path']
    content = (ROOT / path).read_bytes()
    assert digest(content) == entry['sha256'], path
    assert content == git('show', f'{CANDIDATE}:{path}') == (T1 / path).read_bytes(), path
    producers.append({'path': path, 'sha256': digest(content)})
previous = []
for path in git('diff-tree', '--no-commit-id', '--name-only', '-r', 'f0bb470').decode().splitlines():
    if path in {'BATON.md', 'task_plan.md', 'ERRORS.md'}:
        continue
    content = git('show', f'f0bb470:{path}')
    assert content == git('show', f'{CANDIDATE}:{path}') == (ROOT / path).read_bytes(), path
    previous.append({'path': path, 'sha256': digest(content)})
historical = []
for path in sorted((ROOT / 'qa/t05-real-export-20261014/exports').glob('*.mp4')):
    relative = path.relative_to(ROOT).as_posix()
    content = path.read_bytes()
    assert content == git('show', f'{CANDIDATE}:{relative}') == (T1 / relative).read_bytes(), relative
    historical.append({'path': relative, 'sha256': digest(content)})
assert len(historical) == 37
test_copy = (PROOF / 'retest.mts').read_text().replace('t05-final-candidate-20261015', 't05-integrated-retest-20261015')
assert test_copy == (ROOT / 'qa/t05-integrated-retest-20261015/retest.mts').read_text()
save('integration.json', {'observedAt': datetime.now(timezone.utc).isoformat(), 'candidate': CANDIDATE,
    'status': 'PASS', 'author': AUTHOR, 'controlledFiles': rows, 'producersAndFixtures': producers,
    'previousDeliveryF0bb470': previous, 'historicalExportsPreserved': historical,
    'historicalExportsRerenderedByT05': 0, 'testCopyOnlyChangesOutputDirectory': True})

receipt = T1 / 'qa/t01-closure-20261015/ci-cb3f893-contract-counts.json'
counts = json.loads(receipt.read_text())
assert counts['source'] == CANDIDATE and counts['ciRun'] == 38797929920
groups = json.loads((CI / 'test-results/ci/media/results.json').read_text())
(PROOF / 'ci').mkdir(exist_ok=True)
for group in groups:
    assert group['status'] == 'PASS' and group['exitCode'] == 0, group
    relative = f"test-results/ci/media/{group['name']}.log"
    content = (CI / relative).read_bytes()
    expected = next(item for item in counts['groups'] if item['path'] == relative)
    assert digest(content) == expected['sha256']
    assert expected['counts']['fail'] == [0] and expected['counts']['skipped'] == [0]
    (PROOF / 'ci' / (group['name'] + '.log')).write_bytes(content)
    group.update({'sha256': digest(content), 'counts': expected['counts']})
media = json.loads((CI / 'qa/t05-final-media-20261015/media-ci.json').read_text())
assert len(media['exports']) == 17
for item in media['exports']:
    artifact = CI / 'qa/t05-final-media-20261015' / item['file']
    assert digest(artifact.read_bytes()) == item['validation']['final']['sha256'], item['name']
save('ci/media-ci.json', media)
save('ci-reused.json', {'candidate': CANDIDATE, 'run': counts['ciRun'], 'receipt': str(receipt),
    'receiptSha256': digest(receipt.read_bytes()), 'groups': groups, 'artifactsMeasuredAndHashMatched': 17,
    'scope': 'Exact candidate Linux CPU CI; groups overlap, do not sum; paid providers not tested'})

local = json.loads((PROOF / 'measurements.json').read_text())
measurements = []
for item in local['exports']:
    actual = item['validation']['final']
    assert actual['sha256'] == digest((PROOF / item['file']).read_bytes()) == item['sha256']
    v, a = actual['video'], actual['audio'][0]
    lineage = item['validation']['sources'][0]
    row = {'format': item['format'], 'file': item['file'], 'width': v['width'], 'height': v['height'],
        'orientation': v['orientation'], 'sar': v['sar'], 'rotation': v['rotation'],
        'duration': actual['duration'], 'fps': v['fps'], 'frames': v['frames'], 'videoCodec': v['codec'],
        'audioCodec': a['codec'], 'bitrate': actual['bitrate'], 'videoBitrate': v['bitrate'],
        'audioBitrate': a['bitrate'], 'audioChannels': a['channels'], 'audioSampleRate': a['sampleRate'],
        'audioStartDelta': a['start']-v['start'],
        'audioEndDelta': (a['start']+a['duration'])-(v['start']+v['duration']),
        'fullDecode': actual['fullDecode'], 'native': f"{lineage['native']['video']['width']}x{lineage['native']['video']['height']}",
        'source': f"{lineage['source']['video']['width']}x{lineage['source']['video']['height']}",
        'enhanced': f"{lineage['enhanced']['video']['width']}x{lineage['enhanced']['video']['height']}",
        'origin': item['validation']['resolutionOrigin'], 'bytes': actual['bytes'], 'sha256': actual['sha256']}
    measurements.append(row)
with (PROOF / 'measurements.csv').open('w', newline='') as handle:
    writer = csv.DictWriter(handle, fieldnames=measurements[0], lineterminator='\n')
    writer.writeheader()
    writer.writerows(measurements)
tests = {}
for name in ('media', 'ready', 'concurrency'):
    log = (PROOF / f'{name}.txt').read_text()
    tests[name] = {key: int(re.search(r'(?:ℹ |# )'+key+r' (\d+)', log).group(1))
        for key in ('tests', 'pass', 'fail', 'skipped')}
    assert tests[name]['fail'] == tests[name]['skipped'] == 0
temporary = [p.name for p in (PROOF / 'temporary').iterdir() if p.name.startswith('sutra-')]
assert not temporary
save('verification.json', {'candidate': CANDIDATE, 'status': 'PASS', 'tests': tests,
    'measurements': measurements, 'temporaryMediaRemaining': temporary,
    'productFilesModified': 0, 'providerCalls': 0, 'visual': 'Three previews displayed: short SUTRA cue readable, no clipping or logo overlap',
    'limits': ['Paid provider renders and remote upload NOT TESTED',
        'No native AI 4K generation, no human lip sync or arbitrary long text proof',
        'No hard production CPU/RAM, OOM/load or deployed application end-to-end proof',
        'Ready tests use real pipeline logic with synthetic providers and persistence ports']})
print(json.dumps({'status': 'PASS', 'candidate': CANDIDATE, 'controlledFiles': len(rows),
    'previousDeliveryFiles': len(previous), 'unchangedProducersAndFixtures': len(producers),
    'historicalExportsPreserved': len(historical), 'ciExportsVerified': len(media['exports']), 'freshTests': tests}))
