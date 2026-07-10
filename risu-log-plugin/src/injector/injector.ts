/* eslint-disable @typescript-eslint/no-explicit-any */
// injector.ts — API v3.0 기반
// 1. 채팅 단위 내보내기 버튼: main.tsx에서 registerButton으로 등록 (공식 API)
// 2. 메시지별 버튼(이 메시지만/이 메시지부터/범위): getRootDocument + SafeMutationObserver로 주입
// 3. openExportModalForCurrentChat: showCopyPreviewModal을 iframe에서 오픈

import { getAllMessageNodes } from '../services/messageScanner'
import { ensureRootDoc } from '../services/chatData'

// 메시지별 버튼 주입에 사용할 스타일 (메인 DOM에 주입)
const INJECTOR_CSS = `
.log-exporter-msg-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-right: 0;
  opacity: 0;
  max-width: 0;
  overflow: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.log-exporter-toolbar:hover .log-exporter-msg-btn-group,
.log-exporter-toolbar:focus-within .log-exporter-msg-btn-group,
.log-exporter-msg-btn-group:hover,
.log-exporter-msg-btn-group:focus-within {
  opacity: 1;
  max-width: 80px;
  margin-right: 4px;
  overflow: visible;
  pointer-events: auto;
}
.log-exporter-msg-btn-group button {
  background: transparent;
  border: none;
  color: var(--textcolor2, #888);
  cursor: pointer;
  width: 0;
  padding: 0;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  overflow: hidden;
}
.log-exporter-toolbar:hover .log-exporter-msg-btn-group button,
.log-exporter-toolbar:focus-within .log-exporter-msg-btn-group button,
.log-exporter-msg-btn-group:hover button,
.log-exporter-msg-btn-group:focus-within button {
  width: auto;
  padding: 2px;
  overflow: visible;
}
.log-exporter-msg-btn-group button:hover {
  background: rgba(128,128,128,0.15);
  color: var(--textcolor, #fff);
}
.log-exporter-range-start {
  background: rgba(80, 160, 255, 0.15) !important;
  box-shadow: inset 3px 0 0 rgba(80,160,255,0.7);
}
`

// 모듈 상태
let rangeSelection = {
  active: false,
  startIndex: -1
}
let styleEl: SafeElement | null = null
let observer: SafeMutationObserver | null = null
let rootDocClickListenerId: string | null = null

async function clearRange(rootDoc: SafeDocument): Promise<void> {
  try {
    const startNodes = await rootDoc.querySelectorAll('.log-exporter-range-start')
    const arr = await Risuai.unwarpSafeArray(startNodes)
    for (const n of arr) {
      await n.removeClass('log-exporter-range-start')
    }
  } catch {
    /* ignore */
  }
  rangeSelection.active = false
  rangeSelection.startIndex = -1
}

async function injectCss(rootDoc: SafeDocument): Promise<void> {
  if (styleEl) return
  try {
    styleEl = await rootDoc.createElement('style')
    await styleEl.setAttribute('x-log-exporter-style', 'injector')
    await styleEl.setInnerHTML(INJECTOR_CSS)
    const body = await rootDoc.querySelector('body')
    if (body) {
      await body.appendChild(styleEl)
    }
  } catch (e) {
    console.error('[log plugin] CSS inject error:', e)
  }
}

// 메시지 노드에 버튼 그룹이 이미 있는지 확인
async function hasBtnGroup(target: SafeElement): Promise<boolean> {
  try {
    const existing = await target.querySelector('.log-exporter-msg-btn-group')
    return !!existing
  } catch {
    return false
  }
}

// 클릭 이벤트가 실제 엘리먼트 영역 내에서 발생했는지 검사하는 헬퍼 함수
async function isClickInside(element: SafeElement, e: unknown): Promise<boolean> {
  const mouseEvent = e as MouseEvent;
  if (!mouseEvent || typeof mouseEvent.clientX !== 'number' || typeof mouseEvent.clientY !== 'number') {
    return false
  }
  try {
    const rect = await element.getBoundingClientRect()
    // 엘리먼트가 화면에 보이지 않거나 (크기가 0) DOM에서 제거된 경우 무시
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return false
    }
    return (
      mouseEvent.clientX >= rect.left &&
      mouseEvent.clientX <= rect.right &&
      mouseEvent.clientY >= rect.top &&
      mouseEvent.clientY <= rect.bottom
    )
  } catch (err) {
    console.error('[log plugin] isClickInside error:', err)
    return false
  }
}

// 메시지별 버튼 그룹을 하나의 SafeElement로 생성
async function createMsgBtnGroup(
  rootDoc: SafeDocument,
  index: number
): Promise<SafeElement> {
  const btnGroup = await rootDoc.createElement('div')
  await btnGroup.addClass('log-exporter-msg-btn-group')

  // 이 메시지부터 끝까지
  const fromHereBtn = await rootDoc.createElement('button')
  await fromHereBtn.setAttribute('x-title', '이 메시지부터 끝까지 내보내기')
  await fromHereBtn.setAttribute('x-action', 'from-here')
  await fromHereBtn.setAttribute('x-index', String(index))
  await fromHereBtn.setInnerHTML(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 4 4 4-4"/></svg>'
  )

  // 이 메시지만
  const onlyThisBtn = await rootDoc.createElement('button')
  await onlyThisBtn.setAttribute('x-title', '이 메시지만 내보내기')
  await onlyThisBtn.setAttribute('x-action', 'only-this')
  await onlyThisBtn.setAttribute('x-index', String(index))
  await onlyThisBtn.setInnerHTML(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  )

  // 범위 선택
  const rangeBtn = await rootDoc.createElement('button')
  await rangeBtn.setAttribute('x-title', '범위 선택')
  await rangeBtn.setAttribute('x-action', 'range')
  await rangeBtn.setAttribute('x-index', String(index))
  await rangeBtn.setInnerHTML(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8H3"/><path d="M21 16H3"/><path d="M7 12v8"/><path d="M7 4v4"/><path d="M17 12v8"/><path d="M17 4v4"/></svg>'
  )

  await btnGroup.appendChild(fromHereBtn)
  await btnGroup.appendChild(onlyThisBtn)
  await btnGroup.appendChild(rangeBtn)
  return btnGroup
}

// 모든 메시지 노드에 버튼 주입
async function injectMessageButtons(rootDoc: SafeDocument): Promise<void> {
  const messageNodes = await getAllMessageNodes(rootDoc)

  for (let i = 0; i < messageNodes.length; i++) {
    const node = messageNodes[i]
    // Tailwind `grow` (예전 flex-grow는 더 이상 사용 안 함)
    const target = await node.querySelector('.grow.flex.items-center.justify-end')
    if (!target) continue
    if (await hasBtnGroup(target)) continue

    await target.addClass('log-exporter-toolbar')
    const btnGroup = await createMsgBtnGroup(rootDoc, i)
    await target.prepend(btnGroup)
  }
}

// showCopyPreviewModal 지연 로드 (순환 의존 회피)
let _showCopyPreviewModal: ((options: {
  startIndex?: number
  endIndex?: number
  singleMessage?: boolean
}) => Promise<void>) | null = null

async function getShowCopyPreviewModal() {
  if (_showCopyPreviewModal) return _showCopyPreviewModal
  const mod = await import('../LogExporter/showCopyPreviewModal')
  _showCopyPreviewModal = mod.showCopyPreviewModal
  return _showCopyPreviewModal
}

// 메시지 범위 옵션으로 모달 오픈
async function openExportModal(options: {
  startIndex?: number
  endIndex?: number
  singleMessage?: boolean
}): Promise<void> {
  try {
    const fn = await getShowCopyPreviewModal()
    await fn(options)
  } catch (e) {
    console.error('[log plugin] openExportModal error:', e)
  }
}

// main.tsx에서 호출 — 현재 채팅 전체 내보내기
export async function openExportModalForCurrentChat(): Promise<void> {
  await openExportModal({})
}

// 전역 클릭 이벤트 핸들러 (이벤트 위임 적용)
async function handleRootClick(e: unknown): Promise<void> {
  const mouseEvent = e as MouseEvent;
  if (!mouseEvent || typeof mouseEvent.clientX !== 'number' || typeof mouseEvent.clientY !== 'number') {
    return
  }

  try {
    const rootDoc = await Risuai.getRootDocument()
    if (!rootDoc) return

    // 전체 툴바 목록을 가져옵니다.
    const toolbars = await rootDoc.querySelectorAll('.log-exporter-toolbar')
    const arr = await Risuai.unwarpSafeArray(toolbars)

    // 각 툴바의 bounding rect를 가져옵니다.
    const rects = await Promise.all(arr.map(t => t.getBoundingClientRect()))

    // 클릭된 Y 좌표가 속하는 툴바를 찾습니다. (메시지 영역은 수직으로 겹치지 않음)
    let targetToolbar: SafeElement | null = null
    let targetIndex = -1
    for (let i = 0; i < arr.length; i++) {
      const rect = rects[i]
      if (rect && mouseEvent.clientY >= rect.top && mouseEvent.clientY <= rect.bottom) {
        targetToolbar = arr[i]
        targetIndex = i
        break
      }
    }

    if (targetToolbar) {
      // 해당 툴바 내부의 버튼들만 조회하여 클릭 여부를 확인합니다.
      const buttons = await targetToolbar.querySelectorAll('.log-exporter-msg-btn-group button')
      const btnArr = await Risuai.unwarpSafeArray(buttons)

      for (const btn of btnArr) {
        if (await isClickInside(btn, mouseEvent)) {
          mouseEvent.preventDefault?.()
          mouseEvent.stopPropagation?.()

          const action = await btn.getAttribute('x-action')
          const indexStr = await btn.getAttribute('x-index')
          const index = indexStr ? parseInt(indexStr, 10) : targetIndex

          if (action === 'from-here') {
            await clearRange(rootDoc)
            await openExportModal({ startIndex: index })
          } else if (action === 'only-this') {
            await clearRange(rootDoc)
            await openExportModal({ startIndex: index, singleMessage: true })
          } else if (action === 'range') {
            const messageNodes = await getAllMessageNodes(rootDoc)
            const node = messageNodes[index]
            if (!node) return

            if (!rangeSelection.active) {
              await clearRange(rootDoc)
              rangeSelection.active = true
              rangeSelection.startIndex = index
              await node.addClass('log-exporter-range-start')
            } else {
              const endIndex = index
              const start = Math.min(rangeSelection.startIndex, endIndex)
              const end = Math.max(rangeSelection.startIndex, endIndex)
              await openExportModal({ startIndex: start, endIndex: end })
              await clearRange(rootDoc)
            }
          }
          break
        }
      }
    }
  } catch (err) {
    console.error('[log plugin] handleRootClick error:', err)
  }
}

// MutationObserver 콜백
// 참고: RisuAI v3.0의 SafeMutationObserver는 콜백 인자(SafeClassArray)를
// postMessage 직렬화 과정에서 메서드가 손실된 일반 객체로 전달하는 버그가 있어
// mutations 내용 검사 대신 단순 재주입 트리거(디바운스)로 회피합니다.
let reinjectTimer: ReturnType<typeof setTimeout> | null = null

async function onMutation(_mutations: SafeClassArray<SafeMutationRecord>): Promise<void> {
  try {
    // 디바운스: 연속 DOM 변경 시 한 번만 재주입
    if (reinjectTimer) clearTimeout(reinjectTimer)
    reinjectTimer = setTimeout(async () => {
      reinjectTimer = null
      try {
        const rootDoc = await Risuai.getRootDocument()
        if (!rootDoc) return
        await injectMessageButtons(rootDoc)
      } catch (e) {
        console.error('[log plugin] reinject error:', e)
      }
    }, 300)
  } catch (e) {
    console.error('[log plugin] mutation observer error:', e)
  }
}

// 메인 DOM에 메시지별 버튼 주입 셋업
export async function setupMessageButtons(): Promise<void> {
  try {
    const rootDoc = await ensureRootDoc()
    if (!rootDoc) {
      console.warn('[log plugin] mainDom permission denied — message buttons skipped')
      return
    }
    await injectCss(rootDoc)
    await clearRange(rootDoc)
    await injectMessageButtons(rootDoc)

    // SafeMutationObserver로 메시지 영역 변경 감지
    observer = await Risuai.createMutationObserver(onMutation)
    const body = await rootDoc.querySelector('body')
    if (body && observer) {
      await observer.observe(body, { childList: true, subtree: true })
    }

    // 전역 클릭 이벤트 등록 (이벤트 위임)
    rootDocClickListenerId = await rootDoc.addEventListener('click', handleRootClick)

    console.log('[log plugin] Message buttons set up.')
  } catch (e) {
    console.error('[log plugin] setupMessageButtons error:', e)
  }
}

// 정리
export async function teardownMessageButtons(): Promise<void> {
  try {
    // observer는 Risuai.onUnload 시 자동 해제되지만, 명시적으로도 처리
    observer = null

    const rootDoc = await Risuai.getRootDocument()
    if (!rootDoc) return

    // 전역 클릭 이벤트 해제
    if (rootDocClickListenerId) {
      await rootDoc.removeEventListener('click', rootDocClickListenerId)
      rootDocClickListenerId = null
    }

    // 주입된 버튼 그룹 제거
    const groups = await rootDoc.querySelectorAll('.log-exporter-msg-btn-group')
    const arr = await Risuai.unwarpSafeArray(groups)
    for (const g of arr) {
      await g.remove()
    }
    // 스타일 제거
    if (styleEl) {
      await styleEl.remove()
      styleEl = null
    }
    // range 표시 제거
    await clearRange(rootDoc)
  } catch {
    /* ignore */
  }
}
