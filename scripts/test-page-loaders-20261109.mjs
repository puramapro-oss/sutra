import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
const root = path.resolve(import.meta.dirname, '..')
const walk = (node, fn) => { fn(node); ts.forEachChild(node, child => walk(child, fn)) }
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no)=>{resolve=yes;reject=no}); return {promise,resolve,reject} }
const nextTurn = () => new Promise(resolve => setImmediate(resolve))
// Execute the actual loader bodies and constants, with controlled network promises.
// This verifies async behavior; React mounting and a live browser are separate gates.
function constant(file, name, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let initializer
  walk(tree, node => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) initializer = node.initializer })
  assert.ok(initializer, `actual ${name} constant found`)
  const code = ts.transpileModule(`const captured = ${initializer.getText(tree)}; captured`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  return vm.runInNewContext(code, globals)
}
function harness(file, loaderName, extra={}) {
  const source=fs.readFileSync(path.join(root,file),'utf8'), tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let loader, effect;const setters=new Set()
  walk(tree,node=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===loaderName)loader=node.initializer.arguments[0]
    if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(tree)==='useState'&&ts.isArrayBindingPattern(node.name))setters.add(node.name.elements[1].name.getText(tree))
    if(ts.isCallExpression(node)&&node.expression.getText(tree)==='useEffect'&&node.arguments[0].getText(tree).includes(loaderName+'('))effect=node.arguments[0]
  })
  assert.ok(loader,'actual page loader found');assert.ok(effect,'actual cleanup effect found')
  const calls=[],requests=[],dataRequest={current:null}
  const context=vm.createContext({AbortController,Promise,console,dataRequest,profile:{id:'user-a'},authLoading:false,toast:{error(){}},...extra,fetch(url,options){const d=deferred();requests.push({url,options,...d});return d.promise}})
  for(const setter of setters)context[setter]=value=>calls.push({setter,value})
  function compile(node,name){const code=ts.transpileModule('const '+name+' = '+node.getText(tree)+';\n'+name, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return vm.runInContext(code,context)}
  const load=compile(loader,'capturedLoader');context[loaderName]=load
  return {load,effect:compile(effect,'capturedEffect'),context,calls,requests,dataRequest}
}
const achievements='src/app/(dashboard)/achievements/page.tsx'
test('actual Achievements loader ignores stale JSON completing after a newer refresh',async()=>{
  const h=harness(achievements,'loadFetchData');const firstJson=deferred()
  const old=h.load();h.requests[0].resolve({ok:true,json:()=>firstJson.promise});await nextTurn()
  const fresh=h.load();assert.equal(h.requests[0].options.signal.aborted,true)
  h.requests[1].resolve({ok:true,json:async()=>({achievements:['fresh'],totalXP:2,totalPoints:3})});await fresh
  firstJson.resolve({achievements:['stale'],totalXP:99,totalPoints:99});await old
  assert.deepEqual(h.calls.filter(x=>x.setter==='setAchievements').map(x=>x.value),[['fresh']])
  assert.equal(h.calls.filter(x=>x.setter==='setLoading').length,1)
})
test('actual Achievements effect cleanup aborts and prevents later state commits',async()=>{
  const h=harness(achievements,'loadFetchData');let pending
  h.context.loadFetchData=()=>{pending=h.load();return pending}
  const cleanup=h.effect();assert.equal(h.requests.length,1);cleanup()
  assert.equal(h.requests[0].options.signal.aborted,true)
  h.requests[0].resolve({ok:true,json:async()=>({achievements:['after-unmount']})});await pending
  assert.deepEqual(h.calls,[])
})
test('actual Achievements loader completes loading after a current request failure',async()=>{
  const h=harness(achievements,'loadFetchData');const promise=h.load();h.requests[0].reject(new Error('fixture network failure'));await promise
  assert.deepEqual(h.calls,[{setter:'setLoading',value:false}])
  assert.equal(h.dataRequest.current,null)
})
test('actual Autopilot Supabase loader passes abort signal and ignores a superseded query',async()=>{
  const queries=[]
  const supabase={from(){const d=deferred();const q={...d,select(){return q},eq(){return q},order(){return q},abortSignal(signal){q.signal=signal;return q},then(resolve,reject){return d.promise.then(resolve,reject)}};queries.push(q);return q}}
  const h=harness('src/app/(dashboard)/autopilot/page.tsx','loadFetchSeries',{supabase,userId:'user-a'})
  const old=h.load();const current=h.load();assert.equal(queries[0].signal.aborted,true)
  queries[1].resolve({data:['current-series']});await current
  queries[0].resolve({data:['stale-series']});await old
  assert.deepEqual(h.calls.filter(x=>x.setter==='setSeries').map(x=>x.value),[['current-series']])
})

const usagePage = 'src/app/(dashboard)/admin/api-usage/page.tsx'
const healthPage = 'src/app/(dashboard)/admin/health/page.tsx'
const SVC = constant(usagePage, 'SVC', { Zap() {}, Activity() {}, Cpu() {}, Server() {} })
const SERVICE_LABELS = constant('src/app/(dashboard)/admin/health/health-config.tsx', 'SERVICE_LABELS')

test('actual API usage loader keeps a measured zero distinct from missing and invalid costs', async () => {
  const h = harness(usagePage, 'fetchData', { SVC })
  const pending = h.load()
  assert.equal(h.requests[0].url, '/api/admin/stats?type=service_costs')
  h.requests[0].resolve({ ok: true, json: async () => ({ services: { claude: 12.5, runpod: 0, suno: -1, custom: 7 } }) })
  await pending
  const services = h.calls.find(call => call.setter === 'setServices').value
  const cost = key => services.find(service => service.service === key).recordedCost30d
  assert.equal(cost('claude'), 12.5)
  assert.equal(cost('runpod'), 0)
  assert.equal(cost('elevenlabs'), null)
  assert.equal(cost('suno'), null)
  assert.equal(cost('custom'), 7)
})

test('actual health loader preserves measurements without inventing unchecked service health or uptime', async () => {
  const h = harness(healthPage, 'fetchHealth', { SERVICE_LABELS })
  const pending = h.load()
  const timestamp = '2026-11-09T20:00:00.000Z'
  h.requests[0].resolve({ ok: true, json: async () => ({ timestamp, services: {
    supabase: { status: 'operational', latency_ms: 0 }, stripe: { status: 'degraded', latency_ms: 24 },
    elevenlabs: { status: 'unrecognized', latency_ms: -1 },
  } }) })
  await pending
  const services = h.calls.find(call => call.setter === 'setServices').value
  const database = services.find(service => service.key === 'supabase')
  assert.equal(database.status, 'operational'); assert.equal(database.latency_ms, 0); assert.equal(database.last_checked, timestamp)
  const unmeasured = services.find(service => service.key === 'claude')
  assert.equal(unmeasured.status, 'unknown'); assert.equal(unmeasured.latency_ms, null); assert.equal(unmeasured.last_checked, null)
  const invalid = services.find(service => service.key === 'elevenlabs')
  assert.equal(invalid.status, 'unknown'); assert.equal(invalid.latency_ms, null); assert.equal(invalid.last_checked, null)
  assert.ok(services.every(service => service.uptime_30d === null))
})

test('actual monitoring loaders clear old measurements on refresh failure and expose the error', async () => {
  for (const [file, loaderName, globals] of [[usagePage, 'fetchData', { SVC }], [healthPage, 'fetchHealth', { SERVICE_LABELS }]]) {
    const h = harness(file, loaderName, globals)
    const pending = h.load()
    h.requests[0].resolve({ ok: false })
    await pending
    const cleared = h.calls.find(call => call.setter === 'setServices').value
    assert.equal(cleared.length, 0)
    assert.ok(h.calls.find(call => call.setter === 'setError').value)
    assert.equal(h.calls.find(call => call.setter === 'setLoading').value, false)
  }
})

function contestDatabase(results) {
  let index = 0
  return { from() {
    const result = results[index++]
    assert.ok(result, 'unexpected contest query')
    const promise = Promise.resolve(result)
    const query = {
      select() { return query }, eq() { return query }, in() { return query },
      order() { return query }, limit() { return query }, abortSignal() { return query },
      maybeSingle() { return promise }, then(resolve, reject) { return promise.then(resolve, reject) },
    }
    return query
  } }
}
const contestPages = [
  ['src/app/(dashboard)/classement/page.tsx', 'fetchData'],
  ['src/app/(dashboard)/contest/page.tsx', 'loadFetchData'],
]
function contestResults() {
  return [
    { data: null, error: null }, { data: [], error: null },
    { data: [], error: null }, { data: [], error: null },
    { data: null, count: 0, error: null },
  ]
}
for (const [file, loader] of contestPages) {
  for (let failed = 0; failed < 4; failed++) {
    test(`actual ${loader} in ${file}: query ${failed + 1} failure cannot claim an empty competition`, async () => {
      const results = contestResults()
      results[failed] = { data: null, error: { message: 'fixture database unavailable' } }
      const h = harness(file, loader, { userId: 'user-a', supabase: contestDatabase(results) })
      await h.load()
      assert.ok(h.calls.find(call => call.setter === 'setLoadError').value)
      assert.equal(h.calls.find(call => call.setter === 'setActiveContest').value, null)
      assert.equal(h.calls.find(call => call.setter === 'setLoading').value, false)
    })
  }
}
test('actual contest loader cannot fabricate one participation when the exact count is absent', async () => {
  const results = contestResults(); results[4].count = null
  const h = harness(contestPages[1][0], contestPages[1][1], { userId: 'user-a', supabase: contestDatabase(results) })
  await h.load()
  assert.ok(h.calls.find(call => call.setter === 'setLoadError').value)
  assert.equal(h.calls.some(call => call.setter === 'setUserEntries'), false)
})
test('actual contest loader preserves a measured zero and an absent current competition', async () => {
  const h = harness(contestPages[1][0], contestPages[1][1], { userId: 'user-a', supabase: contestDatabase(contestResults()) })
  await h.load()
  assert.equal(h.calls.find(call => call.setter === 'setLoadError').value, null)
  assert.equal(h.calls.find(call => call.setter === 'setUserEntries').value, 0)
  assert.equal(h.calls.find(call => call.setter === 'setActiveContest').value, null)
  assert.equal(h.calls.find(call => call.setter === 'setHasSubmitted').value, false)
})
test('actual ranking loader clears an earlier unavailable state after successful reads', async () => {
  const h = harness(contestPages[0][0], contestPages[0][1], { userId: 'user-a', supabase: contestDatabase(contestResults()) })
  await h.load()
  assert.equal(h.calls.find(call => call.setter === 'setLoadError').value, null)
  assert.equal(h.calls.find(call => call.setter === 'setActiveContest').value, null)
  assert.equal(h.calls.find(call => call.setter === 'setHasSubmitted').value, false)
})
