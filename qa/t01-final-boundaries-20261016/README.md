# Final browser boundaries — base f36013a

CI38809803219 had416PASS/2FAIL. Private-download now checks an actually suspended HTTP307 media transfer at the fixture boundary (one byte, not ended), no download, disabled action,31s clock timeout and aborted connection. It avoids Chromium-specific response-event attribution without removing behavior assertions. Local Chromium9PASS; native HTTPS two-origin probes PASS Chromium/WebKit. WebKit app-development attempts fail earlier at login/library navigation; these raw failures remain and do not certify production.

Social-reload now installs the existing completed-notifications-read navigation barrier on reload as well as goto. Before new countertests0PASS3FAIL; after full barrier suite21PASS0FAIL0SKIP, including native-browser negative CORS guards. No runtime error filtering relaxed, timeout inflated or tests skipped. Targeted ESLint PASS. Exact production CI required.

Atomic cancellation audit is documented in ../t01-cancel-audit-20261016/README.md. Exact owner QA imports T02/T04/T05/T06/T07 are recorded; originals and WIP preserved. GitNexus staged run CRITICAL/mixed/partial, direct source diff limited; not exhaustive certification.
