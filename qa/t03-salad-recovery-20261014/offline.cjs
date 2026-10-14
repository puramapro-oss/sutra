/* eslint-disable @typescript-eslint/no-require-imports -- synchronous safety preload */
// No sockets, generation processes or secret files. Version checks are synthetic.
require('../t08/offline.cjs');
const net = require('node:net');
const child = require('node:child_process');
const originalSpawn = child.spawn;
const { syncBuiltinESMExports } = require('node:module');
const deny = () => { throw new Error('T03_EXTERNAL_EXECUTION_DENIED'); };
net.Socket.prototype.connect = deny;
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFileSync', 'fork']) child[name] = deny;
child.spawn = function (file, args, options) {
  // tsx requires its installed esbuild transpiler service, never a media engine.
  if (!/\/node_modules\/@esbuild\/[^/]+\/bin\/esbuild$/.test(file)
      || !Array.isArray(args) || !args.every(arg => /^--service=[\d.]+$/.test(arg) || arg === '--ping')) return deny();
  return originalSpawn(file, args, options);
};
child.execFile = function (file, args, ...rest) {
  if (!['ffprobe', 'ffmpeg'].includes(file) || JSON.stringify(args) !== '["-version"]') return deny();
  const callback = rest.at(-1);
  if (typeof callback !== 'function') return deny();
  queueMicrotask(() => callback(null, 'T03 synthetic version fixture', ''));
};
syncBuiltinESMExports();
