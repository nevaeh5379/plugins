// chatData.ts — API v3.0 기반 채팅 데이터 수집
// 기존 utils/domParser.ts의 processChatLog를 대체합니다.
// Risuai.getCharacter / getChatFromIndex / getRootDocument를 사용하여
// 캐릭터 정보, 채팅 메시지 데이터, 메시지 DOM 노드를 수집합니다.

import type { RisuCharacter, RisuChat } from '../types/risuai'
import type { Persona } from '../types'
import { getAllMessageNodes } from './messageScanner'



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

  const avatarMap = await collectAvatarsMain(messageNodes, charName)

  return {
    charName,
    chatName,
    charAvatarUrl,
    messageNodes,
    character,
    chat,
    avatarMap
  }
}

/**
 * 메인 DOM에서 캐릭터 및 유저(페르소나) 등의 아바타 이미지를 수집하여
 * 이름 -> Base64 data URL 형태의 맵을 생성합니다.
 */








async function collectAvatarsMain(
  nodes: SafeElement[],
  charName: string
): Promise<Record<string, string>> {
  const avatarMap: Record<string, string> = {}
  
  // 1. 현재 캐릭터의 기본 아바타 (미리 캐싱)
  const character: RisuCharacter | null = (await Risuai.getCharacter()) as RisuCharacter | null
  if (character?.image) {
    const dataUrl = await extractAvatarDataUrl(String(character.image))
    if (dataUrl) {
      avatarMap[charName] = dataUrl
    }
  }

  // 2. 현재 대화에 바인딩된 페르소나 아바타 (미리 캐싱)
  try {
    const db = await Risuai.getDatabase(['personas', 'selectedPersona'])
    if (db) {
      let userIcon = ''
      let username = 'User'
      // 바인딩된 페르소나 체크
      const charIdx = await Risuai.getCurrentCharacterIndex()
      const chatIdx = await Risuai.getCurrentChatIndex()
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
    }
  } catch (e) {
    console.warn('[log plugin] Failed to pre-fetch user persona avatar:', e)
  }

  // 3. 각 대화 노드를 돌며 background style 로부터 추가적인 아바타(그룹 챗 등)를 수집
  for (const node of nodes) {
    try {
      const nameEl = await node.querySelector('.text-textcolor')
      if (!nameEl) continue
      
      const nameHtml = await nameEl.getOuterHTML()
      const cleanText = nameHtml.replace(/<[^>]+>/g, '').trim()
      if (!cleanText) continue
      const name = cleanText
      
      if (avatarMap[name]) continue // 이미 수집된 이름이면 패스

      const styleDivs = await node.querySelectorAll('[style*="background"]')
      const arr = await Risuai.unwarpSafeArray(styleDivs)
      
      let avatarUrl = ''
      for (const div of arr) {
        const styleAttr = await div.getAttribute('style')
        if (styleAttr) {
          const urlMatch = styleAttr.match(/url\(['"]?(.*?)['"]?\)/) || styleAttr.match(/url\(&quot;(.*?)&quot;\)/)
          if (urlMatch && urlMatch[1]) {
            avatarUrl = urlMatch[1]
            break
          }
        }
      }
      
      if (avatarUrl) {
        let finalDataUrl = ''
        
        // 서비스 워커 주소인 경우
        const swImgMatch = avatarUrl.match(/\/sw\/img\/([0-9a-fA-F]+)/)
        if (swImgMatch && swImgMatch[1]) {
          try {
            const hex = swImgMatch[1]
            let loc = ''
            for (let i = 0; i < hex.length; i += 2) {
              loc += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
            }
            finalDataUrl = await extractAvatarDataUrl(loc)
          } catch {}
        }
        
        // Tauri 로컬 프로토콜 주소인 경우
        if (!finalDataUrl && (avatarUrl.startsWith('asset://') || avatarUrl.includes('asset.localhost'))) {
          try {
            const decoded = decodeURIComponent(avatarUrl)
            let loc = ''
            const assetsIdx = decoded.indexOf('assets/')
            if (assetsIdx !== -1) {
              loc = decoded.substring(assetsIdx)
            } else {
              loc = decoded.replace(/^(asset:\/\/localhost\/|https:\/\/asset\.localhost\/|http:\/\/asset\.localhost\/|asset:\/\/)/, '')
            }
            finalDataUrl = await extractAvatarDataUrl(loc)
          } catch {}
        }
        
        // 일반 URL인 경우 fetch 시도
        if (!finalDataUrl && !avatarUrl.startsWith('data:') && !avatarUrl.startsWith('blob:')) {
          try {
            const res = await fetch(avatarUrl)
            const blob = await res.blob()
            finalDataUrl = await new Promise<string>((resVal, rejVal) => {
              const reader = new FileReader()
              reader.onload = () => resVal(reader.result as string)
              reader.onerror = () => rejVal(new Error('FileReader failed'))
              reader.readAsDataURL(blob)
            })
          } catch {}
        }
        
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