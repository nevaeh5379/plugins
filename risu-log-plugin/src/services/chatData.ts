// chatData.ts — API v3.0 기반 채팅 데이터 수집
// 기존 utils/domParser.ts의 processChatLog를 대체합니다.
// Risuai.getCharacter / getChatFromIndex / getRootDocument를 사용하여
// 캐릭터 정보, 채팅 메시지 데이터, 메시지 DOM 노드를 수집합니다.

import type { RisuCharacter, RisuChat } from '../types/risuai'
import type { Persona } from '../types'
import { getAllMessageNodes } from './messageScanner'
import { extractSwImageLocation, extractTauriAssetLocation, extractBackgroundImageUrl } from '../LogExporter/utils/imageUtils'

export interface ChatLogData {
  charName: string
  chatName: string
  charAvatarUrl: string
  messageNodes: SafeElement[]
  character: RisuCharacter | null
  chat: RisuChat | null
  avatarMap?: Record<string, string>
}

export interface ProcessOptions {
  startIndex?: number
  endIndex?: number
  singleMessage?: boolean
}

// ──────────────────────────────────────────────
// 권한 관리
// ──────────────────────────────────────────────

/**
 * mainDom 권한을 보장하여 rootDoc을 반환합니다.
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

// ──────────────────────────────────────────────
// 아바타 추출
// ──────────────────────────────────────────────

/**
 * 캐릭터 아바타를 data URL로 추출합니다.
 * RisuAI의 character.image는 asset id이므로 Risuai.readImage로 원본 바이트를 가져옵니다.
 */
async function extractAvatarDataUrl(imageAssetId: string): Promise<string> {
  if (!imageAssetId) return ''
  try {
    const data = await Risuai.readImage(imageAssetId)
    if (!data) return ''
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
 * 캐릭터 메타데이터 (이름, 아바타, 채팅 정보) 를 수집합니다.
 */
async function fetchChatMetadata(
  chatIndex?: number
): Promise<{
  charName: string
  chatName: string
  charAvatarUrl: string
  character: RisuCharacter | null
  chat: RisuChat | null
}> {
  const charIdx = await Risuai.getCurrentCharacterIndex()
  const character: RisuCharacter | null = (await Risuai.getCharacter()) as RisuCharacter | null
  const targetChatIndex = chatIndex ?? (await Risuai.getCurrentChatIndex())

  let chat: RisuChat | null = null
  if (character && targetChatIndex >= 0) {
    chat = (await Risuai.getChatFromIndex(charIdx, targetChatIndex)) as RisuChat | null
  }

  const charName = character?.name || 'Unknown'
  const chatName = chat?.name || `Chat ${targetChatIndex}`

  let charAvatarUrl = ''
  if (character?.image) {
    charAvatarUrl = await extractAvatarDataUrl(String(character.image))
  }

  return { charName, chatName, charAvatarUrl, character, chat }
}

// ──────────────────────────────────────────────
// 노드 수집
// ──────────────────────────────────────────────

/**
 * 메인 DOM에서 메시지 노드를 수집합니다.
 */
async function collectMessageNodes(rootDoc: SafeDocument | null): Promise<SafeElement[]> {
  if (!rootDoc) {
    console.warn('[log plugin] rootDoc is null — no message nodes collected')
    return []
  }
  return await getAllMessageNodes(rootDoc)
}

/**
 * 메시지 노드를 범위 옵션에 따라 슬라이스합니다.
 */
function sliceMessageNodes(
  allNodes: SafeElement[],
  options: ProcessOptions
): SafeElement[] {
  const { startIndex, endIndex, singleMessage } = options
  if (singleMessage && typeof startIndex === 'number') {
    return allNodes.slice(startIndex, startIndex + 1)
  }
  if (typeof startIndex === 'number' && typeof endIndex === 'number') {
    return allNodes.slice(startIndex, endIndex + 1)
  }
  if (typeof startIndex === 'number') {
    return allNodes.slice(startIndex)
  }
  return allNodes
}

// ──────────────────────────────────────────────
// 아바타 맵 수집
// ──────────────────────────────────────────────

/**
 * 캐릭터 기본 아바타를 수집합니다.
 */
async function fetchCharacterAvatar(
  character: RisuCharacter | null,
  charName: string
): Promise<Record<string, string>> {
  const avatarMap: Record<string, string> = {}
  if (character?.image) {
    const dataUrl = await extractAvatarDataUrl(String(character.image))
    if (dataUrl) {
      avatarMap[charName] = dataUrl
    }
  }
  return avatarMap
}

/**
 * 바인딩된 페르소나 아바타를 수집합니다.
 */
async function fetchPersonaAvatar(
  charIdx: number,
  chatIdx: number
): Promise<Record<string, string>> {
  const avatarMap: Record<string, string> = {}
  try {
    const db = await Risuai.getDatabase(['personas', 'selectedPersona'])
    if (!db) return avatarMap

    let userIcon = ''
    let username = 'User'

    const chat = await Risuai.getChatFromIndex(charIdx, chatIdx) as RisuChat | null
    let bindedPersona: Persona | null = null
    if (chat && chat.bindedPersona && db.personas) {
      bindedPersona = db.personas?.find((v) => v.id === chat.bindedPersona) as Persona | undefined ?? null
    }

    if (bindedPersona) {
      userIcon = bindedPersona.icon
      username = bindedPersona.name
    } else {
      userIcon = (db as Record<string, unknown>)['userIcon'] as string || ''
      username = (db as Record<string, unknown>)['username'] as string || 'User'
    }

    if (userIcon) {
      const dataUrl = await extractAvatarDataUrl(userIcon)
      if (dataUrl) {
        avatarMap[username] = dataUrl
      }
    }
  } catch (e) {
    console.warn('[log plugin] Failed to pre-fetch user persona avatar:', e)
  }
  return avatarMap
}

/**
 * DOM 노드에서 background-image 스타일을 통해 추가 아바타를 수집합니다.
 */
async function collectAvatarsFromDOM(
  nodes: SafeElement[],
  existingMap: Record<string, string>
): Promise<Record<string, string>> {
  const avatarMap = { ...existingMap }

  for (const node of nodes) {
    try {
      const nameEl = await node.querySelector('.text-textcolor')
      if (!nameEl) continue

      const nameHtml = await nameEl.getOuterHTML()
      const cleanText = nameHtml.replace(/<[^>]+>/g, '').trim()
      if (!cleanText) continue
      const name = cleanText

      if (avatarMap[name]) continue

      const styleDivs = await node.querySelectorAll('[style*="background"]')
      const arr = await Risuai.unwarpSafeArray(styleDivs)

      let avatarUrl = ''
      for (const div of arr) {
        const styleAttr = await div.getAttribute('style')
        if (styleAttr) {
          const url = extractBackgroundImageUrl(styleAttr)
          if (url) {
            avatarUrl = url
            break
          }
        }
      }

      if (avatarUrl) {
        const finalDataUrl = await convertUrlToDataUrl(avatarUrl)
        if (finalDataUrl) {
          avatarMap[name] = finalDataUrl
        }
      }
    } catch (e) {
      console.warn('[log plugin] Error collecting avatar for a node:', e)
    }
  }

  return avatarMap
}

/**
 * URL을 종류에 따라 data URL로 변환합니다.
 */
async function convertUrlToDataUrl(avatarUrl: string): Promise<string> {
  // SW 이미지 주소인 경우
  const swLoc = extractSwImageLocation(avatarUrl)
  if (swLoc) {
    try {
      return await extractAvatarDataUrl(swLoc)
    } catch {
      // ignore
    }
  }

  // Tauri 로컬 프로토콜 주소인 경우
  if (!avatarUrl.startsWith('data:') && !avatarUrl.startsWith('blob:')) {
    if (avatarUrl.startsWith('asset://') || avatarUrl.includes('asset.localhost')) {
      try {
        const loc = extractTauriAssetLocation(avatarUrl)
        if (loc) {
          return await extractAvatarDataUrl(loc)
        }
      } catch {
        // ignore
      }
    }
  }

  // 일반 URL — fetch 시도
  if (!avatarUrl.startsWith('data:') && !avatarUrl.startsWith('blob:')) {
    try {
      const res = await fetch(avatarUrl)
      const blob = await res.blob()
      return await new Promise<string>((resVal, rejVal) => {
        const reader = new FileReader()
        reader.onload = () => resVal(reader.result as string)
        reader.onerror = () => rejVal(new Error('FileReader failed'))
        reader.readAsDataURL(blob)
      })
    } catch {
      // ignore
    }
  }

  return ''
}

/**
 * 모든 아바타를 수집합니다 (캐릭터 + 페르소나 + DOM).
 */
async function collectAllAvatars(
  nodes: SafeElement[],
  charName: string,
  character: RisuCharacter | null,
  chatIdx: number
): Promise<Record<string, string>> {
  // 1. 캐릭터 아바타
  const avatarMap = await fetchCharacterAvatar(character, charName)

  // 2. 페르소나 아바타
  const charIdx = await Risuai.getCurrentCharacterIndex()
  const personaMap = await fetchPersonaAvatar(charIdx, chatIdx)
  Object.assign(avatarMap, personaMap)

  // 3. DOM 노드에서 추가 아바타
  return await collectAvatarsFromDOM(nodes, avatarMap)
}

// ──────────────────────────────────────────────
// Serialize
// ──────────────────────────────────────────────

/**
 * SafeElement[]의 outerHTML을 문자열 배열로 반환합니다.
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

// ──────────────────────────────────────────────
// 메인 진입점
// ──────────────────────────────────────────────

/**
 * 현재 채팅의 로그 데이터를 수집합니다.
 */
export async function processChatLog(
  chatIndex?: number,
  options: ProcessOptions = {}
): Promise<ChatLogData> {
  // 1. 메타데이터 수집
  const { charName, chatName, charAvatarUrl, character, chat } =
    await fetchChatMetadata(chatIndex)

  // 2. 노드 수집
  const rootDoc = await ensureRootDoc()
  const allNodes = await collectMessageNodes(rootDoc)

  // 3. 범위 슬라이싱
  const messageNodes = sliceMessageNodes(allNodes, options)

  // 4. 아바타 수집
  const targetChatIndex = chatIndex ?? (await Risuai.getCurrentChatIndex())
  const avatarMap = await collectAllAvatars(
    messageNodes, charName, character, targetChatIndex
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
