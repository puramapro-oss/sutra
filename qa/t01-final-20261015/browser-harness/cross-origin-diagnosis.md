# Cross-origin native control — diagnostic only

Candidate ed12d9c retains all cross-origin pageerrors as failures. No application or runtime-guard changes are made by this control.

Command: `node qa/t01-final-20261015/browser-harness/cross-origin-reproduction.mjs`. Two local HTTPS ports, synthetic responses, no master/provider or application build. ESLint of this file PASS. Receipts cross-origin-results-H0aOg2.

Both Chromium and WebKit complete the normal cross-origin request with valid CORS. WebKit additionally reports two pageerrors for caught fetches initiated during explicit goto/reload teardown. Chromium reports none. Both browsers detect the deliberately unhandled real CORS denial; WebKit produces a different empty-stack diagnostic and DOM rejection. Raw evidence is retained, including another caught-teardown event on leaving the last control page.

This reproduces a possible engine mechanism, not the cause of the three historical SUTRA affirmations errors. CI48eb raw errors remain FAIL; candidate ed12 exact CI must be inspected. No allowlist or test skip introduced.

GitNexus impact crossOriginReproduction UNKNOWN (new standalone file, no indexed symbol). Direct scope: only the TLS fixture and Playwright imports; no application callers. No index freshness certification claimed.
