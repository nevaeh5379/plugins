/**
 * FloatingEditor — a small draggable/resizable editor panel injected
 * directly into the RisuAI host DOM (like the textarea quick-edit buttons).
 *
 * Because the plugin iframe is sandboxed (no allow-same-origin), we cannot
 * make it click-through to RisuAI. Instead, we build the entire panel on
 * the host document via getRootDocument(), so RisuAI's UI stays interactive
 * everywhere outside the panel.
 *
 * The editor is a plain textarea (no CodeMirror) since we can only inject
 * sanitized HTML into the host. Changes are saved back via api.setCharacter().
 *
 * Copyright (C) 2026 nevaeh5379
 * GPL-3.0-or-later
 */

interface Rect { x: number; y: number; width: number; height: number }

const DEFAULT_RECT: Rect = { x: 120, y: 120, width: 560, height: 380 }
const MIN_W = 320
const MIN_H = 200

const PANEL_CSS = `
.re-fe-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: #1f1f1f;
  color: #ddd;
  border: 1px solid #333;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  overflow: hidden;
  z-index: 2147483646;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
}
.re-fe-panel.dragging { opacity: 0.85; user-select: none; }
.re-fe-panel.resizing { user-select: none; }
.re-fe-header {
  display: flex; align-items: center; justify-content: space-between;
  height: 32px; padding: 0 8px;
  background: #181818; border-bottom: 1px solid #2b2b2b;
  cursor: move; user-select: none;
}
.re-fe-title { color: #ccc; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.re-fe-saving { color: #60a5fa; }
.re-fe-dirty { color: #f59e0b; }
.re-fe-actions { display: flex; gap: 4px; }
.re-fe-btn {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; padding: 0; border: none;
  background: transparent; color: #aaa; cursor: pointer; border-radius: 3px;
}
.re-fe-btn:hover { background: #2a2d2e; color: #fff; }
.re-fe-close:hover { background: #e81123; color: #fff; }
.re-fe-body { flex: 1 1 auto; min-height: 0; display: flex; }
.re-fe-textarea {
  flex: 1; width: 100%; border: none; outline: none; resize: none;
  background: #1f1f1f; color: #ddd; padding: 8px 12px;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px; line-height: 1.5;
}
.re-fe-resize { position: absolute; z-index: 2; }
.re-fe-resize.r-n  { top: -3px; left: 6px; right: 6px; height: 6px; cursor: ns-resize; }
.re-fe-resize.r-s  { bottom: -3px; left: 6px; right: 6px; height: 6px; cursor: ns-resize; }
.re-fe-resize.r-e  { top: 6px; bottom: 6px; right: -3px; width: 6px; cursor: ew-resize; }
.re-fe-resize.r-w  { top: 6px; bottom: 6px; left: -3px; width: 6px; cursor: ew-resize; }
.re-fe-resize.r-ne { top: -3px; right: -3px; width: 10px; height: 10px; cursor: nesw-resize; }
.re-fe-resize.r-nw { top: -3px; left: -3px; width: 10px; height: 10px; cursor: nwse-resize; }
.re-fe-resize.r-se { bottom: -3px; right: -3px; width: 10px; height: 10px; cursor: nwse-resize; }
.re-fe-resize.r-sw { bottom: -3px; left: -3px; width: 10px; height: 10px; cursor: nesw-resize; }
`

function labelForField(field: string): string {
  const map: Record<string, string> = {
    desc: '설명',
    firstMessage: '첫 메시지',
    systemPrompt: '시스템 프롬프트',
    personality: '성격',
    scenario: '시나리오',
    exampleMessage: '예시 메시지',
    creatorNotes: '작가의 노트',
    translatorNote: '번역가의 노트',
    additionalText: '추가 텍스트',
    replaceGlobalNote: '글로벌 노트',
  }
  return map[field] ?? field
}

const CLOSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
const MAX_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>'
const RESTORE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>'

export class FloatingEditorHost {
  private api: any
  private panel: any = null  // SafeElement
  private textarea: any = null
  private titleSpan: any = null
  private rootDoc: any = null
  private rect: Rect = { ...DEFAULT_RECT }
  private maximized = false
  private savedRect: Rect | null = null
  private field = ''
  private dirty = false
  private saving = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private dragInfo: { sx: number; sy: number; sr: Rect } | null = null
  private resizeInfo: { sx: number; sy: number; sr: Rect; dir: string } | null = null
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null
  private mouseUpHandler: ((e: MouseEvent) => void) | null = null
  private bound = false

  constructor(api: any) {
    this.api = api
  }

  async open(field: string) {
    this.field = field
    this.dirty = false

    // Load current character value
    let value = ''
    try {
      const char = await this.api.getCharacter()
      value = String((char as any)?.[field] ?? '')
    } catch (err) {
      console.error('[Risu Editor/Floating] getCharacter failed:', err)
      return
    }

    // Get host document
    this.rootDoc = await this.api.getRootDocument()
    if (!this.rootDoc) {
      console.error('[Risu Editor/Floating] getRootDocument returned null')
      return
    }

    // Remove any existing panel
    await this.removePanel()

    // Inject CSS (once)
    const existingStyle = await this.rootDoc.getElementById('re-floating-editor-style')
    if (!existingStyle) {
      const style = await this.rootDoc.createElement('style')
      await style.setAttribute('id', 're-floating-editor-style')
      await style.setInnerHTML(PANEL_CSS)
      const head = await this.rootDoc.querySelector('head')
      if (head) await head.appendChild(style)
      else {
        const body = await this.rootDoc.querySelector('body')
        if (body) await body.appendChild(style)
      }
    }

    // Create panel
    this.panel = await this.rootDoc.createElement('div')
    await this.panel.setClassName('re-fe-panel')
    await this.panel.setStyle('left', `${this.rect.x}px`)
    await this.panel.setStyle('top', `${this.rect.y}px`)
    await this.panel.setStyle('width', `${this.rect.width}px`)
    await this.panel.setStyle('height', `${this.rect.height}px`)

    const headerHtml = `
      <div class="re-fe-header">
        <span class="re-fe-title">${labelForField(field)}</span>
        <div class="re-fe-actions">
          <button class="re-fe-btn re-fe-max" title="최대화">${MAX_SVG}</button>
          <button class="re-fe-btn re-fe-close" title="닫기">${CLOSE_SVG}</button>
        </div>
      </div>
      <div class="re-fe-body">
        <textarea class="re-fe-textarea" spellcheck="false"></textarea>
      </div>
      <div class="re-fe-resize r-n"></div>
      <div class="re-fe-resize r-s"></div>
      <div class="re-fe-resize r-e"></div>
      <div class="re-fe-resize r-w"></div>
      <div class="re-fe-resize r-ne"></div>
      <div class="re-fe-resize r-nw"></div>
      <div class="re-fe-resize r-se"></div>
      <div class="re-fe-resize r-sw"></div>
    `
    await this.panel.setInnerHTML(headerHtml)

    const body = await this.rootDoc.querySelector('body')
    if (body) await body.appendChild(this.panel)

    // Grab references
    this.textarea = await this.panel.querySelector('.re-fe-textarea')
    this.titleSpan = await this.panel.querySelector('.re-fe-title')

    // Set initial value
    await this.textarea.setInnerText(value)

    // Bind events
    await this.bindEvents()
  }

  private async bindEvents() {
    if (!this.panel || !this.textarea) return

    // Textarea input → autosave
    await this.textarea.addEventListener('input', async () => {
      this.dirty = true
      this.updateTitle()
      if (this.saveTimer) clearTimeout(this.saveTimer)
      this.saveTimer = setTimeout(() => this.doSave(), 1200)
    })

    // Header drag
    const header = await this.panel.querySelector('.re-fe-header')
    if (header) {
      await header.addEventListener('mousedown', (e: MouseEvent) => {
        if (e.button !== 0 || this.maximized) return
        e.preventDefault()
        this.dragInfo = { sx: e.clientX, sy: e.clientY, sr: { ...this.rect } }
        this.startMouseLoop('drag')
      })
    }

    // Resize handles
    const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']
    for (const d of dirs) {
      const handle = await this.panel.querySelector(`.r-${d}`)
      if (handle) {
        await handle.addEventListener('mousedown', (e: MouseEvent) => {
          if (e.button !== 0 || this.maximized) return
          e.preventDefault()
          e.stopPropagation()
          this.resizeInfo = { sx: e.clientX, sy: e.clientY, sr: { ...this.rect }, dir: d }
          this.startMouseLoop('resize')
        })
      }
    }

    // Close button
    const closeBtn = await this.panel.querySelector('.re-fe-close')
    if (closeBtn) {
      await closeBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        this.close()
      })
    }

    // Maximize button
    const maxBtn = await this.panel.querySelector('.re-fe-max')
    if (maxBtn) {
      await maxBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation()
        this.toggleMaximize()
      })
    }
  }

  private startMouseLoop(mode: 'drag' | 'resize') {
    this.addPanelClass(mode === 'drag' ? 'dragging' : 'resizing')

    this.mouseMoveHandler = (e: MouseEvent) => {
      if (mode === 'drag' && this.dragInfo) {
        const nx = this.dragInfo.sr.x + (e.clientX - this.dragInfo.sx)
        const ny = this.dragInfo.sr.y + (e.clientY - this.dragInfo.sy)
        this.rect = { ...this.rect, x: Math.max(0, nx), y: Math.max(0, ny) }
      } else if (mode === 'resize' && this.resizeInfo) {
        const dx = e.clientX - this.resizeInfo.sx
        const dy = e.clientY - this.resizeInfo.sy
        let { x, y, width, height } = this.resizeInfo.sr
        const dir = this.resizeInfo.dir
        if (dir.includes('e')) width = Math.max(MIN_W, this.resizeInfo.sr.width + dx)
        if (dir.includes('s')) height = Math.max(MIN_H, this.resizeInfo.sr.height + dy)
        if (dir.includes('w')) {
          const nw = Math.max(MIN_W, this.resizeInfo.sr.width - dx)
          x = this.resizeInfo.sr.x + (this.resizeInfo.sr.width - nw)
          width = nw
        }
        if (dir.includes('n')) {
          const nh = Math.max(MIN_H, this.resizeInfo.sr.height - dy)
          y = this.resizeInfo.sr.y + (this.resizeInfo.sr.height - nh)
          height = nh
        }
        this.rect = { x: Math.max(0, x), y: Math.max(0, y), width, height }
      }
      this.applyRect()
    }

    this.mouseUpHandler = () => {
      this.dragInfo = null
      this.resizeInfo = null
      this.removePanelClass('dragging')
      this.removePanelClass('resizing')
      this.stopMouseLoop()
    }

    // We can't use window.addEventListener on the host doc directly via SafeElement,
    // but the mousedown event came from the host doc so the mousemove/mouseup
    // should be listened on the host document. However SafeElement only exposes
    // addEventListener on elements, not on document. We use the iframe's window
    // as fallback — but mouse events outside the iframe won't fire there.
    // Since RisuAI's SafeElement.addEventListener on document is supported
    // (we use it for DOM observer), we attach to rootDoc.
    // Actually rootDoc is a SafeDocument (extends SafeElement), and
    // addEventListener is supported on it.
    if (this.rootDoc) {
      this.rootDoc.addEventListener('mousemove', this.mouseMoveHandler)
      this.rootDoc.addEventListener('mouseup', this.mouseUpHandler)
    }
  }

  private stopMouseLoop() {
    if (this.mouseMoveHandler && this.rootDoc) {
      this.rootDoc.removeEventListener('mousemove', this.mouseMoveHandler)
    }
    if (this.mouseUpHandler && this.rootDoc) {
      this.rootDoc.removeEventListener('mouseup', this.mouseUpHandler)
    }
    this.mouseMoveHandler = null
    this.mouseUpHandler = null
  }

  private async applyRect() {
    if (!this.panel) return
    await this.panel.setStyle('left', `${this.rect.x}px`)
    await this.panel.setStyle('top', `${this.rect.y}px`)
    await this.panel.setStyle('width', `${this.rect.width}px`)
    await this.panel.setStyle('height', `${this.rect.height}px`)
  }

  private async addPanelClass(cls: string) {
    if (!this.panel) return
    await this.panel.addClass(cls)
  }

  private async removePanelClass(cls: string) {
    if (!this.panel) return
    await this.panel.removeClass(cls)
  }

  private async toggleMaximize() {
    this.maximized = !this.maximized
    if (this.maximized) {
      this.savedRect = { ...this.rect }
      this.rect = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }
      // Use host window dimensions instead
      try {
        const winSize = await this.getHostWindowSize()
        this.rect = { x: 0, y: 0, width: winSize.w, height: winSize.h }
      } catch {}
    } else if (this.savedRect) {
      this.rect = { ...this.savedRect }
    }
    this.applyRect()
    // Update maximize/restore icon
    const maxBtn = await this.panel?.querySelector('.re-fe-max')
    if (maxBtn) {
      await maxBtn.setInnerHTML(this.maximized ? RESTORE_SVG : MAX_SVG)
    }
  }

  private async getHostWindowSize(): Promise<{ w: number; h: number }> {
    // Try to get from rootDoc's defaultView
    try {
      const iframes = await this.rootDoc.querySelectorAll('iframe')
      const arr = await this.api.unwarpSafeArray(iframes)
      // We can't easily access host window, so use a large fallback
    } catch {}
    return { w: 9999, h: 9999 }
  }

  private async updateTitle() {
    if (!this.titleSpan) return
    const label = labelForField(this.field)
    let suffix = ''
    if (this.saving) suffix = ' <span class="re-fe-saving">· 저장중…</span>'
    else if (this.dirty) suffix = ' <span class="re-fe-dirty">· 수정됨</span>'
    await this.titleSpan.setInnerHTML(label + suffix)
  }

  private async doSave() {
    if (!this.textarea) return
    this.saving = true
    this.updateTitle()
    try {
      const val = await this.textarea.getInnerText()
      const char = await this.api.getCharacter()
      const next = { ...char, [this.field]: val }
      await this.api.setCharacter(next)
      this.dirty = false
    } catch (err) {
      console.error('[Risu Editor/Floating] save failed:', err)
    } finally {
      this.saving = false
      this.updateTitle()
    }
  }

  async close() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (this.dirty) {
      await this.doSave()
    }
    await this.removePanel()
  }

  private async removePanel() {
    if (this.panel) {
      try { await this.panel.remove() } catch {}
      this.panel = null
      this.textarea = null
      this.titleSpan = null
    }
    this.stopMouseLoop()
  }

  destroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.removePanel()
  }
}