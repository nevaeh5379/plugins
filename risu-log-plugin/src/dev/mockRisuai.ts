// src/dev/mockRisuai.ts
// RisuAI Plugin API v3.0 모킹 — 테스트 서버에서 가상의 Risuai 글로벌을 제공합니다.
// 실제 DOM HTMLElement를 SafeElement로 래핑하여, 플러그인 코드가 그대로 동작하도록 합니다.

import { buildMockChatDom, type MockCharSpec } from './mockData'

// ─── SafeClassArray 래퍼 ──────────────────────────────────────────────────────
class MockSafeClassArray<T> {
  constructor(private items: T[]) {}
  async at(index: number): Promise<T | undefined> {
    return this.items[index < 0 ? this.items.length + index : index]
  }
  async length(): Promise<number> {
    return this.items.length
  }
  async push(item: T): Promise<void> {
    this.items.push(item)
  }
  asArray(): T[] {
    return this.items
  }
}

// ─── SafeElement 래퍼 ──────────────────────────────────────────────────────────
class MockSafeElement {
  constructor(public el: HTMLElement) {}

  // private wrap helper removed (unused)

  async appendChild(child: MockSafeElement): Promise<void> {
    this.el.appendChild(child.el)
  }
  async removeChild(child: MockSafeElement): Promise<void> {
    this.el.removeChild(child.el)
  }
  async replaceChild(newChild: MockSafeElement, oldChild: MockSafeElement): Promise<void> {
    this.el.replaceChild(newChild.el, oldChild.el)
  }
  async replaceWith(newElement: MockSafeElement): Promise<void> {
    this.el.replaceWith(newElement.el)
  }
  async cloneNode(deep = true): Promise<MockSafeElement> {
    return new MockSafeElement(this.el.cloneNode(deep) as HTMLElement)
  }
  async prepend(child: MockSafeElement): Promise<void> {
    this.el.prepend(child.el)
  }
  async remove(): Promise<void> {
    this.el.remove()
  }

  async innerText(): Promise<string> {
    return this.el.innerText
  }
  async textContent(): Promise<string | null> {
    return this.el.textContent
  }
  async setTextContent(value: string): Promise<void> {
    this.el.textContent = value
  }
  async setInnerText(value: string): Promise<void> {
    this.el.innerText = value
  }

  async getInnerHTML(): Promise<string> {
    return this.el.innerHTML
  }
  async getOuterHTML(): Promise<string> {
    return this.el.outerHTML
  }
  async setInnerHTML(value: string): Promise<void> {
    this.el.innerHTML = value
  }
  async setOuterHTML(value: string): Promise<void> {
    this.el.outerHTML = value
  }

  async setAttribute(name: string, value: string): Promise<void> {
    if (!name.startsWith('x-')) {
      throw new Error(`[mock] setAttribute: only x- prefixed allowed (got ${name})`)
    }
    this.el.setAttribute(name, value)
  }
  async getAttribute(name: string): Promise<string | null> {
    if (!name.startsWith('x-')) {
      throw new Error(`[mock] getAttribute: only x- prefixed allowed (got ${name})`)
    }
    return this.el.getAttribute(name)
  }

  async setStyle(property: string, value: string): Promise<void> {
    ;(this.el.style as any)[property] = value
  }
  async getStyle(property: string): Promise<string> {
    return (this.el.style as any)[property]
  }
  async getStyleAttribute(): Promise<string> {
    return this.el.getAttribute('style') || ''
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

  async getChildren(): Promise<MockSafeClassArray<MockSafeElement>> {
    return new MockSafeClassArray(Array.from(this.el.children).map(c => new MockSafeElement(c as HTMLElement)))
  }
  async getParent(): Promise<MockSafeElement | null> {
    return this.el.parentElement ? new MockSafeElement(this.el.parentElement) : null
  }
  async querySelectorAll(selector: string): Promise<MockSafeClassArray<MockSafeElement>> {
    return new MockSafeClassArray(Array.from(this.el.querySelectorAll(selector)).map(c => new MockSafeElement(c as HTMLElement)))
  }
  async querySelector(selector: string): Promise<MockSafeElement | null> {
    const found = this.el.querySelector(selector)
    return found ? new MockSafeElement(found as HTMLElement) : null
  }
  async getElementById(id: string): Promise<MockSafeElement | null> {
    const found = this.el.querySelector(`#${id}`)
    return found ? new MockSafeElement(found as HTMLElement) : null
  }
  async getElementsByClassName(className: string): Promise<MockSafeClassArray<MockSafeElement>> {
    return new MockSafeClassArray(Array.from(this.el.getElementsByClassName(className)).map(c => new MockSafeElement(c as HTMLElement)))
  }
  async matches(selector: string): Promise<boolean> {
    return this.el.matches(selector)
  }

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

  async addEventListener(type: string, listener: (event: unknown) => void, options?: boolean | AddEventListenerOptions): Promise<string> {
    const id = Math.random().toString(36).slice(2)
    ;(this.el as any).__listeners = (this.el as any).__listeners || {}
    ;(this.el as any).__listeners[id] = { type, listener, options }
    this.el.addEventListener(type, listener as any, options as any)
    return id
  }
  async removeEventListener(type: string, id: string, options?: boolean | EventListenerOptions): Promise<void> {
    const map = (this.el as any).__listeners
    if (map && map[id]) {
      this.el.removeEventListener(type, map[id].listener, options as any)
      delete map[id]
    }
  }
  async scrollIntoView(options?: boolean | ScrollIntoViewOptions): Promise<void> {
    this.el.scrollIntoView(options as any)
  }
}

// ─── SafeDocument 래퍼 ─────────────────────────────────────────────────────────
class MockSafeDocument extends MockSafeElement {
  constructor(doc: Document) {
    super(doc.documentElement)
  }

  createElement(tagName: string): MockSafeElement {
    return new MockSafeElement(document.createElement(tagName))
  }
  createAnchorElement(href: string): MockSafeElement {
    const a = document.createElement('a')
    if (/^https?:\/\//.test(href)) {
      a.href = href
    } else {
      a.href = '#'
    }
    return new MockSafeElement(a)
  }
}

// ─── 메모리 기반 PluginStorage ─────────────────────────────────────────────────
class MockPluginStorage {
  private store = new Map<string, any>()
  async getItem(key: string): Promise<any | null> {
    return this.store.has(key) ? this.store.get(key) : null
  }
  async setItem(key: string, value: unknown): Promise<void> {
    this.store.set(key, value)
  }
  async removeItem(key: string): Promise<void> {
    this.store.delete(key)
  }
  async clear(): Promise<void> {
    this.store.clear()
  }
  async key(index: number): Promise<any | null> {
    return Array.from(this.store.keys())[index] ?? null
  }
  async keys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }
  async length(): Promise<number> {
    return this.store.size
  }
}

class MockSafeLocalPluginStorage {
  private store = new Map<string, any>()
  async getItem<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? (this.store.get(key) as T) : null
  }
  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value)
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

class MockSafeLocalStorage {
  private store = new Map<string, string>()
  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value)
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

// ─── SafeMutationObserver ─────────────────────────────────────────────────────
class MockSafeMutationObserver {
  private mo: MutationObserver
  constructor(callback: (mutations: MockSafeClassArray<any>) => void) {
    this.mo = new MutationObserver((records) => {
      const wrapped = new MockSafeClassArray(
        records.map(r => ({
          getType: async () => r.type,
          getTarget: async () => new MockSafeElement(r.target as HTMLElement),
          getAddedNodes: async () =>
            new MockSafeClassArray(
              Array.from(r.addedNodes)
                .filter((n): n is HTMLElement => n.nodeType === 1)
                .map(n => new MockSafeElement(n)),
            ),
        })),
      )
      callback(wrapped)
    })
  }
  async observe(element: MockSafeElement, options: MutationObserverInit): Promise<void> {
    this.mo.observe(element.el, options)
  }
}

// ─── 모킹용 캐릭터/채팅 상태 ─────────────────────────────────────────────────────
interface MockState {
  character: any
  charIndex: number
  chatIndex: number
  chat: any
  personas: any[]
  selectedPersona: string
  userIcon: string
  username: string
}

// ─── Risuai API 객체 빌더 ─────────────────────────────────────────────────────
export function installMockRisuai(spec: MockCharSpec): () => void {
  // 가상 채팅 DOM을 document에 주입 (default-chat-screen 구조)
  const { rootDoc } = buildMockChatDom(spec)

  const state: MockState = {
    character: {
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
          })),
          id: 'chat-0',
          bindedPersona: spec.personaId,
        },
      ],
      chatPage: 0,
      type: 'character',
      firstMessage: spec.messages[0]?.text || '',
    },
    charIndex: 0,
    chatIndex: 0,
    chat: null,
    personas: [
      {
        id: spec.personaId,
        name: spec.userName,
        icon: spec.userAvatarAsset,
        personaPrompt: '테스트 페르소나',
      },
    ],
    selectedPersona: spec.personaId,
    userIcon: spec.userAvatarAsset,
    username: spec.userName,
  }

  const safeDoc = new MockSafeDocument(rootDoc)
  const pluginStorage = new MockPluginStorage()
  const safeLocalStorage = new MockSafeLocalStorage()
  const localPluginStorage = new MockSafeLocalPluginStorage()

  const api: any = {
    apiVersion: '3.0',
    apiVersionCompatibleWith: ['3.0'],

    async log(msg: string) {
      console.log(`[mock Risuai Plugin] ${msg}`)
    },

    async showContainer(_mode: string) {
      // 실제 iframe 표시를 모킹 — 이미 document.body 에 모달이 렌더되므로 no-op
    },
    async hideContainer() {
      // no-op
    },

    async getRootDocument() {
      return safeDoc
    },
    async createMutationObserver(cb: any) {
      return new MockSafeMutationObserver(cb)
    },

    async getCharacter() {
      return state.character
    },
    async setCharacter(c: any) {
      state.character = c
    },
    async getChar() {
      return state.character
    },
    async setChar(c: any) {
      state.character = c
    },
    async getCharacterFromIndex(i: number) {
      return i === 0 ? state.character : null
    },
    async setCharacterToIndex(_i: number, c: any) {
      state.character = c
    },
    async getChatFromIndex(charIdx: number, chatIdx: number) {
      if (charIdx === 0 && chatIdx === 0) {
        return state.character.chats[0]
      }
      return null
    },
    async setChatToIndex(_c: number, _ci: number, chat: any) {
      state.character.chats[0] = chat
    },
    async getCurrentCharacterIndex() {
      return state.charIndex
    },
    async getCurrentChatIndex() {
      return state.chatIndex
    },
    async getCurrentLorebookEntries() {
      return []
    },

    pluginStorage,
    safeLocalStorage,
    async getLocalPluginStorage() {
      return localPluginStorage
    },

    async getArgument(_key: string) {
      return undefined
    },
    async setArgument(_key: string, _value: string | number) {},
    getArg(_key: string) {
      return undefined
    },
    setArg(_key: string, _value: string | number) {},

    async getDatabase(includeOnly: string[] | 'all' = 'all') {
      const all: any = {
        characters: [state.character],
        personas: state.personas,
        selectedPersona: state.selectedPersona,
        userIcon: state.userIcon,
        username: state.username,
        theme: 'dark',
        textTheme: 'standard',
      }
      if (includeOnly === 'all') return all
      const filtered: any = {}
      for (const k of includeOnly) filtered[k] = all[k]
      return filtered
    },
    async setDatabaseLite(_db: any) {},
    async setDatabase(_db: any) {},

    async changeColorScheme(_n: string) {},
    async setColorScheme(_s: any) {},
    async getColorScheme() {
      return { name: 'default', scheme: {} as any }
    },
    async changeTextTheme(_n: string) {},
    async setCustomTextTheme(_t: any) {},
    async getTextTheme() {
      return { name: 'standard', customTheme: {} as any }
    },

    async nativeFetch(url: string, options?: any) {
      // 테스트 환경에서 arca.live 실제 업로드는 동작하지 않음 (CORS/Cloudflare).
      // 명확한 에러를 즉시 반환하여 UI가 멈추지 않도록 합니다.
      if (typeof url === 'string' && url.includes('arca.live')) {
        throw new Error(
          '[테스트 서버] 아카라이브 직접 업로드는 RisuAI 네이티브 fetch(CORS 우회)가 필요합니다. ' +
          '테스트 서버에서는 "ZIP 파일 다운로드" 방식만 사용 가능합니다.',
        )
      }

      // requestTimeoutMs 지원 (브라우저 fetch 에 타임아웃 옵션이 없으므로 직접 구현)
      const timeoutMs = options?.requestTimeoutMs
      const fetchOpts: RequestInit = {
        method: options?.method,
        headers: options?.headers,
        body: options?.body,
      }
      if (timeoutMs && typeof timeoutMs === 'number') {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        fetchOpts.signal = controller.signal
        try {
          const res = await fetch(url, fetchOpts)
          clearTimeout(timer)
          return res
        } catch (e) {
          clearTimeout(timer)
          throw e
        }
      }
      return fetch(url, fetchOpts)
    },
    async saveSecretHeader(_key: string, _prefix: string, _value: string | string[]) {},

    async registerSetting(_name: string, _cb: () => void, _icon?: string, _iconType?: string, _id?: string) {
      return { id: _id || 'mock-setting' }
    },
    async registerButton(_arg: any, _cb: () => void) {
      return { id: 'mock-btn' }
    },
    async unregisterUIPart(_id: string) {},

    async registerMCP(_arg: any, _getTools: any, _callTool: any) {},
    async unregisterMCP(_id: string) {},

    async addProvider(_name: string, _fn: any, _options?: any) {},
    async addTTSPreprocessor(_fn: any) {},
    async addTTSPostprocessor(_fn: any) {},

    unwarpSafeArray(arr: any): Promise<any[]> {
      if (arr instanceof MockSafeClassArray) return Promise.resolve(arr.asArray())
      if (Array.isArray(arr)) return Promise.resolve(arr)
      // SafeClassArray-like
      if (arr && typeof arr.length === 'function') {
        return (async () => {
          const len = await arr.length()
          const out: any[] = []
          for (let i = 0; i < len; i++) out.push(await arr.at(i))
          return out
        })()
      }
      return Promise.resolve([])
    },

    requestPluginPermission(_perm: string): Promise<boolean> {
      return Promise.resolve(true)
    },
    onUnload(_cb: () => void) {},
    readImage: async (assetId: string): Promise<Uint8Array> => {
      // 테스트용: asset id 가 data: URL 이면 그대로 디코딩, 아니면 1x1 투명 PNG
      if (assetId && assetId.startsWith('data:')) {
        const res = await fetch(assetId)
        const buf = await res.arrayBuffer()
        return new Uint8Array(buf)
      }
      // 1x1 투명 PNG
      return Promise.resolve(
        new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
        ]),
      )
    },
  }

  ;(globalThis as any).Risuai = api
  ;(globalThis as any).risuai = api

  // cleanup 함수 반환
  return () => {
    delete (globalThis as any).Risuai
    delete (globalThis as any).risuai
  }
}