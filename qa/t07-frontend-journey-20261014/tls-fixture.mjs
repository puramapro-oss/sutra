import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, chmod, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

export async function prepareTLS() {
  // Ephemeral synthetic TLS only. No system trust installation, repository key or master secret.
  const dir = await mkdtemp(resolve(tmpdir(), 'sutra-t07-test-tls-'))
  const key = resolve(dir, 'key.pem'), cert = resolve(dir, 'cert.pem')
  const generated = spawnSync('/usr/bin/openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' })
  assert.equal(generated.status, 0, 'synthetic TLS fixture generated')
  await chmod(key, 0o600)
  return { key, cert, options: { key: await readFile(key), cert: await readFile(cert) } }
}
