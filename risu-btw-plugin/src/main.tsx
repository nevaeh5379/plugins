import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const api = typeof Risuai !== 'undefined' ? Risuai : (typeof risuai !== 'undefined' ? risuai : null);
const isPlugin = api !== null;

// Lucide icon style SVG string for RisuAI native buttons
const LUCIDE_MESSAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square" style="width: 100%; height: 100%; display: block;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

function mountApp() {
  let rootEl = document.getElementById('root')
  if (!rootEl) {
    rootEl = document.createElement('div')
    rootEl.id = 'root'
    document.body.appendChild(rootEl)
  }

  document.body.style.margin = '0'
  document.body.style.padding = '0'
  document.body.style.overflow = 'hidden'
  document.body.style.width = '100%'
  document.body.style.height = '100%'
  document.body.style.background = 'transparent'
  document.documentElement.style.width = '100%'
  document.documentElement.style.height = '100%'

  const root = createRoot(rootEl)
  root.render(React.createElement(App))
  return root
}

if (isPlugin) {
  (async () => {
    try {
      let appRoot: ReturnType<typeof createRoot> | null = mountApp()

      const openBtwPanel = async () => {
        if (!appRoot) appRoot = mountApp()
        window.dispatchEvent(new CustomEvent('risu-editor:reload'))
        await api.showContainer('fullscreen')
      }

      // 1. Register Setting menu item
      await api.registerSetting(
        'BTW',
        openBtwPanel,
        LUCIDE_MESSAGE_SVG,
        'html',
        'risu-btw-settings'
      )

      // 2. Register Chat Float Action Button
      await api.registerButton(
        {
          name: 'BTW',
          icon: LUCIDE_MESSAGE_SVG,
          iconType: 'html',
          location: 'chat',
          id: 'risu-btw-action',
        },
        openBtwPanel
      )

      // 3. Key Interceptor for /btw in main input
      const handleInputScript = (content: string) => {
        const trimmed = content.trim()
        if (trimmed.startsWith('/btw')) {
          const query = trimmed.replace(/^\/btw\s*/, '')

          if (!appRoot) appRoot = mountApp()
          api.showContainer('fullscreen').catch((err) => {
            console.error('[BTW Plugin] Failed to show container:', err)
          })

          // Dispatch query to open a new OOC thread
          window.dispatchEvent(new CustomEvent('btw-plugin:new-thread-with-query', {
            detail: { query: query || '새 대화' }
          }))

          // '{}' error message is ignored by RisuAI alert system, aborting the roleplay send silently
          throw new Error('{}')
        }
        return content
      }

      await api.addRisuScriptHandler('input', handleInputScript)

      await api.onUnload(async () => {
        if (appRoot) {
          appRoot.unmount()
          appRoot = null
        }
        await api.removeRisuScriptHandler('input', handleInputScript)
      })

      console.log('[BTW Plugin] Initialized with Lucide SVG buttons and BTW labels')
    } catch (error) {
      console.error('[BTW Plugin] Init error:', error)
    }
  })()
} else {
  mountApp()
}
