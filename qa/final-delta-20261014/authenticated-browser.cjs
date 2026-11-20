// Session credentials remain in parent memory and private subprocess stdin/stdout.
const proof = __dirname;
const focusedAffirmations = process.argv.includes('--affirmations');
const evidenceName = focusedAffirmations ? 'affirmations-browser' : 'authenticated-browser';
(async () => {
  const { spawnSync } = await import('node:child_process');
  const { writeFileSync } = await import('node:fs');
  const { homedir } = await import('node:os');
  const { build } = await import('esbuild');
  const { chromium } = await import('playwright');
  const assert = (await import('node:assert/strict')).default;
  const ssh = ['-i', homedir() + '/.ssh/purama_vps_ed25519', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', 'root@144.217.14.210', 'docker exec -i purama-sutra node --input-type=module'];
  const report = { source: '86d04c85bdb19cbe7f59fbd1d9c29fe4c536f164', observedAt: new Date().toISOString(), results: [], generationRequests: 0 };
  let session, browser, revokeBundle, activePage, gate = 'session';
  const network = [];
  try {
    revokeBundle = (await build({ stdin: { contents: "import {createClient} from '@supabase/supabase-js';const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const r=await a.auth.admin.signOut(globalThis.qaSessionToken,'local');process.stdout.write(JSON.stringify({revoked:!r.error}));if(r.error)process.exitCode=1;", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22', banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" } })).outputFiles[0].text;
    const bundled = await build({ entryPoints: [proof + '/browser-session.mjs'], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node22', banner: { js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);" } });
    const remote = spawnSync('ssh', ssh, { input: bundled.outputFiles[0].text, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000 });
    assert.equal(remote.status, 0);
    session = JSON.parse(remote.stdout);
    assert.equal(session.pass, true);
    assert.ok(session.sessionToken && session.cookies.length);
    gate = 'browser';
    browser = await chromium.launch({ headless: true });
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 1000 }, serviceWorkers: 'block' });
      await context.addCookies(session.cookies.map(c => ({ ...c, url: 'https://sutra.purama.dev', secure: true, sameSite: 'Lax' })));
      const errors = [], blocked = [];
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        const safeOrigin = url.origin === 'https://sutra.purama.dev' || url.origin === session.authOrigin;
        if (safeOrigin && ['GET', 'HEAD'].includes(request.method()) && !url.pathname.startsWith('/api/cron/') && url.pathname !== '/api/health') return route.continue();
        blocked.push({ path: url.pathname, method: request.method() });
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      activePage = page;
      page.on('response', response => { const url = new URL(response.url()); if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) network.push({ method: response.request().method(), path: url.pathname, status: response.status() }); });
      page.on('requestfailed', request => { const url = new URL(request.url()); network.push({ method: request.method(), path: url.pathname, failed: true }); });
      page.on('pageerror', error => errors.push(error.name));
      const routes = [['/dashboard', '[data-testid=dashboard-greeting]'], ['/create', 'h1'], ['/production', 'h1'], ['/library', '[data-testid=library-create-btn]'], ['/settings/social', 'h1']];
      for (const [path, selector] of focusedAffirmations ? routes.slice(0, 1) : routes) {
        gate = `${width}:${path}`;
        const affirmationPending = focusedAffirmations ? page.waitForResponse(response => new URL(response.url()).pathname === '/rest/v1/affirmations', { timeout: 20000 }) : null;
        const response = await page.goto('https://sutra.purama.dev' + path, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20000 });
        assert.equal(new URL(page.url()).pathname, path);
        let affirmationRead;
        if (affirmationPending) {
          const response = await affirmationPending;
          assert.equal(response.status(), 200);
          const rows = await response.json();
          const category = new URL(response.url()).searchParams.get('category')?.replace(/^eq\./, '');
          assert.ok(['abundance', 'power', 'wisdom'].includes(category));
          assert.ok(Array.isArray(rows) && rows.length > 0 && rows.every(row => typeof row.text_fr === 'string' && row.category === category));
          affirmationRead = { status: 200, rows: rows.length, contract: true };
          await page.getByLabel('Introduction cinematique SUTRA', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 });
        }
        // Observe required legal consent without accepting or bypassing it.
        const legalConsentVisible = await page.getByRole('heading', { name: 'Mise à jour de nos conditions', exact: true }).isVisible();
        const tutorialVisible = await page.getByTestId('tutorial-overlay').isVisible();
        await page.waitForTimeout(700); // Allow hydration and entrance animations before visual evidence.
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false);
        assert.equal(errors.length, 0);
        await page.screenshot({ path: `${proof}/${focusedAffirmations ? 'affirmations' : 'authenticated'}-${width}-${path.slice(1).replaceAll('/', '-')}.png`, fullPage: true });
        report.results.push({ width, path, ...(affirmationRead ? { affirmationRead } : {}), status: response.status(), hydratedSelectorVisible: true, horizontalOverflow: false, pageErrors: 0, legalConsentVisible, tutorialVisible, interactiveJourney: legalConsentVisible ? 'BLOCKED_USER_LEGAL_CONSENT' : 'NOT_TESTED_READ_ONLY' });
      }
      assert.ok(blocked.every(r => r.path === '/api/legal/cookie-consent'));
      await context.close();
    }
    report.pass = true;
    report.scope = 'Authenticated route rendering only; required legal consent remains untouched. No interactive project or generation journey.';
  } catch (error) {
    report.pass = false; report.failedGate = gate; report.errorType = error.name; report.network = network; report.safeFailureLocation = String(error.stack || '').split('\n').filter(line => line.includes('authenticated-browser.cjs:')).map(line => line.trim());
    if (activePage && !activePage.isClosed()) {
      report.diagnostic = { path: new URL(activePage.url()).pathname, dashboardReadError: await activePage.getByText('Le tableau de bord n’a pas pu être chargé', { exact: true }).isVisible(), loginVisible: await activePage.getByRole('button', { name: 'Se connecter', exact: true }).isVisible(), greetingPresent: await activePage.locator('[data-testid=dashboard-greeting]').count() };
      await activePage.screenshot({ path: proof + '/authenticated-browser-failure.png', fullPage: true });
    }
  } finally {
    try { if (browser) await browser.close(); } catch { report.pass = false; }
    if (session?.sessionToken) {
      const revoke = `globalThis.qaSessionToken=${JSON.stringify(session.sessionToken)};\n` + revokeBundle;
      const result = spawnSync('ssh', ssh, { input: revoke, encoding: 'utf8', timeout: 30000 });
      try { report.testSessionRevoked = result.status === 0 && JSON.parse(result.stdout).revoked === true; } catch { report.testSessionRevoked = false; }
      if (!report.testSessionRevoked) report.pass = false;
    }
    session = undefined;
  }
  writeFileSync(proof + '/' + evidenceName + '.json', JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report) + '\n');
  if (!report.pass) process.exitCode = 1;
})().catch(() => { process.stdout.write('SAFE_BROWSER_HARNESS_FAILED\n'); process.exitCode = 1; });
