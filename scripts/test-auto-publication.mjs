// Isolated regression test of the actual publication helper; no network calls.
// Requires Node 24. Run: node scripts/test-auto-publication.mjs
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';
let source = readFileSync(new URL('../src/lib/sutra-auto.ts', import.meta.url), 'utf8');
source = source.slice(source.indexOf('const PLATFORM_ALIASES:'), source.indexOf('// Functions analyzePerformance'));
source = stripTypeScriptTypes(source);
const calls = [];
const publisher = async params => {
  calls.push(params);
  return params.platforms.map(platform => ({ platform, success: true, postId: 'mock' }));
};
const publish = new Function('publishToPlatforms', source.replace('export async function', 'async function') + '; return publishAutoVideo;')(publisher);
const params = {
  config: { publish_platforms: ['youtube', 'instagram'], zernio_connected_platforms: [{ platform: 'youtube', account_id: 'mock' }] },
  videoUrl: 'https://example.invalid/mock.mp4', title: 'mock', description: 'mock', hashtags: [], scheduledFor: '2026-10-06T08:00:00Z',
};
const mixed = await publish(params);
assert.equal(mixed.length, 2);
assert.equal(mixed.find(r => r.platform === 'instagram').success, false);
assert.equal(mixed.find(r => r.platform === 'youtube').success, true);
assert.deepEqual(calls[0].platforms, ['youtube']);
assert.equal(calls[0].scheduledAt, params.scheduledFor);
calls.length = 0;
const duplicate = await publish({ ...params, config: { ...params.config, publish_platforms: ['youtube', 'youtube_shorts'] } });
assert.deepEqual(calls[0].platforms, ['youtube']);
assert.equal(duplicate.length, 1);
calls.length = 0;
const disconnected = await publish({ ...params, config: { ...params.config, zernio_connected_platforms: [] } });
assert.equal(disconnected.length, 2);
assert.ok(disconnected.every(r => !r.success));
assert.equal(calls.length, 0);
const empty = await publish({ ...params, config: { ...params.config, publish_platforms: [] } });
assert.ok(empty.every(r => !r.success));
assert.equal(calls.length, 0);
console.log('PASS: mixed accounts, aliases, scheduledAt, disconnected accounts, empty configuration');
// Does not validate the full Next.js build, real uploads, database concurrency, or provider responses.
