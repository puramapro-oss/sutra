import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, stat, readdir, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { CONTEXT_FILES, prepareContext } from '../../src/lib/salad/container/prepare-context.mjs';

test('isolated build context contains only exact sources, hashes and restrictive permissions', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sutra-t04-context-'));
  try {
    const destination = join(parent, 'context'); const manifest = await prepareContext(destination);
    assert.equal(manifest.files.length, CONTEXT_FILES.length);
    assert.equal((await stat(destination)).mode & 0o777, 0o700);
    for (const entry of manifest.files) {
      assert.equal(createHash('sha256').update(await readFile(join(destination, entry.path))).digest('hex'), entry.sha256);
      assert.equal((await stat(join(destination, entry.path))).mode & 0o777, 0o600);
    }
    const exported = (await readdir(destination, { recursive: true })).map(String);
    assert.equal(exported.some(path => /(^|\/)(\.env[^/]*|node_modules|\.git|models)(\/|$)/.test(path)), false);
    assert.equal(exported.filter(path => path.endsWith('.mjs')).length, 3);
    await assert.rejects(prepareContext(destination), { code: 'EEXIST' });
    assert.deepEqual(JSON.parse(await readFile(join(destination, 'context-manifest.json'), 'utf8')), manifest);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('context rejects missing inputs and source symlinks without creating a destination', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'sutra-t04-context-'));
  try {
    const source = join(parent, 'source'); await mkdir(source);
    await assert.rejects(prepareContext(join(parent, 'missing'), source));
    const file = join(source, CONTEXT_FILES[0]); await mkdir(dirname(file), { recursive: true });
    await symlink(resolve(CONTEXT_FILES[0]), file);
    await assert.rejects(prepareContext(join(parent, 'linked'), source), /SOURCE_INVALID/);
    await assert.rejects(stat(join(parent, 'missing')), { code: 'ENOENT' });
    await assert.rejects(stat(join(parent, 'linked')), { code: 'ENOENT' });
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('Docker COPY and all relative runtime imports are closed over the minimal context', async () => {
  const docker = await readFile(CONTEXT_FILES[0], 'utf8');
  const copies = docker.split('\n').filter(line => line.startsWith('COPY ') && !line.includes('--from='));
  const copied = copies.flatMap(line => line.split(/\s+/).slice(1, -1));
  for (const file of copied) assert.ok(CONTEXT_FILES.includes(file), `COPY absent from context: ${file}`);
  for (const file of copied.filter(file => /\.(ts|mts|mjs)$/.test(file))) {
    const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies = [];
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) dependencies.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) dependencies.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(source);
    for (const specifier of dependencies.filter(name => name.startsWith('.'))) {
      const path = join(dirname(file), specifier);
      assert.ok([path, `${path}.ts`, `${path}.mts`, `${path}.mjs`].some(candidate => copied.includes(candidate)), `missing import ${file} -> ${specifier}`);
    }
  }
});
