import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAccess } from './validate-access.mjs';
import { readScope } from '../t04-final-providers-20261015/salad-read.mjs';

const values = { SALAD_API_KEY: 'fixture-key-not-real', SALAD_ORGANIZATION: 'fixture-org', SALAD_PROJECT: 'fixture-project' };
const quota = { container_groups_quotas: { container_replicas_quota: 1, container_replicas_used: 0 } };

test('two scoped GETs; never POST, retry, raw environment, or secret output', async () => {
  const calls = [];
  const result = await validateAccess(values, (kind, v) => readScope(kind, v, { fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Salad-Api-Key'], values.SALAD_API_KEY);
    return Response.json(kind === 'quotas' ? quota : { items: [{ name: 'private-name', environment_variables: { SECRET: 'fixture-private' } }] });
  } }));
  assert.equal(result.status, 'PASS_READ_ONLY'); assert.equal(result.requests, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/organizations\/fixture-org\/quotas$/);
  assert.match(calls[1], /\/projects\/fixture-project\/containers$/);
  for (const value of [...Object.values(values), 'private-name', 'fixture-private']) assert.ok(!JSON.stringify(result).includes(value));
});

test('organization HTTP refusals stop project lookup and preserve unproven authentication', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    let calls = 0;
    const result = await validateAccess(values, (kind, v) => readScope(kind, v, { fetchImpl: async () => {
      calls++; return new Response('private-error', { status });
    } }));
    assert.equal(calls, 1); assert.equal(result.status, 'BLOQUE');
    assert.equal(result.organization.http, status); assert.equal(result.organization.authentication, 'UNPROVEN');
    assert.equal(result.project, undefined);
  }
});

test('malformed JSON and schema never save configuration', async () => {
  for (const body of ['bad-json', '{}', '{"container_groups_quotas":{"container_replicas_used":0}}']) {
    const result = await validateAccess(values, (kind, v) => readScope(kind, v, { fetchImpl: async () => new Response(body) }));
    assert.equal(result.status, 'BLOQUE'); assert.equal(result.requests, 1);
  }
});

test('project denial keeps organization proof but blocks overall success', async () => {
  const result = await validateAccess(values, (kind, v) => readScope(kind, v, { fetchImpl: async () => kind === 'quotas' ? Response.json(quota) : new Response('', { status: 403 }) }));
  assert.equal(result.status, 'BLOQUE'); assert.equal(result.requests, 2);
  assert.equal(result.organization.authentication, 'ORGANIZATION_READ_CONFIRMED');
  assert.equal(result.project.http, 403);
});

test('request timeout stops before project; no hidden retry', async () => {
  let calls = 0;
  const result = await validateAccess(values, (kind, v) => readScope(kind, v, { timeoutMs: 20, fetchImpl: () => { calls++; return new Promise(() => {}); } }));
  assert.equal(result.status, 'BLOQUE'); assert.equal(result.organization.reason, 'TIMEOUT'); assert.equal(calls, 1);
});

test('missing scope performs zero requests, no invented organization discovery', async () => {
  const result = await validateAccess({}, (kind, v) => readScope(kind, v, { fetchImpl: () => assert.fail('network forbidden') }));
  assert.equal(result.status, 'BLOQUE'); assert.equal(result.requests, 0);
});
