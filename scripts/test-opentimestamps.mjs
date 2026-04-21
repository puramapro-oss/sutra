#!/usr/bin/env node
// Tests de non-régression pour src/lib/opentimestamps.ts + lib JS sous-jacente.
// Utilise node:test natif (Node 20+) — zéro dépendance ajoutée.
//
// Offline (défaut)         : node --test scripts/test-opentimestamps.mjs
//   → API surface, hashing, base64 round-trip, fabrication locale.
//   → Aucun appel réseau (pas de hit des calendars OpenTimestamps).
//
// Network (stamp réel OTS) : OTS_NETWORK=1 node --test scripts/test-opentimestamps.mjs
//   → Déclenche stamp() contre calendars publics (~1-2s).
//   → Valide deserialize → fileDigest round-trip.
//   → verify() n'est PAS testée ici (exigerait un proof Bitcoin-anchored,
//     donc 1h-24h d'attente) — sera couverte par le CRON upgrade côté prod.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import OpenTimestamps from 'javascript-opentimestamps'

const NETWORK = process.env.OTS_NETWORK === '1'

function sha256Of(data) {
  return createHash('sha256').update(data).digest()
}

test('API surface expected', () => {
  assert.ok(OpenTimestamps.DetachedTimestampFile, 'DetachedTimestampFile exposed')
  assert.ok(OpenTimestamps.Ops.OpSHA256, 'Ops.OpSHA256 exposed')
  assert.equal(typeof OpenTimestamps.stamp, 'function')
  assert.equal(typeof OpenTimestamps.verify, 'function')
  assert.equal(typeof OpenTimestamps.upgrade, 'function')
})

test('DetachedTimestampFile.fromHash stores the exact digest', () => {
  const data = Buffer.from('SUTRA test vidéo #1 — ' + Date.now())
  const digest = sha256Of(data)
  const df = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    digest,
  )
  const fileDigestHex = Buffer.from(df.fileDigest()).toString('hex')
  assert.equal(fileDigestHex, digest.toString('hex'), 'fileDigest() must match input sha256')
})

test('serializeToBytes returns non-empty Uint8Array with magic header', () => {
  const digest = sha256Of(Buffer.from('payload'))
  const df = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    digest,
  )
  const bytes = df.serializeToBytes()
  assert.ok(bytes instanceof Uint8Array, 'serializeToBytes returns Uint8Array')
  assert.ok(bytes.length > 20, 'serialized proof has plausible size')
  // Magic bytes attendus: \x00 + "OpenTimestamps" (15 bytes total for header start)
  const magicStart = Buffer.from(bytes.slice(0, 15)).toString('utf8')
  assert.ok(
    magicStart.includes('OpenTimestamps'),
    `header should contain 'OpenTimestamps' magic, got: ${magicStart}`,
  )
})

test('Different payloads produce different SHA-256 (collision sanity)', () => {
  const a = sha256Of(Buffer.from('payload A'))
  const b = sha256Of(Buffer.from('payload B'))
  assert.notEqual(a.toString('hex'), b.toString('hex'))
})

test('Base64 encode/decode of proof bytes is lossless', () => {
  const digest = sha256Of(Buffer.from('base64 round-trip check'))
  const df = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    digest,
  )
  const originalBytes = df.serializeToBytes()
  const b64 = Buffer.from(originalBytes).toString('base64')
  const roundBytes = Buffer.from(b64, 'base64')
  assert.equal(roundBytes.length, originalBytes.length)
  assert.equal(Buffer.compare(roundBytes, Buffer.from(originalBytes)), 0)
})

test('Purama sha256 contract : hex 64 chars lowercase', () => {
  const mockMp4 = Buffer.from('MP4 header ... 0xDEADBEEF ... video bytes')
  const hex = sha256Of(mockMp4).toString('hex')
  assert.equal(hex.length, 64)
  assert.match(hex, /^[0-9a-f]{64}$/)
})

test(
  'NETWORK : real stamp() → deserialize → fileDigest round-trip',
  { skip: !NETWORK },
  async () => {
    const data = Buffer.from('SUTRA network test ' + Date.now())
    const digest = sha256Of(data)
    const df = OpenTimestamps.DetachedTimestampFile.fromHash(
      new OpenTimestamps.Ops.OpSHA256(),
      digest,
    )
    // Hit des calendars publics — peut échouer si hors réseau.
    await OpenTimestamps.stamp(df)
    const bytes = df.serializeToBytes()
    assert.ok(bytes.length > 100, 'real stamp proof larger than pre-stamp skeleton')

    const restored = OpenTimestamps.DetachedTimestampFile.deserialize(Buffer.from(bytes))
    assert.equal(
      Buffer.from(restored.fileDigest()).toString('hex'),
      digest.toString('hex'),
      'round-trip preserves the file digest after real stamp',
    )
  },
)
