import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { join } from 'node:path'

export async function wireChecks({ page, base, fixture, output, check, details, wire }) {
  const panel = page.getByTestId('production-request-status')
  const receipt = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), `sutra:create-intent:v1:${fixture.user.id}`)
  const jobs = async () => (await wire.sql('SELECT * FROM video_jobs ORDER BY created_at')).rows
  const submits = () => wire.createRequests.filter(r => r.path === '/api/create').length
  const start = async () => {
    await page.goto(base + '/create')
    await page.getByTestId('topic-input').fill('Création de recette sans fournisseur réel')
    await expect(page.getByTestId('create-button')).toBeEnabled()
    await page.getByTestId('create-button').evaluate(button => { button.click(); button.click() })
  }
  const settled = async job => {
    const current = (await jobs()).find(j => j.id === job.id)
    assert.equal(current.status, 'cancelled')
    assert.equal(current.locked_by, null); assert.equal(current.lease_until, null)
    const events = (await wire.sql("SELECT * FROM activity_logs WHERE type='video_cancelled' AND metadata->>'job_id'=$1", [job.id])).rows
    assert.equal(events.length, 1); assert.equal(events[0].user_id, fixture.user.id)
    assert.equal(current.progress.effects['activity_logs:cancelled'], events[0].id)
    assert.equal((await wire.sql('SELECT sum(reserved)::int AS reserved FROM video_quota_counters')).rows[0].reserved, 0)
    assert.equal(await wire.queue.claimJobByKey(job.idempotency_key, 'late-fixture-worker'), null)
    return current
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: create lost ACK; reload; cancel ACK loss; GET confirms SQL/audit/quota without another POST`, async () => {
      const before = submits(), workers = wire.evidence.workerCalls
      wire.faults.loseSubmit = true
      await start(); await expect(panel).toContainText('État non confirmé.')
      const saved = await receipt(), job = (await jobs()).find(j => j.idempotency_key.endsWith(saved.requestId))
      assert.equal(job.status, 'queued'); assert.equal(submits(), before + 1); assert.equal(wire.evidence.workerCalls, workers)
      await page.reload(); await expect(panel).toContainText('Demande retrouvée.')
      await expect(page.getByTestId('create-button')).toBeDisabled()
      wire.faults.loseCancel = true
      const cancels = wire.evidence.rpc.filter(n => n === 'cancel_video_job').length
      await page.getByTestId('production-cancel').evaluate(button => { button.click(); button.click() })
      await expect(panel).toContainText('État non confirmé.')
      assert.equal((await receipt()).cancelRequested, true)
      assert.equal(wire.evidence.rpc.filter(n => n === 'cancel_video_job').length, cancels + 1)
      await settled(job)
      await wire.reopen(); await page.reload()
      await expect(panel).toContainText('Annulation non confirmée.')
      wire.faults.read = true
      await page.getByTestId('production-resume').click(); await expect(panel).toContainText('État non confirmé.')
      await expect(panel).not.toContainText('SYNTHETIC_PRIVATE')
      wire.faults.read = false
      await page.getByTestId('production-resume').click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
      assert.equal(await receipt(), null); assert.equal(submits(), before + 1)
      await settled(job)
      await page.screenshot({ path: join(output, `create-cancel-${width}.png`), fullPage: true })
    })
    await check(`${width}: early cancel 404 stays uncertain; late submission is cancelled with no replay`, async () => {
      const before = submits()
      wire.holdSubmission(); wire.faults.loseSubmit = true
      await start(); await expect(panel).toBeVisible()
      await expect.poll(submits).toBe(before + 1)
      const saved = await receipt()
      await page.getByTestId('production-cancel').click(); await expect(panel).toContainText('État non confirmé.')
      assert.equal((await jobs()).some(j => j.idempotency_key.endsWith(saved.requestId)), false)
      assert.equal((await receipt()).cancelRequested, true)
      wire.releaseSubmission()
      await expect.poll(async () => (await jobs()).some(j => j.idempotency_key.endsWith(saved.requestId))).toBe(true)
      await page.reload(); await expect(panel).toContainText('Annulation non confirmée.')
      await page.getByTestId('production-resume').click(); await expect(panel).toContainText('La tâche existe encore')
      assert.equal(submits(), before + 1)
      await page.getByTestId('production-cancel').click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
      const job = (await jobs()).find(j => j.idempotency_key.endsWith(saved.requestId))
      await settled(job); assert.equal(submits(), before + 1)
    })
    await check(`${width}: in-flight create cancellation preserves provider receipt and rejects stale completion`, async () => {
      const before = wire.evidence.workerCalls, posts = submits()
      await start(); await expect.poll(() => wire.evidence.workerCalls).toBe(before + 1)
      await expect.poll(async () => (await jobs()).at(-1).provider_job_ids.fixture).toBe('synthetic-remote-already-submitted')
      const job = (await jobs()).at(-1)
      await page.getByTestId('production-cancel').click(); await expect(panel).toContainText('Annulation confirmée par le serveur.')
      wire.releaseWorker()
      await expect.poll(async () => (await jobs()).find(j => j.id === job.id).status).toBe('cancelled')
      const current = await settled(job)
      assert.deepEqual(current.provider_job_ids, job.provider_job_ids); assert.equal(submits(), posts + 1)
      await expect(panel).not.toContainText('Tâche terminée.')
      await expect(panel).toContainText('ni l’arrêt d’un fournisseur déjà lancé, ni un remboursement')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    })
  }
  await check('repeated DELETE returns cancelled; one canonical audit receipt and quota release', async () => {
    const job = (await jobs())[0], requestId = job.idempotency_key.split(fixture.user.id + '-')[1]
    const response = await wire.control.DELETE(new Request(`https://sutra.example.test/api/create/status?requestId=${requestId}`, { method: 'DELETE' }))
    assert.equal(response.status, 200); assert.equal((await response.json()).status, 'cancelled')
    await settled(job)
    const totals = (await wire.sql('SELECT sum(reserved)::int AS reserved,sum(released)::int AS released FROM video_quota_counters')).rows[0]
    assert.deepEqual(totals, { reserved: 0, released: 6 })
    assert.equal(wire.evidence.providerCalls, 0); assert.equal(wire.evidence.publicationCalls, 0)
    details.push({ jobs: 6, auditEvents: 6, totals, generations: 0, publications: 0 })
  })
  for (const [name, status, body, title] of [
    ['quota', 403, {code:'SUTRA_GENERATION_FAILED'}, 'Limite du compte ou budget atteint'],
    ['disabled', 503, {code:'SALAD_DISABLED',submissionState:'not_submitted'}, 'Mode personnel distant indisponible'],
    ['profile', 503, {code:'SALAD_UNSUPPORTED_PROFILE',submissionState:'not_submitted'}, 'Format non pris en charge par le mode personnel'],
  ]) {
    await check(`conclusive ${name} refusal: classification, draft, no locked receipt or automatic retry`, async () => {
      let posts = 0
      await page.route('**/api/create', route => { posts++; return route.fulfill({ status, json:{...body,error:'SYNTHETIC_PRIVATE_DIAGNOSTIC'} }) })
      try {
        await start()
        await expect(page.getByText(title, {exact:true})).toBeVisible()
        await expect(page.getByTestId('create-button')).toBeEnabled()
        await expect(page.getByTestId('topic-input')).toHaveValue('Création de recette sans fournisseur réel')
        await expect(panel).toContainText('Demande refusée avant exécution.')
        await expect(panel).not.toContainText('SYNTHETIC_PRIVATE_DIAGNOSTIC')
        await expect(panel).not.toContainText('SALAD_')
        assert.equal(await receipt(), null); assert.equal(posts,1)
      } finally { await page.unroute('**/api/create') }
    })
  }

}
