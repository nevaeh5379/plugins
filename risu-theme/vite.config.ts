import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

const header = `// ==UserScript==
// @name         Risu Theme
// @namespace    https://risuai.xyz/mods/risu-theme
// @version      ${pkg.version}
// @description  Comprehensive UI theme overhaul for RisuAI (CSS variables + presets + settings panel).
// @match        http://*/*
// @match        https://*/*
// @grant        unsafeWindow
// @run-at       document-start
// @license      MIT
// ==/UserScript==

`

function userscriptHeader(): Plugin {
  return {
    name: 'risu-theme-header',
    enforce: 'post',
    closeBundle() {
      const output = resolve(__dirname, 'dist/risu-theme.user.js')
      writeFileSync(output, header + readFileSync(output, 'utf8'), 'utf8')
    },
  }
}

export default defineConfig({
  plugins: [userscriptHeader()],
  build: {
    target: 'es2020',
    minify: false,
    outDir: 'dist',
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'risu-theme.user.js',
      },
    },
  },
})