import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'../..'), proof=resolve(import.meta.dirname)
const config=Object.fromEntries(['PATH','HOME','TMPDIR','TMP','TEMP','SystemRoot'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[]))
mkdirSync(`${proof}/temporary`,{recursive:true})
Object.assign(config,{PATH:`${root}/qa/t05-final-media-20261015/cpu-bin:/opt/homebrew/opt/ffmpeg-full/bin:${config.PATH||''}`,
  TMPDIR:`${proof}/temporary`,FFMPEG_MAX_CONCURRENT_JOBS:'1',NODE_OPTIONS:`--require=${root}/qa/t08/offline.cjs`,
  CI:'1',NEXT_TELEMETRY_DISABLED:'1',OTS_NETWORK:'0',LTX_TRACK_DB:'0',
  NEXT_PUBLIC_SUPABASE_URL:'https://sutra-test.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',NEXT_PUBLIC_APP_SCHEMA:'sutra'})
const groups={
  shotstack:['--import','tsx','--test','qa/t01-closure-20261015/shotstack-boundary.test.mts'],
  ready:['--import','tsx','--test','--test-name-pattern=^(AUTO|EXPORT):','scripts/test-release-regressions.mts'],
  concurrency:['--import','tsx','--test','src/lib/ffmpeg-concurrency.test.ts'],
  media:['--import','tsx','--test','qa/t05-final-f360-20261016/retest.mts'],
  typecheck:['node_modules/typescript/bin/tsc','--noEmit','-p','qa/t05-final-f360-20261016/tsconfig.json'],
  lint:['node_modules/eslint/bin/eslint.js','qa/t05-final-f360-20261016/retest.mts','qa/t05-final-f360-20261016/run.mjs'],
}
for(const name of process.argv.slice(2)) {
  if(!Object.hasOwn(groups,name)) throw new Error('Explicit group required')
  const result=spawnSync('/usr/bin/time',['-l',process.execPath,...groups[name]],{cwd:root,env:config,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024})
  writeFileSync(`${proof}/${name}.txt`,(result.stdout||'')+(result.stderr||'')+(result.error?`\n${result.error.name}\n`:''))
  process.stdout.write(`${name}: exit=${result.status}\n`)
  if(result.status!==0) process.exit(result.status||1)
}
