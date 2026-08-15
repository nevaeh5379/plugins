/**
 * @file mockData.ts
 * @description Virtual chat DOM hierarchy and mock conversation generator for RisuAI plugin development.
 *
 * Emulates the RisuAI main chat DOM hierarchy expected by `messageScanner.ts` and `chatData.ts`:
 * - Root structure: `#risu-mock-root > .default-chat-screen > .chat-message-container[data-chat-index]`
 * - Message element: `.risu-chat` (.justify-end for user messages)
 * - Message components:
 *   - Avatar: `.shadow-lg.rounded-md` with `background: url(...)`
 *   - Name header: `.unmargin.text-xl` containing `.text-textcolor`
 *   - Body content: `.prose.chattext`
 *
 * Also provides factory utilities to generate strongly typed `RisuCharacter`, `RisuChat`,
 * `RisuPersona`, and `RisuDatabaseSubset` structures for development and unit testing.
 */

import type {
  RisuCharacter,
  RisuChat,
  RisuMessage,
  RisuPersona,
  RisuDatabaseSubset,
  RisuMessageRole,
} from '../types/risuai'

// ============================================================================
// 1. Type Specifications
// ============================================================================

/**
 * Specification for an individual mock chat message turn.
 */
export interface MockMessageSpec {
  /** Message sender role ('user' or 'char') */
  role: 'user' | 'char'
  /** Plain text or markdown content of the message */
  text: string
  /** Optional custom display name overriding persona/character name */
  name?: string
  /** Optional timestamp (epoch ms) */
  time?: number
  /** Optional unique identifier for the message */
  chatId?: string
  /** Optional spoken dialogue / saying text */
  saying?: string
}

/**
 * Specification for a mock character session with associated persona and messages.
 */
export interface MockCharSpec {
  /** Character display name */
  charName: string
  /** Chat title / session name */
  chatName: string
  /** Unique character ID */
  charId: string
  /** Asset ID or data URI used for character avatar */
  charAvatarAsset: string
  /** Background image URL for character avatar DOM */
  charAvatarUrl: string
  /** User persona display name */
  userName: string
  /** User persona unique ID */
  personaId: string
  /** Asset ID or data URI used for user avatar */
  userAvatarAsset: string
  /** Background image URL for user avatar DOM */
  userAvatarUrl: string
  /** Sequence of chat messages */
  messages: MockMessageSpec[]
  /** Optional character personality prompt definition */
  personality?: string
  /** Optional character description prompt */
  description?: string
  /** Optional scenario / situation setting prompt */
  scenario?: string
  /** Optional user persona prompt */
  personaPrompt?: string
}

/**
 * Configuration options for generating an SVG avatar data URL.
 */
export interface SvgAvatarOptions {
  /** Initial or letter displayed in the avatar */
  text: string
  /** Background hex or CSS color string */
  bgColor: string
  /** Text color (default: #ffffff) */
  textColor?: string
  /** Size in pixels (default: 64) */
  size?: number
}

/**
 * Result returned after injecting the mock DOM tree into the document.
 */
export interface MockDomResult {
  /** Reference to the document root containing the injected mock DOM */
  rootDoc: Document
  /** Injected character name */
  charName: string
}

// ============================================================================
// 2. Constants & Fixtures
// ============================================================================

/** Default identifier constants for mock entities */
export const DEFAULT_MOCK_IDS = {
  charId: 'char-aria-001',
  personaId: 'persona-anon-001',
  chatId: 'chat-001',
} as const

/** Default avatar color palette */
export const DEFAULT_AVATAR_PALETTE = {
  charBg: '#7c9cf0',
  userBg: '#6cb6ff',
  textColor: '#ffffff',
} as const

/**
 * Default multi-turn conversation fixture showcasing diverse markdown styling:
 * bold, italic, inline code, blockquote, and multi-line paragraphs.
 */
export const DEFAULT_MOCK_MESSAGES: readonly MockMessageSpec[] = [
  {
    role: 'char',
    text: '안녕하세요! 처음 뵙겠습니다. 저는 **아리아**라고 해요.\n오늘은 어떤 이야기를 나누고 싶으신가요?',
  },
  {
    role: 'user',
    text: '안녕 아리아! 만나서 반가워.\n너에 대해 좀 더 알려줄 수 있어?',
  },
  {
    role: 'char',
    text: '물론이죠! 저는 *대화를 즐기고*, 새로운 것을 배우는 걸 좋아해요.\n\n> 좋은 대화는 좋은 관계의 시작이니까요.\n\n궁금한 점이 있으면 뭐든 물어봐 주세요!',
  },
  {
    role: 'user',
    text: '좋아! 그럼 평소에 취미가 뭐야?',
  },
  {
    role: 'char',
    text: '저는 책 읽는 걸 좋아해요. 특히 `소설`이나 `에세이` 장르를 즐겨 읽죠.\n그리고 음악을 들으면서 산책하는 것도 좋아해요. 당신은 어떤 취미가 있으신가요?',
  },
  {
    role: 'user',
    text: '나는 코딩하는 걸 좋아해. 요즘은 웹 개발 공부 중이야.',
  },
  {
    role: 'char',
    text: '와, 코딩 멋지네요! 웹 개발이라면 정말 창의적인 일을 많이 할 수 있겠어요.\n어떤 언어를 주로 사용하시나요?',
  },
  {
    role: 'user',
    text: '주로 TypeScript 와 React 를 써. 최근에는 Vite 도 써봤어.',
  },
  {
    role: 'char',
    text: 'TypeScript 랑 React 라면 요즘 가장 핫한 스택이네요!\n\n**플러그인** 개발도 해보신다고요? 대단해요. 혹시 만들고 있는 게 있으신가요?',
  },
  {
    role: 'user',
    text: '응, RisuAI 용 로그 내보내기 플러그인을 만들고 있어.',
  },
  {
    role: 'char',
    text: '정말 흥미롭네요! RisuAI 로그를 예쁘게 내보낼 수 있다니,\n테마도 여러 가지고 커스터마이징도 가능할 것 같아요.\n\n> 개발하시면서 필요한 게 있으면 언제든 말씀해 주세요. 응원할게요! 💪',
  },
]

// ============================================================================
// 3. SVG & Text Rendering Utilities
// ============================================================================

/**
 * Generates an SVG data URL for a circular avatar with centered text initials.
 */
export function createSvgAvatar({
  text,
  bgColor,
  textColor = DEFAULT_AVATAR_PALETTE.textColor,
  size = 64,
}: SvgAvatarOptions): string {
  const radius = size / 2
  const fontSize = Math.round(size * 0.44)
  const textY = Math.round(size * 0.62)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${bgColor}"/>` +
    `<text x="${radius}" y="${textY}" font-size="${fontSize}" fill="${textColor}" ` +
    `text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="600">${text}</text>` +
    `</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * Escapes HTML entities and translates simple markdown tokens (bold, italic, code, quote, br) to HTML tags.
 */
export function renderMessageText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br/>')
}

// ============================================================================
// 4. DOM Construction Helpers
// ============================================================================

/**
 * Creates the avatar DOM element (.shadow-lg.rounded-md).
 */
function createAvatarElement(avatarUrl: string): HTMLDivElement {
  const avatar = document.createElement('div')
  avatar.className = 'shadow-lg rounded-md'
  avatar.style.background = `url("${avatarUrl}") center/cover`
  avatar.style.width = '48px'
  avatar.style.height = '48px'
  avatar.style.borderRadius = '50%'
  avatar.style.flexShrink = '0'
  return avatar
}

/**
 * Creates the speaker name element (.unmargin.text-xl > .text-textcolor).
 */
function createNameElement(displayName: string, isUser: boolean): HTMLDivElement {
  const nameEl = document.createElement('div')
  nameEl.className = 'unmargin text-xl'

  const nameInner = document.createElement('span')
  nameInner.className = 'text-textcolor'
  nameInner.textContent = displayName
  nameEl.appendChild(nameInner)

  if (isUser) {
    nameEl.style.textAlign = 'right'
  }

  return nameEl
}

/**
 * Creates the message body container (.prose.chattext).
 */
function createBodyElement(text: string): HTMLDivElement {
  const prose = document.createElement('div')
  prose.className = 'prose chattext'
  prose.innerHTML = renderMessageText(text)
  return prose
}

/**
 * Builds a single `.risu-chat` message node matching RisuAI's rendered chat message DOM structure.
 */
export function buildRisuChat(msg: MockMessageSpec, spec: MockCharSpec): HTMLElement {
  const isUser = msg.role === 'user'
  const displayName = msg.name || (isUser ? spec.userName : spec.charName)
  const avatarUrl = isUser ? spec.userAvatarUrl : spec.charAvatarUrl

  const risuChat = document.createElement('div')
  risuChat.className = isUser ? 'risu-chat justify-end' : 'risu-chat'

  const contentArea = document.createElement('div')
  contentArea.className = isUser ? 'flex-col items-end' : 'flex-col'

  const nameElement = createNameElement(displayName, isUser)
  const bodyElement = createBodyElement(msg.text)
  contentArea.appendChild(nameElement)
  contentArea.appendChild(bodyElement)

  const avatarElement = createAvatarElement(avatarUrl)

  // Character: [Avatar, Content]; User: [Avatar, Content] (flex-row layout aligned with RisuAI DOM)
  risuChat.appendChild(avatarElement)
  risuChat.appendChild(contentArea)

  return risuChat
}

/**
 * Injects a hidden mock chat DOM tree into the document and returns root document references.
 * The injected tree is placed offscreen so scanner functions like `getBoundingClientRect` function properly.
 */
export function buildMockChatDom(spec: MockCharSpec): MockDomResult {
  // Remove any preexisting mock DOM trees to avoid stale node queries
  document.querySelectorAll('#risu-mock-root').forEach((el) => el.remove())

  const root = document.createElement('div')
  root.id = 'risu-mock-root'
  root.style.position = 'fixed'
  root.style.left = '-99999px'
  root.style.top = '0'
  root.style.width = '800px'
  root.style.pointerEvents = 'none'
  document.body.appendChild(root)

  // .default-chat-screen scope (used by messageScanner standalone detection)
  const screen = document.createElement('div')
  screen.className = 'default-chat-screen'
  root.appendChild(screen)

  spec.messages.forEach((msg, index) => {
    const container = document.createElement('div')
    container.className = 'chat-message-container'
    container.setAttribute('data-chat-index', String(index))
    container.appendChild(buildRisuChat(msg, spec))
    screen.appendChild(container)
  })

  return { rootDoc: document, charName: spec.charName }
}

// ============================================================================
// 5. RisuAI Data Model Mappers & Factory Functions
// ============================================================================

/**
 * Transforms an array of `MockMessageSpec` into full `RisuMessage` data models.
 */
export function createMockMessages(
  messages: MockMessageSpec[],
  charName: string,
  userName: string,
): RisuMessage[] {
  const baseTime = Date.now() - messages.length * 60_000

  return messages.map((msg, index) => ({
    role: msg.role as RisuMessageRole,
    data: msg.text,
    chatId: msg.chatId ?? `msg-${index}`,
    name: msg.name ?? (msg.role === 'char' ? charName : userName),
    time: msg.time ?? baseTime + index * 60_000,
    saying: msg.saying,
  }))
}

/**
 * Creates a complete `RisuChat` object conforming to RisuAI data contracts.
 */
export function createMockChat(
  spec: MockCharSpec,
  overrides: Partial<RisuChat> = {},
): RisuChat {
  return {
    id: DEFAULT_MOCK_IDS.chatId,
    name: spec.chatName,
    note: '',
    bindedPersona: spec.personaId,
    fmIndex: 0,
    lastDate: Date.now(),
    message: createMockMessages(spec.messages, spec.charName, spec.userName),
    ...overrides,
  }
}

/**
 * Creates a complete `RisuCharacter` object conforming to RisuAI data contracts.
 */
export function createMockCharacter(
  spec: MockCharSpec,
  overrides: Partial<RisuCharacter> = {},
): RisuCharacter {
  const chat = createMockChat(spec)

  return {
    chaId: spec.charId,
    name: spec.charName,
    image: spec.charAvatarAsset,
    type: 'character',
    chatPage: 0,
    chats: [chat],
    firstMessage: spec.messages[0]?.text ?? '',
    personality:
      spec.personality ?? '친절하고 따뜻하며 호기심이 많은 대화형 AI 어시스턴트.',
    description:
      spec.description ?? '다양한 주제로 깊이 있는 대화를 나누는 가상 캐릭터.',
    scenario:
      spec.scenario ??
      '사용자와 처음 만나 일상과 개발 프로젝트에 대해 편안하게 이야기하는 상황.',
    tags: ['assistant', 'friendly', 'conversational', 'dev-mock'],
    creator: 'RisuLogPluginDev',
    characterVersion: '1.0.0',
    ...overrides,
  }
}

/**
 * Creates a complete `RisuPersona` object conforming to RisuAI data contracts.
 */
export function createMockPersona(
  spec: MockCharSpec,
  overrides: Partial<RisuPersona> = {},
): RisuPersona {
  return {
    id: spec.personaId,
    name: spec.userName,
    icon: spec.userAvatarAsset,
    personaPrompt: spec.personaPrompt ?? '사용자 기본 개발 테스트 페르소나',
    ...overrides,
  }
}

/**
 * Creates a complete `RisuDatabaseSubset` object conforming to RisuAI data contracts.
 */
export function createMockDatabaseSubset(
  spec: MockCharSpec,
  overrides: Partial<RisuDatabaseSubset> = {},
): RisuDatabaseSubset {
  return {
    characters: [createMockCharacter(spec)],
    personas: [createMockPersona(spec)],
    selectedPersona: spec.personaId,
    userIcon: spec.userAvatarAsset,
    username: spec.userName,
    theme: 'dark',
    textTheme: 'standard',
    colorSchemeName: 'default',
    ...overrides,
  }
}

// ============================================================================
// 6. Mock Spec Factory Functions
// ============================================================================

/**
 * Creates a mock character specification with configurable overrides.
 */
export function createMockSpec(overrides: Partial<MockCharSpec> = {}): MockCharSpec {
  const charAvatarUrl =
    overrides.charAvatarUrl ??
    createSvgAvatar({ text: 'A', bgColor: DEFAULT_AVATAR_PALETTE.charBg })
  const userAvatarUrl =
    overrides.userAvatarUrl ??
    createSvgAvatar({ text: 'U', bgColor: DEFAULT_AVATAR_PALETTE.userBg })

  return {
    charName: '아리아',
    chatName: '첫 만남',
    charId: DEFAULT_MOCK_IDS.charId,
    charAvatarAsset: overrides.charAvatarAsset ?? charAvatarUrl,
    charAvatarUrl,
    userName: '사용자',
    personaId: DEFAULT_MOCK_IDS.personaId,
    userAvatarAsset: overrides.userAvatarAsset ?? userAvatarUrl,
    userAvatarUrl,
    messages: [...DEFAULT_MOCK_MESSAGES],
    ...overrides,
  }
}

/**
 * Returns the default mock character specification for development sandbox testing.
 */
export function defaultMockSpec(): MockCharSpec {
  return createMockSpec()
}