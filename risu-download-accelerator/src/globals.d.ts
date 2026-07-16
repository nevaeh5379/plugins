interface Window {
  RisuMods?: LoaderApi
  __RISU_MOD_QUEUE__?: ModDefinition[]
}

declare const unsafeWindow: Window & typeof globalThis
declare const GM: {
  getValue<T>(key: string, defaultValue: T): Promise<T>
  setValue<T>(key: string, value: T): Promise<void>
  xmlHttpRequest(options: {
    method: string
    url: string
    headers?: Record<string, string>
    data?: ArrayBuffer | Uint8Array
    responseType?: 'json' | 'text' | 'arraybuffer'
    onload(response: { status: number; response: any; responseText: string }): void
    onerror(error: unknown): void
    ontimeout(): void
    timeout?: number
  }): void
}

interface LoaderApi {
  register(definition: ModDefinition): Promise<void>
}

interface ModDefinition {
  id: string
  name: string
  version: string
  permissions: string[]
  activate(api: ModApi): void | (() => void)
}

interface ModApi {
  character: { getCurrent<T = unknown>(): T | null }
  database: { snapshot<T = unknown>(): T }
  assets: { read(path: string): Promise<Uint8Array | null> }
  ui: {
    addMenuItem(options: { id: string; label: string; title?: string; onClick(): void }): () => void
    openModal(content: HTMLElement | string, options?: { title?: string }): () => void
    toast(message: string, options?: { type?: 'info' | 'success' | 'warning' | 'error'; duration?: number }): void
  }
}
