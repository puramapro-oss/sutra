# R99 browser readiness — T01

Base 7d96b38092c56497045c6d7905060c6f130ffe8f. CI38825902111 failed at scripts/ui-isolated/t07-flows.mjs:17: /create networkidle timeout15000ms. Artifact navigation.json: document200 in72ms, application assets and data200, four old sidebar prefetches still pending and four current speculative prefetches outstanding; no browser errors/accessibility violations. See qa/t01-create-cancel-20261016/ci-7d96-quality/test-results/t08/browser/.

Only the reserved detailed-flow harness changes. Navigation now waits for DOMContentLoaded and the actual page control/list state before interacting. Navigation deadline, accessibility, per-step, native-error, pagination/race and no-duplicate assertions retained. Additional HTTP200 and readiness assertions; no skipped or removed scenario, no product change.

PASS local: node --check scripts/ui-isolated/t07-flows.mjs; ./node_modules/.bin/eslint scripts/ui-isolated/t07-flows.mjs (0 errors/0 warnings); git diff --check on changed sources. Exact-SHA optimized browser CI remains REQUIRED; this static proof does not certify application E2E.

GitNexus upstream executed before edit: CRITICAL158direct14processes, graph10commitsbehind and cross-project. Bounded source callers scripts/test-ui-isolated.mjs and qa/t08/integrated/browser-extension.mjs reviewed. No migration/deployment, paid call, publication or foreign WIP change.
