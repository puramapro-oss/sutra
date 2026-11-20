import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '../..'), proof = resolve(root, 'qa/t05-final-media-20261015')
const config = Object.fromEntries(['PATH','HOME','TMPDIR','TMP','TEMP','SystemRoot'].flatMap(k => process.env[k] ? [[k,process.env[k]]] : []))
mkdirSync(`${proof}/temporary`, {recursive:true})
Object.assign(config, { PATH:`${proof}/cpu-bin:/opt/homebrew/opt/ffmpeg-full/bin:${config.PATH || ''}`,
 TMPDIR:`${proof}/temporary`, FFMPEG_MAX_CONCURRENT_JOBS:'1', NODE_OPTIONS:`--require=${root}/qa/t08/offline.cjs`,
 CI:'1', NEXT_TELEMETRY_DISABLED:'1', OTS_NETWORK:'0', LTX_TRACK_DB:'0',
 NEXT_PUBLIC_SUPABASE_URL:'https://sutra-test.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY:'synthetic-service', NEXT_PUBLIC_APP_SCHEMA:'sutra' })
const groups = {
 failures:['--import','tsx','--test','--test-name-pattern=failures:','scripts/test-t05-final-media.mts'],
 variants:['--import','tsx','--test','--test-name-pattern=variants:','scripts/test-t05-final-media.mts'],
 limits:['--import','tsx','--test','--test-name-pattern=limits:','scripts/test-t05-final-media.mts'],
 resources:['--import','tsx','--test','--test-name-pattern=resource:','scripts/test-t05-final-media.mts'],
 media:['--import','tsx','--test','--test-name-pattern=media:','scripts/test-t05-final-media.mts'],
 regression:['--import','tsx','--test','src/lib/ffmpeg-concurrency.test.ts'],
 typecheck:['node_modules/typescript/bin/tsc','--noEmit','-p','qa/t05-final-media-20261015/tsconfig.json'],
 lint:['node_modules/eslint/bin/eslint.js','scripts/test-t05-final-media.mts','qa/t05-final-media-20261015/helpers.mts','qa/t05-final-media-20261015/run-targeted.mjs', 'src/lib/ffmpeg-concurrency.ts','src/lib/ffmpeg-compositor.ts','src/lib/ffmpeg-encoder.ts']
}
for (const name of process.argv.slice(2)) {
 if (!Object.hasOwn(groups,name)) throw new Error('Explicit delta group required')
 const stamp = new Date().toISOString().replace(/[:.]/g,'-')
 const result = spawnSync('/usr/bin/time',['-l',process.execPath,...groups[name]], {cwd:root,env:{...config,T05_FINAL_GROUP:name,T05_FINAL_STAMP:stamp},encoding:'utf8',timeout:360000,maxBuffer:8*1024*1024})
 writeFileSync(`${proof}/${name}-${stamp}.txt`,(result.stdout||'')+(result.stderr||'')+(result.error ? `\n${result.error.name}\n`:''))
 process.stdout.write(`${name}: exit=${result.status} evidence=${name}-${stamp}.txt\n`)
 if(result.status!==0) process.exit(result.status||1)
}
