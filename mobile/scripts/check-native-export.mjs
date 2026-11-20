import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const [directory, platform] = process.argv.slice(2)
assert.ok(directory && ['ios', 'android'].includes(platform), 'Expected an export folder and ios or android')
const metadata = JSON.parse(readFileSync(join(directory, 'metadata.json'), 'utf8'))
const { bundle } = metadata.fileMetadata[platform]
assert.ok(bundle.endsWith('.hbc'), 'Expected a compiled Hermes bundle')
const bytes = readFileSync(join(directory, bundle))

// These keys are registered by Expo Router in the shipped bundle.
for (const route of ['./(auth)/login.tsx', './(tabs)/dashboard.tsx', './editor/index.tsx']) {
  assert.ok(bytes.includes(route), `Missing ${platform} route: ${route}`)
}
