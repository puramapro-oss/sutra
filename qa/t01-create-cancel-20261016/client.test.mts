import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFailureNotice, readCreateIntent, saveCreateIntent, createIntentKey } from '../../src/lib/create-intent-client.ts'
const owner = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
test('fixed public categories never echo arbitrary diagnostics', () => {
  assert.equal(createFailureNotice(403, {code:'SUTRA_GENERATION_FAILED'}), 'Quota ou budget atteint.')
  assert.equal(createFailureNotice(402, {error:'Credits insuffisants'}), 'Quota ou budget atteint.')
  assert.equal(createFailureNotice(503, {code:'SALAD_ESTIMATE_EXCEEDS_BUDGET'}), 'Quota ou budget atteint.')
  assert.equal(createFailureNotice(503, {code:'SALAD_UNSUPPORTED_PROFILE'}), 'SALAD_UNSUPPORTED_PROFILE')
  assert.equal(createFailureNotice(503, {code:'SALAD_DISABLED'}), 'SALAD_UNAVAILABLE')
  for (const code of ['SALAD_DISABLED: PRIVATE_MARKER', 'PRIVATE_MARKER', 'SUTRA_SUBMISSION_UNCONFIRMED']) {
    assert.equal(createFailureNotice(503, {code, error:'PRIVATE_MARKER'}), undefined)
  }
  assert.equal(createFailureNotice(403, {code:'UNKNOWN'}), undefined)
})
test('tab receipt is owner scoped, preserves cancel intention and fails closed on corrupt data', () => {
  const records = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {configurable:true, value:{
    getItem:(key:string) => records.get(key) ?? null,
    setItem:(key:string,value:string) => records.set(key,value), removeItem:(key:string) => records.delete(key),
  }})
  try {
    const intent = {version:1 as const, userId:owner, requestId:id, body:JSON.stringify({topic:'Fixture',format:'16:9',quality:'720p',engine:'wan-classic',mode:'auto',mediaMode:'ai'}), cancelRequested:true}
    saveCreateIntent(owner,intent); assert.deepEqual(readCreateIntent(owner),intent)
    assert.equal(readCreateIntent('other'),null)
    for (const patch of [{userId:'other'}, {requestId:'invalid'}, {jobId:'invalid'}, {body:'{}'}, {cancelRequested:'yes'}]) {
      records.set(createIntentKey(owner), JSON.stringify({...intent,...patch})); assert.throws(() => readCreateIntent(owner))
    }
    records.set(createIntentKey(owner), '{'); assert.throws(() => readCreateIntent(owner))
    saveCreateIntent(owner,null); assert.equal(readCreateIntent(owner),null)
  } finally { Reflect.deleteProperty(globalThis,'sessionStorage') }
})
