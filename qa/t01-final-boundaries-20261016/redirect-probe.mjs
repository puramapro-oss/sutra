import { createServer } from 'node:https'
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { chromium, webkit } from '@playwright/test'
import { prepareTLS } from '../t07-frontend-journey-20261014/tls-fixture.mjs'
import { startFixture } from '../t07-frontend-journey-20261014/fixture.mjs'
const tls = await prepareTLS(), fixture = await startFixture(tls.options)
const media = fixture.url + '/storage/v1/object/sign/sutra-assets/owners/' + fixture.user.id + '/fixture.mp4?token=fixture-only'
const app = createServer(tls.options, (req,res) => {
 if (req.url === '/api/media/test') {res.writeHead(307, {'Location':media,'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Vary':'Cookie'}); return res.end()}
 res.setHeader('Content-Type','text/html'); res.end(`<button id="go">download</button><script>
 go.onclick=async()=>{window.result={};const c=new AbortController();const t=setTimeout(()=>c.abort(),30000);try{const r=await fetch('/api/media/test',{signal:c.signal,credentials:'same-origin'});window.result.headers=true;await r.blob();window.result.body=true}catch(e){window.result.error=e.name}finally{clearTimeout(t)}};
 </script>`)
})
app.listen(0,'127.0.0.1');await once(app,'listening');const origin=`https://127.0.0.1:${app.address().port}`
const receipts=[]
try {for(const engine of ['chromium','webkit']) {
 const browser=await ({chromium,webkit}[engine]).launch();
 try{for(const clock of [false,true]) {
 const context=await browser.newContext({ignoreHTTPSErrors:true});await context.route('**/*',route=>[origin,fixture.url].includes(new URL(route.request().url()).origin)?route.continue():route.abort());
 const page=await context.newPage(),events=[];page.on('response',r=>events.push({path:new URL(r.url()).pathname,status:r.status(),type:r.request().resourceType()}));await page.goto(origin);
 fixture.state.mediaMode='normal';await page.click('#go');await page.waitForFunction(()=>window.result?.body);events.length=0;
 fixture.state.mediaMode='hang';if(clock)await page.clock.install();await page.click('#go');await new Promise(done=>setTimeout(done,500));
 const before=await page.evaluate(()=>window.result);if(clock)await page.clock.fastForward(31000);
 await new Promise(done=>setTimeout(done,100));receipts.push({engine,clock,events,before,after:await page.evaluate(()=>window.result)});await context.close();
 }}finally{await browser.close()}
}}finally{for(const server of [app,fixture.server]){server.closeAllConnections();await new Promise(done=>server.close(done))};await writeFile(new URL('./redirect-probe.json',import.meta.url),JSON.stringify(receipts,null,2)+'\n')}
process.stdout.write(JSON.stringify(receipts,null,2)+'\n')
