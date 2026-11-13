import assert from 'node:assert/strict'
import http from 'node:http'
import { resolve } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

// Real pages, forms, durable request hook and handoff. Only auth, routing and external APIs are fixtures.
const root = resolve(import.meta.dirname, '..')
const user = '00000000-0000-4000-8000-000000000017', other = '00000000-0000-4000-8000-000000000018'
const key = `sutra:storyboard-draft:v1:${user}`
const receiptKey = `sutra:create-intent:v1:${user}`
const original = { idea: 'Le souffle — forêt 🌿', format: '1:1', durationTarget: 'medium', scenes: [
  { id: 'plan-a', visual_prompt: 'A golden forest, wide shot', description: 'La lumière entre.\nLa forêt respire.', duration_seconds: 7, transition: 'fade' },
  { id: 'plan-b', visual_prompt: 'A mountain river from above', description: 'La rivière poursuit son chemin.', duration_seconds: 11, transition: 'cut' },
] }
const fixture = { version: 1, id: '00000000-0000-4000-8000-000000000019', userId: user, importCount: 0, source: original }
const expectedScript = 'La lumière entre. La forêt respire.\nLa rivière poursuit son chemin.'
const checks = [], requests = [], unexpected = [], errors = []
let completed = false, fatalError = null
const bundle = await build({
  absWorkingDir: root, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'process.env': '{}' }, logLevel: 'silent',
  stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React, {StrictMode} from 'react'; import {createRoot} from 'react-dom/client';
    import StoryboardPage from './src/app/(dashboard)/storyboard/page';
    import CreatePage from './src/app/(dashboard)/create/page';
    const root=createRoot(document.getElementById('root'));
    function render(){root.render(<StrictMode>{location.pathname==='/storyboard'?<StoryboardPage/>:<CreatePage/>}</StrictMode>)}
    window.addEventListener('popstate',render);render();
  ` },
  plugins: [{ name: 'storyboard-draft-fixtures', setup(builder) {
    builder.onResolve({ filter: /^(next\/(navigation|image|link)|next-intl|@\/hooks\/useAuth)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: root, contents:
      args.path === 'next/navigation'
        ? `export function useRouter(){return {push:(path)=>{history.pushState(null,'',path);window.dispatchEvent(new PopStateEvent('popstate'))}}}`
        : args.path === 'next-intl' ? `export function useTranslations(){return key=>key}`
          : args.path === 'next/link' ? `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`
            : args.path === 'next/image' ? `import React from 'react';export default function Image({fill,unoptimized,priority,...props}){return <img {...props}/>}`
              : `import {useSyncExternalStore} from 'react';
                const profiles={${JSON.stringify(user)}:{id:${JSON.stringify(user)},plan:'creator',monthly_video_count:0},${JSON.stringify(other)}:{id:${JSON.stringify(other)},plan:'creator',monthly_video_count:0}};
                let current={loading:Boolean(window.__initialLoading),profile:window.__initialLoading?undefined:profiles[${JSON.stringify(user)}]};const listeners=new Set();
                window.__switchAccount=id=>{current={loading:false,profile:profiles[id]};for(const notify of listeners)notify()};
                window.__resolveAuth=(id,plan)=>{profiles[id]={id,plan,monthly_video_count:0};window.__switchAccount(id)};
                const subscribe=notify=>{listeners.add(notify);return ()=>listeners.delete(notify)};
                export function useAuth(){return useSyncExternalStore(subscribe,()=>current,()=>current)}`,
    }))
  } }],
})
const server = http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store')
  if(req.url==='/app.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].text);return}
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>svg{width:20px;height:20px}button,input,textarea,select{margin:4px;min-height:30px}textarea{display:block;width:min(500px,90vw)}details{padding:8px}section{padding:8px}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>')
})
await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen))
const origin=`http://127.0.0.1:${server.address().port}`
let browser

async function runCase(name, run, seed={}) {
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:true})
  try {
    await context.addInitScript(({key,receiptKey,seed})=>{
      if(!sessionStorage.getItem('fixture:seeded')){
        if(seed.raw!==undefined)sessionStorage.setItem(key,seed.raw)
        if(seed.receipt!==undefined)sessionStorage.setItem(receiptKey,seed.receipt)
        sessionStorage.setItem('fixture:seeded','1')
      }
      const get=Storage.prototype.getItem,set=Storage.prototype.setItem
      window.__initialLoading=seed.loading??false
      window.__storageFailure=seed.failure??null
      Storage.prototype.getItem=function(k){if(this===sessionStorage&&k.startsWith('sutra:storyboard-draft:')&&window.__storageFailure==='read')throw new DOMException('Fixture denied','SecurityError');return get.call(this,k)}
      Storage.prototype.setItem=function(k,v){if(this===sessionStorage&&k.startsWith('sutra:storyboard-draft:')&&window.__storageFailure==='write')throw new DOMException('Fixture full','QuotaExceededError');return set.call(this,k,v)}
    },{key,receiptKey,seed})
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url())
      if(url.origin!==origin){unexpected.push({case:name,url:request.url(),disposition:'blocked'});return route.abort('blockedbyclient')}
      if(url.pathname.startsWith('/api/')){
        requests.push({case:name,path:url.pathname,method:request.method()})
        if(url.pathname==='/api/video/capabilities')return route.fulfill({json:{version:1,
          personal:{provider:'salad',allowed:false,available:false,state:'unavailable',reason:'FIXTURE',operations:[],profiles:[],quotaRemaining:null,
            cost:{currency:'USD',actualUsd:null,estimatedComputeUsd:null,basis:'compute-only-excludes-idle-storage-network'}},
          client:{mode:'api',availability:'unknown',reason:'PROVIDER_NOT_PROBED'}}})
        return route.fulfill({status:503,json:{error:'No backend or provider is available in this fixture'}})
      }
      return route.continue()
    })
    const page=await context.newPage();page.on('pageerror',error=>errors.push({case:name,error:error.message}))
    await run(page)
    checks.push({name,status:'PASS'})
  } catch(error){checks.push({name,status:'FAIL',error:String(error)});throw error}
  finally{await context.close()}
}
async function stored(page){return page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),key)}
async function step(page,number){await page.getByRole('button',{name:'Suivant',exact:true}).click();await expect(page.locator('nav[aria-label="Étapes de création manuelle"] [aria-current="step"]')).toHaveText(String(number))}
async function manualFields(page){
  await expect(page.getByTestId('mode-manual')).toHaveAttribute('aria-pressed','true')
  await step(page,2);await expect(page.getByTestId('topic-input')).toHaveValue(original.idea)
  await step(page,3);await expect(page.getByTestId('script-input')).toHaveValue(expectedScript)
  await step(page,4);await step(page,5)
  await expect(page.getByRole('button',{name:/1:1/})).toHaveAttribute('aria-pressed','true')
}
async function preparePage(page){
  await page.goto(`${origin}/storyboard`);await page.getByTestId('add-first-scene-btn').click()
  await page.getByLabel('Idee de video').fill(original.idea)
  for(let i=0;i<original.scenes.length;i++){
    if(i)await page.getByTestId('add-scene-btn').click()
    const scene=original.scenes[i],n=i+1
    await page.getByLabel(`Instruction visuelle du plan ${n}`,{exact:true}).fill(scene.visual_prompt)
    await page.getByLabel(`Description du plan ${n}`,{exact:true}).fill(scene.description)
    await page.getByLabel(`Durée du plan ${n} en secondes`,{exact:true}).fill(String(scene.duration_seconds))
    await page.getByLabel(`Transition du plan ${n}`,{exact:true}).selectOption(scene.transition)
  }
  await page.getByRole('button',{name:/^1:1/}).click()
}

try {
  browser=await chromium.launch({headless:true,executablePath:process.env.SUTRA_UI_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']})
  await runCase('real storyboard to explicit import; exact manual fields and complete original export',async page=>{
    await preparePage(page)
    await page.getByRole('button',{name:'Préparer un brouillon manuel',exact:true}).click()
    await expect(page).toHaveURL(`${origin}/create`)
    await expect(page.getByTestId('mode-auto')).toHaveAttribute('aria-pressed','true')
    await expect(page.getByTestId('topic-input')).toHaveValue('')
    await expect(page.locator('#storyboard-draft-limits')).toContainText('5 secondes')
    await expect(page.locator('#storyboard-draft-limits')).toContainText('ne seront pas reprises')
    const before=await stored(page);assert.equal(before.importCount,0)
    assert.deepEqual(before.source.scenes.map(scene=>({...scene,id:undefined})),original.scenes.map(scene=>({...scene,id:undefined})))
    await page.getByTestId('import-storyboard-draft-btn').click();await manualFields(page)
    const after=await stored(page);assert.equal(after.importCount,1);assert.deepEqual(after.source,before.source)
    await expect(page.getByTestId('import-storyboard-draft-btn')).toBeDisabled()
    await page.getByTestId('import-storyboard-draft-btn').evaluate(button=>{button.click();button.click()})
    assert.equal((await stored(page)).importCount,1)
    await page.getByText('Conserver le storyboard original complet',{exact:true}).click()
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByTestId('export-cinema-json-btn').click()])
    const stream=await download.createReadStream(),parts=[];for await(const part of stream)parts.push(Buffer.from(part))
    const project=JSON.parse(Buffer.concat(parts).toString('utf8'))
    assert.equal(project.format,'1:1');assert.deepEqual(project.scenes.map(x=>x.id),before.source.scenes.map(x=>x.id))
    assert.deepEqual(project.scenes.map(x=>x.duration_seconds),[7,11]);assert.deepEqual(project.scenes.map(x=>x.transition),['fade','cut'])
    assert.deepEqual(project.scenes.map(x=>x.description),original.scenes.map(x=>x.description))
    await page.reload();await expect(page.getByTestId('import-storyboard-draft-btn')).toBeDisabled()
    await expect(page.getByTestId('mode-auto')).toHaveAttribute('aria-pressed','true')
    await page.getByRole('checkbox',{name:/Je confirme le remplacement du brouillon affiché/}).check()
    await page.getByTestId('import-storyboard-draft-btn').click();assert.equal((await stored(page)).importCount,2)
  })
  await runCase('existing draft is preserved until replacement is explicitly confirmed',async page=>{
    await page.goto(`${origin}/create`);await page.getByTestId('topic-input').fill('Brouillon à conserver')
    await expect(page.getByTestId('import-storyboard-draft-btn')).toBeDisabled()
    await expect(page.getByTestId('topic-input')).toHaveValue('Brouillon à conserver')
    await page.getByRole('checkbox',{name:/Je confirme le remplacement du brouillon affiché/}).check()
    await page.getByTestId('import-storyboard-draft-btn').click();await manualFields(page)
  },{raw:JSON.stringify(fixture)})
  const receipt=JSON.stringify({version:1,userId:user,requestId:'00000000-0000-4000-8000-000000000020',body:JSON.stringify({topic:'Demande déjà admise',mode:'manual',script:'Ancien texte',format:'16:9'}),cancelRequested:false})
  await runCase('pending durable request blocks import and remains byte-for-byte unchanged',async page=>{
    await page.goto(`${origin}/create`);await expect(page.getByTestId('import-storyboard-draft-btn')).toBeDisabled()
    await expect(page.getByText('Demande retrouvée. Reprends le suivi pour connaître son état serveur.')).toBeVisible()
    await page.getByTestId('import-storyboard-draft-btn').evaluate(button=>button.click())
    assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),receiptKey),receipt)
    assert.equal((await stored(page)).importCount,0)
  },{raw:JSON.stringify(fixture),receipt})
  for(const failure of ['read','write'])await runCase(`storage ${failure} failure prevents navigation and keeps edited shots`,async page=>{
    await preparePage(page);await page.getByRole('button',{name:'Préparer un brouillon manuel',exact:true}).click()
    await expect(page).toHaveURL(`${origin}/storyboard`);await expect(page.getByRole('alert')).toContainText(/stockage/)
    await expect(page.getByLabel('Description du plan 1',{exact:true})).toHaveValue(original.scenes[0].description)
    await page.evaluate(()=>{window.__storageFailure=null})
    await page.getByRole('button',{name:'Préparer un brouillon manuel',exact:true}).click();await expect(page).toHaveURL(`${origin}/create`)
  },{failure})
  await runCase('storage write failure at import cannot mutate form or consume original',async page=>{
    await page.goto(`${origin}/create`);await page.evaluate(()=>{window.__storageFailure='write'})
    await page.getByTestId('import-storyboard-draft-btn').click();await expect(page.getByRole('alert')).toContainText(/stockage/)
    await expect(page.getByTestId('mode-auto')).toHaveAttribute('aria-pressed','true');await expect(page.getByTestId('topic-input')).toHaveValue('')
    assert.equal((await stored(page)).importCount,0)
  },{raw:JSON.stringify(fixture)})
  await runCase('corrupt handoff is reported without populating or submitting the form',async page=>{
    await page.goto(`${origin}/create`);await expect(page.getByRole('alert')).toContainText(/illisible/)
    await expect(page.getByTestId('import-storyboard-draft-btn')).toHaveCount(0)
    await page.getByTestId('topic-input').fill('Sujet indépendant');await expect(page.getByTestId('topic-input')).toHaveValue('Sujet indépendant')
  },{raw:'{'})
  await runCase('changed handoff refreshes context and invalidates the previous consent',async page=>{
    await page.goto(`${origin}/create`);await page.getByTestId('topic-input').fill('À préserver')
    await page.getByRole('checkbox',{name:/Je confirme le remplacement du brouillon affiché/}).check()
    const changed={...fixture,id:'00000000-0000-4000-8000-000000000021',source:{...original,idea:'Une nouvelle histoire'}}
    await page.evaluate(({key,changed})=>{sessionStorage.setItem(key,JSON.stringify(changed));window.dispatchEvent(new StorageEvent('storage',{key}))},{key,changed})
    await expect(page.getByRole('checkbox',{name:/Je confirme le remplacement du brouillon affiché/})).not.toBeChecked()
    await expect(page.getByTestId('import-storyboard-draft-btn')).toBeDisabled();await expect(page.getByTestId('topic-input')).toHaveValue('À préserver')
    await expect(page.getByRole('region',{name:'Brouillon manuel depuis le storyboard'})).toContainText('Une nouvelle histoire')
  },{raw:JSON.stringify(fixture)})
  await runCase('account switch clears visible form and storyboard state without exposing another owner’s draft',async page=>{
    await page.goto(`${origin}/create`);await page.getByTestId('import-storyboard-draft-btn').click()
    await page.evaluate(other=>window.__switchAccount(other),other)
    await expect(page.getByTestId('mode-auto')).toHaveAttribute('aria-pressed','true');await expect(page.getByTestId('topic-input')).toHaveValue('')
    await expect(page.getByTestId('import-storyboard-draft-btn')).toHaveCount(0)
    await page.evaluate(user=>window.__switchAccount(user),user);await expect(page.getByTestId('import-storyboard-draft-btn')).toBeDisabled()
    assert.equal((await stored(page)).importCount,1)
    await page.goto(`${origin}/storyboard`);await page.getByTestId('add-first-scene-btn').click()
    await page.evaluate(other=>window.__switchAccount(other),other)
    await expect(page.getByTestId('add-first-scene-btn')).toBeVisible();await expect(page.getByTestId('generate-video-btn')).toHaveCount(0)
  },{raw:JSON.stringify(fixture)})
  await runCase('preparing a different storyboard requires consent before replacing the stored original',async page=>{
    await preparePage(page);await page.getByLabel('Idee de video').fill('Autre projet à transférer')
    await page.getByRole('button',{name:'Préparer un brouillon manuel',exact:true}).click();await expect(page).toHaveURL(`${origin}/storyboard`)
    await expect(page.getByRole('alert')).toContainText('Un autre storyboard');assert.deepEqual(await stored(page),fixture)
    await page.getByRole('checkbox',{name:/Je confirme le remplacement du storyboard précédemment transféré/}).check()
    await page.getByRole('button',{name:'Préparer un brouillon manuel',exact:true}).click();await expect(page).toHaveURL(`${origin}/create`)
    const after=await stored(page);assert.notEqual(after.id,fixture.id);assert.equal(after.source.idea,'Autre projet à transférer')
  },{raw:JSON.stringify(fixture)})
  for(const [plan,engine] of [['creator','ltx-fast'],['admin','ltx-pro']])await runCase(`auth loading to ${plan} preserves the default engine and an empty draft`,async page=>{
    await page.goto(`${origin}/create`);await expect(page.getByTestId('mode-auto')).toHaveCount(0)
    await page.evaluate(({user,plan})=>window.__resolveAuth(user,plan),{user,plan})
    await expect(page.getByTestId(`engine-${engine}`)).toHaveAttribute('aria-pressed','true')
    await expect(page.getByTestId('import-storyboard-draft-btn')).toBeEnabled()
    await page.getByTestId('import-storyboard-draft-btn').click();await manualFields(page)
  },{raw:JSON.stringify(fixture),loading:true})
  assert.equal(checks.length,12)
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.ok(requests.every(request=>request.method==='GET'&&request.path==='/api/video/capabilities'))
  completed = true
} catch(error) {
  fatalError = String(error)
  throw error
} finally {
  await browser?.close();server.closeAllConnections();await new Promise(resolveClose=>server.close(resolveClose))
  const hashes={}
  for(const file of ['src/lib/storyboard-create-draft.ts','src/components/storyboard/StoryboardDraftImport.tsx','src/app/(dashboard)/storyboard/page.tsx','src/app/(dashboard)/create/page.tsx'])hashes[file]=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex')
  const output=resolve(root,'test-results/ci/storyboard-draft');await mkdir(output,{recursive:true})
  const receipt={status:completed?'PASS':'FAIL',fatalError,
    baseSha:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),source_sha256:hashes,checks,requests,unexpected,errors,
    externalRequestsAllowed:unexpected.filter(request=>request.disposition==='allowed').length,
    blockedExternalRequests:unexpected.length,automaticGenerationPosts:requests.filter(request=>request.method==='POST').length,
    scope:'Real React pages in StrictMode; synthetic auth/navigation/API boundaries; no production auth, provider or rendering claim'}
  await writeFile(resolve(output,'results.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2))
}
