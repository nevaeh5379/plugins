import { fetchText } from './fetch'
import { transformDevelopmentEntry } from './transform'
import { createProductionBridge } from './sourceMap'

export interface InterceptionReport {
  intercepted: boolean
  strategy?: string
  reason?: string
  entryUrl?: string
}

function isRisuEntry(script: HTMLScriptElement) {
  if (script.type !== 'module' || !script.src) return false
  const url = new URL(script.src, location.href)
  return url.pathname.endsWith('/src/main.ts') || /\/assets\/index-[\w-]+\.js$/.test(url.pathname)
}

export function interceptRisuEntry(
  onReport: (report: InterceptionReport) => void,
): () => void {
  let finished = false
  const handleScript = (node: HTMLScriptElement) => {
    if (finished || !isRisuEntry(node)) return false
    finished = true
    observer.disconnect()
    const entryUrl = node.src

    void fetchText(entryUrl).then((source) => {
      if (!entryUrl.endsWith('/src/main.ts')) {
        return createProductionBridge(source, entryUrl).then((bridge) => {
          runModuleUrl(bridge.bridgeUrl, 'production-sourcemap')
          onReport({
            intercepted: true,
            entryUrl,
            strategy: `production-sourcemap:${bridge.getterExport}`,
          })
        })
      }

      const result = transformDevelopmentEntry(source, entryUrl)

      if (!result.supported || !result.code) {
        onReport({ intercepted: false, entryUrl, strategy: result.strategy, reason: result.reason })
        return
      }

      runModuleCode(result.code, result.strategy)
      onReport({ intercepted: true, entryUrl, strategy: result.strategy })
    }).catch((error) => {
      onReport({ intercepted: false, entryUrl, reason: String(error) })
    })
    return true
  }

  const observer = new MutationObserver((records) => {
    if (finished) return
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLScriptElement && handleScript(node)) return
      }
    }
  })

  observer.observe(document, { childList: true, subtree: true })
  for (const script of document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')) {
    if (handleScript(script)) break
  }
  return () => observer.disconnect()
}

function runModuleCode(
  code: string,
  strategy: string | undefined,
) {
  const blob = new Blob([code], { type: 'text/javascript' })
  runModuleUrl(URL.createObjectURL(blob), strategy)
}

function runModuleUrl(url: string, strategy: string | undefined) {
  const patched = document.createElement('script')
  patched.type = 'module'
  patched.src = url
  patched.dataset.risuLoaderPatched = strategy ?? 'unknown'
  patched.addEventListener('load', () => URL.revokeObjectURL(patched.src), { once: true })
  ;(document.head ?? document.documentElement).appendChild(patched)
}
