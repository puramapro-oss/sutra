import { build } from 'esbuild'
import { resolve } from 'node:path'

export async function compilePreferencesFixture() {
  const mocks = {
    '@/lib/supabase': `export const createClient = () => ({
      auth: { getUser: (...args) => window.prefs.client.auth.getUser(...args) },
      from: (...args) => window.prefs.client.from(...args)
    });`,
    '@/hooks/useAuth': `export const useAuth = () => {
      const h = window.prefs;
      return { user: h.owner ? { id: h.owner } : null, profile: h.profile, loading: h.loading,
        refetch: h.refetch };
    };`,
    'sonner': `export const toast = {
      success(text) { window.prefs.toasts.push({ success: true, text }); },
      error(text) { window.prefs.toasts.push({ success: false, text }); }
    };`,
    'next/link': `import { createElement } from 'react';
      export default function Link({ children, ...props }) { return createElement('a', props, children); }`,
  }
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: 'js', contents: `
      import { createElement, StrictMode } from 'react';
      import { createRoot } from 'react-dom/client';
      import Page from './src/app/(dashboard)/settings/notifications/page.tsx';
      const first = '11111111-1111-4111-8111-111111111111';
      const second = '22222222-2222-4222-8222-222222222222';
      const defaults = { welcome: true, digest: true, inactivity: false, tips: false, contest: false, referral: true };
      const database = {
        [first]: { id: first, email_preferences: { ...defaults } },
        [second]: { id: second, email_preferences: { ...defaults, welcome: false, digest: false } }
      };
      const h = window.prefs = {
        owner: first, profile: database[first], loading: false, writes: [], toasts: [], releases: [],
        response: 'ok', hold: false, authReads: 0, authFailureAt: 0, refetches: 0, refetchFails: false
      };
      h.client = {
        auth: { getUser: async () => {
          h.authReads++;
          return { data: { user: h.owner ? { id: h.owner } : null },
            error: h.authReads === h.authFailureAt ? { message: 'Fixture identity outage' } : null };
        } },
        from(table) {
          if (table !== 'profiles') throw new Error('Unexpected table');
          let values, owner, signal;
          const query = {
            update(value) { values = structuredClone(value); return query; },
            eq(key, value) { if (key !== 'id') throw new Error('Unexpected filter'); owner = value; return query; },
            select() { return query; },
            abortSignal(value) { signal = value; return query; },
            single() {
              const call = { owner, values, aborted: signal.aborted };
              h.writes.push(call);
              signal.addEventListener('abort', () => { call.aborted = true; }, { once: true });
              const mode = h.response;
              const reply = () => {
                if (mode === 'error') return { data: null, error: { message: 'Fixture failure' } };
                if (mode === 'empty') return { data: null, error: null };
                database[owner] = { ...database[owner], ...values };
                return { data: { id: owner, ...values }, error: null };
              };
              return h.hold ? new Promise(resolve => h.releases.push(() => resolve(reply()))) : Promise.resolve(reply());
            }
          };
          return query;
        }
      };
      const root = createRoot(document.getElementById('root'));
      h.render = () => root.render(createElement(StrictMode, null, createElement(Page)));
      h.refetch = async () => {
        h.refetches++;
        if (h.refetchFails) throw new Error('Fixture refresh unavailable');
        h.profile = database[h.owner] ?? null; h.render();
      };
      h.switchOwner = owner => { h.owner = owner; h.profile = database[owner] ?? null; h.render(); };
      h.unmount = () => root.unmount();
      h.render();
    ` },
    plugins: [{ name: 'synthetic-preference-boundaries', setup(builder) {
      builder.onResolve({ filter: /^(?:@\/lib\/supabase|@\/hooks\/useAuth|sonner|next\/link)$/ },
        args => ({ path: args.path, namespace: 'preference-fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'preference-fixture' }, args => ({
        contents: mocks[args.path], loader: 'js', resolveDir: process.cwd(),
      }))
    } }],
    alias: { react: resolve('node_modules/react'), 'react-dom': resolve('node_modules/react-dom') },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_PILOT_MODE': '"false"' }, tsconfig: 'tsconfig.json',
  })
  return result.outputFiles[0].contents
}
