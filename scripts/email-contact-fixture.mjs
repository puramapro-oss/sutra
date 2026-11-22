import { build } from 'esbuild'
import { resolve } from 'node:path'

export async function compileContactFixture() {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: 'js', contents: `
      import { createElement, StrictMode } from 'react';
      import { createRoot } from 'react-dom/client';
      import { EscaladeForm } from './src/app/aide/EscaladeForm.tsx';
      window.contactFixture = { toasts: [] };
      createRoot(document.getElementById('root')).render(
        createElement(StrictMode, null, createElement(EscaladeForm)));
    ` },
    plugins: [{ name: 'contact-toast-observer', setup(builder) {
      builder.onResolve({ filter: /^sonner$/ }, args => ({ path: args.path, namespace: 'contact-fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'contact-fixture' }, () => ({
        contents: `export const toast = {
          success(text) { window.contactFixture.toasts.push({ success: true, text }); },
          error(text) { window.contactFixture.toasts.push({ success: false, text }); }
        };`, loader: 'js',
      }))
    } }],
    alias: { react: resolve('node_modules/react'), 'react-dom': resolve('node_modules/react-dom') },
    bundle: true, write: false, platform: 'browser', format: 'iife', tsconfig: 'tsconfig.json',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_PILOT_MODE': '"false"' },
  })
  return result.outputFiles[0].contents
}
