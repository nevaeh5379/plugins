import type { RisuRuntimeHook } from '../types'

function pageWindow() {
  try { return unsafeWindow } catch { return window as typeof unsafeWindow }
}

export function detectRuntimeHook(): RisuRuntimeHook | null {
  const page = pageWindow()
  if (page.__RISU_LOADER_HOOK__) return page.__RISU_LOADER_HOOK__
  return null
}

export async function waitForRuntimeHook(timeoutMs = 30_000): Promise<RisuRuntimeHook | null> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const hook = detectRuntimeHook()
    if (hook) return hook
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  }
  return null
}
