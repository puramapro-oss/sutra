#!/usr/bin/env node
// Tests de la lib INSEE Sirene (hit l'API live portail-api.insee.fr).
//
// Offline : node --test scripts/test-insee.mjs
//   → Validation format SIRET/SIREN, mapping contract (pas d'I/O)
//
// Live    : INSEE_LIVE=1 node --test scripts/test-insee.mjs
//   → Appelle https://api.insee.fr/api-sirene/3.11/siret/{siret} avec clé .env.local
//
// SIRET de test utilisés (publics) :
//   - 55203222800026 → INSEE (l'organisme lui-même)
//   - 00000000000000 → invalid format check
//   - 99999999999999 → 404 not_found (format valide mais SIRET fictif)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const envRaw = readFileSync(resolve(rootDir, '.env.local'), 'utf8')
const env = Object.fromEntries(
  envRaw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)

const LIVE = process.env.INSEE_LIVE === '1'
const API_KEY = env.INSEE_API_KEY
const INSEE_BASE = 'https://api.insee.fr/api-sirene/3.11'

const SIRET_RE = /^\d{14}$/
const SIREN_RE = /^\d{9}$/

test('SIRET format validator', () => {
  assert.equal(SIRET_RE.test('55203222800026'), true)
  assert.equal(SIRET_RE.test('552032228'), false) // trop court (9 digits = SIREN)
  assert.equal(SIRET_RE.test('abc'), false)
  assert.equal(SIRET_RE.test(''), false)
  assert.equal(SIRET_RE.test('5520322280002600'), false) // trop long
})

test('SIREN format validator', () => {
  assert.equal(SIREN_RE.test('552032228'), true)
  assert.equal(SIREN_RE.test('55203222'), false)
  assert.equal(SIREN_RE.test('552032228a'), false)
})

test('INSEE_API_KEY presente dans .env.local', () => {
  assert.ok(API_KEY, 'INSEE_API_KEY should be in .env.local')
  assert.match(API_KEY, /^[0-9a-f-]{36}$/, 'looks like a UUID')
})

test('LIVE : SIRET INSEE Paris Club (47832593900021) → 200 avec denomination',
  { skip: !LIVE },
  async () => {
    const siret = '47832593900021'
    const res = await fetch(`${INSEE_BASE}/siret/${siret}`, {
      headers: {
        'X-INSEE-Api-Key-Integration': API_KEY,
        Accept: 'application/json',
      },
    })
    assert.equal(res.status, 200, `expected 200, got ${res.status}`)
    const json = await res.json()
    assert.equal(json.header?.statut, 200, `internal statut should be 200, got ${json.header?.statut}`)
    assert.ok(json.etablissement, 'response has etablissement')
    assert.equal(json.etablissement.siret, siret)
    const denomination =
      json.etablissement.uniteLegale?.denominationUniteLegale ??
      json.etablissement.uniteLegale?.nomUniteLegale
    assert.ok(denomination, 'denomination present')
    console.log(`    ↳ ${siret} = ${denomination}`)
  },
)

test('LIVE : SIRET fictif (99999999999999) → header.statut=404',
  { skip: !LIVE },
  async () => {
    const res = await fetch(`${INSEE_BASE}/siret/99999999999999`, {
      headers: {
        'X-INSEE-Api-Key-Integration': API_KEY,
        Accept: 'application/json',
      },
    })
    // INSEE peut renvoyer 200 HTTP avec header.statut=404 OU 404 HTTP direct
    const json = await res.json().catch(() => ({}))
    const internalStatus = json.header?.statut
    assert.ok(
      res.status === 404 || internalStatus === 404,
      `expected HTTP 404 or header.statut 404, got HTTP=${res.status} internal=${internalStatus}`,
    )
  },
)

test('LIVE : mauvaise clé → 401/403',
  { skip: !LIVE },
  async () => {
    const res = await fetch(`${INSEE_BASE}/siret/55203222800026`, {
      headers: {
        'X-INSEE-Api-Key-Integration': 'bad-key-deadbeef',
        Accept: 'application/json',
      },
    })
    assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`)
  },
)
