/* eslint-disable @typescript-eslint/no-require-imports -- Node preload */
// The T1 SQL harness writes receipts to a fixed directory. Redirect only those
// writes into T02 evidence, without changing that harness or its SQL/assertions.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports } = require('node:module');
const original = fs.promises.writeFile;
const prefix = path.resolve(__dirname, '../t01-final-20261015');
fs.promises.writeFile = function (target, ...args) {
  const name = target instanceof URL ? fileURLToPath(target) : String(target);
  if (path.dirname(name) === prefix && /^social-history-[a-z-]+\.json$/.test(path.basename(name))) {
    target = path.join(__dirname, `pg-${path.basename(name)}`);
  }
  return original.call(this, target, ...args);
};
syncBuiltinESMExports();
