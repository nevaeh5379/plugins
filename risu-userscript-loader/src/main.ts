import { ModRegistry } from './core/registry'
import { detectRuntimeHook, waitForRuntimeHook } from './core/hook'
import { interceptRisuEntry } from './instrumentation/interceptor'
import { diagnosticsMod } from './mods/diagnostics'

const page = (() => {
  try { return unsafeWindow } catch { return window as typeof unsafeWindow }
})()

function startLoader() {
  if (page.RisuMods) return
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

// The userscript intentionally matches every HTTP(S) origin so self-hosted
// installations work without editing metadata. Do not expose anything on an
// unrelated site until its entry module has passed the Risu source-map scan.
if (page.__RISU_LOADER_HOOK__) {
  startLoader()
} else {
  interceptRisuEntry((report) => {
    if (!report.intercepted) {
      console.warn('[Risu Loader] compatible entry was found but instrumentation failed', report)
      return
    }
    console.info('[Risu Loader] entry interception', report)
    startLoader()
  })
}
