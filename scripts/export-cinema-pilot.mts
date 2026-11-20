import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createCinemaProject, exportCinemaProjectJson } from '../src/lib/cinema-project.ts'
import { exportBlenderScript } from '../src/lib/blender-export.ts'

const destination = process.argv[2]
if (!destination) throw new Error('Usage: node --import tsx scripts/export-cinema-pilot.mts OUTPUT_DIRECTORY')
const storyboard = JSON.parse(await readFile(new URL('../qa/cinema/pilot-storyboard.json', import.meta.url), 'utf8'))
const project = createCinemaProject(storyboard)
const output = resolve(destination)
await mkdir(output, { recursive: true })
// Exclusive creation: a re-export cannot replace a user's edited script or manifest.
await writeFile(resolve(output, 'un-geste-circule.project.json'), exportCinemaProjectJson(project), { flag: 'wx' })
await writeFile(resolve(output, 'un-geste-circule.blender.py'), exportBlenderScript(project), { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ status: 'previsualization', scenes: project.scenes.length, frames: project.timeline.totalFrames, output })}\n`)
