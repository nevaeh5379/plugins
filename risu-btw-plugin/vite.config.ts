import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const PLUGIN_HEADER = `//@name risu_btw_plugin
//@display-name Risu BTW Plugin
//@api 3.0
//@version 1.0.0

`

/**
 * Plugin that prepends the RisuAI plugin metadata header AFTER all other
 * transformations (including CSS injection) are complete.
 */
function prependPluginHeader(): Plugin {
  return {
    name: 'prepend-plugin-header',
    enforce: 'post',
    closeBundle() {
      const outPath = resolve(__dirname, 'dist/plugin.js')
      try {
        const content = readFileSync(outPath, 'utf-8')
        writeFileSync(outPath, PLUGIN_HEADER + content, 'utf-8')
        console.log('✓ RisuAI Plugin header prepended to plugin.js')
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
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        format: 'iife',
        name: 'RisuBtwPlugin',
        inlineDynamicImports: true,
        entryFileNames: 'plugin.js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    cssCodeSplit: false,
    target: 'es2020',
    minify: 'esbuild',
    outDir: 'dist',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
})
