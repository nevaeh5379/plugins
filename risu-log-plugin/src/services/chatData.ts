/**
 * chatData.ts — API v3.0 기반 채팅 데이터 수집 서비스
 *
 * Risuai.getCharacter / getChatFromIndex / getRootDocument 등을 사용하여
 * 캐릭터 정보, 채팅 메시지 데이터, 메시지 DOM 노드 및 아바타 맵을 수집합니다.
 */

import type { RisuCharacter, RisuChat } from '../types/risuai'
import type { Persona, DatabaseResponse } from '../types'
import { getAllMessageNodes } from './messageScanner'
import {
  extractSwImageLocation,
  extractTauriAssetLocation,
  extractBackgroundImageUrl,
} from '../LogExporter/utils/imageUtils'

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ChatLogData {
  charName: string
  chatName: string
  charAvatarUrl: string
  messageNodes: SafeElement[] // SafeElement[] (메인 DOM, 외부에서 outerHTML로 변환)
  character: RisuCharacter | null
  chat: RisuChat | null
  avatarMap?: Record<string, string>
}

export interface ProcessOptions {
  startIndex?: number
  endIndex?: number
  singleMessage?: boolean
}

interface UserPersonaInfo {
  username: string
  avatarUrl: string
}

// ============================================================================
// DOM & Permission Helpers
// ============================================================================

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
    return await Risuai.getRootDocument()
  } catch (e) {
    console.error('[log plugin] ensureRootDoc error:', e)
    return null
  }
}

// ============================================================================
// Image & Avatar Transformation Helpers
// ============================================================================

/**
 * Blob 데이터를 base64 Data URL 문자열로 변환합니다.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed to read Blob as Data URL'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 캐릭터/페르소나 아바타를 data URL로 추출합니다.
 * RisuAI의 character.image 또는 persona.icon은 asset id(예: "assets/...")입니다.
 * Risuai.readImage(assetId)로 원본 바이트를 가져와 data URL로 변환합니다.
 */
async function extractAvatarDataUrl(imageAssetId: string): Promise<string> {
  if (!imageAssetId) return ''
  try {
    const data = await Risuai.readImage(imageAssetId)
    if (!data) return ''
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    return await blobToDataUrl(new Blob([bytes]))
  } catch (e) {
    console.warn('[log plugin] readImage avatar failed:', e)
    return ''
  }
}

/**
 * 다양한 형태의 아바타 URL(Data URL, SW 이미지, Tauri asset, 외부 URL)을 Base64 data URL로 변환합니다.
 */
async function resolveAvatarDataUrl(avatarUrl: string): Promise<string> {
  if (!avatarUrl) return ''

  // 1. 이미 data: 또는 blob: URL인 경우
  if (avatarUrl.startsWith('data:') || avatarUrl.startsWith('blob:')) {
    return avatarUrl
  }

  // 2. 서비스 워커 주소인 경우 (/sw/img/<hex>)
  const swLoc = extractSwImageLocation(avatarUrl)
  if (swLoc) {
    try {
      const dataUrl = await extractAvatarDataUrl(swLoc)
      if (dataUrl) return dataUrl
    } catch {
      // 다음 변환 시도로 이동
    }
  }

  // 3. Tauri 로컬 프로토콜 주소인 경우 (asset:// 또는 asset.localhost)
  if (avatarUrl.startsWith('asset://') || avatarUrl.includes('asset.localhost')) {
    try {
      const loc = extractTauriAssetLocation(avatarUrl)
      if (loc) {
        const dataUrl = await extractAvatarDataUrl(loc)
        if (dataUrl) return dataUrl
      }
    } catch {
      // 다음 변환 시도로 이동
    }
  }

  // 4. 일반 외부 웹 URL인 경우 fetch 후 Data URL 변환 시도
  try {
    const res = await fetch(avatarUrl)
    if (res.ok) {
      const blob = await res.blob()
      return await blobToDataUrl(blob)
    }
  } catch {
    // 외부 URL fetch 실패 시 무시
  }

  return ''
}

// ============================================================================
// Node Parsing Helpers
// ============================================================================

/**
 * 메시지 SafeElement 노드에서 화자(참가자) 이름을 추출합니다.
 */
async function extractParticipantName(node: SafeElement): Promise<string | null> {
  try {
    const nameEl = await node.querySelector('.text-textcolor')
    if (!nameEl) return null

    const nameHtml = await nameEl.getOuterHTML()
    const cleanText = nameHtml.replace(/<[^>]+>/g, '').trim()
    return cleanText || null
  } catch {
    return null
  }
}

/**
 * 메시지 SafeElement 노드의 background style에서 아바타 이미지 URL을 추출합니다.
 */
async function extractAvatarUrlFromNode(node: SafeElement): Promise<string | null> {
  try {
    const styleDivs = await node.querySelectorAll('[style*="background"]')
    const arr = await Risuai.unwarpSafeArray(styleDivs)

    for (const div of arr) {
      const styleAttr = await div.getAttribute('style')
      if (styleAttr) {
        const url = extractBackgroundImageUrl(styleAttr)
        if (url) return url
      }
    }
  } catch {
    // 노드 탐색 오류 무시
  }
  return null
}

/**
 * 현재 바인딩된 페르소나 또는 기본 유저 프로필 정보를 가져옵니다.
 */
async function resolveUserPersonaAvatar(
  characterIndex: number,
  chatIndex: number
): Promise<UserPersonaInfo | null> {
  try {
    const db = (await Risuai.getDatabase(['personas', 'selectedPersona'])) as DatabaseResponse | null
    if (!db) return null

    const chat = (await Risuai.getChatFromIndex(characterIndex, chatIndex)) as RisuChat | null
    let boundPersona: Persona | null = null

    if (chat?.bindedPersona && Array.isArray(db.personas)) {
      boundPersona = db.personas.find((p) => p.id === chat.bindedPersona) ?? null
    }

    const userIcon = boundPersona ? boundPersona.icon : (db.userIcon || '')
    const username = boundPersona ? boundPersona.name : (db.username || 'User')

    if (!userIcon) return null

    const avatarUrl = await extractAvatarDataUrl(userIcon)
    return avatarUrl ? { username, avatarUrl } : null
  } catch (e) {
    console.warn('[log plugin] Failed to pre-fetch user persona avatar:', e)
    return null
  }
}

/**
 * 주어진 범위 옵션(startIndex, endIndex, singleMessage)에 따라 메시지 노드 배열을 슬라이스합니다.
 */
function sliceMessageNodes(nodes: SafeElement[], options: ProcessOptions): SafeElement[] {
  const { startIndex, endIndex, singleMessage } = options

  if (typeof startIndex !== 'number') {
    return nodes
  }

  if (singleMessage) {
    return nodes.slice(startIndex, startIndex + 1)
  }

  if (typeof endIndex === 'number') {
    return nodes.slice(startIndex, endIndex + 1)
  }

  return nodes.slice(startIndex)
}

// ============================================================================
// Avatar Map Collection
// ============================================================================

/**
 * 메인 DOM에서 캐릭터, 바인딩된 유저(페르소나), 대화 노드 내 추가 참가자의 아바타 이미지를 수집하여
 * 이름 -> Base64 Data URL 맵을 생성합니다.
 */
async function collectAvatarsMain(
  nodes: SafeElement[],
  charName: string,
  charAvatarUrl?: string,
  characterIndex?: number,
  chatIndex?: number
): Promise<Record<string, string>> {
  const avatarMap: Record<string, string> = {}

  // 1. 현재 캐릭터 기본 아바타 등록 (미리 변환된 dataUrl 사용 또는 새로 추출)
  if (charAvatarUrl) {
    avatarMap[charName] = charAvatarUrl
  } else {
    const character = (await Risuai.getCharacter()) as RisuCharacter | null
    if (character?.image) {
      const dataUrl = await extractAvatarDataUrl(String(character.image))
      if (dataUrl) {
        avatarMap[charName] = dataUrl
      }
    }
  }

  // 2. 현재 대화에 바인딩된 페르소나 또는 기본 유저 아바타 등록
  const effectiveCharIdx = characterIndex ?? (await Risuai.getCurrentCharacterIndex())
  const effectiveChatIdx = chatIndex ?? (await Risuai.getCurrentChatIndex())
  const personaInfo = await resolveUserPersonaAvatar(effectiveCharIdx, effectiveChatIdx)
  if (personaInfo) {
    avatarMap[personaInfo.username] = personaInfo.avatarUrl
  }

  // 3. 각 대화 노드를 순회하며 background style로부터 추가적인 아바타(그룹 챗 등) 수집
  for (const node of nodes) {
    try {
      const name = await extractParticipantName(node)
      if (!name || avatarMap[name]) continue

      const rawAvatarUrl = await extractAvatarUrlFromNode(node)
      if (!rawAvatarUrl) continue

      const finalDataUrl = await resolveAvatarDataUrl(rawAvatarUrl)
      if (finalDataUrl) {
        avatarMap[name] = finalDataUrl
      }
    } catch (e) {
      console.warn('[log plugin] Error collecting avatar for a node:', e)
    }
  }

  return avatarMap
}

// ============================================================================
// Main Public Exports
// ============================================================================

/**
 * 현재 채팅(또는 지정된 인덱스의 채팅)의 로그 데이터를 수집합니다.
 *
 * @param chatIndex 내보낼 채팅 인덱스 (character.chatPage 기준). 생략 시 현재 채팅.
 * @param options startIndex, endIndex, singleMessage 옵션으로 수집할 메시지 범위 제한
 */
export async function processChatLog(
  chatIndex?: number,
  options: ProcessOptions = {}
): Promise<ChatLogData> {
  const rootDoc = await ensureRootDoc()
  const charIdx = await Risuai.getCurrentCharacterIndex()
  const character = (await Risuai.getCharacter()) as RisuCharacter | null

  const targetChatIndex = chatIndex ?? (await Risuai.getCurrentChatIndex())

  let chat: RisuChat | null = null
  if (character && targetChatIndex >= 0) {
    chat = (await Risuai.getChatFromIndex(charIdx, targetChatIndex)) as RisuChat | null
  }

  const charName = character?.name || 'Unknown'
  const chatName = chat?.name || `Chat ${targetChatIndex}`

  // 캐릭터 아바타: Risuai.readImage(character.image)로 asset 데이터를 직접 가져와 data URL로 변환
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

  // 범위 슬라이싱 적용
  const messageNodes = sliceMessageNodes(allNodes, options)

  // 아바타 맵 수집 (캐릭터, 페르소나, 그룹챗 참가자)
  const avatarMap = await collectAvatarsMain(
    messageNodes,
    charName,
    charAvatarUrl,
    charIdx,
    targetChatIndex
  )

  return {
    charName,
    chatName,
    charAvatarUrl,
    messageNodes,
    character,
    chat,
    avatarMap,
  }
}

/**
 * SafeElement[]의 outerHTML을 비동기 병렬로 수집하여 문자열 배열로 반환합니다.
 * iframe 내부에서 표준 HTMLElement로 재구성할 때 사용합니다.
 */
export async function serializeNodes(nodes: SafeElement[]): Promise<string[]> {
  return Promise.all(
    nodes.map(async (node) => {
      try {
        return await node.getOuterHTML()
      } catch {
        return ''
      }
    })
  )
}