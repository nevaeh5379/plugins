/**
 * injector.ts — RisuAI Plugin API v3.0 DOM Injection & Lifecycle Management
 *
 * Responsibilities:
 * 1. Injects custom CSS styles and message-level action buttons (From here / Only this / Range)
 *    into the main document DOM using SafeDocument / SafeElement APIs.
 * 2. Manages DOM MutationObserver lifecycle with debounced reinjection for new messages.
 * 3. Handles delegated global click events for message actions via geometric coordinate hit-testing.
 * 4. Provides clean setup, teardown, and modal launch entry points with robust error handling.
 */

import { getAllMessageNodes } from '../services/messageScanner'
import { ensureRootDoc } from '../services/chatData'
import type { ShowCopyPreviewModalOptions } from '../LogExporter/showCopyPreviewModal'

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Message action identifiers supported by the per-message button group.
 */
export type MessageActionType = 'from-here' | 'only-this' | 'range'

/**
 * Options passed to openExportModal / showCopyPreviewModal.
 * Aliased directly to ShowCopyPreviewModalOptions for complete type parity.
 */
export type ExportModalOptions = ShowCopyPreviewModalOptions
export type { ShowCopyPreviewModalOptions }

/**
 * Configuration definition for an individual message action button.
 */
interface MessageButtonDef {
  readonly action: MessageActionType
  readonly title: string
  readonly iconSvg: string
}

/**
 * Serialized mouse event payload received across the RisuAI postMessage boundary.
 */
interface SerializedMouseEvent {
  clientX?: number
  clientY?: number
  preventDefault?: () => void
  stopPropagation?: () => void
}

/**
 * Explicit 2D point coordinates for geometric hit-testing.
 */
export interface PointCoordinates {
  clientX: number
  clientY: number
}

/**
 * Internal state for tracking multi-message range selection.
 */
interface RangeSelectionState {
  active: boolean
  startIndex: number
}

/**
 * Type signature for the lazily-loaded showCopyPreviewModal function.
 */
type ShowCopyPreviewModalFn = (options?: ShowCopyPreviewModalOptions) => Promise<void>

// ============================================================================
// Constants & Styles
// ============================================================================

/** Style attribute identifier for the plugin's injected styles */
const STYLE_ATTR_NAME = 'x-log-exporter-style'
const STYLE_ATTR_VALUE = 'injector'

/** CSS class names used for DOM elements */
const CLASS_MSG_BTN_GROUP = 'log-exporter-msg-btn-group'
const CLASS_TOOLBAR = 'log-exporter-toolbar'
const CLASS_RANGE_START = 'log-exporter-range-start'

/** SafeElement custom attributes (must start with x- in RisuAI Plugin API v3.0) */
const ATTR_TITLE = 'x-title'
const ATTR_ACTION = 'x-action'
const ATTR_INDEX = 'x-index'

/** Selector for the message toolbar container */
const SELECTOR_TOOLBAR_TARGET = '.grow.flex.items-center.justify-end'

/** Debounce interval for mutation observer reinjection in milliseconds */
const REINJECT_DEBOUNCE_MS = 300

/**
 * CSS stylesheet injected into the host DOM for message toolbar button styling.
 */
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

/**
 * Action button definitions for per-message exporting.
 */
const MESSAGE_BUTTON_DEFS: readonly MessageButtonDef[] = [
  {
    action: 'from-here',
    title: '이 메시지부터 끝까지 내보내기',
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 4 4 4-4"/></svg>',
  },
  {
    action: 'only-this',
    title: '이 메시지만 내보내기',
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  },
  {
    action: 'range',
    title: '범위 선택',
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8H3"/><path d="M21 16H3"/><path d="M7 12v8"/><path d="M7 4v4"/><path d="M17 12v8"/><path d="M17 4v4"/></svg>',
  },
] as const

// ============================================================================
// Module State
// ============================================================================

const rangeState: RangeSelectionState = {
  active: false,
  startIndex: -1,
}

let styleEl: SafeElement | null = null
let observer: SafeMutationObserver | null = null
let rootDocClickListenerId: string | null = null
let reinjectTimer: ReturnType<typeof setTimeout> | null = null

let _showCopyPreviewModal: ShowCopyPreviewModalFn | null = null

// ============================================================================
// Modal Launcher (Lazy-Loaded)
// ============================================================================

/**
 * Lazily imports and caches the modal launcher to avoid circular module dependencies.
 */
async function getShowCopyPreviewModal(): Promise<ShowCopyPreviewModalFn> {
  if (_showCopyPreviewModal) {
    return _showCopyPreviewModal
  }
  const mod = await import('../LogExporter/showCopyPreviewModal')
  _showCopyPreviewModal = mod.showCopyPreviewModal
  return _showCopyPreviewModal
}

/**
 * Opens the log exporter preview modal with the specified range or single-message options.
 *
 * @param options - Configuration options for message filtering and export mode
 */
export async function openExportModal(options: ExportModalOptions = {}): Promise<void> {
  try {
    const showModal = await getShowCopyPreviewModal()
    await showModal(options)
  } catch (err) {
    console.error('[log plugin] openExportModal error:', err)
  }
}

/**
 * Public export to open the export modal for the entire active chat.
 */
export async function openExportModalForCurrentChat(): Promise<void> {
  await openExportModal({})
}

// ============================================================================
// Range Selection State Management
// ============================================================================

/**
 * Clears the active range selection visual highlights and resets internal state.
 *
 * @param rootDoc - Optional SafeDocument instance. If omitted, fetched automatically.
 */
export async function clearRange(rootDoc?: SafeDocument | null): Promise<void> {
  try {
    const doc = rootDoc ?? (await Risuai.getRootDocument())
    if (doc) {
      const startNodes = await doc.querySelectorAll(`.${CLASS_RANGE_START}`)
      const nodes = await Risuai.unwarpSafeArray(startNodes)
      for (const node of nodes) {
        try {
          await node.removeClass(CLASS_RANGE_START)
        } catch {
          /* ignore node if already detached */
        }
      }
    }
  } catch (err) {
    console.warn('[log plugin] clearRange error:', err)
  } finally {
    rangeState.active = false
    rangeState.startIndex = -1
  }
}

// ============================================================================
// DOM Injection Utilities
// ============================================================================

/**
 * Injects the plugin's CSS stylesheet into the main DOM body if not already present.
 */
async function injectCss(rootDoc: SafeDocument): Promise<void> {
  if (styleEl) {
    return
  }

  try {
    // Check if style element already exists in the document (e.g. after soft reload)
    const existingStyle = await rootDoc.querySelector(`style[${STYLE_ATTR_NAME}="${STYLE_ATTR_VALUE}"]`)
    if (existingStyle) {
      styleEl = existingStyle
      return
    }

    const newStyle = await rootDoc.createElement('style')
    await newStyle.setAttribute(STYLE_ATTR_NAME, STYLE_ATTR_VALUE)
    await newStyle.setInnerHTML(INJECTOR_CSS)

    const body = await rootDoc.querySelector('body')
    if (body) {
      await body.appendChild(newStyle)
      styleEl = newStyle
    }
  } catch (err) {
    console.error('[log plugin] CSS inject error:', err)
  }
}

/**
 * Checks whether a toolbar target element already contains an injected button group.
 */
async function hasBtnGroup(target: SafeElement): Promise<boolean> {
  try {
    const existing = await target.querySelector(`.${CLASS_MSG_BTN_GROUP}`)
    return !!existing
  } catch {
    return false
  }
}

/**
 * Creates an individual message action button.
 */
async function createMessageButton(
  rootDoc: SafeDocument,
  def: MessageButtonDef,
  index: number
): Promise<SafeElement> {
  const button = await rootDoc.createElement('button')
  await button.setAttribute(ATTR_TITLE, def.title)
  await button.setAttribute(ATTR_ACTION, def.action)
  await button.setAttribute(ATTR_INDEX, String(index))
  await button.setInnerHTML(def.iconSvg)
  return button
}

/**
 * Creates a message action button group container with all action buttons.
 */
async function createMsgBtnGroup(
  rootDoc: SafeDocument,
  index: number
): Promise<SafeElement> {
  const btnGroup = await rootDoc.createElement('div')
  await btnGroup.addClass(CLASS_MSG_BTN_GROUP)

  for (const def of MESSAGE_BUTTON_DEFS) {
    const button = await createMessageButton(rootDoc, def, index)
    await btnGroup.appendChild(button)
  }

  return btnGroup
}

/**
 * Scans all chat message nodes in the document and injects action buttons into new message toolbars.
 */
export async function injectMessageButtons(rootDoc: SafeDocument): Promise<void> {
  const messageNodes = await getAllMessageNodes(rootDoc)

  for (let i = 0; i < messageNodes.length; i++) {
    try {
      const node = messageNodes[i]
      const target = await node.querySelector(SELECTOR_TOOLBAR_TARGET)
      if (!target) {
        continue
      }

      if (await hasBtnGroup(target)) {
        continue
      }

      await target.addClass(CLASS_TOOLBAR)
      const btnGroup = await createMsgBtnGroup(rootDoc, i)
      await target.prepend(btnGroup)
    } catch (err) {
      console.warn(`[log plugin] Failed to inject buttons into message #${i}:`, err)
    }
  }
}

// ============================================================================
// Event Handling & Hit-Testing
// ============================================================================

/**
 * Validates and extracts coordinates from a serialized mouse event object.
 */
function parseSerializedMouseEvent(
  event: unknown
): (SerializedMouseEvent & PointCoordinates) | null {
  if (!event || typeof event !== 'object') {
    return null
  }
  const mouseEvent = event as SerializedMouseEvent
  if (typeof mouseEvent.clientX !== 'number' || typeof mouseEvent.clientY !== 'number') {
    return null
  }
  return mouseEvent as SerializedMouseEvent & PointCoordinates
}

/**
 * Determines whether the given mouse coordinates fall within the bounding box of a SafeElement.
 */
export async function isClickInside(
  element: SafeElement,
  coords: PointCoordinates
): Promise<boolean> {
  try {
    const rect = await element.getBoundingClientRect()
    // Element is invisible (zero dimension) or removed from layout
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return false
    }
    return (
      coords.clientX >= rect.left &&
      coords.clientX <= rect.right &&
      coords.clientY >= rect.top &&
      coords.clientY <= rect.bottom
    )
  } catch (err) {
    console.error('[log plugin] isClickInside error:', err)
    return false
  }
}

/**
 * Handles the selected action triggered on a specific message index.
 */
async function handleMessageAction(
  rootDoc: SafeDocument,
  action: MessageActionType,
  index: number
): Promise<void> {
  switch (action) {
    case 'from-here': {
      await clearRange(rootDoc)
      await openExportModal({ startIndex: index })
      break
    }

    case 'only-this': {
      await clearRange(rootDoc)
      await openExportModal({ startIndex: index, singleMessage: true })
      break
    }

    case 'range': {
      const messageNodes = await getAllMessageNodes(rootDoc)
      const targetNode = messageNodes[index]
      if (!targetNode) {
        return
      }

      if (!rangeState.active) {
        await clearRange(rootDoc)
        rangeState.active = true
        rangeState.startIndex = index
        await targetNode.addClass(CLASS_RANGE_START)
      } else {
        const start = Math.min(rangeState.startIndex, index)
        const end = Math.max(rangeState.startIndex, index)
        await openExportModal({ startIndex: start, endIndex: end })
        await clearRange(rootDoc)
      }
      break
    }
  }
}

/**
 * Global delegated click event listener attached to rootDoc.
 * Uses geometric bounding-box hit-testing to identify clicked buttons across iframe boundaries.
 */
async function handleRootClick(event: unknown): Promise<void> {
  const mouseEvent = parseSerializedMouseEvent(event)
  if (!mouseEvent) {
    return
  }

  try {
    const rootDoc = await Risuai.getRootDocument()
    if (!rootDoc) {
      return
    }

    // Retrieve all active message toolbars
    const toolbars = await rootDoc.querySelectorAll(`.${CLASS_TOOLBAR}`)
    const toolbarList = await Risuai.unwarpSafeArray(toolbars)
    if (toolbarList.length === 0) {
      return
    }

    // Measure bounding rectangles in parallel
    const rects = await Promise.all(toolbarList.map((t) => t.getBoundingClientRect()))

    // Locate the toolbar matching the click's vertical Y coordinate (message rows do not overlap)
    let targetToolbar: SafeElement | null = null
    let targetIndex = -1

    for (let i = 0; i < toolbarList.length; i++) {
      const rect = rects[i]
      if (rect && mouseEvent.clientY >= rect.top && mouseEvent.clientY <= rect.bottom) {
        targetToolbar = toolbarList[i]
        targetIndex = i
        break
      }
    }

    if (!targetToolbar) {
      return
    }

    // Query buttons only within the matched toolbar
    const buttons = await targetToolbar.querySelectorAll(`.${CLASS_MSG_BTN_GROUP} button`)
    const buttonList = await Risuai.unwarpSafeArray(buttons)

    for (const btn of buttonList) {
      if (await isClickInside(btn, mouseEvent)) {
        mouseEvent.preventDefault?.()
        mouseEvent.stopPropagation?.()

        const action = (await btn.getAttribute(ATTR_ACTION)) as MessageActionType | null
        const indexStr = await btn.getAttribute(ATTR_INDEX)
        const parsedIndex = indexStr ? parseInt(indexStr, 10) : Number.NaN
        const index = Number.isNaN(parsedIndex) ? targetIndex : parsedIndex

        if (action) {
          await handleMessageAction(rootDoc, action, index)
        }
        break
      }
    }
  } catch (err) {
    console.error('[log plugin] handleRootClick error:', err)
  }
}

// ============================================================================
// Lifecycle Management (Setup & Teardown)
// ============================================================================

/**
 * Schedules a debounced reinjection of message action buttons when DOM changes occur.
 */
function debounceReinject(rootDoc: SafeDocument): void {
  if (reinjectTimer !== null) {
    clearTimeout(reinjectTimer)
  }
  reinjectTimer = setTimeout(async () => {
    reinjectTimer = null
    try {
      await injectMessageButtons(rootDoc)
    } catch (err) {
      console.error('[log plugin] reinject error:', err)
    }
  }, REINJECT_DEBOUNCE_MS)
}

/**
 * Initializes and injects message-level action buttons and sets up DOM observation.
 */
export async function setupMessageButtons(): Promise<void> {
  try {
    // Teardown previous instances to ensure idempotence
    await teardownMessageButtons()

    const rootDoc = await ensureRootDoc()
    if (!rootDoc) {
      console.warn('[log plugin] mainDom permission denied — message buttons skipped')
      return
    }

    await injectCss(rootDoc)
    await clearRange(rootDoc)
    await injectMessageButtons(rootDoc)

    // Observe DOM mutations to reinject buttons when new messages arrive.
    // Note: In RisuAI v3.0, SafeMutationObserver payload cannot be reliably inspected across postMessage,
    // so we trigger a debounced re-scan on any mutation event.
    observer = await Risuai.createMutationObserver(async () => {
      debounceReinject(rootDoc)
    })

    const body = await rootDoc.querySelector('body')
    if (body && observer) {
      await observer.observe(body, { childList: true, subtree: true })
    }

    // Attach global click event delegation on the host document
    rootDocClickListenerId = await rootDoc.addEventListener('click', handleRootClick)

    console.log('[log plugin] Message buttons set up.')
  } catch (err) {
    console.error('[log plugin] setupMessageButtons error:', err)
  }
}

/**
 * Tears down injected DOM elements, event listeners, timers, and observers.
 */
export async function teardownMessageButtons(): Promise<void> {
  // Cancel pending debounced reinjection
  if (reinjectTimer !== null) {
    clearTimeout(reinjectTimer)
    reinjectTimer = null
  }

  observer = null

  try {
    const rootDoc = await Risuai.getRootDocument()
    if (!rootDoc) {
      return
    }

    // Remove delegated click listener
    if (rootDocClickListenerId) {
      try {
        await rootDoc.removeEventListener('click', rootDocClickListenerId)
      } catch {
        /* ignore */
      }
      rootDocClickListenerId = null
    }

    // Remove injected button groups
    const groups = await rootDoc.querySelectorAll(`.${CLASS_MSG_BTN_GROUP}`)
    const groupList = await Risuai.unwarpSafeArray(groups)
    for (const group of groupList) {
      try {
        await group.remove()
      } catch {
        /* ignore */
      }
    }

    // Remove injected stylesheet
    if (styleEl) {
      try {
        await styleEl.remove()
      } catch {
        /* ignore */
      }
      styleEl = null
    } else {
      const existingStyle = await rootDoc.querySelector(`style[${STYLE_ATTR_NAME}="${STYLE_ATTR_VALUE}"]`)
      if (existingStyle) {
        try {
          await existingStyle.remove()
        } catch {
          /* ignore */
        }
      }
    }

    // Clear active range highlights and reset state
    await clearRange(rootDoc)
  } catch (err) {
    console.warn('[log plugin] teardownMessageButtons error:', err)
  }
}
