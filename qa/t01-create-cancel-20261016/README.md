# R74 create cancellation / R94 WebKit transport — T01

Base: 4ce8f5c2308a252545b119af96b9b780dbc48b2a, owned working delta. No production change.

R74: owner/tab-scoped durable local intent, GET/DELETE authenticated control over the existing video queue, canonical atomic cancellation/audit/quota, no submission replay. Unknown and initial 404 retain the intent; acknowledged pre-submission refusals release it. Shared production status component reused. No new queue or SQL change.

R94: WebKit does not send Sec-Fetch-Dest for the same fetch. Assert Playwright resourceType=fetch and GET; check the header when present. Real 200/byte/body suspension/abort/deadline/no-file/retry assertions retained.

PASS: `node qa/t01-create-cancel-20261016/run.mjs final-`: 11/11 browser and private PostgreSQL checks (375/1440), six cancelled jobs, six unique audit/quota releases, two actual private PostgreSQL restarts; zero provider/publication calls. Screenshots displayed and reviewed. Development server, not production browser proof.
PASS: `node --experimental-test-module-mocks --import tsx --test qa/t01-create-cancel-20261016/control.test.mts qa/t01-create-cancel-20261016/client.test.mts qa/t01-create-cancel-20261016/submission.test.mts`: 10/10, zero skip.
PASS: `npx tsc --noEmit --incremental false`.
PASS: targeted ESLint (lint-final.log), zero errors, 22 existing create-page warnings.
R94 minimal Chromium/WebKit transport probe PASS; full application WebKit and production build await exact-SHA CI. Existing failing CI 38820587476 preserved.

GitNexus impacts executed before edits. Shared graph CRITICAL, stale/partial and cross-project edges; direct bounded source/caller review used, not exhaustive graph certification. Foreign AGENTS.md and six skills preserved.

No paid generation, publication, GPU, live migration or promotion. Prior owners' commits and WIP preserved. Workspace-requirements error was not reproduced: T08 stdio initialize/configRequirements/read PASS; no speculative configuration rewrite.
