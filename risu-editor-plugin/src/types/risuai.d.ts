/**
 * Minimal Risuai Plugin API v3.0 type definitions for the editor plugin.
 * Based on the full API from RisuAI source.
 */

export interface LoreBook {
  key: string
  secondkey: string
  insertorder: number
  comment: string
  content: string
  mode: 'multiple' | 'constant' | 'normal' | 'child' | 'folder'
  alwaysActive: boolean
  selective: boolean
  extentions?: {
    risu_case_sensitive: boolean
  }
  activationPercent?: number
  loreCache?: {
    key: string
    data: string[]
  }
  useRegex?: boolean
  bookVersion?: number
  id?: string
  folder?: string
}

export interface LoreSettings {
  tokenBudget: number
  scanDepth: number
  recursiveScanning: boolean
  fullWordMatching?: boolean
}

export interface CustomScript {
  comment: string
  in: string
  out: string
  type: string
  flag?: string
  ableFlag?: boolean
}

/** A trigger effect entry. Only the Lua variant is structurally typed —
 * V1/V2 effects are kept as opaque objects since the editor doesn't model them. */
export interface TriggerLuaEffect {
  type: 'triggerlua' | 'triggercode'
  code: string
}
export type TriggerEffect = TriggerLuaEffect | { type: string; [k: string]: any }

export interface TriggerScript {
  comment: string
  type: 'start' | 'manual' | 'output' | 'input' | 'display' | 'request'
  conditions: any[]
  effect: TriggerEffect[]
  lowLevelAccess?: boolean
}

export interface RisuCharacter {
  type?: 'character'
  name: string
  image?: string
  firstMessage: string
  desc: string
  notes: string
  chats: any[]
  chatPage: number
  viewScreen: 'emotion' | 'none' | 'imggen'
  bias: [string, number][]
  emotionImages: [string, string][]
  globalLore: LoreBook[]
  chaId: string
  sdData: [string, string][]
  customscript: CustomScript[]
  triggerscript: TriggerScript[]
  utilityBot: boolean
  exampleMessage: string
  removedQuotes?: boolean
  creatorNotes: string
  systemPrompt: string
  postHistoryInstructions: string
  alternateGreetings: string[]
  tags: string[]
  creator: string
  characterVersion: string
  personality: string
  scenario: string
  firstMsgIndex: number
  loreSettings?: LoreSettings
  loreExt?: any
  additionalData?: {
    tag?: string[]
    creator?: string
    character_version?: string
  }
  ttsMode?: string
  ttsSpeech?: string
  supaMemory?: boolean
  additionalAssets?: [string, string, string][]
  ttsReadOnlyQuoted?: boolean
  replaceGlobalNote: string
  backgroundHTML?: string
  reloadKeys?: number
  backgroundCSS?: string
  license?: string
  private?: boolean
  additionalText: string
  virtualscript?: string
  scriptstate?: { [key: string]: string | number | boolean }
  depth_prompt?: { depth: number; prompt: string }
  extentions?: { [key: string]: any }
  largePortrait?: boolean
  lorePlus?: boolean
  inlayViewScreen?: boolean
  nickname?: string
  source?: string[]
  group_only_greetings?: string[]
  defaultVariables?: string
  lowLevelAccess?: boolean
  hideChatIcon?: boolean
  translatorNote?: string
  modules?: string[]
}

export interface GroupChat {
  type: 'group'
  image?: string
  firstMessage: string
  chats: any[]
  chatPage: number
  name: string
  viewScreen: 'single' | 'multiple' | 'none' | 'emp'
  characters: string[]
  characterTalks: number[]
  characterActive: boolean[]
  globalLore: LoreBook[]
  autoMode: boolean
  useCharacterLore: boolean
  emotionImages: [string, string][]
  customscript: CustomScript[]
  chaId: string
  alternateGreetings?: string[]
  creatorNotes?: string
  removedQuotes?: boolean
  firstMsgIndex?: number
  loreSettings?: LoreSettings
  supaMemory?: boolean
  backgroundHTML?: string
  backgroundCSS?: string
  virtualscript?: string
  lorePlus?: boolean
  nickname?: string
  defaultVariables?: string
  lowLevelAccess?: boolean
  hideChatIcon?: boolean
  translatorNote?: string
  modules?: string[]
  systemPrompt?: string
  replaceGlobalNote?: string
  additionalText?: string
  personality?: string
  scenario?: string
  exampleMessage?: string
}

export type CharacterLike = RisuCharacter | GroupChat

export interface RisuaiPluginAPI {
  apiVersion: string
  showContainer(mode: 'fullscreen'): Promise<void>
  hideContainer(): Promise<void>
  getCharacter(): Promise<any>
  setCharacter(character: any): Promise<void>
  getDatabase(includeOnly?: string[] | 'all'): Promise<any | null>
  setDatabase(db: any): Promise<void>
  setDatabaseLite(db: any): Promise<void>
  getCharacterFromIndex(index: number): Promise<any | null>
  setCharacterToIndex(index: number, character: any): Promise<void>
  getCurrentCharacterIndex(): Promise<number>
  getCurrentChatIndex(): Promise<number>
  pluginStorage: {
    getItem(key: string): Promise<any | null>
    setItem(key: string, value: any): Promise<void>
    removeItem(key: string): Promise<void>
    clear(): Promise<void>
    keys(): Promise<string[]>
    length(): Promise<number>
  }
  getLocalPluginStorage(): Promise<{
    getItem<T>(key: string): Promise<T | null>
    setItem<T>(key: string, value: T): Promise<void>
    removeItem(key: string): Promise<void>
    keys(): Promise<string[]>
    clear(): Promise<void>
  }>
  getArgument(key: string): Promise<string | number | undefined>
  setArgument(key: string, value: string | number): Promise<void>
  registerSetting(
    name: string,
    callback: () => void | Promise<void>,
    icon?: string,
    iconType?: 'html' | 'img' | 'none',
    id?: string
  ): Promise<{ id: string }>
  registerButton(
    arg: {
      name: string
      icon: string
      iconType: 'html' | 'img' | 'none'
      location?: 'action' | 'chat' | 'hamburger'
      id?: string
    },
    callback: () => void
  ): Promise<{ id: string }>
  unregisterUIPart(id: string): Promise<void>
  onUnload(func: () => void | Promise<void>): Promise<void>
  nativeFetch(url: string, options?: RequestInit): Promise<Response>
  readImage(path?: string): Promise<any>
  saveAsset(data: any): Promise<string>
  getColorScheme(): Promise<{ name: string; scheme: any }>
  getRuntimeInfo(): Promise<{
    apiVersion: string
    platform: string
    saveMethod: string
  }>
}

declare global {
  const Risuai: RisuaiPluginAPI
  const risuai: RisuaiPluginAPI
  const unsafeWindow: Window & {
    __pluginApis__?: {
      getChar(): any
      setChar(character: any): void
    }
    RisuMods?: {
      register(definition: unknown): Promise<void>
    }
  }
}
