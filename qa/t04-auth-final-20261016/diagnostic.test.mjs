import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, elevenFailure } from './diagnostic.mjs';
import { validateAccess } from '../t04-salad-access-20261015/validate-access.mjs';
import { selected, readScope } from '../t04-final-providers-20261015/salad-read.mjs';

for (const wrap of [v => v, v => `"${v}"`, v => `'${v}'`]) {
  test('valid literal or dotenv quotes do not require replacing a credential', () => {
    const source = ['SALAD_API_KEY', 'PEXELS_API_KEY', 'ELEVENLABS_API_KEY'].map(n => `${n}=${wrap('fixture-token-valid')}`).join('\n');
    const report = inspect(source);
    assert.equal(Object.keys(report.values).length, 3);
    assert.ok(!JSON.stringify(report.metadata).includes('fixture-token-valid'));
  });
}
for (const value of ['\\"fixture-token\\"', '$(get-token)', 'Bearer fixture-token', 'fixture token', '"fixture token"', '`get-token`']) {
  test('malformed or shell input is classified locally without evaluating it', () => {
    const report = inspect(`SALAD_API_KEY=${value}`);
    assert.equal(report.values.SALAD_API_KEY, undefined);
    assert.equal(report.metadata[0].reason, 'MALFORMED_LOCAL_CONFIGURATION');
    assert.ok(!JSON.stringify(report.metadata).includes(value));
  });
}
test('duplicates fail closed and missing canonical names are reported', () => {
  const report = inspect('PEXELS_API_KEY=fixture-token\nPEXELS_API_KEY=fixture-token');
  assert.equal(report.values.PEXELS_API_KEY, undefined);
  assert.equal(report.metadata.find(m => m.name === 'SALAD_PROJECT_NAME').reason, 'ABSENT');
});
test('Salad NAME aliases reach the existing official scoped reader', async () => {
  const values = selected('SALAD_API_KEY=fixture-token-valid\nSALAD_ORGANIZATION_NAME=fixture-org\nSALAD_PROJECT_NAME=fixture-project');
  const paths = [];
  const result = await validateAccess(values, (kind, data) => readScope(kind, data, { fetchImpl: async (url, options) => {
    paths.push(new URL(url).pathname);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Salad-Api-Key'], values.SALAD_API_KEY);
    return Response.json(kind === 'quotas' ? { container_groups_quotas: { container_replicas_quota: 1, container_replicas_used: 0 } } : { items: [] });
  } }));
  assert.equal(result.status, 'PASS_READ_ONLY');
  assert.deepEqual(paths, ['/api/public/organizations/fixture-org/quotas', '/api/public/organizations/fixture-org/projects/fixture-project/containers']);
});
test('Salad alias conflict sends zero requests', async () => {
  let calls = 0;
  const result = await readScope('quotas', { SALAD_API_KEY: 'fixture-token-valid', SALAD_ORGANIZATION: 'one-org', SALAD_ORGANIZATION_NAME: 'other-org' },
    { fetchImpl: async () => { calls++; throw new Error(); } });
  assert.equal(calls, 0); assert.equal(result.requests, 0);
});
for (const status of ['invalid_api_key', 'missing_permissions', 'untrusted-token-text']) {
  test('ElevenLabs reason is allowlisted; provider message and secrets are discarded', () => {
    const result = elevenFailure(401, { detail: { status, message: 'private-value permission voices_read' } });
    assert.ok(!JSON.stringify(result).includes('private-value'));
    assert.ok(!JSON.stringify(result).includes('untrusted-token-text'));
    if (status === 'missing_permissions') {
      assert.equal(result.requiredPermission, 'voices_read');
      assert.equal(result.authentication, 'KEY_RECOGNIZED_SCOPE_REFUSED');
    } else assert.equal(result.authentication, 'UNPROVEN');
  });
}
