import { requirePermission } from './permissions'
import {
  addSystemButton,
  addSystemMenuItem,
  mountUi,
  openSystemModal,
  showSystemToast,
} from './ui'
import { cloneForTransport } from './clone'
import type {
  ChatSendOptions,
  LoaderStatus,
  CbsParseOptions,
  MarkdownParseOptions,
  ModPermission,
  PublicLoaderApi,
  RisuModApi,
  RisuModDefinition,
  RisuRuntimeHook,
  UiButtonOptions,
  UiMenuItemOptions,
  UiMountOptions,
} from '../types'

interface ActiveMod {
  definition: RisuModDefinition
  unloaders: Array<() => void | Promise<void>>
  active: boolean
}

export class ModRegistry implements PublicLoaderApi {
  readonly version = '0.6.0'
  status: LoaderStatus = { phase: 'booting' }
  private hook: RisuRuntimeHook | null = null
  private mods = new Map<string, ActiveMod>()
  private statusListeners = new Set<(status: LoaderStatus) => void>()

  setHook(hook: RisuRuntimeHook) {
    this.hook = hook
    this.setStatus({ phase: 'ready', hookSource: hook.source })
  }

  async replaceHook(hook: RisuRuntimeHook): Promise<void> {
    if (this.hook === hook) return
    const definitions = [...this.mods.values()].map((mod) => mod.definition)
    for (const definition of definitions) await this.unregister(definition.id)
    this.setHook(hook)
    for (const definition of definitions) await this.register(definition)
  }

  setStatus(status: LoaderStatus) {
    this.status = Object.freeze({ ...status })
    for (const listener of this.statusListeners) listener(this.status)
  }

  onStatus(callback: (status: LoaderStatus) => void) {
    this.statusListeners.add(callback)
    callback(this.status)
    return () => this.statusListeners.delete(callback)
  }

  async register(definition: RisuModDefinition): Promise<void> {
    validateDefinition(definition)
    if (this.mods.has(definition.id)) await this.unregister(definition.id)
    const active: ActiveMod = { definition, unloaders: [], active: false }
    this.mods.set(definition.id, active)
    if (!this.hook) return

    const api = this.createApi(active)
    const cleanup = await definition.activate(api)
    if (cleanup) active.unloaders.push(cleanup)
    active.active = true
  }

  async unregister(modId: string): Promise<void> {
    const mod = this.mods.get(modId)
    if (!mod) return
    for (const unload of [...mod.unloaders].reverse()) await unload()
    this.mods.delete(modId)
  }

  list() {
    return [...this.mods.values()].map(({ definition, active }) => ({
      id: definition.id,
      name: definition.name,
      version: definition.version,
      active,
    }))
  }

  async activatePending(): Promise<void> {
    for (const mod of this.mods.values()) {
      if (!mod.active) await this.register(mod.definition)
    }
  }

  private createApi(mod: ActiveMod): RisuModApi {
    const hook = this.hook!
    const permissions = new Set<ModPermission>(mod.definition.permissions)
    const check = (permission: ModPermission) =>
      requirePermission(mod.definition.id, permissions, permission)
    const currentCharacter = <T>() => cloneForTransport(hook.getCurrentCharacter()) as T | null
    const currentChat = <T>() => {
      if (hook.getCurrentChat) return cloneForTransport(hook.getCurrentChat()) as T | null
      const character = hook.getCurrentCharacter() as { chats?: T[]; chatPage?: number } | null
      return cloneForTransport(character?.chats?.[character.chatPage ?? -1] ?? null) as T | null
    }
    const subscribeContext = (kind: 'character' | 'chat', callback: (value: unknown | null) => void) => {
      let previous = contextKey(kind, hook)
      const timer = window.setInterval(() => {
        const next = contextKey(kind, hook)
        if (next === previous) return
        previous = next
        callback(kind === 'character' ? currentCharacter() : currentChat())
      }, 350)
      const dispose = () => window.clearInterval(timer)
      mod.unloaders.push(dispose)
      return dispose
    }
    const findMessageIndex = (messages: Array<Record<string, unknown>>, idOrIndex: string | number) => {
      if (typeof idOrIndex === 'number') return idOrIndex >= 0 && idOrIndex < messages.length ? idOrIndex : -1
      return messages.findIndex((message) => message.chatId === idOrIndex || message.id === idOrIndex)
    }
    const updateCurrentChat = async (mutate: (chat: { message: Array<Record<string, unknown>> }) => void) => {
      const character = currentCharacter<{ chats: Array<{ message: Array<Record<string, unknown>> }>; chatPage: number }>()
      const chat = character?.chats?.[character.chatPage]
      if (!character || !chat) throw new Error('No current chat is selected.')
      chat.message ??= []
      mutate(chat)
      await hook.setCurrentCharacter(character)
    }

    return Object.freeze({
      modId: mod.definition.id,
      runtime: Object.freeze({ source: hook.source, version: hook.version }),
      character: Object.freeze({
        getCurrent: <T>() => {
          check('character.read')
          return cloneForTransport(hook.getCurrentCharacter()) as T | null
        },
        updateCurrent: async <T>(character: T) => {
          check('character.write')
          await hook.setCurrentCharacter(cloneForTransport(character))
        },
        subscribe: (callback: () => void) => {
          check('character.read')
          return hook.subscribeCharacter?.(callback) ?? (() => {})
        },
      }),
      database: Object.freeze({
        snapshot: <T>() => {
          check('database.read')
          if (!hook.getDatabaseSnapshot) throw new Error('Database snapshots are unavailable.')
          return cloneForTransport(hook.getDatabaseSnapshot()) as T
        },
        update: async <T>(database: T) => {
          check('database.write')
          if (!hook.updateDatabase) throw new Error('Database updates are unavailable.')
          await hook.updateDatabase(cloneForTransport(database))
        },
      }),
      parser: Object.freeze({
        cbs: (text: string, options: CbsParseOptions = {}) => {
          check('parser.cbs')
          if (options.runVar) check('parser.cbs.mutate')
          if (!hook.parseCBS) throw new Error('CBS parsing is unavailable.')
          return hook.parseCBS(String(text), cloneForTransport(options))
        },
        markdown: async (text: string, options: MarkdownParseOptions = {}) => {
          check('parser.cbs')
          if (!hook.parseMarkdown) throw new Error('Markdown parsing is unavailable.')
          return hook.parseMarkdown(String(text), cloneForTransport(options))
        },
        markdownSafe: (text: string, forbidTags: string[] = []) => {
          check('parser.cbs')
          if (!hook.parseMarkdownSafe) throw new Error('Safe Markdown parsing is unavailable.')
          return hook.parseMarkdownSafe(String(text), [...forbidTags])
        },
        escape: (text: string) => {
          check('parser.cbs')
          return String(text).replace(/[{}()]/g, (value) => ({
            '{': '\uE9B8', '}': '\uE9B9', '(': '\uE9BA', ')': '\uE9BB',
          })[value] ?? value)
        },
        unescape: (text: string) => {
          check('parser.cbs')
          return String(text).replace(/[\uE9b8-\uE9bf]/g, (value) => [
            '{', '}', '(', ')', '&lt;', '&gt;', ':', ';',
          ][value.charCodeAt(0) - 0xE9B8])
        },
      }),
      variables: Object.freeze({
        getChat: (key: string) => {
          check('variables.read')
          if (!hook.getChatVariable) throw new Error('Chat variables are unavailable.')
          return hook.getChatVariable(String(key))
        },
        setChat: (key: string, value: string) => {
          check('variables.write')
          if (!hook.setChatVariable) throw new Error('Chat variables are unavailable.')
          hook.setChatVariable(String(key), String(value))
        },
        getGlobal: (key: string) => {
          check('variables.read')
          if (!hook.getGlobalVariable) throw new Error('Global variables are unavailable.')
          return hook.getGlobalVariable(String(key))
        },
        setGlobal: (key: string, value: string) => {
          check('variables.write')
          if (!hook.setGlobalVariable) throw new Error('Global variables are unavailable.')
          hook.setGlobalVariable(String(key), String(value))
        },
        listEffective: () => {
          check('variables.read')
          if (!hook.listEffectiveVariables) throw new Error('Effective variables are unavailable.')
          return cloneForTransport(hook.listEffectiveVariables())
        },
      }),
      modules: Object.freeze({
        getActive: <T>() => {
          check('modules.read')
          if (!hook.getActiveModules) throw new Error('Active modules are unavailable.')
          return cloneForTransport(hook.getActiveModules()) as T[]
        },
        getByNamespace: <T>(namespace: string) => {
          check('modules.read')
          if (!hook.getActiveModules) throw new Error('Active modules are unavailable.')
          const modules = hook.getActiveModules() as Array<{ namespace?: string }>
          return cloneForTransport(modules.find((module) => module?.namespace === namespace) ?? null) as T | null
        },
        getLorebooks: <T>() => {
          check('modules.read')
          if (!hook.getActiveModules) throw new Error('Active modules are unavailable.')
          const modules = hook.getActiveModules() as Array<{ lorebook?: T[] }>
          return cloneForTransport(modules.flatMap((module) => module?.lorebook ?? []))
        },
        getAssets: <T>() => {
          check('modules.read')
          if (!hook.getActiveModules) throw new Error('Active modules are unavailable.')
          const modules = hook.getActiveModules() as Array<{ assets?: T[] }>
          return cloneForTransport(modules.flatMap((module) => module?.assets ?? []))
        },
      }),
      context: Object.freeze({
        getCurrentCharacter: <T>() => { check('context.read'); return currentCharacter<T>() },
        getCurrentChat: <T>() => { check('context.read'); return currentChat<T>() },
        getCurrentCharacterIndex: () => {
          check('context.read')
          if (hook.getCurrentCharacterIndex) return hook.getCurrentCharacterIndex()
          const character = hook.getCurrentCharacter() as { chaId?: string } | null
          const database = hook.getDatabaseSnapshot?.() as { characters?: Array<{ chaId?: string }> } | undefined
          return database?.characters?.findIndex((item) => item.chaId === character?.chaId) ?? -1
        },
        getCurrentChatIndex: () => {
          check('context.read')
          return (hook.getCurrentCharacter() as { chatPage?: number } | null)?.chatPage ?? -1
        },
        onCharacterChange: (callback: (character: unknown | null) => void) => {
          check('context.read')
          return subscribeContext('character', callback)
        },
        onChatChange: (callback: (chat: unknown | null) => void) => {
          check('context.read')
          return subscribeContext('chat', callback)
        },
        onDatabaseReady: (callback: () => void) => {
          check('context.read')
          let active = true
          queueMicrotask(() => { if (active) callback() })
          const dispose = () => { active = false }
          mod.unloaders.push(dispose)
          return dispose
        },
      }),
      chat: Object.freeze({
        getCurrent: <T>() => { check('chat.read'); return currentChat<T>() },
        getMessages: <T>() => {
          check('chat.read')
          return (currentChat<{ message?: T[] }>()?.message ?? []) as T[]
        },
        getMessage: <T>(idOrIndex: string | number) => {
          check('chat.read')
          const messages = currentChat<{ message?: Array<Record<string, unknown>> }>()?.message ?? []
          const index = findMessageIndex(messages, idOrIndex)
          return (index >= 0 ? messages[index] : null) as T | null
        },
        getLastMessage: <T>() => {
          check('chat.read')
          const messages = currentChat<{ message?: T[] }>()?.message ?? []
          return (messages.length ? messages[messages.length - 1] : null) as T | null
        },
        getLastUserMessage: <T>() => {
          check('chat.read')
          return ([...(currentChat<{ message?: Array<Record<string, unknown>> }>()?.message ?? [])].reverse().find((message) => message.role === 'user') ?? null) as T | null
        },
        getLastCharacterMessage: <T>() => {
          check('chat.read')
          return ([...(currentChat<{ message?: Array<Record<string, unknown>> }>()?.message ?? [])].reverse().find((message) => message.role === 'char' || message.role === 'bot') ?? null) as T | null
        },
        updateMessage: async (idOrIndex: string | number, patch: Record<string, unknown>) => {
          check('chat.write')
          await updateCurrentChat((chat) => {
            const index = findMessageIndex(chat.message, idOrIndex)
            if (index < 0) throw new Error(`Message not found: ${idOrIndex}`)
            chat.message[index] = { ...chat.message[index], ...cloneForTransport(patch) }
          })
        },
        deleteMessage: async (idOrIndex: string | number) => {
          check('chat.write')
          await updateCurrentChat((chat) => {
            const index = findMessageIndex(chat.message, idOrIndex)
            if (index < 0) throw new Error(`Message not found: ${idOrIndex}`)
            chat.message.splice(index, 1)
          })
        },
        addMessage: async (message: Record<string, unknown>) => {
          check('chat.write')
          if (message.role !== 'user' && message.role !== 'char') throw new Error('Message role must be user or char.')
          if (typeof message.data !== 'string') throw new Error('Message data must be a string.')
          await updateCurrentChat((chat) => chat.message.push(cloneForTransport(message)))
        },
        send: async (text: string, options: ChatSendOptions = {}) => {
          check('chat.send')
          if (!hook.sendMessage) throw new Error('Native chat sending is unavailable.')
          if (typeof text !== 'string') throw new TypeError('Chat text must be a string.')
          const timeoutMs = options.timeoutMs ?? 10 * 60 * 1000
          if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60 * 60 * 1000) {
            throw new RangeError('timeoutMs must be between 1 second and 1 hour.')
          }
          return hook.sendMessage(text, { wait: options.wait ?? true, timeoutMs })
        },
        reload: async () => {
          check('chat.write')
          const character = currentCharacter()
          if (!character) throw new Error('No current character is selected.')
          await hook.setCurrentCharacter(character)
        },
      }),
      assets: Object.freeze({
        read: async (path: string) => {
          check('assets.read')
          if (!hook.readAsset) throw new Error('Asset reading is unavailable.')
          return cloneForTransport(await hook.readAsset(String(path)))
        },
        save: async (data: Uint8Array, options: { customId?: string; fileName?: string } = {}) => {
          check('assets.write')
          if (!hook.saveAsset) throw new Error('Asset saving is unavailable.')
          return hook.saveAsset(new Uint8Array(data), options.customId, options.fileName)
        },
        resolve: async (path: string) => {
          check('assets.read')
          if (/^(?:data:|blob:|https?:)/.test(path)) return path
          if (!hook.readAsset) throw new Error('Asset reading is unavailable.')
          const data = await hook.readAsset(path)
          if (!data) throw new Error(`Asset not found: ${path}`)
          return URL.createObjectURL(new Blob([new Uint8Array(data)], { type: mimeForPath(path) }))
        },
        revoke: (url: string) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url) },
      }),
      ui: Object.freeze({
        mount: (options: UiMountOptions) => {
          check('ui.inject')
          const mounted = mountUi({ ...options, id: `${mod.definition.id}-${options.id}` })
          mod.unloaders.push(mounted.unmount)
          return mounted
        },
        addToolbarButton: (options: UiButtonOptions) => {
          check('ui.inject')
          const dispose = addSystemButton('toolbar', { ...options, id: `${mod.definition.id}-${options.id}` })
          mod.unloaders.push(dispose)
          return dispose
        },
        addChatButton: (options: UiButtonOptions) => {
          check('ui.inject')
          const dispose = addSystemButton('chat', { ...options, id: `${mod.definition.id}-${options.id}` })
          mod.unloaders.push(dispose)
          return dispose
        },
        addMenuItem: (options: UiMenuItemOptions) => {
          check('ui.inject')
          const dispose = addSystemMenuItem({ ...options, id: `${mod.definition.id}-${options.id}` })
          mod.unloaders.push(dispose)
          return dispose
        },
        openModal: (content: HTMLElement | string, options: { title?: string } = {}) => {
          check('ui.inject')
          const dispose = openSystemModal(content, options.title)
          mod.unloaders.push(dispose)
          return dispose
        },
        toast: (
          message: string,
          options: { type?: 'info' | 'success' | 'warning' | 'error'; duration?: number } = {},
        ) => {
          check('ui.inject')
          showSystemToast(String(message), options.type, options.duration)
        },
      }),
      lifecycle: Object.freeze({
        onUnload: (callback: () => void | Promise<void>) => { mod.unloaders.push(callback) },
      }),
    })
  }
}

function validateDefinition(definition: RisuModDefinition) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(definition.id)) {
    throw new Error(`Invalid mod id: ${definition.id}`)
  }
  if (!definition.name || !definition.version || typeof definition.activate !== 'function') {
    throw new Error(`Invalid mod definition: ${definition.id}`)
  }
}

function contextKey(kind: 'character' | 'chat', hook: RisuRuntimeHook) {
  if (hook.getContextKey) return hook.getContextKey(kind)
  const character = hook.getCurrentCharacter() as {
    chaId?: string
    chatPage?: number
    chats?: Array<{ id?: string }>
  } | null
  if (!character) return 'none'
  const characterKey = character.chaId ?? 'unknown-character'
  if (kind === 'character') return characterKey
  const chatIndex = character.chatPage ?? -1
  return `${characterKey}:${chatIndex}:${character.chats?.[chatIndex]?.id ?? ''}`
}

function mimeForPath(path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  return ({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4',
    json: 'application/json', txt: 'text/plain', css: 'text/css', html: 'text/html',
  } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream'
}
