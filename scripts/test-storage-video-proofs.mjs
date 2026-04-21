#!/usr/bin/env node
// Test E2E du bucket Supabase Storage "video-proofs".
// Usage : node scripts/test-storage-video-proofs.mjs
//
// Scénario :
//   1. Service_role uploade un .ots fake → 200
//   2. URL publique renvoie les bytes (SELECT public) → 200
//   3. Anon tente d'uploader → 401/403 (policy bloque)
//   4. Service_role delete le fichier → 200
//
// Prérequis : .env.local avec NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//             + NEXT_PUBLIC_SUPABASE_ANON_KEY.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// Charge .env.local manuellement (pas de dep dotenv)
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

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BUCKET = 'video-proofs'

if (!SUPA_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('❌ Missing .env.local keys (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const testPath = `test/${Date.now()}.ots`
const testBytes = Buffer.from('FAKE_OTS_PROOF_' + Math.random().toString(36).slice(2))
let passed = 0
let failed = 0

function logOk(msg) {
  console.log(`✔ ${msg}`)
  passed++
}
function logFail(msg, detail) {
  console.log(`✖ ${msg}${detail ? `: ${detail}` : ''}`)
  failed++
}

// 1. Upload via service_role → doit réussir
async function testServiceUpload() {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${testPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/octet-stream',
      'apikey': SERVICE_KEY,
    },
    body: testBytes,
  })
  if (res.ok) {
    logOk(`service_role upload (${res.status})`)
  } else {
    logFail(`service_role upload (${res.status})`, await res.text())
  }
}

// 2. Download public (pas d'auth) → doit réussir
async function testPublicRead() {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/public/${BUCKET}/${testPath}`)
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer())
    if (Buffer.compare(buf, testBytes) === 0) {
      logOk(`public read (${res.status}, bytes match)`)
    } else {
      logFail('public read bytes mismatch', `expected ${testBytes.length}B got ${buf.length}B`)
    }
  } else {
    logFail(`public read (${res.status})`, await res.text())
  }
}

// 3. Upload via anon → doit être refusé (policy service_role only)
async function testAnonUploadRejected() {
  const anonPath = `test/anon-attack-${Date.now()}.ots`
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${anonPath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/octet-stream',
      'apikey': ANON_KEY,
    },
    body: Buffer.from('ATTACK'),
  })
  if (res.status === 401 || res.status === 403 || res.status === 400) {
    logOk(`anon upload rejected (${res.status})`)
  } else {
    logFail(`anon upload should be rejected (got ${res.status})`, await res.text())
  }
}

// 4. Delete via service_role → cleanup
async function testServiceDelete() {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${testPath}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
  })
  if (res.ok) {
    logOk(`service_role delete (${res.status})`)
  } else {
    logFail(`service_role delete (${res.status})`, await res.text())
  }
}

try {
  await testServiceUpload()
  await testPublicRead()
  await testAnonUploadRejected()
  await testServiceDelete()
} catch (err) {
  logFail('uncaught exception', err.message)
}

console.log(`\nResult: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
