import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const version = pkg.version || '1.0.0'

const PLUGIN_HEADER = `// ==UserScript==
// @name         Risu Editor
// @namespace    https://risuai.xyz/
// @version      ${version}
// @description  Add VSCode textarea windows and an optional VSCode character explorer to RisuAI.
// @match        http://*/*
// @match        https://*/*
// @grant        unsafeWindow
// @run-at       document-start
// @license      GPL-3.0-or-later
// ==/UserScript==

`

/**
 * Prepends the Tampermonkey metadata header AFTER all other
 * transformations (including CSS injection) are complete.
 */
function prependPluginHeader(): Plugin {
  return {
    name: 'prepend-plugin-header',
    enforce: 'post',
    closeBundle() {
      const outPath = resolve(__dirname, 'dist/risu-editor.user.js')
      try {
        const content = readFileSync(outPath, 'utf-8')
        writeFileSync(outPath, PLUGIN_HEADER + content, 'utf-8')
        console.log('✓ Userscript header prepended to risu-editor.user.js')
      } catch (e) {
        console.error('Failed to prepend plugin header:', e)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJsPlugin(),
    prependPluginHeader(),
  ],
  build: {
    // Keep codicon fonts inside the userscript. Worker files may still be
    // emitted by Monaco's build, but monacoSetup disables them at runtime.
    assetsInlineLimit: 200_000,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        format: 'iife',
        name: 'RisuEditorPlugin',
        inlineDynamicImports: true,
        entryFileNames: 'risu-editor.user.js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    cssCodeSplit: false,
    // Drop down from esnext so esbuild lowers any stray import.meta usage.
    target: 'es2020',
    minify: false,
    outDir: 'dist',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})
