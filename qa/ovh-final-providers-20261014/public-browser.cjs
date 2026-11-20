(async()=>{
 const {createRequire}=await import('node:module');const fs=await import('node:fs');
 const root='/Users/matissdornier/purama-worktrees/sutra-final-providers-20261013';
 const {chromium}=createRequire(root+'/package.json')('playwright');
 const browser=await chromium.launch({headless:true});const results=[];
 try{
  for(const viewport of [{width:1440,height:1000},{width:375,height:812}]){
   const context=await browser.newContext({viewport,serviceWorkers:'block'});
   const page=await context.newPage();const errors=[],blocked=[];
   await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url());
    if(u.hostname==='sutra.purama.dev'&&r.method()==='GET'&&!u.pathname.startsWith('/api/'))return route.continue();
    blocked.push({host:u.hostname,path:u.pathname,method:r.method()});return route.abort('blockedbyclient');
   });
   page.on('pageerror',e=>errors.push(e.name+': '+e.message));
   await page.goto('https://sutra.purama.dev/dashboard?postdeploy=1',{waitUntil:'domcontentloaded'});
   await page.waitForURL('https://sutra.purama.dev/login?next=%2Fdashboard%3Fpostdeploy%3D1');
   await page.locator('input[type=email]').waitFor({state:'visible'});
   const refuse=page.getByRole('button',{name:'Tout refuser',exact:true});
   await refuse.waitFor({state:'visible'});await refuse.click();await refuse.waitFor({state:'hidden'});
   await page.locator('input[type=email]').fill('not-an-email');
   await page.locator('input[type=password]').fill('synthetic-no-account');
   await page.getByTestId('login-button').click();
   const invalidEmail=await page.locator('input[type=email]').evaluate(el=>!el.validity.valid);
   if(!invalidEmail||!page.url().startsWith('https://sutra.purama.dev/login'))throw Error('INVALID_FORM_NOT_BLOCKED');
   await page.goto('https://sutra.purama.dev/auth/callback?next=https://untrusted.invalid',{waitUntil:'domcontentloaded'});
   await page.waitForURL('https://sutra.purama.dev/login?error=missing_code');
   const alert=page.getByRole('alert').filter({hasText:'Le lien de connexion a expiré'});
   await alert.waitFor({state:'visible'});
   await page.waitForFunction(()=>{let el=document.querySelector('input[type=email]');if(!el)return false;for(;el;el=el.parentElement)if(Number(getComputedStyle(el).opacity)<0.99)return false;return true;});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
   if(overflow||errors.length||blocked.some(r=>r.method!=='GET'&&r.path!=='/api/legal/cookie-consent')){const diagnostic={viewport,overflow,errors,blocked};fs.writeFileSync(root+'/qa/ovh-final-providers-20261014/public-browser-initial-failure.json',JSON.stringify(diagnostic,null,2)+'\n');throw Error('PUBLIC_UI_REGRESSION '+JSON.stringify(diagnostic));}
   await page.screenshot({path:root+'/qa/ovh-final-providers-20261014/public-login-'+viewport.width+'.png',fullPage:true});
   results.push({viewport,protectedRouteLogin:true,nextPreserved:true,invalidEmailBlocked:true,callbackErrorVisible:true,canonicalOrigin:true,horizontalOverflow:overflow,pageErrors:errors,blockedRequests:blocked});
   await context.close();
  }
 }finally{await browser.close();}
 const report={source:'e3b17117256269e281304cd4ab83bc722a6f7894',observedAt:new Date().toISOString(),status:'PASS',paidCalls:0,authenticatedJourney:false,mutatingRequestsSent:0,expectedBlockedMutation:'/api/legal/cookie-consent',results};
 fs.writeFileSync(root+'/qa/ovh-final-providers-20261014/public-browser-final.json',JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify(report)+'\n');
})().catch(e=>{console.error(e.message);process.exit(1)});
