import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { socialDatabase, accountId, secondAccount, postId } from './helpers/social-database.mts'
import type { PublishRequest, PublishResult } from '../src/lib/zernio.ts'
import type { PublicationGateway, PublicationOperation } from '../src/lib/publication-journal.ts'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://sutra-test.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service'
process.env.ZERNIO_API_KEY = 'test-only'
const user = '11111111-1111-4111-8111-111111111111'
process.env.ZERNIO_PROFILE_BINDINGS = JSON.stringify({ [user]: 'a'.repeat(24) })
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const { publishVideoRecord, savePublicationHistory } = await import('../src/lib/social-publication.ts')
const { publishAutoVideoRecord } = await import('../src/lib/auto-publication.ts')
const { revokeSocialAccount } = await import('../src/lib/social-account-revocation.ts')
const { runPublicationJournal } = await import('../src/lib/publication-journal.ts')
const input = { videoId: 'v', platforms: ['youtube'] as PublishRequest['platforms'] }
const results = (request: PublishRequest, status: PublishResult['status'] = 'published'): PublishResult[] => request.platforms.map(platform => ({
  platform, accountId: request.accountIds[platform], status, success: status === 'published', postId,
}))
function harness() {
  const db = socialDatabase(user); let now = Date.now(), posts = 0, replays = 0, gets = 0, retries = 0
  const gateway: PublicationGateway = {
    now: () => now,
    publish: async request => { posts++; return results(request) },
    replay: async request => { replays++; return results(request) },
    reconcile: async (_id, request) => { gets++; return results(request) },
    retry: async (_id, request) => { retries++; return results(request) },
  }
  const invoke = (extra = {}) => publishVideoRecord(user, { ...input, ...extra }, db.client, gateway.publish, gateway.reconcile, gateway)
  return { db, gateway, invoke, advance: (ms: number) => { now += ms }, counts: () => ({ posts, replays, gets, retries }) }
}

test('T06: une production peut cibler deux comptes distincts sans reposter au premier', async () => {
  const h = harness(); await h.invoke()
  // The canonical public schema has one row per user/platform. Reconnection
  // changes its external identity, which requires a new explicit selection.
  h.db.accounts[0].external_id = secondAccount
  await h.invoke({ accountIds: { youtube: 'local-y' } })
  h.db.accounts[0].external_id = accountId
  await h.invoke({ accountIds: { youtube: 'local-y' }, caption: 'modified' })
  assert.equal(h.counts().posts, 2); assert.equal(h.db.tables.social_posts.length, 2)
  assert.equal(new Set(h.db.tables.social_posts.map(r => r.id)).size, 2)
})
test('T06: compte manquant conserve le partiel puis reprend uniquement cette destination', async () => {
  const h = harness(); h.db.accounts[1].status = 'disconnected'
  const both = { platforms: ['youtube', 'instagram'] }
  assert.equal((await h.invoke(both)).status, 'partially_published')
  h.db.accounts[1].status = 'connected'
  assert.equal((await h.invoke(both)).status, 'published'); assert.equal(h.counts().posts, 2)
})
for (const state of ['revoked', 'disconnected', 'expired', 'invalid-expiry']) test(`T06: compte ${state} refuse avant POST`, async () => {
  const h = harness()
  if (state === 'expired' || state === 'invalid-expiry') h.db.accounts[0].token_expires_at = state === 'expired' ? '2000-01-01T00:00:00Z' : 'bad'
  else h.db.accounts[0].status = state
  assert.equal((await h.invoke()).success, false); assert.equal(h.counts().posts, 0)
})
test('T06: revocation apres reservation empeche le POST', async () => {
  const h = harness()
  h.db.settings.hook = (table, mutation) => {
    if (table === 'social_publication_journals' && mutation?.operations?.length) h.db.accounts[0].status = 'revoked'
  }
  const result = await h.invoke()
  assert.equal(h.counts().posts, 0); assert.match(result.results[0].error!, /REVOKED/)
})
test('T06: revocation locale precedente a la panne distante; historique conserve et aucune repetition aveugle', async () => {
  const h = harness(); await h.invoke()
  const history = structuredClone(h.db.tables.social_posts); let calls = 0
  const disconnect = async () => { calls++; assert.equal(h.db.accounts[0].status, 'revoked'); return false }
  assert.deepEqual(await revokeSocialAccount(user, 'local-y', h.db.client, disconnect), { success: false, status: 'revoked', remoteStatus: 'unconfirmed' })
  const retried = await revokeSocialAccount(user, 'local-y', h.db.client, async () => { calls++; return true })
  assert.equal(retried.success, false); assert.equal(retried.remoteStatus, 'unconfirmed'); assert.equal(calls, 1)
  assert.deepEqual(h.db.tables.social_posts, history); assert.equal(h.db.accounts.length, 2)
  await assert.rejects(() => revokeSocialAccount('other', 'local-y', h.db.client, disconnect), /NOT_FOUND/)
  assert.equal(calls, 1)
})
test('T06: statut distant lisible apres revocation et arret autonomie, sans nouvelle autorisation POST', async () => {
  const h = harness(); h.db.config.publish_platforms = ['youtube']
  h.gateway.publish = async request => results(request, 'publishing')
  await publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway)
  h.db.config.is_active = false; h.db.accounts[0].status = 'revoked'
  const result = await publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway, true)
  assert.equal(result.status, 'published'); assert.equal(h.counts().gets, 1)
  assert.equal(h.counts().retries, 0); assert.equal(h.counts().replays, 0)
})
test('T06: timeout au-dela de la fenetre fournisseur conserve l incertitude sans replay', async () => {
  const h = harness(); h.gateway.publish = async () => { throw new Error('lost') }
  await h.invoke(); h.advance(24 * 3600_000)
  const result = await h.invoke()
  assert.equal(result.status, 'publishing'); assert.match(result.results[0].error!, /WINDOW_EXPIRED/)
  assert.equal(h.counts().replays, 0)
})
test('T06: horaire depasse apres reponse perdue ne devient jamais une publication immediate', async () => {
  const h = harness(); const scheduledAt = new Date(h.gateway.now() + 60_000).toISOString()
  h.gateway.publish = async () => { throw new Error('lost') }
  await h.invoke({ scheduledAt }); h.advance(120001)
  const result = await h.invoke({ scheduledAt })
  assert.match(result.results[0].error!, /SCHEDULE_RECONCILIATION_REQUIRED/); assert.equal(h.counts().replays, 0)
})
for (const change of ['revoked', 'external-id', 'media-hash']) test(`T06: replay refuse si ${change} a change`, async () => {
  const h = harness(); h.gateway.publish = async () => { throw new Error('lost') }
  await h.invoke(); h.advance(120001)
  if (change === 'revoked') h.db.accounts[0].status = 'revoked'
  if (change === 'external-id') h.db.accounts[0].external_id = secondAccount
  if (change === 'media-hash') h.db.video.shotstack_json!.sutraVerification.sha256 = 'b'.repeat(64)
  if (change === 'media-hash') {
    await assert.rejects(() => h.invoke(), /MEDIA_CHANGED/)
    assert.equal(h.counts().replays, 0)
    return
  }
  const result = await h.invoke()
  assert.equal(h.counts().replays, 0)
  assert.equal(h.db.tables.social_publication_journals[0].operations.length, 1)
  assert.match(result.results[0].error!, /REVOKED|MEDIA_CHANGED/)
})
test('T06: retry a reponse perdue ne peut jamais relancer un deuxieme retry sur statut failed', async () => {
  const h = harness(); let retries = 0
  h.gateway.publish = async request => results(request, 'failed')
  h.gateway.reconcile = async (_id, request) => results(request, 'failed')
  h.gateway.retry = async () => { retries++; throw new Error('lost retry') }
  await h.invoke(); await h.invoke(); await h.invoke()
  assert.equal(retries, 1); assert.equal(h.db.tables.social_publication_journals[0].operations[0].phase, 'retrying')
})
test('T06: panne de projection reparee depuis journal sans creation distante', async () => {
  const h = harness(); h.db.settings.failProjection = true
  await assert.rejects(() => h.invoke(), /projection/)
  h.db.settings.failProjection = false
  assert.equal((await h.invoke()).status, 'published'); assert.equal(h.counts().posts, 1)
})
for (const kind of ['video', 'auto']) for (const change of ['url', 'sha256']) test(`T06: succes ${kind} ne valide pas un nouvel export ${change}`, async () => {
  const h = harness()
  const invoke = () => kind === 'video' ? h.invoke() : publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway)
  await invoke()
  const before = h.counts().posts
  if (kind === 'video') {
    h.db.video.status = 'ready'
    if (change === 'url') h.db.video.video_url = h.db.video.shotstack_json!.sutraVerification.url = 'https://media.invalid/new.mp4'
    else h.db.video.shotstack_json!.sutraVerification.sha256 = 'b'.repeat(64)
  } else {
    h.db.auto.status = 'ready'
    if (change === 'url') h.db.auto.video_final_url = h.db.tables.video_jobs[0].progress.steps.assembly.verification.url = 'https://media.invalid/new.mp4'
    else h.db.tables.video_jobs[0].progress.steps.assembly.verification.sha256 = 'b'.repeat(64)
  }
  await assert.rejects(invoke, /MEDIA_CHANGED/)
  assert.equal(h.counts().posts, before)
  assert.equal((kind === 'video' ? h.db.video : h.db.auto).status, 'ready')
})
test('T06: import PR3 multi-destination conserve le succes et les identifiants historiques', async () => {
  const h = harness()
  const operation: PublicationOperation = { id: 'legacy', fingerprint: 'pr3', phase: 'recorded', createdAt: new Date().toISOString(),
    accountRows: { youtube: 'local-y', instagram: 'local-i' }, request: { videoUrl: h.db.video.video_url,
      caption: 'legacy', hashtags: [], platforms: ['youtube', 'instagram'], accountIds: { youtube: accountId, instagram: secondAccount } as PublishRequest['accountIds'], idempotencyKey: 'legacy' } }
  operation.results = results(operation.request).map(r => r.platform === 'instagram' ? { ...r, status: 'publishing', success: false } : r)
  h.db.video.publish_data = { sutraPublications: [operation] }
  await savePublicationHistory(user, 'v', [operation], h.db.client)
  const ids = h.db.tables.social_posts.map(r => r.id)
  const hash = createHash('sha256').update('legacy:youtube').digest('hex')
  assert.equal(ids[0], `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`)
  h.gateway.reconcile = async (_id, request) => results(request, 'failed')
  h.db.accounts[0].status = 'revoked'
  const outcome = await h.invoke({ platforms: ['youtube', 'instagram'] })
  assert.equal(outcome.status, 'partially_published'); assert.equal(outcome.results[0].status, 'published')
  assert.equal(h.counts().posts, 0); assert.equal(h.counts().retries, 0)
  assert.deepEqual(h.db.tables.social_posts.map(r => r.id), ids)
})
test('T06: ancien partiel PR2 sans identite compte reste intact, sans inference ni publication', async () => {
  const h = harness(); h.db.auto.status = 'partially_published'
  h.db.auto.published_platforms = [{ platform: 'youtube', status: 'published', success: true, postId }, { platform: 'instagram', status: 'failed', success: false }]
  const before = structuredClone(h.db.auto)
  const outcome = await publishAutoVideoRecord(user, 'v', true, h.db.client, undefined, h.gateway)
  assert.ok('reconciliationRequired' in outcome)
  assert.equal(outcome.reconciliationRequired, 'SUTRA_LEGACY_ACCOUNT_EVIDENCE_REQUIRED')
  assert.deepEqual(h.db.auto, before); assert.equal(h.counts().posts, 0)
})
for (const reason of ['inactive', 'approval', 'not-due', 'invalid-date', 'no-proof']) test(`T06: autonomie refuse ${reason}`, async () => {
  const h = harness()
  if (reason === 'inactive') h.db.config.is_active = false
  if (reason === 'approval') h.db.config.require_approval_before_publish = true
  if (reason === 'not-due') h.db.auto.scheduled_for = '2099-01-01T00:00:00Z'
  if (reason === 'invalid-date') h.db.auto.scheduled_for = null
  if (reason === 'no-proof') h.db.tables.video_jobs.length = 0
  await assert.rejects(() => publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway), /AUTHORIZED|VERIFICATION/)
  assert.equal(h.counts().posts, 0)
})
test('T06: approbation explicite autorise le media verifie meme avec mode automatique arrete', async () => {
  const h = harness(); h.db.config.is_active = false; h.db.auto.status = 'pending_approval'
  const outcome = await publishAutoVideoRecord(user, 'v', true, h.db.client, undefined, h.gateway)
  assert.equal(outcome.success, true); assert.equal(h.counts().posts, 2)
})
test('T06: autorisation retiree entre reservation et envoi ferme toute destination', async () => {
  const h = harness(); h.db.config.publish_platforms = ['youtube']
  h.db.settings.hook = (table, mutation) => { if (table === 'social_publication_journals' && mutation?.operations?.length) h.db.config.is_active = false }
  const outcome = await publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway)
  assert.equal(outcome.success, false); assert.equal(h.counts().posts, 0)
})
test('T06: controle service isole utilisateur et production, sans nouvelle requete', async () => {
  const h = harness(); await h.invoke()
  await assert.rejects(() => runPublicationJournal({ userId: 'other', productionId: 'v', kind: 'video', platforms: ['youtube'],
    request: { videoUrl: h.db.video.video_url, caption: '', hashtags: [] }, authorize: async () => {} }, h.db.client, h.gateway), /JOURNAL_INVALID/)
  assert.equal(h.counts().posts, 1)
})

for (const path of ['replay', 'retry'] as const) {
  for (const change of ['revoked', 'disconnected', 'external-id', 'media-hash', 'profile-revoked'] as const) {
    test(`T06: ${path} reautorise apres claim si ${change} change`, async () => {
      const h = harness()
      h.gateway.publish = path === 'replay' ? async () => { throw new Error('lost') } : async request => results(request, 'failed')
      h.gateway.reconcile = async (_id, request) => results(request, 'failed')
      await h.invoke(); h.advance(120001)
      const original = structuredClone(h.db.tables.social_publication_journals[0].operations[0].request)
      let changed = false
      h.db.settings.hook = (table, mutation) => {
        const op = mutation?.operations?.[0]
        if (changed || table !== 'social_publication_journals' || !op?.claimedAt) return
        changed = true
        if (change === 'revoked' || change === 'disconnected') h.db.accounts[0].status = change
        if (change === 'external-id') h.db.accounts[0].external_id = secondAccount
        if (change === 'media-hash') h.db.video.shotstack_json!.sutraVerification.sha256 = 'b'.repeat(64)
        if (change === 'profile-revoked') h.db.profile.access_revoked_at = new Date().toISOString()
      }
      // Media CAS can reject the projection, but the durable journal still records the refusal.
      await h.invoke().catch(error => { assert.match(error.message, /projection/) })
      assert.equal(changed, true)
      assert.equal(h.counts().replays + h.counts().retries, 0)
      const operation = h.db.tables.social_publication_journals[0].operations[0]
      assert.deepEqual(operation.request, original)
      assert.match(operation.results![0].error!, /REVOKED|MEDIA_CHANGED|ACCESS_DENIED/)
      if (path === 'retry') assert.equal(operation.phase, 'recorded', 'a POST never attempted must remain recoverable')
      h.db.settings.hook = undefined
      h.db.accounts[0].status = 'connected'; h.db.accounts[0].external_id = accountId
      h.db.video.shotstack_json!.sutraVerification.sha256 = 'a'.repeat(64); h.db.profile.access_revoked_at = null
      h.advance(120001)
      assert.equal((await h.invoke()).status, 'published')
      assert.equal(h.counts().replays + h.counts().retries, 1)
      assert.deepEqual(h.db.tables.social_publication_journals[0].operations[0].request, original)
    })
  }
  test(`T06: autonomie ${path} refuse une approbation retiree apres claim`, async () => {
    const h = harness(); h.db.config.publish_platforms = ['youtube']
    h.gateway.publish = path === 'replay' ? async () => { throw new Error('lost') } : async request => results(request, 'failed')
    h.gateway.reconcile = async (_id, request) => results(request, 'failed')
    const invoke = () => publishAutoVideoRecord(user, 'v', path === 'retry', h.db.client, undefined, h.gateway)
    await invoke(); h.advance(120001)
    h.db.settings.hook = (table, mutation) => {
      if (table === 'social_publication_journals' && mutation?.operations?.[0].claimedAt) h.db.config.publish_platforms = []
    }
    const outcome = await invoke()
    assert.equal(h.counts().replays + h.counts().retries, 0)
    assert.equal(outcome.success, false)
    assert.match(outcome.results[0].error!, /DESTINATION_REVOKED/)
  })
}
for (const kind of ['video', 'auto']) for (const reason of ['banned', 'revoked', 'missing', 'unreadable']) {
  test(`T06: profil ${reason} refuse la publication ${kind} service-role`, async () => {
    const h = harness()
    if (reason === 'banned') h.db.profile.subscription_status = 'banned'
    if (reason === 'revoked') h.db.profile.access_revoked_at = new Date().toISOString()
    if (reason === 'missing') h.db.tables.profiles.length = 0
    if (reason === 'unreadable') h.db.settings.failProfileRead = true
    await assert.rejects(() => kind === 'video' ? h.invoke() : publishAutoVideoRecord(user, 'v', false, h.db.client, undefined, h.gateway), /ACCESS_DENIED|ACCESS_UNAVAILABLE/)
    assert.equal(h.counts().posts + h.counts().replays + h.counts().retries, 0)
  })
}
test('T06: profil revoque bloque le premier POST apres claim mais permet reconciliation GET', async () => {
  const h = harness()
  h.db.settings.hook = (table, mutation) => {
    if (table === 'social_publication_journals' && mutation?.operations?.length) h.db.profile.access_revoked_at = new Date().toISOString()
  }
  const outcome = await h.invoke()
  assert.equal(h.counts().posts, 0); assert.match(outcome.results[0].error!, /ACCESS_DENIED/)
  h.db.settings.hook = undefined; h.db.profile.access_revoked_at = null
  h.gateway.replay = async request => results(request, 'publishing'); h.advance(120001)
  await h.invoke()
  h.db.profile.access_revoked_at = new Date().toISOString()
  assert.equal((await h.invoke()).status, 'published')
  assert.equal(h.counts().gets, 1); assert.equal(h.counts().posts + h.counts().retries, 0)
})
