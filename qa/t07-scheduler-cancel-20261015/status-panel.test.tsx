import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ProductionRequestStatus from '../../src/components/production/ProductionRequestStatus'

// tsx uses the repository's preserved JSX setting; Next applies the automatic transform.
Object.assign(globalThis, { React })

test('an unreadable recovery receipt is unknown, never a false empty state', () => {
  const html = renderToStaticMarkup(<ProductionRequestStatus intent={null} busy={false} cancelling={false}
    message="" error="Reçu local indisponible. Contacte le support avant de relancer une production."
    onResume={() => {}} onCancel={() => {}} />)
  assert.ok(html.includes('role="alert"'))
  assert.ok(!html.includes('Aucune demande en cours'), 'a corrupt receipt cannot certify an empty queue')
})

test('an empty readable session can show an idle state', () => {
  const html = renderToStaticMarkup(<ProductionRequestStatus intent={null} busy={false} cancelling={false}
    message="" error={null} onResume={() => {}} onCancel={() => {}} />)
  assert.ok(html.includes('Aucune demande en cours'))
  assert.ok(!html.includes('role="alert"'))
})


test('lost submission receipt still permits read-only reconciliation after cancellation', () => {
  const html = renderToStaticMarkup(<ProductionRequestStatus intent={{ version: 1, userId: 'fixture',
    requestId: '11111111-1111-4111-8111-111111111111', step: 'script', body: '{}', cancelRequested: true }}
    busy={false} cancelling={false} message="Annulation non confirmée." error={null}
    onResume={() => {}} onCancel={() => {}} />)
  const resume = html.match(/<button[^>]*data-testid="production-resume"[^>]*>/)?.[0]
  assert.ok(resume)
  assert.ok(!/\sdisabled(?:=|\s|>)/.test(resume), 'GET lookup is safe even without a jobId after cancellation')
})
