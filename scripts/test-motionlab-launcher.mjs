import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const launcher = fileURLToPath(new URL('../public/motion/lancer-motionlab.mjs', import.meta.url))

test('local MotionLab launcher checks the brief and opens Codex in the chosen kit with an intact, unique copy', async t => {
  const root = await mkdtemp(join(tmpdir(), 'sutra-motionlab-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const kit = join(root, 'Mon kit MotionLab')
  const file = join(root, 'Brief de création.txt')
  const log = join(root, 'codex-calls.jsonl')
  await mkdir(kit)
  await writeFile(join(root, 'codex'), `#!${process.execPath}\nconst fs=require('node:fs');\nfs.appendFileSync(process.env.CALL_LOG,JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)})+'\\n');\nconsole.log('Codex local de test');\n`, { mode: 0o700 })
  const launch = (...args) => spawnSync(process.execPath, [launcher, ...args], {
    encoding: 'utf8', env: { ...process.env, CALL_LOG: log, PATH: root + delimiter + process.env.PATH },
  })
  const text = '/full-visual Prépare les plans.\n' + 'Un plan avec sa lumière 🌿.\n'.repeat(7000)
  await writeFile(file, text)
  const checked = launch('--check', kit, file)
  assert.equal(checked.status, 0, checked.stderr)
  assert.deepEqual(await readdir(kit), [])
  for (let i = 0; i < 2; i++) {
    const result = launch(kit, file)
    assert.equal(result.status, 0, result.stderr)
  }
  const files = await readdir(kit)
  assert.equal(files.length, 2)
  const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  const runs = calls.filter(call => call.args[0] !== '--version')
  assert.equal(runs.length, 2)
  for (const call of runs) {
    assert.equal(call.cwd, await realpath(kit))
    assert.equal(call.args.length, 1)
    const name = call.args[0].match(/^\/full-visual .* (sutra-brief-[a-f0-9-]+\.txt) dans ce dossier\.$/)?.[1]
    assert.ok(files.includes(name))
    assert.equal(await readFile(join(kit, name), 'utf8'), text)
  }
  for (const invalid of ['Brief ChatGPT', '/full-visual ' + '🎬'.repeat(140_000)]) {
    await writeFile(file, invalid)
    assert.equal(launch(kit, file).status, 1)
  }
  assert.deepEqual(await readdir(kit), files)
  assert.equal((await readFile(log, 'utf8')).trim().split('\n').length, 5)
})
