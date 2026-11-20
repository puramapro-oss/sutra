const assert = require("node:assert/strict");
const { test } = require("node:test");
const configure = require("../app.config");
const { normalizeProjectId } = require("../lib/eas-project");
const { verifyProject } = require("./check-eas-project.cjs");
const expo = structuredClone(require("../app.json").expo);
if (expo.extra?.eas) delete expo.extra.eas.projectId;

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";

function setProject(t, id) {
  const previous = process.env.EAS_PROJECT_ID;
  if (id === undefined) delete process.env.EAS_PROJECT_ID;
  else process.env.EAS_PROJECT_ID = id;
  t.after(() => {
    if (previous === undefined) delete process.env.EAS_PROJECT_ID;
    else process.env.EAS_PROJECT_ID = previous;
  });
}

test("local use keeps the declared application and disables unconfigured OTA", (t) => {
  setProject(t);
  const resolved = configure({ config: expo });
  assert.deepEqual(resolved.extra, expo.extra);
  assert.deepEqual(resolved.updates, { enabled: false });
  assert.equal(resolved.android.package, "dev.purama.sutra");
  assert.equal(resolved.ios.bundleIdentifier, "dev.purama.sutra");
});

test("the registered identity is shared by OTA and push", (t) => {
  setProject(t, first);
  const resolved = configure({ config: expo });
  assert.equal(resolved.extra.eas.projectId, first);
  assert.equal(resolved.updates.url, `https://u.expo.dev/${first}`);
  assert.deepEqual(resolved.extra.router, expo.extra.router);
});

test("explicit configuration works and different project identities are rejected", (t) => {
  setProject(t);
  const config = { ...expo, extra: { ...expo.extra, eas: { projectId: first, other: true } } };
  assert.deepEqual(configure({ config }).extra.eas, config.extra.eas);
  process.env.EAS_PROJECT_ID = second;
  assert.throws(() => configure({ config }), /differs/);
});

test("the production preflight refuses missing, nil and placeholder identities", (t) => {
  setProject(t);
  for (const id of ["", "00000000-0000-0000-0000-000000000000", "sutra-mobile"]) {
    process.env.EAS_PROJECT_ID = id;
    assert.throws(() => verifyProject(expo), /EAS/);
  }
  process.env.EAS_PROJECT_ID = first;
  assert.doesNotThrow(() => verifyProject(expo));
  assert.equal(normalizeProjectId({}), null);
});
