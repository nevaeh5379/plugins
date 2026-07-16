import { ModRegistry } from './core/registry'
import { detectRuntimeHook, waitForRuntimeHook } from './core/hook'
import { interceptRisuEntry } from './instrumentation/interceptor'
import { diagnosticsMod } from './mods/diagnostics'

const page = (() => {
  try { return unsafeWindow } catch { return window as typeof unsafeWindow }
})()

if (!page.RisuMods) {
  const registry = new ModRegistry()
  page.RisuMods = registry

  // Reactivate mods if a newer instrumented hook replaces a custom transport.
  page.addEventListener('risu-loader:hook-ready', () => {
    const hook = detectRuntimeHook()
    if (hook?.source === 'instrumented') {
      void registry.replaceHook(hook).then(() => {
        console.info(`[Risu Loader] upgraded to ${hook.source}/${hook.version ?? 'unknown'}`)
      }).catch((error) => console.error('[Risu Loader] hook upgrade failed', error))
    }
  })

  // Capture the parser-inserted module entry. Unsupported production builds
  // are restored unchanged; this makes a failed signature scan non-destructive.
  interceptRisuEntry((report) => {
    console.info('[Risu Loader] entry interception', report)
  })

  const queued = page.__RISU_MOD_QUEUE__?.splice(0) ?? []
  void registry.register(diagnosticsMod)
  for (const mod of queued) void registry.register(mod)

  registry.setStatus({ phase: 'waiting-for-hook' })
  void waitForRuntimeHook().then(async (hook) => {
    if (!hook) {
      registry.setStatus({
        phase: 'degraded',
        message: 'No compatible Risu runtime hook was detected.',
      })
      return
    }
    registry.setHook(hook)
    await registry.activatePending()
    console.info(`[Risu Loader] ready via ${hook.source} hook`)
  }).catch((error) => {
    registry.setStatus({ phase: 'failed', message: String(error) })
    console.error('[Risu Loader] initialization failed', error)
  })
}
