// src/dev/mockData.ts
// RisuAI 메인 DOM 구조를 모방한 가상 채팅 DOM을 생성합니다.
// messageScanner.ts 가 탐색하는 셀렉터와 chatData.ts / domUtils.ts 가 읽는 구조에 맞춤:
//   .default-chat-screen > .chat-message-container > .risu-chat
//   .risu-chat 내부: 아바타(.shadow-lg.rounded-md[style*=background]) + 이름(.unmargin.text-xl) + 본문(.prose/.chattext)
//   사용자 메시지는 .justify-end 클래스로 식별

export interface MockMessageSpec {
  role: 'user' | 'char'
  text: string
  name?: string
}

export interface MockCharSpec {
  charName: string
  chatName: string
  charId: string
  charAvatarAsset: string // asset id (또는 data URL)
  charAvatarUrl: string // background 에 넣을 URL
  userName: string
  personaId: string
  userAvatarAsset: string
  userAvatarUrl: string
  messages: MockMessageSpec[]
}

// prose 내부 콘텐츠: RisuAI 는 마크다운을 렌더하므로 <p>, <strong>, <em> 등 포함
function renderMessageText(text: string): string {
  // 간단한 마크다운 렌더링 (테스트용)
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

// 메시지 하나에 대한 .risu-chat 노드 생성
function buildRisuChat(msg: MockMessageSpec, spec: MockCharSpec): HTMLElement {
  const isUser = msg.role === 'user'
  const displayName = msg.name || (isUser ? spec.userName : spec.charName)
  const avatarUrl = isUser ? spec.userAvatarUrl : spec.charAvatarUrl
  const contentHtml = renderMessageText(msg.text)

  const risuChat = document.createElement('div')
  risuChat.className = 'risu-chat'

  // 사용자 메시지: justify-end 로 식별 (getNameFromNode 참고)
  if (isUser) {
    risuChat.classList.add('justify-end')
  }

  // 아바타 — .shadow-lg.rounded-md[style*="background"] 형태
  const avatarWrap = document.createElement('div')
  avatarWrap.className = 'shadow-lg rounded-md'
  avatarWrap.style.background = `url("${avatarUrl}") center/cover`
  avatarWrap.style.width = '48px'
  avatarWrap.style.height = '48px'
  avatarWrap.style.borderRadius = '50%'
  risuChat.appendChild(avatarWrap)

  // 이름 + 본문 영역
  const contentArea = document.createElement('div')
  contentArea.className = 'flex-col'

  // 이름 — .unmargin.text-xl (getNameFromNode 의 fallback 셀렉터)
  const nameEl = document.createElement('div')
  nameEl.className = 'unmargin text-xl'
  // 텍스트 색상 클래스도 추가 (chatData.collectAvatarsMain 이 .text-textcolor 사용)
  const nameInner = document.createElement('span')
  nameInner.className = 'text-textcolor'
  nameInner.textContent = displayName
  nameEl.appendChild(nameInner)
  if (isUser) {
    contentArea.classList.add('items-end')
    nameEl.style.textAlign = 'right'
  }
  contentArea.appendChild(nameEl)

  // 본문 — .prose 와 .chattext 모두 포함 (CHAT_CONTENT_SELECTOR = '.prose, .chattext')
  const prose = document.createElement('div')
  prose.className = 'prose chattext'
  prose.innerHTML = contentHtml
  contentArea.appendChild(prose)

  risuChat.appendChild(contentArea)
  return risuChat
}

// 전체 모킹 DOM 트리를 document 에 주입하고 SafeDocument 로 사용할 document 를 반환.
// 실제로는 document 자체를 반환 (messageScanner 가 querySelectorAll 등을 호출하므로).
export function buildMockChatDom(spec: MockCharSpec): { rootDoc: Document; charName: string } {
  // 기존 모킹 DOM 제거
  document.querySelectorAll('#risu-mock-root').forEach(el => el.remove())

  const root = document.createElement('div')
  root.id = 'risu-mock-root'
  // 화면에 보이지 않게 (messageScanner 는 getBoundingClientRect 로 정렬하므로 렌더는 필요)
  root.style.position = 'fixed'
  root.style.left = '-99999px'
  root.style.top = '0'
  root.style.width = '800px'
  document.body.appendChild(root)

  // .default-chat-screen 스코프 (messageScanner 의 standalone 탐색 경로)
  const screen = document.createElement('div')
  screen.className = 'default-chat-screen'
  root.appendChild(screen)

  spec.messages.forEach((msg, _i) => {
    const container = document.createElement('div')
    container.className = 'chat-message-container'
    container.setAttribute('data-chat-index', String(_i))
    container.appendChild(buildRisuChat(msg, spec))
    screen.appendChild(container)
  })

  return { rootDoc: document, charName: spec.charName }
}

// 기본 가상 메시지 데이터
export function defaultMockSpec(): MockCharSpec {
  // 1x1 플레이스홀더 data URL (캐릭터/유저 아바타)
  const charAvatarUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#7c9cf0"/><text x="32" y="40" font-size="28" fill="#fff" text-anchor="middle" font-family="sans-serif">A</text></svg>',
  )
  const userAvatarUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="#6cb6ff"/><text x="32" y="40" font-size="28" fill="#fff" text-anchor="middle" font-family="sans-serif">U</text></svg>',
  )

  return {
    charName: '아리아',
    chatName: '첫 만남',
    charId: 'char-aria-001',
    charAvatarAsset: charAvatarUrl,
    charAvatarUrl,
    userName: '사용자',
    personaId: 'persona-anon-001',
    userAvatarAsset: userAvatarUrl,
    userAvatarUrl,
    messages: [
      {
        role: 'char',
        text: "안녕하세요! 처음 뵙겠습니다. 저는 **아리아**라고 해요.\n오늘은 어떤 이야기를 나누고 싶으신가요?",
      },
      {
        role: 'user',
        text: "안녕 아리아! 만나서 반가워.\n너에 대해 좀 더 알려줄 수 있어?",
      },
      {
        role: 'char',
        text: "물론이죠! 저는 *대화를 즐기고*, 새로운 것을 배우는 걸 좋아해요.\n\n> 좋은 대화는 좋은 관계의 시작이니까요.\n\n궁금한 점이 있으면 뭐든 물어봐 주세요!",
      },
      {
        role: 'user',
        text: "좋아! 그럼 평소에 취미가 뭐야?",
      },
      {
        role: 'char',
        text: "저는 책 읽는 걸 좋아해요. 특히 `소설`이나 `에세이` 장르를 즐겨 읽죠.\n그리고 음악을 들으면서 산책하는 것도 좋아해요. 당신은 어떤 취미가 있으신가요?",
      },
      {
        role: 'user',
        text: "나는 코딩하는 걸 좋아해. 요즘은 웹 개발 공부 중이야.",
      },
      {
        role: 'char',
        text: "와, 코딩 멋지네요! 웹 개발이라면 정말 창의적인 일을 많이 할 수 있겠어요.\n어떤 언어를 주로 사용하시나요?",
      },
      {
        role: 'user',
        text: "주로 TypeScript 와 React 를 써. 최근에는 Vite 도 써봤어.",
      },
      {
        role: 'char',
        text: "TypeScript 랑 React 라면 요즘 가장 핫한 스택이네요!\n\n**플러그인** 개발도 해보신다고요? 대단해요. 혹시 만들고 있는 게 있으신가요?",
      },
      {
        role: 'user',
        text: "응, RisuAI 용 로그 내보내기 플러그인을 만들고 있어.",
      },
      {
        role: 'char',
        text: "정말 흥미롭네요! RisuAI 로그를 예쁘게 내보낼 수 있다니,\n테마도 여러 가지고 커스터마이징도 가능할 것 같아요.\n\n> 개발하시면서 필요한 게 있으면 언제든 말씀해 주세요. 응원할게요! 💪",
      },
    ],
  }
}