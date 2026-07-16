import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const header = `// ==UserScript==
// @name         Risu Download Accelerator
// @namespace    https://risuai.xyz/mods
// @version      ${pkg.version}
// @description  Export RisuAI backups, characters, and modules with parallel asset loading.
// @match        http://*/*
// @match        https://*/*
// @grant        unsafeWindow
// @grant        GM.xmlHttpRequest
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      *
// @run-at       document-start
// @license      MIT
// ==/UserScript==

`

function userscriptHeader(): Plugin {
  return {
    name: 'userscript-header',
    enforce: 'post',
    closeBundle() {
      const output = resolve(__dirname, 'dist/risu-download-accelerator.user.js')
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
        entryFileNames: 'risu-download-accelerator.user.js',
      },
    },
  },
})
