import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FinancingReview } from '../src/app/financer/FinancingReview.tsx'
import { Step2 } from '../src/components/financer/Step2.tsx'
import AdminContestImport from '../src/app/(dashboard)/admin/contest/page.tsx'
import { officialAidUrl } from '../src/lib/financer-utils.ts'
import type { Aide } from '../src/types/financer.ts'

Object.assign(globalThis, { React })
// tsx may expose the default of a CommonJS-transformed TSX page under .default.
const AdminContestPage = (AdminContestImport as unknown as { default?: React.ComponentType }).default ?? AdminContestImport
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK') }
const aide: Aide = { id: 'fixture-aid', nom: 'Aide de test', type_aide: 'formation',
  profil_eligible: ['particulier'], situation_eligible: [], montant_max: 1000, taux_remboursement: 80,
  url_officielle: 'https://organisme.example.invalid/conditions', description: 'Conditions à vérifier',
  region: '', handicap_only: false, cumulable: false }
const noAction = () => { throw new Error('A render must not submit or generate anything') }

test('financing review reports unavailable PDFs and links to the selected official application', () => {
  const html = renderToStaticMarkup(React.createElement(FinancingReview, { aides: [aide], onBack: noAction }))
  assert.ok(html.includes('data-testid="financer-pdf-unavailable"'))
  assert.ok(html.includes('role="status"'))
  assert.ok(html.includes('Aucun dossier'))
  assert.ok(html.includes(`href="${aide.url_officielle}"`))
  assert.ok(html.includes('rel="noopener noreferrer"'))
  assert.ok(!html.includes('download=') && !html.includes('dossiers sont prets'))
  assert.ok(html.includes('Aucun financement'))
})

test('financing review does not turn an unsafe or missing source into a clickable official link', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,fixture', 'http://organisme.example.invalid', '//organisme.example.invalid', 'https://user:password@organisme.example.invalid', '']) {
    assert.equal(officialAidUrl(url), null)
    const html = renderToStaticMarkup(React.createElement(FinancingReview, { aides: [{ ...aide, url_officielle: url }], onBack: noAction }))
    assert.ok(!html.includes('<a '))
    assert.ok(html.includes('Lien officiel indisponible'))
  }
})

test('aid selection separates its toggle from the external link and promises only review', () => {
  const html = renderToStaticMarkup(React.createElement(Step2, { loading: false, aides: [aide], selectedAides: new Set([aide.id]),
    toggleAide: noAction, onBack: noAction, onNext: noAction }))
  assert.ok(html.includes('aria-pressed="true"'))
  assert.ok(html.includes('Vérifier les démarches'))
  for (const button of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) assert.ok(!button[1].includes('<a '))
  assert.ok(!html.includes('100%') && !html.includes('Generer') && !html.includes('coute 0'))
})

test('aid selection cannot advance while a lookup is unresolved', () => {
  const html = renderToStaticMarkup(React.createElement(Step2, { loading: true, aides: [], selectedAides: new Set([aide.id]),
    toggleAide: noAction, onBack: noAction, onNext: noAction }))
  assert.ok(html.includes('role="status"'))
  assert.ok(!html.includes('Vérifier les démarches ('))
})

test('contest administration renders an unavailable state with no unsupported mutation controls', () => {
  const html = renderToStaticMarkup(React.createElement(AdminContestPage))
  assert.ok(html.includes('data-testid="admin-contest-unavailable"'))
  assert.ok(html.includes('role="status"'))
  assert.ok(!html.includes('<button'))
  assert.ok(!html.includes('Aucun concours en cours'))
})
