/** Adds VSCode textarea windows and an optional character explorer UI. */
import './lib/monacoSetup'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { App, type EditorRequest } from './App'
import { CharacterExplorer } from './components/CharacterExplorer'
import {
  characterToVFS, findNode, rebuildGlobalLoreFromVFS, rebuildGreetingsFromVFS,
  updateFileContent, vfsToCharacter, type VFSNode,
} from './lib/virtualFS'
import type { RisuCharacter } from './types/risuai.d.ts'

const MOD_ID = 'risu.textarea-editor'
const HOST_ID = 'risu-textarea-editor-host'
const EXPLORER_HOST_ID = 'risu-vscode-character-ui'
const MODE_BAR_ID = 'risu-editor-mode-bar'
const DECORATED = 'risuEditorDecorated'
const MODE_KEY = 'risu-editor:character-ui'

interface RuntimeApi {
  character: {
    getCurrent<T = unknown>(): T | null
    updateCurrent<T = unknown>(character: T): Promise<void>
  }
  context: { onCharacterChange(callback: () => void): () => void }
  ui: { toast(message: string, options?: { type?: 'info' | 'success' | 'warning' | 'error' }): void }
}

interface RisuModsApi {
  register(definition: {
    id: string; name: string; version: string; permissions: string[]
    activate(api: RuntimeApi): void | (() => void)
  }): Promise<void>
}

function getLoader(): RisuModsApi | null {
  try { return typeof unsafeWindow !== 'undefined' ? unsafeWindow.RisuMods as RisuModsApi | undefined ?? null : null }
  catch { return null }
}

function copyStyles(shadow: ShadowRoot) {
  for (const style of Array.from(document.head.querySelectorAll('style'))) {
    if (style.textContent?.includes('.re-vscode-window')) shadow.appendChild(style.cloneNode(true))
  }
}

type Editable = HTMLTextAreaElement | HTMLElement
const readEditable = (editable: Editable) => editable instanceof HTMLTextAreaElement ? editable.value : editable.textContent ?? ''

function writeEditable(editable: Editable, value: string) {
  if (!editable.isConnected) throw new Error('원본 입력란이 더 이상 존재하지 않습니다.')
  if (editable instanceof HTMLTextAreaElement) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(editable, value)
  } else editable.textContent = value
  editable.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: null }))
  editable.dispatchEvent(new Event('change', { bubbles: true }))
}

function titleFor(editable: Editable): string {
  let node = editable.parentElement?.previousElementSibling
  for (let index = 0; node && index < 5; index += 1, node = node.previousElementSibling) {
    const text = node.textContent?.replace(/\s+/g, ' ').trim()
    if (text && text.length < 100 && !node.querySelector('textarea,[contenteditable="true"]')) return text
  }
  return editable.getAttribute('placeholder') || '텍스트 편집'
}

function languageFor(title: string): string {
  const value = title.toLowerCase()
  if (value.includes('css')) return 'css'
  if (value.includes('html')) return 'html'
  if (value.includes('json')) return 'json'
  if (value.includes('lua')) return 'lua'
  if (value.includes('javascript') || value.includes('스크립트') || value.includes('script')) return 'javascript'
  return 'markdown'
}

function findCharacterConfig(): { area: HTMLElement; tabRow: HTMLElement } | null {
  for (const area of document.querySelectorAll<HTMLElement>('.setting-area')) {
    for (const candidate of area.querySelectorAll<HTMLElement>('div')) {
      const directButtons = Array.from(candidate.children).filter((child) => child.tagName === 'BUTTON')
      if (directButtons.length >= 5) return { area, tabRow: candidate }
    }
  }
  return null
}

function createIntegration(api: RuntimeApi): () => void {
  const overlayHost = document.createElement('div')
  overlayHost.id = HOST_ID
  overlayHost.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;width:100vw;height:100vh'
  document.documentElement.appendChild(overlayHost)
  const overlayShadow = overlayHost.attachShadow({ mode: 'open' })
  copyStyles(overlayShadow)
  const overlayContainer = document.createElement('div')
  overlayShadow.appendChild(overlayContainer)
  const overlayRoot = createRoot(overlayContainer)

  let requestId = 0
  let requests: EditorRequest[] = []
  let mode: 'native' | 'vscode' = localStorage.getItem(MODE_KEY) === 'vscode' ? 'vscode' : 'native'
  let currentArea: HTMLElement | null = null
  let modeBar: HTMLDivElement | null = null
  let explorerHost: HTMLDivElement | null = null
  let explorerRoot: Root | null = null
  let explorerVfs: VFSNode | null = null
  let explorerLoading = false
  const hidden = new Map<HTMLElement, string>()
  const buttons = new Set<HTMLButtonElement>()
  const decorated = new Set<Editable>()

  const renderOverlay = () => overlayRoot.render(React.createElement(App, {
    requests,
    onClose: (id: number) => { requests = requests.filter((request) => request.id !== id); renderOverlay() },
  }))
  const openRequest = (request: Omit<EditorRequest, 'id'>) => {
    requests = [...requests, { ...request, id: ++requestId }]
    renderOverlay()
  }
  renderOverlay()

  const restoreNative = () => {
    for (const [element, display] of hidden) element.style.display = display
    hidden.clear()
  }

  const syncModeButtons = () => {
    if (!modeBar) return
    for (const button of modeBar.querySelectorAll<HTMLButtonElement>('button')) {
      const active = button.dataset.mode === mode
      button.style.background = active ? 'var(--risu-theme-selected)' : 'transparent'
      button.style.color = active ? 'var(--risu-theme-textcolor)' : 'var(--risu-theme-textcolor2)'
    }
  }

  const renderExplorer = () => {
    if (!explorerRoot) return
    explorerRoot.render(React.createElement(CharacterExplorer, {
      root: explorerVfs,
      loading: explorerLoading,
      onRefresh: loadExplorer,
      onNative: () => setMode('native'),
      onOpen: openVfsNode,
    }))
  }

  async function loadExplorer() {
    explorerLoading = true
    renderExplorer()
    const character = api.character.getCurrent<RisuCharacter>()
    explorerVfs = character ? characterToVFS(character) : null
    explorerLoading = false
    renderExplorer()
  }

  function openVfsNode(node: VFSNode) {
    if (node.type !== 'file') return
    openRequest({
      title: node.name,
      value: node.content ?? '',
      language: node.language ?? 'markdown',
      save: async (value) => {
        const character = api.character.getCurrent<RisuCharacter>()
        if (!character) throw new Error('선택된 캐릭터가 없습니다.')
        const vfs = characterToVFS(character)
        let target = findNode(vfs, node.path)
        // Character name changes alter the virtual root path. Fall back to mapping identity.
        if (!target?.mapping && node.mapping) {
          const visit = (candidate: VFSNode): VFSNode | null => {
            if (candidate.mapping?.field === node.mapping?.field && candidate.mapping?.index === node.mapping?.index && candidate.mapping?.subfield === node.mapping?.subfield) return candidate
            for (const child of candidate.children ?? []) { const found = visit(child); if (found) return found }
            return null
          }
          target = visit(vfs)
        }
        if (!target || !updateFileContent(vfs, target.path, value)) throw new Error('가상 파일을 찾지 못했습니다.')
        const updated = vfsToCharacter(vfs, character)
        updated.globalLore = rebuildGlobalLoreFromVFS(vfs)
        updated.alternateGreetings = rebuildGreetingsFromVFS(vfs)
        await api.character.updateCurrent(updated)
        explorerVfs = characterToVFS(updated)
        renderExplorer()
        api.ui.toast(`${node.name} 저장됨`, { type: 'success' })
      },
    })
  }

  function applyMode() {
    restoreNative()
    syncModeButtons()
    if (!explorerHost || !modeBar) return
    explorerHost.style.display = mode === 'vscode' ? 'block' : 'none'
    if (mode === 'native') return
    let sibling = explorerHost.nextElementSibling as HTMLElement | null
    while (sibling) {
      hidden.set(sibling, sibling.style.display)
      sibling.style.display = 'none'
      sibling = sibling.nextElementSibling as HTMLElement | null
    }
    void loadExplorer()
  }

  function setMode(next: 'native' | 'vscode') {
    mode = next
    localStorage.setItem(MODE_KEY, next)
    applyMode()
  }

  const removeCharacterUi = () => {
    restoreNative()
    explorerRoot?.unmount()
    explorerRoot = null
    explorerHost?.remove()
    modeBar?.remove()
    explorerHost = null
    modeBar = null
    currentArea = null
  }

  const installCharacterUi = () => {
    const found = findCharacterConfig()
    if (!found) {
      if (modeBar || explorerHost) removeCharacterUi()
      return
    }
    if (currentArea === found.area && modeBar?.isConnected && explorerHost?.isConnected) return
    removeCharacterUi()
    currentArea = found.area

    modeBar = document.createElement('div')
    modeBar.id = MODE_BAR_ID
    modeBar.style.cssText = 'display:flex;align-items:center;gap:3px;margin-bottom:8px;padding:3px;border:1px solid var(--risu-theme-darkborderc);border-radius:8px;background:var(--risu-theme-darkbg);font:11px system-ui'
    const label = document.createElement('span')
    label.textContent = 'Character UI'
    label.style.cssText = 'flex:1;padding-left:6px;color:var(--risu-theme-textcolor2)'
    modeBar.appendChild(label)
    for (const [value, text] of [['native', '기본 UI'], ['vscode', 'VSCode UI']] as const) {
      const button = document.createElement('button')
      button.type = 'button'; button.dataset.mode = value; button.textContent = text
      button.style.cssText = 'border:0;border-radius:6px;padding:5px 8px;cursor:pointer'
      button.addEventListener('click', () => setMode(value))
      modeBar.appendChild(button)
    }
    found.tabRow.insertAdjacentElement('beforebegin', modeBar)

    explorerHost = document.createElement('div')
    explorerHost.id = EXPLORER_HOST_ID
    explorerHost.style.cssText = 'display:none;width:100%;height:calc(100vh - 190px);min-height:420px'
    modeBar.insertAdjacentElement('afterend', explorerHost)
    const shadow = explorerHost.attachShadow({ mode: 'open' })
    copyStyles(shadow)
    const container = document.createElement('div')
    container.style.height = '100%'
    shadow.appendChild(container)
    explorerRoot = createRoot(container)
    applyMode()
  }

  const decorateTextareas = () => {
    if (mode !== 'native') return
    for (const area of document.querySelectorAll<HTMLElement>('.setting-area')) {
      for (const editable of area.querySelectorAll<Editable>('textarea, [contenteditable="true"][role="textbox"]')) {
        if (editable.dataset[DECORATED]) continue
        const wrapper = editable.parentElement
        if (!wrapper) continue
        editable.dataset[DECORATED] = 'true'; decorated.add(editable)
        if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative'
        const button = document.createElement('button')
        button.type = 'button'; button.title = 'VSCode 편집기로 열기'; button.setAttribute('aria-label', 'VSCode 편집기로 열기')
        button.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/><path d="m14.5 4-5 16"/></svg>'
        button.style.cssText = 'position:absolute;top:6px;right:6px;z-index:70;display:flex;width:27px;height:27px;align-items:center;justify-content:center;border:1px solid var(--risu-theme-darkborderc);border-radius:6px;background:var(--risu-theme-darkbg);color:var(--risu-theme-textcolor2);box-shadow:0 2px 7px #0004;cursor:pointer'
        button.addEventListener('click', (event) => {
          event.preventDefault(); event.stopPropagation()
          const title = titleFor(editable)
          openRequest({ title, value: readEditable(editable), language: languageFor(title), save: (value) => writeEditable(editable, value) })
        })
        wrapper.appendChild(button); buttons.add(button)
      }
    }
    for (const button of buttons) if (!button.isConnected) buttons.delete(button)
  }

  const sync = () => { installCharacterUi(); decorateTextareas() }
  let syncFrame = 0
  const scheduleSync = () => {
    if (syncFrame) return
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0
      sync()
    })
  }
  const isInsideSettings = (node: Node) => node instanceof Element
    && (node.matches('.setting-area') || !!node.closest('.setting-area'))
  const containsSettings = (node: Node) => node instanceof Element
    && (node.matches('.setting-area') || (node.matches('[class*="rs-setting-cont"]') && !!node.querySelector('.setting-area')))
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (isInsideSettings(record.target)) { scheduleSync(); return }
      for (const node of record.addedNodes) if (containsSettings(node)) { scheduleSync(); return }
      for (const node of record.removedNodes) if (containsSettings(node)) { scheduleSync(); return }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  const unsubscribe = api.context.onCharacterChange(() => { if (mode === 'vscode') void loadExplorer() })
  sync()

  return () => {
    observer.disconnect(); if (syncFrame) cancelAnimationFrame(syncFrame); unsubscribe(); removeCharacterUi()
    for (const button of buttons) button.remove()
    for (const editable of decorated) delete editable.dataset[DECORATED]
    overlayRoot.unmount(); overlayHost.remove()
  }
}

const definition = {
  id: MOD_ID, name: 'Risu Textarea Editor', version: '2.3.2',
  permissions: ['character.read', 'character.write', 'context.read', 'ui.inject'], activate: createIntegration,
}

const loader = getLoader()
if (loader) {
  loader.register(definition).catch((error) => console.error('[Risu Editor]', error))
} else {
  const page = (() => {
    try { return unsafeWindow } catch { return window as typeof unsafeWindow }
  })() as Window & { __RISU_MOD_QUEUE__?: unknown[] }
  ;(page.__RISU_MOD_QUEUE__ ??= []).push(definition)
}
