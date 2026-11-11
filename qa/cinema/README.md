# SUTRA cinema: portable previsualization and staged Higgsfield adapter

This change adds a useful offline path from the existing storyboard: edit visual instructions and descriptions, keep shot identities and timing, then download a self-contained Blender script or JSON project. The script creates a new, editable scene with generic blocking, animated cameras, lights and shot markers. It does not interpret the prompts into geometry, generate a finished film or call Higgsfield.

## Implemented scope

- `cinema-project.ts` validates one to sixty shots, unique identities, finite durations up to 120 seconds, supported formats and rational frame rates. It preserves requested seconds and rounds cumulative frame boundaries to avoid accumulating independent rounding errors.
- All scene intervals are zero-based and half-open in the manifest. Blender receives inclusive frames `1..totalFrames`.
- Non-cut transitions remain in the manifest with an explicit warning. The preview uses cuts; no undocumented dissolve duration or media handles are invented.
- `affectedCinemaNodes` validates a dependency graph and returns all affected descendants. It is an invalidation plan, not an executor or cache integration.
- Higgsfield draft bodies share the provider validator. Unsupported durations or missing media-reference tokens produce a correction issue and no request body. Every request remains `not_submitted`.
- Export validation rejects stale derived timing, extra data and invented qualifications. Rights, audio and color qualification remain unverified.
- The Blender script embeds JSON as data, creates its own scene and data blocks, preserves existing work and does not automatically save. An explicit `--sutra-output` saves a new `.blend` and refuses an existing destination.
- Manual storyboard preparation needs no model call. Pollinations previews require an explicit click; editing a prompt or format invalidates its previous preview. Export has no network call.

## Higgsfield adapter

`higgsfield.ts` is a server module with an injectable transport. It exposes estimation, submission, authenticated status polling and cancellation. It is **not registered in the existing engine router**.

A submission requires a fresh estimate from that client instance, matching parameters, a sufficient approved per-request USD ceiling, and a caller-supplied idempotency key plus request fingerprint. Decimal comparison avoids binary floating-point money errors. An estimate is not an invoice or a provider-enforced price ceiling.

The caller must persist the intent before sending, reserve the global budget atomically, store the returned handle and reconcile ambiguous outcomes. These duties belong in the existing submission/journal/worker components. The in-memory adapter guards do not implement them. After a restart, obtain a fresh estimate while retaining the persisted intent and key. There are no automatic retries, generated replacement keys or paid fallbacks.

Credentials are sent only to `https://api.higgsfield.ai`. Status/cancel paths must match the returned safe opaque request ID; redirects are rejected. Error bodies and transport causes are not exposed. Provider JSON is limited to 64 KiB under the request deadline. A cancellation acknowledgement requires a subsequent status check and does not itself prove that the remote request is canceled.

There is no webhook handler, media downloader, output archival, `.blend` provider response, REST 3D endpoint, client billing or public commercial qualification in this change.

## Evidence and reproduction

```bash
node --import tsx --test scripts/test-cinema-project.mts scripts/test-higgsfield-contracts.mts
node --import tsx --test scripts/test-cinema-blender.mts
node scripts/run-ci.mjs quality
node scripts/run-ci.mjs browser-cinema
node --import tsx scripts/export-cinema-pilot.mts NEW_OUTPUT_DIRECTORY
blender --background --factory-startup --python-exit-code 7 \
  --python NEW_OUTPUT_DIRECTORY/un-geste-circule.blender.py -- \
  --sutra-output NEW_OUTPUT_DIRECTORY/un-geste-circule.blend
```

The Blender test preserves a pre-existing scene/object, checks fractional timing and camera markers, round-trips adversarial Unicode text, saves and reopens a real file, refuses overwrite and renders a PNG. It explicitly skips when Blender is unavailable; a skip is not a Blender qualification. Native Blender 4.3.2 was exercised locally. This does not qualify the official Higgsfield plugin, whose documented Blender requirement is different.

The browser test mounts the real storyboard page and components with synthetic auth/navigation/image fixtures. It checks downloaded `.py`/`.json` contents and explicit preview consent. It does not exercise production auth or the backend. The local environment blocked Chromium startup and the separate browser could not access the test origin/local file; no local browser assertion is claimed as passed. CI contains the independent browser gate.

Optional `--serve-only` and `--write-static PATH` modes expose the same fixture for an authorized browser. They use local simulated previews, a restrictive test CSP and a visible fixture banner. They do not change application production behavior.

## Pilot and remaining integration

`pilot-storyboard.json` describes **Un geste circule**: six shots of eight seconds, one square, two original adult characters and one keepsake. At 24 fps the exported timeline has 1,152 frames. The generic mannequins do not perform the described action; animation, final assets, dialogue/ambience and continuity review remain production work.

The pre-existing storyboard-to-`/create` handoff does not consume the stored storyboard into a structured shot timeline. This change provides a lossless export, but does not repair that separate route or claim that the existing 30 fps video compositor uses the new cinema clock. Wiring the new provider requires a deliberate conversion from the storyboard Scene type to the production Scene type, preserving shot IDs, timings, transitions and revision dependencies.

Before routing paid Higgsfield jobs: extend the existing durable journal and atomic budget reservation; qualify the actual account; download and verify outputs before provider expiry; bind approvals to asset revisions; qualify rights, color, sound and accessibility; run a bounded live trial; confirm commercial service terms before public client access. No production merge, deployment, account connection or paid generation is included.

## Primary references checked 2026-11-11

- [Cinema Studio 4.0 REST schema](https://docs.higgsfield.ai/docs/models/cinema-studio-4/generate)
- [Request idempotency](https://docs.higgsfield.ai/docs/concepts/idempotency)
- [Billing and retention](https://docs.higgsfield.ai/docs/concepts/billing-and-retention)
- [Requests and lifecycle](https://docs.higgsfield.ai/docs/concepts/requests)
- [Official Blender plugin](https://higgsfield.ai/plugins/blender)
- [API terms](https://open.higgsfield.ai/terms-of-service)
