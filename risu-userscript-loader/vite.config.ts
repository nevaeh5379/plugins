import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

const header = `// ==UserScript==
// @name         Risu Userscript Loader
// @namespace    https://risuai.xyz/mods
// @version      ${pkg.version}
// @description  Runtime mod loader and compatibility layer for RisuAI.
// @match        https://risuai.xyz/*
// @match        https://stable.risuai.xyz/*
// @match        https://nightly.risuai.xyz/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @grant        unsafeWindow
// @grant        GM.xmlHttpRequest
// @run-at       document-start
// @license      MIT
// ==/UserScript==

`

function userscriptHeader(): Plugin {
  return {
    name: 'risu-userscript-header',
    enforce: 'post',
    closeBundle() {
      const output = resolve(__dirname, 'dist/risu-loader.user.js')
      writeFileSync(output, header + readFileSync(output, 'utf8'), 'utf8')
      copyFileSync(
        resolve(__dirname, 'examples/test-mod.user.js'),
        resolve(__dirname, 'dist/risu-loader-test.user.js'),
      )
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
        entryFileNames: 'risu-loader.user.js',
      },
    },
  },
})
