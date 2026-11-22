import { readFile } from 'node:fs/promises'
import { resolve, dirname, relative } from 'node:path'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import ts from 'typescript'
import { NextRequest, NextResponse } from 'next/server.js'
import { z } from 'zod'

// Actual application modules run with synthetic configuration and a provider
// boundary only. Unlisted imports and all network access fail closed.
export async function emailHarness(options = {}) {
  const root = process.cwd()
  const state = { sends: [], constructors: 0, authReads: 0, logs: [] }
  const env = { RESEND_API_KEY: 're_fixture_only', ...options.env }
  const context = createContext({
    process: { env }, URL, Request, Response, Headers, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, structuredClone,
    console: { error: (...args) => state.logs.push(args), warn: (...args) => state.logs.push(args) },
    fetch: () => { throw new Error('UNEXPECTED_NETWORK') },
  })
  class Resend {
    constructor(key) {
      state.constructors++
      if (!key) throw new Error('Fixture provider requires a key')
      this.emails = { send: async (payload) => {
        state.sends.push(structuredClone(payload))
        if (options.send) return options.send(payload)
        return { data: { id: 'fixture-provider-receipt' }, error: null }
      } }
    }
  }
  const external = {
    'next/server': { NextRequest, NextResponse }, zod: { z }, resend: { Resend },
    '@/lib/supabase-server': { createServerClient: async () => ({ auth: { getUser: async () => {
      state.authReads++
      return { data: { user: options.user === null ? null : { id: 'fixture-user', email: 'owner@example.invalid' } }, error: null }
    } } }) },
  }
  const allowed = new Set([
    'src/app/api/email/route.ts', 'src/app/api/contact/route.ts',
    'src/lib/emails.ts', 'src/lib/env.ts', 'src/lib/suno-config.ts',
    'src/lib/public-origin.ts', 'src/lib/rate-limit.ts', 'src/lib/validators.ts',
  ])
  const modules = new Map()
  async function load(file) {
    const path = resolve(root, file)
    if (!allowed.has(relative(root, path))) throw new Error(`Unexpected source import: ${file}`)
    if (modules.has(path)) return modules.get(path)
    const source = await readFile(path, 'utf8')
    const { outputText, diagnostics } = ts.transpileModule(source, {
      fileName: path, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    if (diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error(`Invalid source: ${file}`)
    const sourceModule = new SourceTextModule(outputText, { context, identifier: path })
    modules.set(path, sourceModule)
    await sourceModule.link(async (specifier, referring) => {
      if (external[specifier]) {
        const values = external[specifier]
        return new SyntheticModule(Object.keys(values), function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value)
        }, { context })
      }
      if (specifier.startsWith('@/')) return load(`${specifier.replace('@/', 'src/')}.ts`)
      if (specifier.startsWith('.')) return load(resolve(dirname(referring.identifier), specifier))
      throw new Error(`Unexpected external import: ${specifier}`)
    })
    return sourceModule
  }
  return { state, async module(path) {
    const sourceModule = await load(path)
    if (sourceModule.status !== 'evaluated') await sourceModule.evaluate()
    return sourceModule.namespace
  } }
}

export function jsonRequest(path, body, headers = {}) {
  return new Request(`https://sutra.example${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
