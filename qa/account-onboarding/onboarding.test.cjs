const { test } = require('node:test')
const assert = require('node:assert/strict')
const modulePath = process.env.SUTRA_ONBOARDING_TEST_MODULE
if (!modulePath) throw new Error('Run: node qa/account-onboarding/run.mjs')
const { planAccountOnboarding: plan, parseOnboardingIntent: parse, onboardingIntentKey: key,
  onboardingCapabilities: capabilities, PLATFORMS, ONBOARDING_POLICY_VERSION: version } = require(modulePath)
const now = Date.UTC(2026, 9, 21, 12)
const intent = (change = {}) => ({ tenantId: 'tenant-1', ownerId: 'owner-1', editionId: 'love-fr',
  platform: 'youtube', kind: 'channel', action: 'create', mode: 'personal', locale: 'fr-FR', profileDigest: 'a'.repeat(64), ...change })
const context = i => ({ enabled: true, now, actor: { userId: i.ownerId, tenantId: i.tenantId, access: 'active' },
  personalOwnerId: 'owner-1', networkAccess: 'approved',
  policy: { version, platform: i.platform, kind: i.kind, action: i.action, evidenceId: 'review-1', reviewedAt: now - 1000, expiresAt: now + 60000 },
  mandate: { id: 'mandate-1', ownerId: i.ownerId, tenantId: i.tenantId, intentKey: key(i), policyVersion: version,
    approvedAt: now - 1000, expiresAt: now + 60000, revoked: false },
  quota: { state: 'available', checkedAt: now - 1000, expiresAt: now + 60000 },
  approvedInstanceOrigins: i.instanceOrigin ? [i.instanceOrigin] : [],
})
const evaluate = (change = {}, mutate = () => {}) => { const i = intent(change), c = context(i); mutate(c, i); return plan(i, c) }
test('YouTube creation is assisted, never a live creation permission', () => {
  const p = evaluate(); assert.equal(p.status, 'USER_ACTION_REQUIRED'); assert.equal(p.route, 'official-assisted')
  assert.equal(p.remoteExecutionAllowed, false); assert.equal(p.publicationAllowed, false)
})
for (const platform of PLATFORMS) {
  test(`${platform}: every supported kind stays offline and scoped`, () => {
    const cap = capabilities(platform)
    for (const kind of cap.kinds) for (const action of ['create', 'connect']) {
      const i = intent({ platform, kind, action, ...(cap.requiresInstance ? { instanceOrigin: 'https://social.example' } : {}) })
      const p = plan(i, context(i))
      assert.ok(['USER_ACTION_REQUIRED', 'CONNECTOR_REVIEW_REQUIRED'].includes(p.status))
      assert.equal(p.remoteExecutionAllowed, false); assert.equal(p.publicationAllowed, false)
      assert.equal(p.intentKey, key(i))
      if (action === 'connect') assert.equal(p.route, 'connect-existing')
    }
  })
}
const gateCases = [
  ['feature defaults off', c => { delete c.enabled }, 'DISABLED'],
  ['revoked identity', c => { c.actor.access = 'revoked' }, 'BLOCKED'],
  ['different owner', c => { c.actor.userId = 'other' }, 'BLOCKED'],
  ['different tenant', c => { c.actor.tenantId = 'other' }, 'BLOCKED'],
  ['personal owner mismatch', c => { c.personalOwnerId = 'other' }, 'BLOCKED'],
  ['network restricted', c => { c.networkAccess = 'restricted' }, 'BLOCKED'],
  ['network unknown', c => { delete c.networkAccess }, 'BLOCKED'],
  ['no policy', c => { delete c.policy }, 'POLICY_REVIEW_REQUIRED'],
  ['wrong policy version', c => { c.policy.version = 'old' }, 'POLICY_REVIEW_REQUIRED'],
  ['wrong policy platform', c => { c.policy.platform = 'x' }, 'POLICY_REVIEW_REQUIRED'],
  ['wrong policy kind', c => { c.policy.kind = 'account' }, 'POLICY_REVIEW_REQUIRED'],
  ['wrong policy action', c => { c.policy.action = 'connect' }, 'POLICY_REVIEW_REQUIRED'],
  ['expired policy boundary', c => { c.policy.expiresAt = now }, 'POLICY_REVIEW_REQUIRED'],
  ['future policy', c => { c.policy.reviewedAt = now + 1 }, 'POLICY_REVIEW_REQUIRED'],
  ['old policy despite future expiry', c => { c.policy.reviewedAt = now - 31 * 86400000 }, 'POLICY_REVIEW_REQUIRED'],
  ['no evidence', c => { c.policy.evidenceId = '' }, 'POLICY_REVIEW_REQUIRED'],
  ['no mandate', c => { delete c.mandate }, 'OWNER_APPROVAL_REQUIRED'],
  ['revoked mandate', c => { c.mandate.revoked = true }, 'OWNER_APPROVAL_REQUIRED'],
  ['revocation not explicit', c => { delete c.mandate.revoked }, 'OWNER_APPROVAL_REQUIRED'],
  ['expired mandate', c => { c.mandate.expiresAt = now }, 'OWNER_APPROVAL_REQUIRED'],
  ['future mandate', c => { c.mandate.approvedAt = now + 1 }, 'OWNER_APPROVAL_REQUIRED'],
  ['mandate tenant mismatch', c => { c.mandate.tenantId = 'other' }, 'OWNER_APPROVAL_REQUIRED'],
  ['mandate owner mismatch', c => { c.mandate.ownerId = 'other' }, 'OWNER_APPROVAL_REQUIRED'],
  ['mandate intent mismatch', c => { c.mandate.intentKey = 'other' }, 'OWNER_APPROVAL_REQUIRED'],
  ['mandate policy mismatch', c => { c.mandate.policyVersion = 'old' }, 'OWNER_APPROVAL_REQUIRED'],
  ['quota absent', c => { delete c.quota }, 'WAIT_QUOTA'],
  ['quota exhausted', c => { c.quota.state = 'exhausted' }, 'WAIT_QUOTA'],
  ['quota expired', c => { c.quota.expiresAt = now }, 'WAIT_QUOTA'],
  ['quota future', c => { c.quota.checkedAt = now + 1 }, 'WAIT_QUOTA'],
  ['quota too old', c => { c.quota.checkedAt = now - 300001 }, 'WAIT_QUOTA'],
]
for (const [name, mutate, expected] of gateCases) test(name, () => {
  const result = evaluate({}, mutate); assert.equal(result.status, expected)
  assert.equal(result.remoteExecutionAllowed, false); assert.equal(result.publicationAllowed, false)
})
for (const state of ['unknown', 'in_flight', 'confirmed']) test(`${state} attempt never starts again`, () => {
  const p = evaluate({}, (c, i) => { c.previousAttempt = { state, operationId: 'op-1', intentKey: key(i) } })
  assert.equal(p.status, 'RECONCILE_REQUIRED')
})
test('an attempt from another intent is rejected', () => {
  assert.equal(evaluate({}, c => { c.previousAttempt = { state: 'unknown', operationId: 'op-1', intentKey: 'other' } }).status, 'BLOCKED')
})
test('policy and quota failures do not authorize blind replay', () => {
  assert.equal(evaluate({}, (c, i) => { delete c.policy; delete c.quota; c.previousAttempt = { state: 'unknown', operationId: 'op-1', intentKey: key(i) } }).status, 'RECONCILE_REQUIRED')
})
for (const patch of [null, [], {}, { ...intent(), platform: '__proto__' }, { ...intent(), password: 'DO-NOT-LEAK' },
  { ...intent(), enabled: true }, { ...intent(), profileDigest: 'bad' }, { ...intent(), ownerId: '' }, { ...intent(), locale: '<script>' }]) {
  test(`invalid request ${JSON.stringify(patch)?.slice(0, 64)}`, () => {
    const p = plan(patch, context(intent())); assert.equal(p.status, 'BLOCKED')
    assert.ok(!JSON.stringify(p).includes('DO-NOT-LEAK')); assert.throws(() => parse(patch))
  })
}
for (const url of ['http://social.example', 'https://127.0.0.1', 'https://[::1]', 'https://2130706433',
  'https://user:password@social.example', 'https://social.example/path', 'https://social.example?token=private',
  'https://social.example#fragment', 'https://social.example:8443', 'https://host.local', 'https://localhost']) {
  test(`reject unsafe or non-origin instance ${url}`, () => assert.throws(() => parse(intent({ platform: 'mastodon', kind: 'account', instanceOrigin: url }))))
}
test('instance has to be explicitly approved; suffix matching is not allowed', () => {
  const i = intent({ platform: 'bluesky', kind: 'account', instanceOrigin: 'https://trusted.example.attacker.example' }), c = context(i)
  c.approvedInstanceOrigins = ['https://trusted.example']
  assert.equal(plan(i, c).status, 'INSTANCE_REVIEW_REQUIRED')
})
test('normalization is deterministic, without including arbitrary profile fields', () => {
  const i = intent({ platform: 'mastodon', kind: 'account', instanceOrigin: 'https://SOCIAL.example/' })
  assert.equal(parse(i).instanceOrigin, 'https://social.example')
  assert.equal(key(i), key({ ...i, instanceOrigin: 'https://social.example' }))
})
test('a changed dossier invalidates previous owner approval', () => {
  const i = intent(), c = context(i); i.profileDigest = 'b'.repeat(64)
  assert.equal(plan(i, c).status, 'OWNER_APPROVAL_REQUIRED')
})
test('mode switch invalidates owner approval', () => {
  const i = intent(), c = context(i); i.mode = 'client'
  assert.equal(plan(i, c).status, 'OWNER_APPROVAL_REQUIRED')
})
test('client mode never supplies personal execution rights', () => {
  const i = intent({ mode: 'client', ownerId: 'client-1' }); const p = plan(i, context(i))
  assert.equal(p.remoteExecutionAllowed, false); assert.equal(p.publicationAllowed, false)
})
test('capabilities cannot be mutated to enable new platforms or kinds', () => {
  assert.throws(() => PLATFORMS.push('unreviewed')); capabilities('youtube').kinds.push('account')
  assert.deepEqual(capabilities('youtube').kinds, ['channel'])
})
test('invalid runtime context fails closed', () => {
  for (const c of [undefined, null, {}, { ...context(intent()), now: NaN }, { ...context(intent()), now: Infinity }])
    assert.equal(plan(intent(), c).status, 'BLOCKED')
})
test('planning is deterministic, non-mutating and serializable', () => {
  const i = intent(), c = context(i), before = JSON.stringify([i, c])
  assert.deepEqual(plan(i, c), plan(i, c)); assert.equal(JSON.stringify([i, c]), before)
  assert.deepEqual(JSON.parse(JSON.stringify(plan(i, c))), plan(i, c))
})
test('1000 synthetic editions: unique keys, no network or remote permission', () => {
  const keys = new Set()
  for (let n = 0; n < 1000; n++) {
    const i = intent({ editionId: `synthetic-${n}` }), result = plan(i, context(i))
    keys.add(result.intentKey); assert.equal(result.remoteExecutionAllowed, false)
  }
  assert.equal(keys.size, 1000)
})
