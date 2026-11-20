// Dans un terminal : node lancer-motionlab.mjs [--check] <dossier-MotionLab> <brief-SUTRA.txt>
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { open, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const limit = 512 * 1024
const args = process.argv.slice(2)
const checkOnly = args[0] === '--check'
if (checkOnly) args.shift()

async function run() {
  if (args.length !== 2) throw new Error('Usage : node lancer-motionlab.mjs [--check] <dossier-MotionLab> <brief-SUTRA.txt>')
  const directory = resolve(args[0])
  if (!(await stat(directory)).isDirectory()) throw new Error('Sélectionne le dossier de ton exemplaire de MotionLab.')
  const briefPath = resolve(args[1])
  if (!(await stat(briefPath)).isFile()) throw new Error('Sélectionne le brief texte téléchargé depuis SUTRA.')
  const brief = await open(briefPath)
  let text
  try {
    const data = Buffer.alloc(limit + 1)
    let size = 0
    while (size < data.length) {
      const { bytesRead } = await brief.read(data, size, data.length - size)
      if (!bytesRead) break
      size += bytesRead
    }
    if (size > limit) throw new Error('Le brief dépasse 512 Kio.')
    text = new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(0, size))
    if (!text.startsWith('/full-visual ')) throw new Error('Utilise le bouton « Télécharger le brief MotionLab » dans SUTRA.')
  } finally {
    await brief.close()
  }

  const probe = spawnSync('codex', ['--version'], { cwd: directory, encoding: 'utf8', timeout: 5000 })
  if (probe.status !== 0) throw new Error('La commande codex est indisponible. Ouvre ton dossier MotionLab dans Codex et donne-lui le brief.')
  if (checkOnly) {
    process.stdout.write(`Dossier accessible, brief reconnu, ${probe.stdout.trim()}.\n`)
    return
  }
  // A short, generated relative name also supports large briefs and spaces in the creator's paths.
  const name = `sutra-brief-${randomUUID()}.txt`
  await writeFile(join(directory, name), text, { flag: 'wx', mode: 0o600 })
  process.stdout.write(`Brief conservé dans le dossier MotionLab sous ${name}.\n`)
  const session = spawnSync('codex', [`/full-visual Utilise le brief SUTRA du fichier ${name} dans ce dossier.`], {
    cwd: directory, stdio: 'inherit',
  })
  if (session.error) throw new Error(`Impossible d’ouvrir la session Codex. Le brief est disponible dans ${name}.`)
  process.exitCode = session.status ?? 1
}

run().catch(error => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
