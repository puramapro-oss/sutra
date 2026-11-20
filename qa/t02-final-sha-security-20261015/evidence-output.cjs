/* eslint-disable @typescript-eslint/no-require-imports -- test-only Node preload */
// Redirect only owner harness receipt writes. Assertions, SQL and product stay exact.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports } = require('node:module');
const t6 = path.resolve(__dirname, '../t06-integrated-retest-20261015');
const t1 = path.resolve(__dirname, '../t01-final-20261015');
function evidencePath(target) {
  const name = target instanceof URL ? fileURLToPath(target) : String(target);
  if (path.dirname(name) === t6 && /^postgres(?:-cas-tests)?(?:-result)?\.(?:log|json)$/.test(path.basename(name)))
    return path.join(__dirname, `t06-${path.basename(name)}`);
  if (path.dirname(name) === t1 && /^social-history-[a-z-]+\.json$/.test(path.basename(name)))
    return path.join(__dirname, `t01-${path.basename(name)}`);
  return target;
}
const originalSync = fs.writeFileSync;
fs.writeFileSync = function (target, ...args) { return originalSync.call(this, evidencePath(target), ...args); };
const originalAsync = fs.promises.writeFile;
fs.promises.writeFile = function (target, ...args) { return originalAsync.call(this, evidencePath(target), ...args); };
syncBuiltinESMExports();
