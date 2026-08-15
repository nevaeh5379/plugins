/**
 * @file mockRisuai.ts
 * @description High-fidelity RisuAI Plugin API v3.0 mock environment for local development and unit testing.
 *
 * Emulates the full Risuai runtime sandbox including:
 * - SafeElement / SafeDocument DOM wrapper hierarchy
 * - SafeMutationObserver and SafeClassArray collections
 * - Async storage tiers (pluginStorage, safeLocalStorage, localPluginStorage)
 * - RPC methods (character, chat, lorebook, database, UI parts, color themes)
 * - Native fetch with timeout handling and security boundaries
 *
 * @version 3.0.0
 */

import { buildMockChatDom, type MockCharSpec } from './mockData'
import type {
  RisuCharacter,
  RisuChat,
} from '../types/risuai'

// ============================================================================
// 1. Constants & Fallbacks
// ============================================================================

/**
 * Fallback 1x1 transparent PNG binary bytes for asset mock resolution.
 */
const TRANSPARENT_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

/**
 * Whitelist of HTML tags permitted by RisuAI SafeDocument.createElement.
 */
const SAFE_HTML_TAGS = new Set([
  'a', 'article', 'aside', 'blockquote', 'br', 'button', 'code', 'div',
  'em', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
  'img', 'input', 'label', 'li', 'main', 'nav', 'ol', 'option', 'p',
  'pre', 'section', 'select', 'span', 'strong', 'table', 'tbody', 'td',
  'textarea', 'tfoot', 'th', 'thead', 'tr', 'ul',
])

// ============================================================================
// 2. DOM Listener Registry
// ============================================================================

interface RegisteredEventListener {
  type: string
  listener: EventListener
  rawListener: (event: unknown) => void
  options?: boolean | AddEventListenerOptions
}

const elementListenerRegistry = new WeakMap<HTMLElement, Map<string, RegisteredEventListener>>()

/**
 * Unwraps a SafeElement or HTMLElement instance into its underlying raw DOM node.
 */
export function unwrapElement(element: unknown): HTMLElement | null {
  if (!element) return null
  if (element instanceof MockSafeElement) {
    return element.el
  }
  if (element instanceof HTMLElement) {
    return element
  }
  if (typeof element === 'object' && 'el' in element && (element as { el: unknown }).el instanceof HTMLElement) {
    return (element as { el: HTMLElement }).el
  }
  return null
}

// ============================================================================
// 3. SafeClassArray Implementation
// ============================================================================

/**
 * SafeClassArray provides asynchronous array-like access to collections in the sandbox.
 */
export class MockSafeClassArray<T> implements SafeClassArray<T> {
  constructor(private readonly items: T[]) {}

  async at(index: number): Promise<T | undefined> {
    const effectiveIndex = index < 0 ? this.items.length + index : index
    return this.items[effectiveIndex]
  }

  async length(): Promise<number> {
    return this.items.length
  }

  async push(item: T): Promise<void> {
    this.items.push(item)
  }

  asArray(): T[] {
    return [...this.items]
  }
}

// ============================================================================
// 4. SafeElement Implementation
// ============================================================================

/**
 * MockSafeElement wraps a live HTMLElement and exposes RisuAI v3.0 SafeElement async contracts.
 */
export class MockSafeElement implements SafeElement {
  constructor(public readonly el: HTMLElement) {}

  // --- Element Tree Operations ---

  async appendChild(child: SafeElement): Promise<void> {
    const rawChild = unwrapElement(child)
    if (rawChild) {
      this.el.appendChild(rawChild)
    }
  }

  async removeChild(child: SafeElement): Promise<void> {
    const rawChild = unwrapElement(child)
    if (rawChild) {
      this.el.removeChild(rawChild)
    }
  }

  async replaceChild(newChild: SafeElement, oldChild: SafeElement): Promise<void> {
    const newEl = unwrapElement(newChild)
    const oldEl = unwrapElement(oldChild)
    if (newEl && oldEl) {
      this.el.replaceChild(newEl, oldEl)
    }
  }

  async replaceWith(newElement: SafeElement): Promise<void> {
    const newEl = unwrapElement(newElement)
    if (newEl) {
      this.el.replaceWith(newEl)
    }
  }

  async cloneNode(deep = true): Promise<MockSafeElement> {
    return new MockSafeElement(this.el.cloneNode(deep) as HTMLElement)
  }

  async prepend(child: SafeElement): Promise<void> {
    const rawChild = unwrapElement(child)
    if (rawChild) {
      this.el.prepend(rawChild)
    }
  }

  async remove(): Promise<void> {
    this.el.remove()
  }

  // --- Content Getters & Setters ---

  async innerText(): Promise<string> {
    return this.el.innerText
  }

  async setInnerText(value: string): Promise<void> {
    this.el.innerText = value
  }

  async textContent(): Promise<string | null> {
    return this.el.textContent
  }

  async setTextContent(value: string): Promise<void> {
    this.el.textContent = value
  }

  async getInnerHTML(): Promise<string> {
    return this.el.innerHTML
  }

  async setInnerHTML(value: string): Promise<void> {
    // Sanitize script tags for sandbox parity
    const sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    this.el.innerHTML = sanitized
  }

  async getOuterHTML(): Promise<string> {
    return this.el.outerHTML
  }

  async setOuterHTML(value: string): Promise<void> {
    const sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    this.el.outerHTML = sanitized
  }

  // --- Attributes ---

  async setAttribute(name: string, value: string): Promise<void> {
    if (!name.startsWith('x-')) {
      throw new Error(`[MockSafeElement] setAttribute: only 'x-' prefixed attributes are allowed (received '${name}')`)
    }
    this.el.setAttribute(name, value)
  }

  async getAttribute(name: string): Promise<string | null> {
    if (!name.startsWith('x-') && name !== 'style' && name !== 'class') {
      throw new Error(`[MockSafeElement] getAttribute: only 'x-' prefixed attributes are allowed (received '${name}')`)
    }
    return this.el.getAttribute(name)
  }

  // --- Styling ---

  async setStyle(property: string, value: string): Promise<void> {
    this.el.style.setProperty(property, value)
    if (property in this.el.style) {
      (this.el.style as unknown as Record<string, string>)[property] = value
    }
  }

  async getStyle(property: string): Promise<string> {
    return this.el.style.getPropertyValue(property) ||
      ((this.el.style as unknown as Record<string, string>)[property] ?? '')
  }

  async getStyleAttribute(): Promise<string> {
    return this.el.getAttribute('style') ?? ''
  }

  async setStyleAttribute(value: string): Promise<void> {
    this.el.setAttribute('style', value)
  }

  async addClass(className: string): Promise<void> {
    this.el.classList.add(className)
  }

  async removeClass(className: string): Promise<void> {
    this.el.classList.remove(className)
  }

  async setClassName(className: string): Promise<void> {
    this.el.className = className
  }

  async getClassName(): Promise<string> {
    return this.el.className
  }

  async hasClass(className: string): Promise<boolean> {
    return this.el.classList.contains(className)
  }

  async focus(): Promise<void> {
    this.el.focus()
  }

  // --- Traversal and Querying ---

  async getChildren(): Promise<MockSafeClassArray<SafeElement>> {
    const children = Array.from(this.el.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement)
      .map(child => new MockSafeElement(child))
    return new MockSafeClassArray(children)
  }

  async getParent(): Promise<SafeElement | null> {
    const parent = this.el.parentElement
    return parent ? new MockSafeElement(parent) : null
  }

  async querySelectorAll(selector: string): Promise<MockSafeClassArray<SafeElement>> {
    const matches = Array.from(this.el.querySelectorAll<HTMLElement>(selector)).map(
      el => new MockSafeElement(el)
    )
    return new MockSafeClassArray(matches)
  }

  async querySelector(selector: string): Promise<SafeElement | null> {
    const found = this.el.querySelector<HTMLElement>(selector)
    return found ? new MockSafeElement(found) : null
  }

  async getElementById(id: string): Promise<SafeElement | null> {
    const found = this.el.querySelector<HTMLElement>(`#${id}`)
    return found ? new MockSafeElement(found) : null
  }

  async getElementsByClassName(className: string): Promise<MockSafeClassArray<SafeElement>> {
    const elements = Array.from(this.el.getElementsByClassName(className))
      .filter((el): el is HTMLElement => el instanceof HTMLElement)
      .map(el => new MockSafeElement(el))
    return new MockSafeClassArray(elements)
  }

  async matches(selector: string): Promise<boolean> {
    return this.el.matches(selector)
  }

  // --- Geometry and Node Info ---

  async clientHeight(): Promise<number> {
    return this.el.clientHeight
  }

  async clientWidth(): Promise<number> {
    return this.el.clientWidth
  }

  async clientTop(): Promise<number> {
    return this.el.clientTop
  }

  async clientLeft(): Promise<number> {
    return this.el.clientLeft
  }

  async getBoundingClientRect(): Promise<DOMRect> {
    return this.el.getBoundingClientRect()
  }

  async getClientRects(): Promise<DOMRectList> {
    return this.el.getClientRects()
  }

  async nodeName(): Promise<string> {
    return this.el.nodeName
  }

  async nodeType(): Promise<number> {
    return this.el.nodeType
  }

  // --- Event Handling ---

  async addEventListener(
    type: string,
    listener: (event: unknown) => void,
    options?: boolean | AddEventListenerOptions
  ): Promise<string> {
    const id = `listener-${Math.random().toString(36).slice(2, 11)}`
    let registry = elementListenerRegistry.get(this.el)
    if (!registry) {
      registry = new Map()
      elementListenerRegistry.set(this.el, registry)
    }

    const domListener: EventListener = (event: Event) => listener(event)
    registry.set(id, { type, listener: domListener, rawListener: listener, options })
    this.el.addEventListener(type, domListener, options)
    return id
  }

  async removeEventListener(
    type: string,
    id: string,
    options?: boolean | EventListenerOptions
  ): Promise<void> {
    const registry = elementListenerRegistry.get(this.el)
    if (registry && registry.has(id)) {
      const entry = registry.get(id)!
      this.el.removeEventListener(type, entry.listener, options ?? entry.options)
      registry.delete(id)
    }
  }

  async scrollIntoView(options?: boolean | ScrollIntoViewOptions): Promise<void> {
    this.el.scrollIntoView(options)
  }
}

// ============================================================================
// 5. SafeDocument Implementation
// ============================================================================

/**
 * MockSafeDocument provides root document access with whitelisted tag creation and URL sanitization.
 */
export class MockSafeDocument extends MockSafeElement implements SafeDocument {
  constructor(doc: Document) {
    super(doc.documentElement)
  }

  createElement(tagName: string): SafeElement {
    const normalized = tagName.toLowerCase()
    const safeTag = SAFE_HTML_TAGS.has(normalized) ? normalized : 'div'
    return new MockSafeElement(document.createElement(safeTag))
  }

  createAnchorElement(href: string): SafeElement {
    const anchor = document.createElement('a')
    anchor.href = /^https?:\/\//i.test(href) ? href : '#'
    return new MockSafeElement(anchor)
  }
}

// ============================================================================
// 6. SafeMutationObserver Implementation
// ============================================================================

/**
 * MockSafeMutationObserver wraps native MutationObserver with SafeElement record wrappers.
 */
export class MockSafeMutationObserver implements SafeMutationObserver {
  private readonly observer: MutationObserver

  constructor(callback: SafeMutationCallback) {
    this.observer = new MutationObserver((records) => {
      const wrappedRecords: SafeMutationRecord[] = records.map((record) => ({
        getType: async () => record.type,
        getTarget: async () => new MockSafeElement(record.target as HTMLElement),
        getAddedNodes: async () =>
          new MockSafeClassArray(
            Array.from(record.addedNodes)
              .filter((node): node is HTMLElement => node.nodeType === Node.ELEMENT_NODE)
              .map((node) => new MockSafeElement(node)),
          ),
      }))

      callback(new MockSafeClassArray(wrappedRecords))
    })
  }

  async observe(element: SafeElement, options: MutationObserverInit): Promise<void> {
    const raw = unwrapElement(element)
    if (raw) {
      this.observer.observe(raw, options)
    }
  }

  disconnect(): void {
    this.observer.disconnect()
  }
}

// ============================================================================
// 7. Storage Implementations
// ============================================================================

/**
 * In-memory PluginStorage (syncs with saved character/chat state).
 */
export class MockPluginStorage implements PluginStorage {
  private readonly store = new Map<string, unknown>()

  async getItem<T = unknown>(key: string): Promise<T | null> {
    if (!this.store.has(key)) return null
    const val = this.store.get(key)
    return (typeof val === 'object' && val !== null ? JSON.parse(JSON.stringify(val)) : val) as T
  }

  async setItem(key: string, value: unknown): Promise<void> {
    const cloned = typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value
    this.store.set(key, cloned)
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async key(index: number): Promise<string | null> {
    return Array.from(this.store.keys())[index] ?? null
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }

  async length(): Promise<number> {
    return this.store.size
  }
}

/**
 * In-memory string-only SafeLocalStorage (shared across plugins on the device).
 */
export class MockSafeLocalStorage implements SafeLocalStorage {
  private readonly store = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, String(value))
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async key(index: number): Promise<string | null> {
    return Array.from(this.store.keys())[index] ?? null
  }

  async length(): Promise<number> {
    return this.store.size
  }
}

/**
 * In-memory generic SafeLocalPluginStorage (device-persisted outside save files).
 */
export class MockSafeLocalPluginStorage implements SafeLocalPluginStorage {
  private readonly store = new Map<string, unknown>()

  async getItem<T>(key: string): Promise<T | null> {
    if (!this.store.has(key)) return null
    const val = this.store.get(key)
    return (typeof val === 'object' && val !== null ? JSON.parse(JSON.stringify(val)) : val) as T
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const cloned = typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value
    this.store.set(key, cloned)
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }

  async clear(): Promise<void> {
    this.store.clear()
  }
}

// ============================================================================
// 8. Mock State & Builder
// ============================================================================

export type MockDatabaseSubset = DatabaseSubset & {
  selectedPersona?: string
  userIcon?: string
  username?: string
}

export interface MockRisuaiState {
  character: RisuCharacter
  characters: RisuCharacter[]
  charIndex: number
  chatIndex: number
  personas: Persona[]
  selectedPersona: string
  userIcon: string
  username: string
  theme: string
  textTheme: string
  colorScheme: ColorScheme
  customTextTheme: CustomTextTheme
  arguments: Map<string, string | number>
  settings: Map<string, unknown>
  buttons: Map<string, unknown>
  unloadCallbacks: Set<() => void | Promise<void>>
}

/**
 * Creates a clean mock state object populated from the provided character specification.
 */
function createInitialState(spec: MockCharSpec): MockRisuaiState {
  const character: RisuCharacter = {
    name: spec.charName,
    image: spec.charAvatarAsset,
    chaId: spec.charId,
    chats: [
      {
        name: spec.chatName,
        message: spec.messages.map((m, i) => ({
          role: m.role,
          data: m.text,
          chatId: `msg-${i}`,
          name: m.role === 'char' ? spec.charName : spec.userName,
          time: m.time ?? Date.now() - (spec.messages.length - i) * 60000,
        })),
        note: '테스트 채팅 세션',
        id: 'chat-0',
        bindedPersona: spec.personaId,
      },
    ],
    chatPage: 0,
    type: 'character',
    firstMessage: spec.messages[0]?.text || '',
  }

  const persona: Persona = {
    id: spec.personaId,
    name: spec.userName,
    icon: spec.userAvatarAsset,
    personaPrompt: '테스트 페르소나',
  }

  return {
    character,
    characters: [character],
    charIndex: 0,
    chatIndex: 0,
    personas: [persona],
    selectedPersona: spec.personaId,
    userIcon: spec.userAvatarAsset,
    username: spec.userName,
    theme: 'dark',
    textTheme: 'standard',
    colorScheme: {
      bgcolor: '#0d0f14',
      darkbg: '#181b22',
      borderc: '#252a35',
      selected: '#5eabef',
      draculared: '#ff5555',
      textcolor: '#e4e6eb',
      textcolor2: '#9499a5',
      darkBorderc: '#1a1d24',
      darkbutton: '#22262f',
      type: 'dark',
    },
    customTextTheme: {
      FontColorStandard: '#e4e6eb',
      FontColorBold: '#ffffff',
      FontColorItalic: '#9499a5',
      FontColorItalicBold: '#c4c8d0',
      FontColorQuote1: '#7c9cf0',
      FontColorQuote2: '#6cb6ff',
    },
    arguments: new Map(),
    settings: new Map(),
    buttons: new Map(),
    unloadCallbacks: new Set(),
  }
}

/**
 * Handles mock nativeFetch calls with support for timeout signals and dev error feedback.
 */
async function handleNativeFetch(
  url: string,
  options?: RequestInit & { requestTimeoutMs?: number },
): Promise<Response> {
  // Check for arca.live direct upload in sandbox mode
  if (typeof url === 'string' && url.includes('arca.live')) {
    throw new Error(
      '[테스트 서버] 아카라이브 직접 업로드는 RisuAI 네이티브 fetch(CORS 우회)가 필요합니다. ' +
      '테스트 서버에서는 "ZIP 파일 다운로드" 방식만 사용 가능합니다.',
    )
  }

  const timeoutMs = options?.requestTimeoutMs
  const fetchOpts: RequestInit = {
    method: options?.method,
    headers: options?.headers,
    body: options?.body,
    mode: options?.mode,
    credentials: options?.credentials,
  }

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    fetchOpts.signal = controller.signal

    try {
      const res = await fetch(url, fetchOpts)
      clearTimeout(timer)
      return res
    } catch (error) {
      clearTimeout(timer)
      throw error
    }
  }

  return fetch(url, fetchOpts)
}

/**
 * Decodes image assets into binary Uint8Array representations.
 */
async function handleReadImage(assetId?: string): Promise<Uint8Array> {
  if (!assetId) {
    return TRANSPARENT_1X1_PNG
  }

  if (assetId.startsWith('data:') || assetId.startsWith('blob:')) {
    try {
      const res = await fetch(assetId)
      const buf = await res.arrayBuffer()
      return new Uint8Array(buf)
    } catch (e) {
      console.warn('[mock Risuai] Failed to decode image asset URI:', e)
    }
  }

  return TRANSPARENT_1X1_PNG
}

/**
 * Constructs the complete RisuaiPluginAPI mock instance.
 */
export function createMockRisuaiAPI(
  state: MockRisuaiState,
  safeDoc: MockSafeDocument,
  storages: {
    pluginStorage: MockPluginStorage
    safeLocalStorage: MockSafeLocalStorage
    localPluginStorage: MockSafeLocalPluginStorage
  },
): RisuaiPluginAPI {
  const { pluginStorage, safeLocalStorage, localPluginStorage } = storages

  const api: RisuaiPluginAPI = {
    // --- Version Info ---
    apiVersion: '3.0',
    apiVersionCompatibleWith: ['3.0'],

    // --- Logging & UI Management ---
    async log(message: string): Promise<void> {
      console.log(`[mock Risuai Plugin] ${message}`)
    },

    async showContainer(_mode: ContainerMode): Promise<void> {
      // In local dev test launcher, iframe container modal is already rendered directly
    },

    async hideContainer(): Promise<void> {
      // No-op for dev environment
    },

    // --- DOM Access ---
    async getRootDocument(): Promise<SafeDocument> {
      return safeDoc
    },

    async createMutationObserver(callback: SafeMutationCallback): Promise<SafeMutationObserver> {
      return new MockSafeMutationObserver(callback)
    },

    async unwarpSafeArray<T>(safeArray: unknown): Promise<T[]> {
      if (safeArray instanceof MockSafeClassArray) {
        return safeArray.asArray() as T[]
      }
      if (Array.isArray(safeArray)) {
        return safeArray as T[]
      }
      if (safeArray && typeof (safeArray as { length: unknown }).length === 'function') {
        const arrayProxy = safeArray as {
          length: () => Promise<number>
          at: (index: number) => Promise<T | undefined>
        }
        const len = await arrayProxy.length()
        const result: T[] = []
        for (let i = 0; i < len; i++) {
          const item = await arrayProxy.at(i)
          if (item !== undefined) {
            result.push(item)
          }
        }
        return result
      }
      return []
    },

    // --- Character & Chat APIs ---
    async getCharacter(): Promise<RisuCharacter> {
      return state.character
    },

    async setCharacter(character: unknown): Promise<void> {
      state.character = character as RisuCharacter
    },

    async getChar(): Promise<unknown> {
      return state.character
    },

    async setChar(character: unknown): Promise<void> {
      state.character = character as RisuCharacter
    },

    async getCharacterFromIndex(index: number): Promise<RisuCharacter | null> {
      return index === 0 ? state.character : (state.characters[index] ?? null)
    },

    async setCharacterToIndex(index: number, character: unknown): Promise<void> {
      if (index === 0) {
        state.character = character as RisuCharacter
      }
      state.characters[index] = character as RisuCharacter
    },

    async getChatFromIndex(charIdx: number, chatIdx: number): Promise<RisuChat | null> {
      if (charIdx === 0 && chatIdx === 0) {
        return state.character.chats[0] ?? null
      }
      const char = state.characters[charIdx]
      return char?.chats?.[chatIdx] ?? null
    },

    async setChatToIndex(charIdx: number, chatIdx: number, chat: unknown): Promise<void> {
      if (charIdx === 0 && chatIdx === 0) {
        state.character.chats[0] = chat as RisuChat
      }
      const char = state.characters[charIdx]
      if (char?.chats) {
        char.chats[chatIdx] = chat as RisuChat
      }
    },

    async getCurrentCharacterIndex(): Promise<number> {
      return state.charIndex
    },

    async getCurrentChatIndex(): Promise<number> {
      return state.chatIndex
    },

    async getCurrentLorebookEntries(): Promise<unknown[]> {
      return []
    },

    // --- Storage APIs ---
    pluginStorage,
    safeLocalStorage,
    async getLocalPluginStorage(): Promise<SafeLocalPluginStorage> {
      return localPluginStorage
    },

    // --- Arguments & Settings ---
    async getArgument(key: string): Promise<string | number | undefined> {
      return state.arguments.get(key)
    },

    async setArgument(key: string, value: string | number): Promise<void> {
      state.arguments.set(key, value)
    },

    getArg(key: string): unknown {
      return state.arguments.get(key)
    },

    setArg(key: string, value: string | number): void {
      state.arguments.set(key, value)
    },

    // --- Database APIs ---
    async getDatabase(includeOnly: string[] | 'all' = 'all'): Promise<DatabaseSubset | null> {
      const fullDb: MockDatabaseSubset = {
        characters: [state.character],
        personas: state.personas,
        selectedPersona: state.selectedPersona,
        userIcon: state.userIcon,
        username: state.username,
        theme: state.theme,
        textTheme: state.textTheme,
      }

      if (includeOnly === 'all') {
        return fullDb
      }

      const filtered: MockDatabaseSubset = {}
      for (const key of includeOnly) {
        if (key in fullDb) {
          (filtered as Record<string, unknown>)[key] = (fullDb as Record<string, unknown>)[key]
        }
      }
      return filtered
    },

    async setDatabaseLite(db: DatabaseSubset): Promise<void> {
      const customDb = db as MockDatabaseSubset
      if (customDb.selectedPersona !== undefined) state.selectedPersona = customDb.selectedPersona
      if (customDb.username !== undefined) state.username = customDb.username
      if (customDb.userIcon !== undefined) state.userIcon = customDb.userIcon
      if (db.theme !== undefined) state.theme = db.theme
      if (db.textTheme !== undefined) state.textTheme = db.textTheme
    },

    async setDatabase(db: DatabaseSubset): Promise<void> {
      await this.setDatabaseLite(db)
    },

    // --- Theming & Styling ---
    async changeColorScheme(name: string): Promise<void> {
      state.theme = name
    },

    async setColorScheme(scheme: ColorScheme): Promise<void> {
      state.colorScheme = scheme
    },

    async getColorScheme(): Promise<{ name: string; scheme: ColorScheme }> {
      return { name: 'default', scheme: state.colorScheme }
    },

    async changeTextTheme(name: string): Promise<void> {
      state.textTheme = name
    },

    async setCustomTextTheme(theme: CustomTextTheme): Promise<void> {
      state.customTextTheme = theme
    },

    async getTextTheme(): Promise<{ name: string; customTheme: CustomTextTheme }> {
      return { name: 'standard', customTheme: state.customTextTheme }
    },

    // --- Network & Security ---
    async nativeFetch(url: string, options?: RequestInit): Promise<Response> {
      return handleNativeFetch(url, options)
    },

    async saveSecretHeader(_key: string, _prefix: string, _value: string | string[]): Promise<void> {
      // Stored in mock session
    },

    // --- UI Registration ---
    async registerSetting(
      _name: string,
      _callback: () => void | Promise<void>,
      _icon?: string,
      _iconType?: IconType,
      id?: string
    ): Promise<UIPartResponse> {
      const assignedId = id || `mock-setting-${Math.random().toString(36).slice(2, 8)}`
      state.settings.set(assignedId, { name: _name, callback: _callback, icon: _icon, iconType: _iconType })
      return { id: assignedId }
    },

    async registerButton(
      arg: { name: string; icon: string; iconType: IconType; location?: 'action' | 'chat' | 'hamburger'; id?: string },
      _callback: () => void
    ): Promise<UIPartResponse> {
      const assignedId = arg.id || `mock-btn-${Math.random().toString(36).slice(2, 8)}`
      state.buttons.set(assignedId, { ...arg, callback: _callback })
      return { id: assignedId }
    },

    async unregisterUIPart(id: string): Promise<void> {
      state.settings.delete(id)
      state.buttons.delete(id)
    },

    // --- MCP Tool Registration ---
    async registerMCP(_arg: unknown, _getTools: unknown, _callTool: unknown): Promise<void> {},
    async unregisterMCP(_id: string): Promise<void> {},

    // --- AI Providers & TTS ---
    async addProvider(_name: string, _func: ProviderFunction, _options?: ProviderOptions): Promise<void> {},
    async addTTSPreprocessor(_func: (ctx: BeforeTTSContext) => Promise<BeforeTTSResult | void> | BeforeTTSResult | void): Promise<void> {},
    async addTTSPostprocessor(_func: (ctx: AfterTTSContext) => Promise<AfterTTSResult | void> | AfterTTSResult | void): Promise<void> {},

    // --- Script Handlers & Replacers ---
    async addRisuScriptHandler(_mode: ScriptMode, _func: (content: string) => string | null | undefined | Promise<string | null | undefined>): Promise<void> {},
    async removeRisuScriptHandler(_mode: ScriptMode, _func: (content: string) => string | null | undefined | Promise<string | null | undefined>): Promise<void> {},
    async addRisuReplacer(_type: ReplacerType, _func: (...args: any[]) => any): Promise<void> {},
    async removeRisuReplacer(_type: ReplacerType, _func: (...args: any[]) => any): Promise<void> {},

    async registerBodyIntercepter(_callback: (body: unknown, type: string) => unknown): Promise<{ id: string } | null> {
      return { id: 'mock-interceptor-001' }
    },
    async unregisterBodyIntercepter(_id: string): Promise<void> {},

    // --- Asset Management ---
    async readImage(assetId?: string): Promise<Uint8Array> {
      return handleReadImage(assetId)
    },

    async saveAsset(_data: unknown): Promise<string> {
      return `assets/mock-asset-${Math.random().toString(36).slice(2, 10)}.png`
    },

    // --- Lifecycle & System Info ---
    async requestPluginPermission(_permission: string): Promise<boolean> {
      return true
    },

    async onUnload(callback: () => void | Promise<void>): Promise<void> {
      state.unloadCallbacks.add(callback)
    },

    async loadPlugins(): Promise<void> {},

    async getFetchLogs(): Promise<{
      url: string
      body: string
      status?: number
      response?: string
      error?: string
      timestamp: number
    }[] | null> {
      return []
    },

    async checkCharOrder(): Promise<void> {},

    async getRuntimeInfo(): Promise<{ apiVersion: string; platform: string; saveMethod: string }> {
      return {
        apiVersion: '3.0',
        platform: 'web',
        saveMethod: 'memory',
      }
    },

    async searchTranslationCache(_partialKey: string): Promise<{ key: string; value: string }[]> {
      return []
    },

    async getTranslationCache(_key: string): Promise<string | null> {
      return null
    },

    async addPluginChannelListener(_channelName: string, _callback: unknown): Promise<void> {},
    async postPluginChannelMessage(_pluginName: string, _channelName: string, _message: unknown): Promise<void> {},

    async runLLMModel(_options: { messages: unknown[]; staticModel?: string; mode: string; allowPlugins?: boolean }): Promise<unknown> {
      return 'Mock LLM Response'
    },

    async sendChat(message: string): Promise<void> {
      if (message) {
        state.character.chats[0]?.message.push({
          role: 'user',
          data: message,
          chatId: `msg-${Date.now()}`,
          name: state.username,
        })
      }
    },
  }

  return api
}

// ============================================================================
// 9. Primary Installation & Cleanup Entrypoint
// ============================================================================

/**
 * Installs the RisuAI mock environment onto `globalThis.Risuai` and `globalThis.risuai`,
 * constructs the virtual chat DOM tree, and returns a cleanup teardown function.
 *
 * @param spec - Mock character, user persona, and message history configuration
 * @returns Cleanup function that removes the injected DOM nodes and tears down globals
 */
export function installMockRisuai(spec: MockCharSpec): () => void {
  // 1. Build and inject virtual chat DOM tree
  const { rootDoc } = buildMockChatDom(spec)

  // 2. Initialize mock state store and storages
  const state = createInitialState(spec)
  const safeDoc = new MockSafeDocument(rootDoc)
  const pluginStorage = new MockPluginStorage()
  const safeLocalStorage = new MockSafeLocalStorage()
  const localPluginStorage = new MockSafeLocalPluginStorage()

  // 3. Construct API instance
  const api = createMockRisuaiAPI(state, safeDoc, {
    pluginStorage,
    safeLocalStorage,
    localPluginStorage,
  })

  // 4. Inject global Risuai handles
  const globalRef = globalThis as unknown as {
    Risuai?: RisuaiPluginAPI
    risuai?: RisuaiPluginAPI
  }
  globalRef.Risuai = api
  globalRef.risuai = api

  // 5. Return cleanup teardown function
  return () => {
    // Run onUnload lifecycle handlers
    for (const callback of state.unloadCallbacks) {
      try {
        void callback()
      } catch (err) {
        console.warn('[mock Risuai] Error during onUnload execution:', err)
      }
    }
    state.unloadCallbacks.clear()

    // Remove injected mock DOM tree
    const mockRoot = document.getElementById('risu-mock-root')
    if (mockRoot) {
      mockRoot.remove()
    }

    // Clean up global references
    delete globalRef.Risuai
    delete globalRef.risuai
  }
}