import type { RisuCharacter } from '../types/risuai.d.ts'

export interface EditorRuntimeApi {
  character: {
    getCurrent<T = unknown>(): T | null
    updateCurrent<T = unknown>(character: T): Promise<void>
  }
  context: {
    onCharacterChange(callback: (character: unknown | null) => void): () => void
  }
  ui?: {
    toast(message: string, options?: { type?: 'info' | 'success' | 'warning' | 'error'; duration?: number }): void
  }
}

let runtimeApi: EditorRuntimeApi | null = null

export function setEditorRuntimeApi(api: EditorRuntimeApi | null) {
  runtimeApi = api
}

export function isRisuRuntime(): boolean {
  return runtimeApi !== null || typeof unsafeWindow !== 'undefined'
}

export async function loadCharacter(): Promise<RisuCharacter | null> {
  if (!runtimeApi) return null
  return runtimeApi.character.getCurrent<RisuCharacter>()
}

export async function saveCharacter(character: RisuCharacter): Promise<boolean> {
  if (!runtimeApi) return false
  try {
    await runtimeApi.character.updateCurrent(structuredClone(character))
    return true
  } catch (error) {
    console.error('[Risu Editor] 캐릭터 저장 실패:', error)
    runtimeApi.ui?.toast('캐릭터 저장에 실패했습니다.', { type: 'error' })
    return false
  }
}

export function onCharacterChange(callback: () => void): () => void {
  if (!runtimeApi) return () => undefined
  return runtimeApi.context.onCharacterChange(() => callback())
}

export function notify(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  runtimeApi?.ui?.toast(message, { type })
}

export function getMockCharacter(): RisuCharacter {
  return {
    name: 'Test Character', firstMessage: '안녕하세요!', desc: '테스트 캐릭터입니다.', notes: '',
    chats: [], chatPage: 0, viewScreen: 'none', bias: [], emotionImages: [], globalLore: [],
    chaId: 'test-001', sdData: [], customscript: [], triggerscript: [], utilityBot: false,
    exampleMessage: '', creatorNotes: '', systemPrompt: '', postHistoryInstructions: '',
    alternateGreetings: [], tags: [], creator: '', characterVersion: '1.0', personality: '',
    scenario: '', firstMsgIndex: 0, replaceGlobalNote: '', additionalText: '',
  }
}
