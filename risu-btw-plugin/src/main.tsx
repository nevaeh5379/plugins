import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const api = typeof Risuai !== 'undefined' ? Risuai : (typeof risuai !== 'undefined' ? risuai : null);
const isPlugin = api !== null;

function mountApp() {
  let rootEl = document.getElementById('root')
  if (!rootEl) {
    rootEl = document.createElement('div')
    rootEl.id = 'root'
    document.body.appendChild(rootEl)
  }

  // Reset body and html styles for full page transparent overlay
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
      // Pre-mount React into the hidden iframe
      let appRoot: ReturnType<typeof createRoot> | null = mountApp()

      // Function to open the OOC side panel
      const openBtwPanel = async () => {
        if (!appRoot) appRoot = mountApp()
        // Reload settings and messages (user might have switched characters)
        window.dispatchEvent(new CustomEvent('risu-editor:reload'))
        await api.showContainer('fullscreen')
      }

      // 1. Register Setting menu item
      await api.registerSetting(
        'BTW OOC 질문방',
        openBtwPanel,
        '💬',
        'html',
        'risu-btw-settings'
      )

      // 2. Register Chat Float Action Button
      await api.registerButton(
        {
          name: 'BTW (OOC)',
          icon: '💬',
          iconType: 'html',
          location: 'chat',
          id: 'risu-btw-action',
        },
        openBtwPanel
      )

      // 3. Key Interceptor for /btw in main input
      const handleInputScript = async (content: string) => {
        const trimmed = content.trim()
        if (trimmed.startsWith('/btw')) {
          // Extract the query following "/btw"
          const query = trimmed.replace(/^\/btw\s*/, '')

          // Open the panel
          if (!appRoot) appRoot = mountApp()
          window.dispatchEvent(new CustomEvent('risu-editor:reload'))
          await api.showContainer('fullscreen')

          // Dispatch query if text is present
          if (query) {
            window.dispatchEvent(new CustomEvent('btw-plugin:open-with-query', {
              detail: { query }
            }))
          }

          // Throwing a custom message stops RisuAI from pushing this to the chat log 
          // and stops the character from generating a response.
          // RisuAI catches this and displays the text inside a toast notification.
          throw new Error('OOC 질문이 BTW 패널로 전송되었습니다.')
        }
        return content
      }

      await api.addRisuScriptHandler('input', handleInputScript)

      // Cleanup on unload
      await api.onUnload(async () => {
        if (appRoot) {
          appRoot.unmount()
          appRoot = null
        }
        await api.removeRisuScriptHandler('input', handleInputScript)
      })

      console.log('[BTW Plugin] Initialized successfully')
    } catch (error) {
      console.error('[BTW Plugin] Init error:', error)
    }
  })()
} else {
  // Standalone dev mode (useful for local styles preview)
  mountApp()
}
