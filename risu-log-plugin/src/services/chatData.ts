// chatData.ts — API v3.0 기반 채팅 데이터 수집
// 기존 utils/domParser.ts의 processChatLog를 대체합니다.
// Risuai.getCharacter / getChatFromIndex / getRootDocument를 사용하여
// 캐릭터 정보, 채팅 메시지 데이터, 메시지 DOM 노드를 수집합니다.

import type { RisuCharacter, RisuChat } from '../types/risuai'
import { getAllMessageNodes } from './messageScanner'

export interface ChatLogData {
  charName: string
  chatName: string
  charAvatarUrl: string
  messageNodes: SafeElement[] // SafeElement[] (메인 DOM, 외부에서 outerHTML로 변환)
  character: RisuCharacter | null
  chat: RisuChat | null
}

export interface ProcessOptions {
  startIndex?: number
  endIndex?: number
  singleMessage?: boolean
}

/**
 * mainDom 권한을 보장하여 rootDoc을 반환합니다.
 * getRootDocument()는 권한 거부 시 null을 반환하므로,
 * 먼저 requestPluginPermission('mainDom')으로 권한을 요청합니다.
 */
export async function ensureRootDoc(): Promise<SafeDocument | null> {
  try {
    const granted = await Risuai.requestPluginPermission('mainDom')
    if (!granted) {
      console.warn('[log plugin] mainDom permission denied')
      return null
    }
    const doc = await Risuai.getRootDocument()
    return doc
  } catch (e) {
    console.error('[log plugin] ensureRootDoc error:', e)
    return null
  }
}

/**
 * 캐릭터 아바타를 data URL로 추출합니다.
 * RisuAI의 character.image는 asset id(예: "assets/...")입니다.
 * Risuai.readImage(assetId)로 원본 바이트를 가져와 data URL로 변환합니다.
 * DOM 기반 추출(사이드바)은 폴더 아이콘 등과 혼동될 수 있어 사용하지 않습니다.
 */
async function extractAvatarDataUrl(imageAssetId: string): Promise<string> {
  if (!imageAssetId) return ''
  try {
    const data = await Risuai.readImage(imageAssetId)
    if (!data) return ''
    // readImage는 Uint8Array를 반환합니다.
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    const blob = new Blob([bytes])
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('[log plugin] readImage avatar failed:', e)
    return ''
  }
}

/**
 * 현재 채팅의 로그 데이터를 수집합니다.
 *
 * @param chatIndex 내보낼 채팅 인덱스 (character.chatPage 기준). undefined 시 현재 채팅.
 * @param options startIndex/endIndex/singleMessage로 메시지 범위 제한
 */
export async function processChatLog(
  chatIndex?: number,
  options: ProcessOptions = {}
): Promise<ChatLogData> {
  const rootDoc = await ensureRootDoc()
  const charIdx = await Risuai.getCurrentCharacterIndex()
  const character: RisuCharacter | null = (await Risuai.getCharacter()) as RisuCharacter | null

  const targetChatIndex = chatIndex ?? (await Risuai.getCurrentChatIndex())

  let chat: RisuChat | null = null
  if (character && targetChatIndex >= 0) {
    chat = (await Risuai.getChatFromIndex(charIdx, targetChatIndex)) as RisuChat | null
  }

  const charName = character?.name || 'Unknown'
  const chatName = chat?.name || `Chat ${targetChatIndex}`

  // 아바타: Risuai.readImage(character.image)로 asset 데이터를 직접 가져와
  // data URL로 변환합니다. DOM 추출(사이드바)은 폴더 아이콘 혼동 위험이 있어 사용하지 않습니다.
  let charAvatarUrl = ''
  if (character?.image) {
    charAvatarUrl = await extractAvatarDataUrl(String(character.image))
  }

  // 메시지 DOM 노드 수집 (문서 순서)
  let allNodes: SafeElement[] = []
  if (rootDoc) {
    allNodes = await getAllMessageNodes(rootDoc)
  } else {
    console.warn('[log plugin] rootDoc is null — no message nodes collected')
  }

  // 범위 슬라이싱
  let messageNodes = allNodes
  const { startIndex, endIndex, singleMessage } = options
  if (singleMessage && typeof startIndex === 'number') {
    messageNodes = allNodes.slice(startIndex, startIndex + 1)
  } else if (typeof startIndex === 'number' && typeof endIndex === 'number') {
    messageNodes = allNodes.slice(startIndex, endIndex + 1)
  } else if (typeof startIndex === 'number') {
    messageNodes = allNodes.slice(startIndex)
  }

  return {
    charName,
    chatName,
    charAvatarUrl,
    messageNodes,
    character,
    chat
  }
}

/**
 * SafeElement[]의 outerHTML을 수집하여 문자열 배열로 반환합니다.
 * iframe 내부에서 HTMLElement로 재구성할 때 사용합니다.
 */
export async function serializeNodes(nodes: SafeElement[]): Promise<string[]> {
  const out: string[] = []
  for (const node of nodes) {
    try {
      out.push(await node.getOuterHTML())
    } catch {
      out.push('')
    }
  }
  return out
}