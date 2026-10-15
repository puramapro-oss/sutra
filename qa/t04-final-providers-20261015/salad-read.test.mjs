import test from 'node:test';
import assert from 'node:assert/strict';
import { selected, readScope, summarize, inspectMaster } from './salad-read.mjs';
const values = { SALAD_API_KEY: 'test-only-placeholder-credential', SALAD_ORGANIZATION: 'fixture-org', SALAD_PROJECT: 'fixture-project' };
test('unsupported master syntax is reported by name only without execution or suppressing other fields', () => {
  const result = inspectMaster('SALAD_API_KEY=unsupported $expression \\ value\nSALAD_ORGANIZATION=fixture-org');
  assert.equal(result.values.SALAD_API_KEY, undefined);
  assert.equal(result.values.SALAD_ORGANIZATION, 'fixture-org');
  assert.equal(result.variables.find(v => v.name === 'SALAD_API_KEY').syntax, 'UNSUPPORTED');
  assert.ok(!JSON.stringify(result.variables).includes('$expression'));
});
test('selected names only, private values never copied into report', () => {
  assert.deepEqual(Object.keys(selected('IGNORED=secret\nSALAD_ORGANIZATION=fixture-org\nSALAD_API_KEY=test-only-placeholder-credential')), ['SALAD_API_KEY','SALAD_ORGANIZATION']);
  for (const s of ['SALAD_PROJECT=../other', 'SALAD_PROJECT=fixture\nSALAD_PROJECT=other', 'SALAD_PROJECT=$(unsafe)']) assert.throws(() => selected(s));
});
test('missing scope or mutation name makes zero calls', async () => {
  let calls = 0; const opts = { fetchImpl: async () => { calls++; throw new Error(); } };
  for (const [kind, v] of [['quotas', {}], ['start', values], ['groups', { ...values, SALAD_PROJECT: undefined }]]) {
    assert.equal((await readScope(kind, v, opts)).requests, 0);
  }
  assert.equal(calls, 0);
});
test('documented GET and server auth; summarize quotas without raw account data', async () => {
  const result = await readScope('quotas', values, { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.salad.com/api/public/organizations/fixture-org/quotas');
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Salad-Api-Key'], values.SALAD_API_KEY);
    return Response.json({ container_groups_quotas: { container_replicas_quota: 5, container_replicas_used: 1 }, secret: values.SALAD_API_KEY });
  } });
  assert.equal(result.replicaHeadroom, 4); assert.equal(result.generation, 'NON_TESTE');
  assert.ok(!JSON.stringify(result).includes(values.SALAD_API_KEY));
});
test('group discovery redacts nested environment variables and names', async () => {
  const result = await readScope('groups', values, { fetchImpl: async () => Response.json({ items: [{ name: 'private-group', container: { environment_variables: { TOKEN: 'never-print' } } }] }) });
  assert.equal(result.groups, 1); assert.ok(!JSON.stringify(result).includes('private-group')); assert.ok(!JSON.stringify(result).includes('never-print'));
});
for (const http of [401,403,404,429,500]) test(`HTTP ${http} never claims invalid key specifically, no retry, no body echo`, async () => {
  let calls = 0;
  const result = await readScope('quotas', values, { fetchImpl: async () => { calls++; return new Response('private upstream error', { status: http }); } });
  assert.equal(calls, 1); assert.equal(result.http, http); assert.equal(result.authentication, 'UNPROVEN'); assert.ok(!JSON.stringify(result).includes('private'));
});
test('malformed JSON, schema and oversized body fail closed', async () => {
  for (const body of ['{', 'null', '{"items":[]}', 'x'.repeat(64)]) {
    const result = await readScope('quotas', values, { maxBytes: 32, fetchImpl: async () => new Response(body) });
    assert.notEqual(result.status, 'PASS');
  }
  assert.equal(summarize('groups', 200, { items: [null] }).status, 'FAIL');
});
test('header and stalled-body timeout bounded even if transport ignores abort', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async () => new Response(new ReadableStream({ start() {} }))]) {
    assert.equal((await readScope('quotas', values, { timeoutMs: 10, fetchImpl })).reason, 'TIMEOUT');
  }
});
