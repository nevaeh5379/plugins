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
/**
 * Monaco Editor setup for sandboxed iframe environment.
 *
 * Key constraints:
 * - CSP: connect-src 'none' (no CDN loading)
 * - CSP: script-src requires nonce (no dynamic workers)
 * - Sandbox: no allow-same-origin (no blob: URL workers)
 *
 * Solution: Bundle Monaco directly and disable workers entirely.
 * Monaco falls back to main-thread processing for language features.
 */

import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// Tell Monaco not to use workers - they won't work in sandboxed iframes
// Monaco will fall back to synchronous main-thread processing
;(self as any).MonacoEnvironment = {
  getWorker: () => {
    // Return a minimal proxy that prevents errors but does nothing
    // Monaco handles this gracefully and falls back to sync mode
    return new Proxy({} as Worker, {
      get: (_target, prop) => {
        if (prop === 'postMessage') return () => {}
        if (prop === 'terminate') return () => {}
        if (prop === 'addEventListener') return () => {}
        if (prop === 'removeEventListener') return () => {}
        if (prop === 'onmessage') return null
        if (prop === 'onerror') return null
        return undefined
      },
      set: () => true,
    })
  },
}

// Configure @monaco-editor/react to use the bundled Monaco instance
// This prevents the CDN loading attempt entirely
loader.config({ monaco })

// ── Custom dark theme (VSCode Dark Modern) ──
monaco.editor.defineTheme('risu-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'delimiter', foreground: 'D4D4D4' },
    { token: 'string.key.json', foreground: '9CDCFE' },
    { token: 'string.value.json', foreground: 'CE9178' },
    { token: 'keyword.json', foreground: '569CD6' },
  ],
  colors: {
    // Editor surface (Dark Modern)
    'editor.background': '#1F1F1F',
    'editor.foreground': '#CCCCCC',
    'editor.lineHighlightBackground': '#2A2D2E',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#264F78',
    'editor.inactiveSelectionBackground': '#3A3D41',
    'editorCursor.foreground': '#AEAFAD',
    'editorWhitespace.foreground': '#3B3B3B',
    'editorLineNumber.foreground': '#6E7681',
    'editorLineNumber.activeForeground': '#CCCCCC',
    'editorIndentGuide.background': '#2B2B2B',
    'editorIndentGuide.activeBackground': '#3B3B3B',
    'editorBracketMatch.background': '#0078D430',
    'editorBracketMatch.border': '#0078D4',

    // Search / find
    'editor.findMatchBackground': '#9E6A0344',
    'editor.findMatchHighlightBackground': '#EA5C0044',

    // Widgets / popups
    'editorWidget.background': '#1F1F1F',
    'editorWidget.border': '#313131',
    'editorSuggestWidget.background': '#1F1F1F',
    'editorSuggestWidget.border': '#313131',
    'editorSuggestWidget.selectedBackground': '#04395E',

    // Inputs / dropdowns (VSCode picker style)
    'input.background': '#313131',
    'input.foreground': '#CCCCCC',
    'input.border': '#3C3C3C',
    'dropdown.background': '#1F1F1F',
    'dropdown.border': '#454545',

    // List / tree
    'list.activeSelectionBackground': '#04395E',
    'list.activeSelectionForeground': '#FFFFFF',
    'list.inactiveSelectionBackground': '#37373D',
    'list.hoverBackground': '#2A2D2E',
    'list.focusBackground': '#04395E',

    // Scrollbar
    'scrollbarSlider.background': '#79797966',
    'scrollbarSlider.hoverBackground': '#646464B3',
    'scrollbarSlider.activeBackground': '#BFBFBF66',
  },
})

export { monaco }
