import assert from 'node:assert/strict';
import test from 'node:test';
import { classify, parseSelected, permittedRead, planReads, probe } from './probe.mjs';

const fake = 'synthetic-key';
const suno = { provider: 'suno', url: 'https://api.sunoapi.org/api/v1/generate/credit', key: fake };
const health = { jobs: { completed: 0, failed: 0, inProgress: 0, inQueue: 0, retried: 0 },
  workers: { idle: 0, initializing: 0, ready: 0, running: 0, throttled: 0, unhealthy: 0 } };

test('dotenv escaped boundary whitespace follows T01 normalization without modifying master', () => {
  const parsed = parseSelected('RUNPOD_ENDPOINT_ID="fixture\\n"\nSUNO_API_KEY="\\nsynthetic-key\\n"');
  assert.equal(parsed.RUNPOD_ENDPOINT_ID, 'fixture');
  assert.equal(parsed.SUNO_API_KEY, fake);
});

test('selected names only, comments/quotes, no inherited environment', () => {
  const parsed = parseSelected('UNRELATED_SECRET=ignored\nexport SUNO_API_KEY="synthetic-key" # note\nSUNO_BASE_URL=https://api.sunoapi.org/api/v1 # base');
  assert.deepEqual(Object.keys(parsed), ['SUNO_API_KEY', 'SUNO_BASE_URL']);
  assert.equal(parsed.SUNO_API_KEY, fake);
  assert.equal(planReads(parsed).length, 1);
});
test('duplicate or expandable selected variables fail closed without value in error', () => {
  for (const input of ['SUNO_API_KEY=a\nSUNO_API_KEY=b', 'SUNO_API_KEY="$(secret)"', 'SUNO_API_KEY=`secret`', 'SUNO_API_KEY="unterminated']) {
    assert.throws(() => parseSelected(input), /^Error: MASTER_(DUPLICATE_SELECTED_NAME|UNSUPPORTED_SYNTAX)$/);
  }
});
test('Suno configured variable precedence matches application; malformed preferred URL never falls back', () => {
  const plan = planReads({ SUNO_API_KEY: fake, SUNO_API_BASE_URL: 'https://invalid.example', SUNO_BASE_URL: 'https://api.sunoapi.org/api/v1' });
  assert.equal(plan.length, 1); assert.equal(permittedRead(plan[0]), false);
});
test('only four expected read requests; correct environment key separation', () => {
  const plans = planReads({ RUNPOD_API_KEY: fake, RUNPOD_ENDPOINT_ID: 'fixture', SHOTSTACK_API_KEY: 'stage-fixture',
    SHOTSTACK_PRODUCTION_KEY: 'prod-fixture', SUNO_API_KEY: fake, SUNO_BASE_URL: 'https://api.sunoapi.org/api/v1/' });
  assert.equal(plans.length, 4); assert.ok(plans.every(permittedRead));
  assert.equal(plans[1].key, 'stage-fixture'); assert.equal(plans[2].key, 'prod-fixture');
});
test('reject generation/admin/cancel, foreign hosts, credential URLs and header injection before I/O', async () => {
  for (const plan of [
    { ...suno, url: 'https://api.sunoapi.org/api/v1/generate' },
    { ...suno, url: 'https://apibox.erweima.ai/api/v1/generate/credit' },
    { ...suno, url: 'https://user:pass@api.sunoapi.org/api/v1/generate/credit' },
    { ...suno, key: 'invalid\r\nheader' },
    { provider: 'runpod', key: fake, url: 'https://rest.runpod.io/v1/endpoints' },
    ...['run', 'cancel/job', 'health?key=other', '../health'].map((path) => ({ provider: 'runpod', key: fake, url: `https://api.runpod.ai/v2/fixture/${path}` })),
  ]) {
    assert.deepEqual(await probe(plan, { fetchImpl: () => assert.fail('must not fetch') }), { status: 'BLOQUE', reason: 'READ_ALLOWLIST_REJECTED' });
  }
});
test('RunPod health validates read access with zero ready workers, not generation permission or credit', () => {
  const result = classify('runpod', 200, health);
  assert.equal(result.status, 'PASS'); assert.equal(result.readyWorkers, 0);
  assert.equal(result.credits, 'NON_TESTE'); assert.equal(result.generation, 'NON_TESTE');
  assert.equal(classify('runpod', 200, { jobs: {}, workers: {} }).status, 'BLOQUE');
});
test('Shotstack empty templates valid, HTML or success=false invalid', () => {
  assert.equal(classify('shotstack-stage', 200, { success: true, response: { templates: [] } }).status, 'PASS');
  for (const body of ['html', {}, { success: false, response: { templates: [] } }]) assert.equal(classify('shotstack-v1', 200, body).status, 'BLOQUE');
});
test('Suno separates successful authentication from zero/positive credits; rejects malformed credit and HTTP200 API error', () => {
  assert.equal(classify('suno', 200, { code: 200, data: 0 }).creditsAvailable, false);
  assert.equal(classify('suno', 200, { code: 200, data: 0.1 }).creditsAvailable, true);
  for (const data of ['100', -1, NaN, Infinity, {}, null]) assert.equal(classify('suno', 200, { code: 200, data }).status, 'BLOQUE');
  for (const code of [401, 403, 429]) assert.equal(classify('suno', 200, { code, data: 100 }).authentication, 'UNPROVEN');
});
test('Suno API 429 means insufficient credits, distinct from HTTP429 and API405/430 rate limits', () => {
  assert.equal(classify('suno', 200, { code: 429 }).reason, 'INSUFFICIENT_CREDITS');
  for (const code of [405, 430]) assert.equal(classify('suno', 200, { code }).reason, 'RATE_LIMIT');
  assert.equal(classify('suno', 429, null).reason, 'RATE_LIMIT');
});
test('HTTP 401/403/404/429/500 remain distinct and do not prove bad key or trigger retry', async () => {
  for (const http of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const result = await probe(suno, { fetchImpl: async () => { calls++; return new Response(fake, { status: http }); } });
    assert.equal(calls, 1); assert.equal(result.http, http); assert.equal(result.status, 'BLOQUE');
    assert.ok(!JSON.stringify(result).includes(fake));
  }
});
test('GET only, redirects forbidden, expected header, bounded success body', async () => {
  const result = await probe(suno, { fetchImpl: async (url, init) => {
    assert.equal(url, suno.url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${fake}`);
    return Response.json({ code: 200, data: 3, message: fake });
  } });
  assert.equal(result.status, 'PASS'); assert.ok(!JSON.stringify(result).includes(fake));
});
test('malformed, oversized and redirect/transport errors are redacted with one attempt', async () => {
  for (const fetchImpl of [async () => new Response(fake), async () => new Response(fake.repeat(100)), async () => { throw new Error(fake + suno.url); }]) {
    const result = await probe(suno, { fetchImpl, maxBytes: 64 });
    assert.equal(result.status, 'BLOQUE'); assert.equal(result.reason, 'TRANSPORT_OR_MALFORMED_BODY');
    assert.ok(!JSON.stringify(result).includes(fake)); assert.ok(!JSON.stringify(result).includes('https:'));
  }
});
test('deadline covers both headers and stalled response stream without retry', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    const result = await probe(suno, { fetchImpl, timeoutMs: 15 });
    assert.equal(result.reason, 'TIMEOUT'); assert.equal(result.status, 'BLOQUE');
  }
});
