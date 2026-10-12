/* eslint-disable @typescript-eslint/no-require-imports -- synchronous Node --require preload must be CommonJS */
// Defense in depth: synthetic environment supplied by run.mjs; no remote I/O.
const net = require('node:net');
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const allowed = new Set(['127.0.0.1', '::1', 'localhost']);
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof normalized === 'object' ? normalized.host : args[1];
  if (!allowed.has(host || 'localhost')) throw new Error('T08_NETWORK_DENIED');
  return originalConnect.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!allowed.has(url.hostname.replace(/^\[|\]$/g, ''))) return Promise.reject(new Error('T08_NETWORK_DENIED'));
  return originalFetch(input, init);
};
function checkPath(path) {
  if (/(^|\/)\.env[^/]*$/.test(String(path))) {
    const error = new Error('T08_ENV_FILE_DENIED');
    error.code = 'ENOENT';
    throw error;
  }
}
for (const method of ['readFileSync', 'readFile', 'openSync', 'open']) {
  const original = fs[method];
  fs[method] = function (path, ...args) { checkPath(path); return original.call(this, path, ...args); };
}
for (const method of ['readFile', 'open']) {
  const original = fs.promises[method];
  fs.promises[method] = async function (path, ...args) { checkPath(path); return original.call(this, path, ...args); };
}
syncBuiltinESMExports();
