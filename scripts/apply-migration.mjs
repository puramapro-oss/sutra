#!/usr/bin/env node
// Applique une migration SQL sur la DB Supabase self-hosted (VPS 72.62.191.111).
// Usage : node scripts/apply-migration.mjs <nom_fichier.sql>
// Ex    : node scripts/apply-migration.mjs v7_1_connect_karma_ots.sql
// Routage : ssh → docker exec supabase-db psql (Supavisor pooler refuse psql direct multi-tenant).
// Idempotent : migrations Purama utilisent CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS.

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

const fileName = process.argv[2]
if (!fileName) {
  console.error('Usage : node scripts/apply-migration.mjs <file.sql>')
  process.exit(1)
}

const VPS_HOST = process.env.VPS_IP || '72.62.191.111'
const VPS_USER = 'root'
const VPS_PASS = process.env.VPS_SSH_PASS || '+Awy3cwg;NoutOTH'
const DB_CONTAINER = 'supabase-db'

const sqlPath = resolve(rootDir, 'migrations', fileName)
const sql = readFileSync(sqlPath, 'utf8')
console.log(`[migration] Loaded ${fileName} (${sql.length} bytes)`)

// Copie via scp puis exécution via docker exec psql -f
const remotePath = `/tmp/purama-migration-${Date.now()}-${basename(fileName)}`

// 1. scp du fichier sur le VPS
console.log(`[migration] scp → ${VPS_HOST}:${remotePath}`)
const scp = spawnSync(
  'sshpass',
  ['-p', VPS_PASS, 'scp', '-o', 'StrictHostKeyChecking=no', sqlPath, `${VPS_USER}@${VPS_HOST}:${remotePath}`],
  { stdio: 'inherit' }
)
if (scp.status !== 0) {
  console.error('[migration] ❌ scp failed')
  process.exit(1)
}

// 2. docker cp dans le container supabase-db
console.log(`[migration] docker cp → ${DB_CONTAINER}${remotePath}`)
const dockerCp = spawnSync(
  'sshpass',
  [
    '-p', VPS_PASS, 'ssh', '-o', 'StrictHostKeyChecking=no', `${VPS_USER}@${VPS_HOST}`,
    `docker cp ${remotePath} ${DB_CONTAINER}:${remotePath} && rm ${remotePath}`,
  ],
  { stdio: 'inherit' }
)
if (dockerCp.status !== 0) {
  console.error('[migration] ❌ docker cp failed')
  process.exit(1)
}

// 3. psql -f dans le container
const start = Date.now()
console.log(`[migration] psql -f ${remotePath}`)
const psql = spawnSync(
  'sshpass',
  [
    '-p', VPS_PASS, 'ssh', '-o', 'StrictHostKeyChecking=no', `${VPS_USER}@${VPS_HOST}`,
    `docker exec -e PGOPTIONS='-c search_path=sutra,public' ${DB_CONTAINER} psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f ${remotePath} && docker exec ${DB_CONTAINER} rm ${remotePath}`,
  ],
  { stdio: 'inherit' }
)

const ms = Date.now() - start
if (psql.status !== 0) {
  console.error(`[migration] ❌ psql failed (${ms}ms)`)
  process.exit(1)
}

console.log(`[migration] ✅ ${fileName} applied in ${ms}ms`)
