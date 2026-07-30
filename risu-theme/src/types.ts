export type ModPermission =
  | 'character.read'
  | 'character.write'
  | 'database.read'
  | 'database.write'
  | 'stores.read'
  | 'stores.write'
  | 'parser.cbs'
  | 'parser.cbs.mutate'
  | 'variables.read'
  | 'variables.write'
  | 'modules.read'
  | 'context.read'
  | 'chat.read'
  | 'chat.write'
  | 'chat.send'
  | 'assets.read'
  | 'assets.write'
  | 'ui.inject'
  | 'runtime.inspect'

export interface RisuRuntimeHook {
  readonly source: 'instrumented' | 'custom'
  readonly version?: string
  getCurrentCharacter(): unknown | null
  setCurrentCharacter(character: unknown): void | Promise<void>
  getDatabaseSnapshot?(): unknown
  updateDatabase?(database: unknown): void | Promise<void>
  subscribeCharacter?(callback: () => void): () => void
  parseCBS?(text: string, options?: CbsParseOptions): string
  getChatVariable?(key: string): string
  setChatVariable?(key: string, value: string): void
  getGlobalVariable?(key: string): string
  setGlobalVariable?(key: string, value: string): void
  listEffectiveVariables?(): Record<string, string>
  getActiveModules?(): unknown[]
  getCurrentCharacterIndex?(): number
  getContextKey?(kind: 'character' | 'chat'): string
  getCurrentChat?(): unknown | null
  readAsset?(path: string): Promise<Uint8Array | null>
  saveAsset?(data: Uint8Array, customId?: string, fileName?: string): Promise<string>
  parseMarkdown?(text: string, options?: MarkdownParseOptions): Promise<string>
  parseMarkdownSafe?(text: string, forbidTags?: string[]): string
  sendMessage?(text: string, options?: ChatSendOptions): Promise<boolean>
}

export interface CbsParseOptions {
  chatID?: number
  chara?: unknown
  rmVar?: boolean
  tokenizeAccurate?: boolean
  consistantChar?: boolean
  visualize?: boolean
  role?: string
  runVar?: boolean
  cbsConditions?: Record<string, boolean>
}

export interface MarkdownParseOptions {
  character?: unknown
  mode?: 'normal' | 'back' | 'pretranslate' | 'notrim'
  chatID?: number
  cbsConditions?: Record<string, boolean>
}

export interface ChatSendOptions {
  /** Wait until Risu finishes generation. Defaults to true. */
  wait?: boolean
  /** Maximum wait time for generation. Defaults to 10 minutes. */
  timeoutMs?: number
}

export interface UiButtonOptions {
  id: string
  label: string
  icon?: string
  title?: string
  onClick(): void | Promise<void>
}

export interface UiMenuItemOptions extends UiButtonOptions {
  order?: number
}

export interface UiMountOptions {
  id: string
  target?: 'overlay' | 'body'
  css?: string
}

export interface RisuModApi {
  readonly modId: string
  readonly runtime: {
    readonly source: RisuRuntimeHook['source']
    readonly version?: string
  }
  character: {
    getCurrent<T = unknown>(): T | null
    updateCurrent<T = unknown>(character: T): Promise<void>
    subscribe(callback: () => void): () => void
  }
  database: {
    snapshot<T = unknown>(): T
    update<T = unknown>(database: T): Promise<void>
  }
  parser: {
    cbs(text: string, options?: CbsParseOptions): string
    markdown(text: string, options?: MarkdownParseOptions): Promise<string>
    markdownSafe(text: string, forbidTags?: string[]): string
    escape(text: string): string
    unescape(text: string): string
  }
  variables: {
    getChat(key: string): string
    setChat(key: string, value: string): void
    getGlobal(key: string): string
    setGlobal(key: string, value: string): void
    listEffective(): Record<string, string>
  }
  modules: {
    getActive<T = unknown>(): T[]
    getByNamespace<T = unknown>(namespace: string): T | null
    getLorebooks<T = unknown>(): T[]
    getAssets<T = unknown>(): T[]
  }
  context: {
    getCurrentCharacter<T = unknown>(): T | null
    getCurrentChat<T = unknown>(): T | null
    getCurrentCharacterIndex(): number
    getCurrentChatIndex(): number
    onCharacterChange(callback: (character: unknown | null) => void): () => void
    onChatChange(callback: (chat: unknown | null) => void): () => void
    onDatabaseReady(callback: () => void): () => void
  }
  chat: {
    getCurrent<T = unknown>(): T | null
    getMessages<T = unknown>(): T[]
    getMessage<T = unknown>(idOrIndex: string | number): T | null
    getLastMessage<T = unknown>(): T | null
    getLastUserMessage<T = unknown>(): T | null
    getLastCharacterMessage<T = unknown>(): T | null
    updateMessage(idOrIndex: string | number, patch: Record<string, unknown>): Promise<void>
    deleteMessage(idOrIndex: string | number): Promise<void>
    addMessage(message: Record<string, unknown>): Promise<void>
    /** Send text through Risu's native composer and generation pipeline. */
    send(text: string, options?: ChatSendOptions): Promise<boolean>
    reload(): Promise<void>
  }
  assets: {
    read(path: string): Promise<Uint8Array | null>
    save(data: Uint8Array, options?: { customId?: string; fileName?: string }): Promise<string>
    resolve(path: string): Promise<string>
    revoke(url: string): void
  }
  ui: {
    mount(options: UiMountOptions): { root: ShadowRoot; container: HTMLElement; unmount(): void }
    addToolbarButton(options: UiButtonOptions): () => void
    addChatButton(options: UiButtonOptions): () => void
    addMenuItem(options: UiMenuItemOptions): () => void
    openModal(content: HTMLElement | string, options?: { title?: string }): () => void
    toast(message: string, options?: { type?: 'info' | 'success' | 'warning' | 'error'; duration?: number }): void
  }
  lifecycle: {
    onUnload(callback: () => void | Promise<void>): void
  }
}

export interface RisuModDefinition {
  id: string
  name: string
  version: string
  permissions: ModPermission[]
  activate(api: RisuModApi): void | (() => void) | Promise<void | (() => void)>
}

export interface LoaderStatus {
  phase: 'booting' | 'waiting-for-hook' | 'ready' | 'degraded' | 'failed'
  hookSource?: RisuRuntimeHook['source']
  message?: string
}

export interface PublicLoaderApi {
  readonly version: string
  readonly status: LoaderStatus
  register(mod: RisuModDefinition): Promise<void>
  unregister(modId: string): Promise<void>
  list(): Array<{ id: string; name: string; version: string; active: boolean }>
  onStatus(callback: (status: LoaderStatus) => void): () => void
}
