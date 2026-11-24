import { build } from 'esbuild'
import { resolve } from 'node:path'

export async function compileContactFixture(type = 'escalade') {
  const components = {
    escalade: "import { EscaladeForm as ContactFixture } from './src/app/aide/EscaladeForm.tsx';",
    page: "import ContactFixture from './src/app/contact/page.tsx';",
    help: "import ContactFixture from './src/components/help/ContactForm.tsx';",
  }
  if (!Object.hasOwn(components, type)) throw new Error(`Unknown contact fixture: ${type}`)
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: 'js', contents: `
      import { createElement, StrictMode } from 'react';
      import { createRoot } from 'react-dom/client';
      ${components[type]}
      let root;
      function mount() {
        if (root) throw new Error('Contact fixture is already mounted');
        root = createRoot(document.getElementById('root'));
        root.render(createElement(StrictMode, null, createElement(ContactFixture)));
      }
      window.contactFixture = {
        toasts: [], mount,
        unmount() { root?.unmount(); root = undefined; }
      };
      mount();
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
