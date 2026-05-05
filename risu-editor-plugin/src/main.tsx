/**
 * risup-editor-plugin, a RisuAI plugin for editing character lorebooks, prompts, and settings
 * Copyright (C) 2026 nevaeh5379
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import './lib/monacoSetup'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

/**
 * Risu Editor Plugin - Entry Point
 *
 * This plugin provides a Monaco Editor-based IDE interface for editing
 * character lorebooks, prompts, and settings within RisuAI.
 */

// Check if we're running inside the RisuAI plugin iframe
const isPlugin = typeof Risuai !== 'undefined' || typeof risuai !== 'undefined'

function mountApp() {
  let rootEl = document.getElementById('root')
  if (!rootEl) {
    rootEl = document.createElement('div')
    rootEl.id = 'root'
    document.body.appendChild(rootEl)
  }

  // Reset body styles for fullscreen
  document.body.style.margin = '0'
  document.body.style.padding = '0'
  document.body.style.overflow = 'hidden'
  document.body.style.width = '100%'
  document.body.style.height = '100%'
  document.documentElement.style.width = '100%'
  document.documentElement.style.height = '100%'

  const root = createRoot(rootEl)
  root.render(React.createElement(App))
  return root
}

if (isPlugin) {
  // ── Plugin Mode ──
  // The official V3 plugin pattern (see plugins.md §Plugin UI) is to
  // populate document.body BEFORE calling showContainer. Doing it the
  // other way around leaves the freshly-revealed iframe with empty body
  // content, which on some browsers prevents the parent <iframe> element
  // from being painted at all (it stays sized 0×0 until any later style
  // change forces a reflow). So: mount React immediately at init, then
  // showContainer is just a visibility toggle.
  ;(async () => {
    try {
      const api = typeof Risuai !== 'undefined' ? Risuai : risuai

      // Pre-mount React into the (hidden) iframe so body has content before
      // the host transitions display:none → display:block.
      let appRoot: ReturnType<typeof createRoot> | null = mountApp()

      const openEditor = async () => {
        if (!appRoot) appRoot = mountApp()
        // Tell App.tsx to refresh — user may have switched characters.
        window.dispatchEvent(new CustomEvent('risu-editor:reload'))
        await api.showContainer('fullscreen')
      }

      await api.registerSetting(
        'Risu Editor',
        openEditor,
        '📝',
        'html',
        'risu-editor-settings'
      )

      await api.registerButton(
        {
          name: 'Open Editor',
          icon: '📝',
          iconType: 'html',
          location: 'action',
          id: 'risu-editor-action',
        },
        openEditor
      )

      await api.onUnload(async () => {
        if (appRoot) {
          appRoot.unmount()
          appRoot = null
        }
      })

      console.log('[Risu Editor] initialized')
    } catch (error) {
      console.error('[Risu Editor] init error:', error)
    }
  })()
} else {
  // ── Development Mode (standalone) ──
  mountApp()
}
