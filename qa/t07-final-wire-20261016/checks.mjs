import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { join } from 'node:path'
import { autoOccurrences, computeNextRun } from '../../src/lib/sutra-auto-utils.ts'

export async function wireChecks({ page, base, fixture, output, check, details, wire }) {
  const configs = async () => (await wire.sql('SELECT * FROM sutra_auto_config WHERE user_id=$1', [fixture.user.id])).rows[0]
  const jobs = async () => (await wire.sql('SELECT * FROM video_jobs ORDER BY created_at')).rows
  const quota = async () => (await wire.sql('SELECT reserved,completed,released FROM video_quota_counters')).rows[0]
  const postCount = () => wire.evidence.requests.filter(r => r.path === '/api/production' && r.method === 'POST' && r.body.step !== 'cancel').length
  const patchCount = () => wire.evidence.requests.filter(r => r.path === '/api/auto/config' && r.method === 'PATCH').length
  const panel = page.getByTestId('production-request-status')
  const capture = async name => {
    // Framer transitions can still run with reduced motion; capture settled UI.
    for (const selector of ['main', 'main > div[style]', 'main fieldset > div[style]']) {
      for (const element of await page.locator(selector).all()) await expect(element).toHaveCSS('opacity', '1')
    }
    await page.screenshot({ path: join(output, name), fullPage: true })
  }
  const receipt = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), `sutra:production-intent:v1:${fixture.user.id}`)
  const start = async () => {
    await page.goto(base + '/production')
    await expect(page.getByTestId('production-idea')).toBeEnabled({ timeout: 20000 })
    await page.getByTestId('production-idea').fill('Preuve gratuite : fournisseur strictement simulé')
    await page.getByRole('button', { name: /^2\. Script/ }).click()
    await page.getByTestId('generate-script').evaluate(button => { button.click(); button.click() })
  }
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await check(`${width}: UI creates four canonical recurrences in SQL; DST uses persisted IANA zone`, async () => {
      await page.goto(base + '/auto/schedules')
      for (const [frequency, expected] of [['daily', '2026-10-07T00:30:00.000Z'], ['weekly', '2026-10-12T00:30:00.000Z'], ['biweekly', '2026-10-12T00:30:00.000Z'], ['monthly', '2026-11-02T01:30:00.000Z']]) {
        await page.getByTestId('schedule-add').click()
        await page.getByTestId('schedule-name').fill(`${frequency}-${width}`)
        await page.getByTestId('schedule-time').fill('02:30')
        await page.getByTestId('schedule-timezone').fill('Europe/Paris')
        await page.getByTestId(`schedule-freq-${frequency}`).click()
        const before = patchCount(), started = performance.now()
        await page.getByTestId('schedule-save').evaluate(button => { button.click(); button.click() })
        await expect(page.getByTestId('schedule-name')).toHaveCount(0)
        details.push({ measurement: 'save-ui-route-sql-ms', width, frequency, value: Math.round(performance.now() - started) })
        assert.equal(patchCount(), before + 1)
        const schedule = (await configs()).schedules.find(s => s.name === `${frequency}-${width}`)
        assert.equal(schedule.timezone, 'Europe/Paris'); assert.equal(schedule.frequency, frequency)
        assert.equal(computeNextRun(schedule, new Date('2026-10-06T12:00:00Z')).toISOString(), expected)
        if (frequency === 'daily') {
          for (const [from, through, at] of [['2027-03-28T00:00:00Z', '2027-03-28T04:00:00Z', '2027-03-28T01:00:00.000Z'], ['2026-10-25T00:00:00Z', '2026-10-25T04:00:00Z', '2026-10-25T01:30:00.000Z']]) {
            assert.deepEqual(autoOccurrences([schedule, schedule], new Date(from), new Date(through)).map(o => o.at.toISOString()), [at])
          }
        }
      }
      assert.equal(new Set((await configs()).schedules.map(s => s.id)).size, (await configs()).schedules.length)
    })
    await check(`${width}: save error is visible; explicit retry and database restart preserve exact schedule`, async () => {
      wire.faults.patch = true
      await page.getByRole('button', { name: `Mettre en pause le planning weekly-${width}`, exact: true }).click()
      await expect(page.getByTestId('schedule-save-error')).toBeVisible()
      assert.equal((await configs()).schedules.find(s => s.name === `weekly-${width}`).is_active, true)
      await expect(page.getByRole('main')).not.toContainText('SYNTHETIC_PRIVATE')
      wire.faults.patch = false
      await page.getByRole('button', { name: 'Vérifier et réessayer', exact: true }).click()
      await expect(page.getByRole('button', { name: `Reprendre le planning weekly-${width}`, exact: true })).toBeEnabled()
      const saved = (await configs()).schedules
      await wire.reopen(); await page.reload()
      await expect(page.getByRole('button', { name: `Reprendre le planning weekly-${width}`, exact: true })).toBeEnabled()
      assert.deepEqual((await configs()).schedules, saved)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      await capture(`schedules-${width}.png`)
    })
    await check(`${width}: preference saves once; runtime remains explicitly unconfirmed`, async () => {
      await page.goto(base + '/auto')
      await expect(page.getByTestId('auto-toggle')).toBeEnabled()
      const expected = !(await configs()).is_active, before = patchCount()
      await page.getByTestId('auto-toggle').evaluate(button => { button.click(); button.click() })
      await expect(page.getByTestId('auto-toggle')).toBeEnabled()
      await expect.poll(async () => (await configs()).is_active).toBe(expected)
      assert.equal(patchCount(), before + 1)
      await expect(page.getByTestId('auto-runtime-status')).toContainText('non vérifiable')
      // Global pause is restored through UI, never directly faked in SQL.
      if (!expected) { await page.getByTestId('auto-toggle').click(); await expect.poll(async () => (await configs()).is_active).toBe(true) }
    })
    await check(`${width}: lost submit ACK; UI cancel once, quota release and restart GET without resubmit`, async () => {
      const submits = postCount(), workers = wire.evidence.workerCalls
      const oldQuota = await quota(); wire.faults.loseSubmit = true
      await start(); await expect(panel).toContainText('État non confirmé.')
      const saved = await receipt(); assert.ok(saved.requestId); assert.equal(saved.jobId, undefined)
      assert.equal(postCount(), submits + 1); assert.equal(wire.evidence.workerCalls, workers)
      const job = (await jobs()).find(j => j.idempotency_key.endsWith(saved.requestId))
      assert.equal(job.status, 'queued'); assert.equal((await quota()).reserved, (oldQuota?.reserved ?? 0) + 1)
      wire.faults.loseCancel = true
      const cancelCount = wire.evidence.rpc.filter(n => n === 'cancel_video_job').length
      await page.getByTestId('production-cancel').evaluate(button => { button.click(); button.click() })
      await expect(panel).toContainText('Annulation non confirmée.')
      assert.equal(wire.evidence.rpc.filter(n => n === 'cancel_video_job').length, cancelCount + 1)
      assert.equal((await jobs()).find(j => j.id === job.id).status, 'cancelled')
      assert.equal((await quota()).released, (oldQuota?.released ?? 0) + 1)
      assert.equal((await receipt()).cancelRequested, true)
      await wire.reopen(); await page.reload()
      await expect(panel).toContainText('Annulation non confirmée.')
      wire.faults.read = true
      await page.getByTestId('production-resume').click()
      await expect(panel).toContainText('État non confirmé.')
      await expect(panel).not.toContainText('SYNTHETIC_PRIVATE')
      assert.equal(postCount(), submits + 1)
      wire.faults.read = false
      await page.getByTestId('production-resume').click()
      await expect(panel).toContainText('Annulation confirmée par le serveur.')
      assert.equal(await receipt(), null); assert.equal(postCount(), submits + 1)
      assert.equal(await wire.queue.claimJobByKey(job.idempotency_key, 'synthetic-restart-worker'), null)
      await capture(`cancel-recovered-${width}.png`)
    })
    await check(`${width}: already submitted provider receipt survives cancellation; stale completion cannot succeed`, async () => {
      const before = wire.evidence.workerCalls, oldQuota = await quota()
      await start()
      await expect.poll(() => wire.evidence.workerCalls).toBe(before + 1)
      await expect.poll(async () => (await jobs()).at(-1).provider_job_ids.fixture).toBe('synthetic-remote-already-submitted')
      const current = (await jobs()).at(-1)
      await page.getByTestId('production-cancel').click()
      await expect(panel).toContainText('Annulation confirmée par le serveur.')
      wire.releaseWorker()
      await expect.poll(async () => (await jobs()).find(j => j.id === current.id).status).toBe('cancelled')
      const cancelled = (await jobs()).find(j => j.id === current.id)
      assert.deepEqual(cancelled.provider_job_ids, current.provider_job_ids)
      assert.equal(cancelled.locked_by, null); assert.equal(cancelled.lease_until, null)
      assert.equal((await quota()).released, oldQuota.released + 1)
      assert.equal(await wire.queue.claimJobByKey(current.idempotency_key, 'late-worker'), null)
      await expect(panel).not.toContainText('Tâche terminée.')
      await expect(panel).toContainText('ni l’arrêt d’un fournisseur déjà lancé, ni un remboursement')
      await capture(`cancel-inflight-${width}.png`)
    })
  }
  await check('stored UI schedule reaches existing cron once across two ticks; pause prevents new occurrence', async () => {
    await page.goto(base + '/auto/schedules')
    const name = 'daily-1440'
    for (const s of (await configs()).schedules.filter(s => s.is_active && s.name !== name)) {
      await page.getByRole('button', { name: `Mettre en pause le planning ${s.name}`, exact: true }).click()
      await expect(page.getByRole('button', { name: `Reprendre le planning ${s.name}`, exact: true })).toBeEnabled()
    }
    await page.getByRole('button', { name: `Modifier le planning ${name}`, exact: true }).click()
    await page.getByTestId('schedule-timezone').fill('UTC')
    await page.getByTestId('schedule-time').fill(new Date().toISOString().slice(11,16))
    await page.getByTestId('schedule-save').click(); await expect(page.getByTestId('schedule-name')).toHaveCount(0)
    const first = await (await wire.tick()).json(), second = await (await wire.tick()).json()
    assert.equal(first.status, 'ok', JSON.stringify(first)); assert.equal(second.status, 'ok', JSON.stringify(second))
    const auto = (await jobs()).filter(j => j.kind === 'auto')
    assert.equal(auto.length, 1); assert.equal(auto[0].status, 'queued')
    assert.equal((await wire.sql('SELECT count(*)::int AS n FROM sutra_auto_videos')).rows[0].n, 1)
    assert.equal(wire.evidence.publicationCalls, 0); assert.equal(wire.evidence.providerCalls, 0)
    await page.getByRole('button', { name: `Mettre en pause le planning ${name}`, exact: true }).click()
    await expect(page.getByRole('button', { name: `Reprendre le planning ${name}`, exact: true })).toBeEnabled()
    assert.equal((await (await wire.tick()).json()).processed_count, 0)
    assert.equal((await jobs()).find(j => j.id === auto[0].id).status, 'queued', 'pause does not cancel an existing task')
    details.push({ boundary: 'UI -> config handler -> SQL -> manually invoked canonical cron', first, second, jobId: auto[0].id, runtimeDispatch: 'NOT_TESTED_DISABLED' })
  })
}
