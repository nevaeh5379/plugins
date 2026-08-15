import './vite-env.d.ts'

/**
 * @file main.tsx
 * @description Main entry point for RisuAI Chat Log Plugin (API v3.0).
 * Handles environment-based bootstrapping (development test runner vs. production RisuAI plugin),
 * registration of chat toolbar action buttons, message action button injection lifecycle,
 * and graceful teardown on plugin unload.
 */

// ============================================================================
// Types & Configuration Constants
// ============================================================================

/**
 * Configuration definition for registering a custom action button in RisuAI UI.
 */
interface ChatButtonConfig {
  readonly id: string
  readonly name: string
  readonly icon: string
  readonly iconType: 'html' | 'img' | 'none'
  readonly location: 'action' | 'chat' | 'hamburger'
}

/** Logging prefix for plugin console messages */
const LOG_PREFIX = '[log plugin]'

/**
 * SVG icon for the chat export button (Lucide-style download box icon).
 */
const EXPORT_BUTTON_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
  '<polyline points="7 10 12 15 17 10"/>' +
  '<line x1="12" x2="12" y1="15" y2="3"/>' +
  '</svg>'

/**
 * Button specification for the chat toolbar action button.
 */
const EXPORT_BUTTON_CONFIG: ChatButtonConfig = {
  id: 'risu-tolog-export',
  name: '로그 플러그인',
  icon: EXPORT_BUTTON_ICON_SVG,
  iconType: 'html',
  location: 'chat',
}

// ============================================================================
// Plugin Lifecycle Handlers
// ============================================================================

/**
 * Registers the plugin unload cleanup hook to safely teardown registered UI components
 * and remove DOM mutation observers and injected elements.
 *
 * @param registeredButtonId - Optional ID of the registered chat action button to unregister.
 * @param teardownMessageButtons - Teardown callback for message action buttons and DOM observers.
 */
async function registerPluginUnloadHandler(
  registeredButtonId: string | undefined,
  teardownMessageButtons: () => Promise<void>,
): Promise<void> {
  if (typeof Risuai === 'undefined' || typeof Risuai.onUnload !== 'function') {
    return
  }

  await Risuai.onUnload(async () => {
    try {
      // 1. Unregister chat toolbar action button
      if (registeredButtonId && typeof Risuai.unregisterUIPart === 'function') {
        try {
          await Risuai.unregisterUIPart(registeredButtonId)
        } catch (buttonUnregisterErr) {
          console.error(`${LOG_PREFIX} Failed to unregister action button during unload:`, buttonUnregisterErr)
        }
      }

      // 2. Teardown injected DOM message action buttons and observers
      try {
        await teardownMessageButtons()
      } catch (domTeardownErr) {
        console.error(`${LOG_PREFIX} Failed to teardown message buttons during unload:`, domTeardownErr)
      }

      console.log(`${LOG_PREFIX} Plugin unloaded.`)
    } catch (unloadErr) {
      console.error(`${LOG_PREFIX} Unload error:`, unloadErr)
    }
  })
}

/**
 * Initializes the plugin within the RisuAI v3.0 runtime environment.
 * Sets up action buttons, per-message injectors, and unload lifecycle hooks.
 */
async function initializePlugin(): Promise<void> {
  // Guard against execution in unsupported environments
  if (typeof Risuai === 'undefined') {
    console.warn(`${LOG_PREFIX} Global 'Risuai' object is undefined. Plugin initialization aborted.`)
    return
  }

  try {
    // Dynamically load injector module to manage code splitting and sandboxed DOM interactions
    const { setupMessageButtons, teardownMessageButtons, openExportModalForCurrentChat } =
      await import('./injector/injector')

    // 1. Register main chat toolbar export button (RisuAI Plugin API v3.0)
    let registeredButtonId: string | undefined
    try {
      const exportBtn = await Risuai.registerButton(
        EXPORT_BUTTON_CONFIG,
        async () => {
          try {
            await openExportModalForCurrentChat()
          } catch (modalErr) {
            console.error(`${LOG_PREFIX} Error opening export modal:`, modalErr)
          }
        },
      )
      registeredButtonId = exportBtn?.id || EXPORT_BUTTON_CONFIG.id
    } catch (btnErr) {
      console.error(`${LOG_PREFIX} Failed to register chat action button:`, btnErr)
    }

    // 2. Inject per-message action buttons & attach DOM mutation observer
    try {
      await setupMessageButtons()
    } catch (injectErr) {
      console.error(`${LOG_PREFIX} Failed to setup message buttons:`, injectErr)
    }

    // 3. Register plugin unload lifecycle hook
    await registerPluginUnloadHandler(registeredButtonId, teardownMessageButtons)

    console.log(`${LOG_PREFIX} Plugin initialized (API v3.0).`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`${LOG_PREFIX} Init error:`, errorMsg)
  }
}

// ============================================================================
// Application Bootstrap Entry Point
// ============================================================================

/**
 * Main application bootstrap router:
 * - When `VITE_TEST_MODE === '1'`, loads the local development test runner (`./dev/main`).
 * - In standard plugin execution, initializes RisuAI Plugin API v3.0 hooks and DOM injectors.
 */
function bootstrap(): void {
  const isTestMode = import.meta.env.VITE_TEST_MODE === '1'

  if (isTestMode) {
    // Dynamic import for test bench in local Vite dev server
    import('./dev/main').catch((err) => {
      console.error(`${LOG_PREFIX} Failed to load dev test launcher:`, err)
    })
  } else {
    // Execute production plugin initialization safely
    initializePlugin().catch((err) => {
      console.error(`${LOG_PREFIX} Unhandled bootstrap error:`, err)
    })
  }
}

// Start application bootstrap
bootstrap()