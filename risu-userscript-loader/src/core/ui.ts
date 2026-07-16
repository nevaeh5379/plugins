import type { UiButtonOptions, UiMenuItemOptions, UiMountOptions } from '../types'

const ROOT_PREFIX = 'risu-mod-root-'

export function mountUi(options: UiMountOptions) {
  const oldHost = document.getElementById(ROOT_PREFIX + options.id)
  oldHost?.remove()

  const host = document.createElement('div')
  host.id = ROOT_PREFIX + options.id
  host.dataset.risuMod = options.id
  if (options.target === 'overlay') {
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;'
  }

  const root = host.attachShadow({ mode: 'open' })
  if (options.css) {
    const style = document.createElement('style')
    style.textContent = options.css
    root.appendChild(style)
  }
  const container = document.createElement('div')
  container.dataset.risuModContainer = options.id
  root.appendChild(container)
  ;(document.body ?? document.documentElement).appendChild(host)

  return {
    root,
    container,
    unmount() { host.remove() },
  }
}

interface SystemUi {
  root: ShadowRoot
  toolbar: HTMLElement
  chat: HTMLElement
  menuItems: HTMLElement
  menu: HTMLDetailsElement
  modals: HTMLElement
  toasts: HTMLElement
}

let systemUi: SystemUi | null = null
let runtimeSource = 'waiting'
let runtimeVersion = 'unknown'
const nativeMenuItems = new Map<string, UiMenuItemOptions>()
let nativeSettingsButton: HTMLButtonElement | null = null
let nativeSettingsPanel: HTMLElement | null = null
let hiddenNativePanel: HTMLElement | null = null
let hiddenNativeDisplay = ''
let settingsObserver: MutationObserver | null = null
let settingsSyncScheduled = false

const supporterPattern = /후원자|Supporter|支持者|Unterstützer|patrocin|ủng hộ/i
const advancedPattern = /고급 설정|Advanced Settings|Erweitert|Configuraciones Avanzadas|高级设置|進階設定|Cài đặt nâng cao/i

export function setSystemStatus(source: string, version?: string) {
  runtimeSource = source
  runtimeVersion = version ?? 'unknown'
  ensureSettingsObserver()
  renderNativeSettingsPanel()
}

function restoreNativeSettingsPanel() {
  nativeSettingsPanel?.remove()
  nativeSettingsPanel = null
  if (hiddenNativePanel?.isConnected) hiddenNativePanel.style.display = hiddenNativeDisplay
  hiddenNativePanel = null
  nativeSettingsButton?.classList.remove('text-textcolor')
  nativeSettingsButton?.classList.add('text-textcolor2')
}

function buttonLabel(button: HTMLButtonElement) {
  return button.querySelector('span')?.textContent?.trim() ?? button.textContent?.trim() ?? ''
}

function showNativeSettingsPanel() {
  const sidebar = document.querySelector<HTMLElement>('.rs-setting-cont-3')
  let content = document.querySelector<HTMLElement>('.rs-setting-cont-4')
  if (!sidebar) return
  if (!content) {
    const advanced = [...sidebar.querySelectorAll<HTMLButtonElement>(':scope > button')]
      .find((button) => advancedPattern.test(buttonLabel(button)))
    advanced?.click()
    window.setTimeout(showNativeSettingsPanel, 0)
    return
  }
  restoreNativeSettingsPanel()
  hiddenNativePanel = content
  hiddenNativeDisplay = content.style.display
  content.style.display = 'none'
  nativeSettingsButton?.classList.remove('text-textcolor2')
  nativeSettingsButton?.classList.add('text-textcolor')
  const panel = document.createElement('div')
  panel.id = 'risu-mod-native-settings-panel'
  panel.className = content.className
  panel.style.display = 'flex'
  panel.innerHTML = `<div style="width:100%;max-width:760px;margin:0 auto">
    <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 4px">Risu Mods</h2>
    <p style="margin:0 0 18px;color:var(--risu-theme-textcolor2)">Userscript loader와 설치된 모드의 설정 및 도구입니다.</p>
    <section style="padding:14px;border:1px solid var(--risu-theme-darkborderc);border-radius:10px;background:var(--risu-theme-darkbg);margin-bottom:14px">
      <div style="font-weight:650;margin-bottom:7px">Loader Runtime</div>
      <div style="display:grid;grid-template-columns:100px 1fr;gap:5px 10px;font:13px ui-monospace,SFMono-Regular,Menlo,monospace">
        <span style="color:var(--risu-theme-textcolor2)">Hook</span><span data-risu-runtime-source></span>
        <span style="color:var(--risu-theme-textcolor2)">Strategy</span><span data-risu-runtime-version></span>
        <span style="color:var(--risu-theme-textcolor2)">Menus</span><span data-risu-menu-count></span>
      </div>
    </section>
    <section data-risu-mod-actions style="display:grid;gap:8px"></section>
  </div>`
  content.insertAdjacentElement('afterend', panel)
  nativeSettingsPanel = panel
  renderNativeSettingsPanel()
}

function renderNativeSettingsPanel() {
  const actions = nativeSettingsPanel?.querySelector<HTMLElement>('[data-risu-mod-actions]')
  if (!actions) return
  const source = nativeSettingsPanel?.querySelector<HTMLElement>('[data-risu-runtime-source]')
  const version = nativeSettingsPanel?.querySelector<HTMLElement>('[data-risu-runtime-version]')
  const count = nativeSettingsPanel?.querySelector<HTMLElement>('[data-risu-menu-count]')
  if (source) source.textContent = runtimeSource
  if (version) version.textContent = runtimeVersion
  if (count) count.textContent = String(nativeMenuItems.size)
  actions.replaceChildren()
  const sorted = [...nativeMenuItems.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  for (const options of sorted) {
    const button = document.createElement('button')
    button.type = 'button'
    button.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border:1px solid var(--risu-theme-darkborderc);border-radius:9px;background:var(--risu-theme-darkbg);color:var(--risu-theme-textcolor);text-align:left;cursor:pointer'
    const icon = document.createElement('span')
    icon.style.cssText = 'display:grid;place-items:center;width:28px;height:28px;border-radius:7px;background:var(--risu-theme-darkbutton)'
    icon.textContent = options.icon ?? '›'
    const labels = document.createElement('span')
    labels.style.cssText = 'display:grid;gap:2px'
    const label = document.createElement('b')
    label.textContent = options.label
    labels.appendChild(label)
    if (options.title) {
      const title = document.createElement('small')
      title.style.color = 'var(--risu-theme-textcolor2)'
      title.textContent = options.title
      labels.appendChild(title)
    }
    button.append(icon, labels)
    button.addEventListener('click', () => void options.onClick())
    actions.appendChild(button)
  }
  if (sorted.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = '등록된 모드 메뉴가 없습니다.'
    empty.style.color = 'var(--risu-theme-textcolor2)'
    actions.appendChild(empty)
  }
}

function syncNativeSettingsMenu() {
  const sidebar = document.querySelector<HTMLElement>('.rs-setting-cont-3')
  if (!sidebar) {
    nativeSettingsButton = null
    restoreNativeSettingsPanel()
    return
  }
  if (nativeSettingsButton?.isConnected && nativeSettingsButton.parentElement === sidebar) return
  restoreNativeSettingsPanel()
  const buttons = [...sidebar.querySelectorAll<HTMLButtonElement>(':scope > button')]
  const supporter = buttons.find((button) => supporterPattern.test(buttonLabel(button)))
  const advanced = buttons.find((button) => advancedPattern.test(buttonLabel(button)))
  if (!supporter && !advanced) return
  const button = document.createElement('button')
  button.type = 'button'
  button.id = 'risu-mod-settings-button'
  button.className = 'flex gap-2 items-center hover:text-textcolor text-textcolor2'
  button.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12M7.76 16.24l-2.12 2.12"/><circle cx="12" cy="12" r="3"/></svg><span>Risu Mods</span>'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    showNativeSettingsPanel()
  })
  if (supporter) sidebar.insertBefore(button, supporter)
  else advanced!.insertAdjacentElement('afterend', button)
  nativeSettingsButton = button
  if (!sidebar.dataset.risuModListener) {
    sidebar.dataset.risuModListener = 'true'
    sidebar.addEventListener('click', (event) => {
      if (!(event.target as Element).closest('#risu-mod-settings-button')) restoreNativeSettingsPanel()
    })
  }
}

function ensureSettingsObserver() {
  if (settingsObserver) return
  const scheduleSync = () => {
    if (settingsSyncScheduled) return
    settingsSyncScheduled = true
    queueMicrotask(() => {
      settingsSyncScheduled = false
      syncNativeSettingsMenu()
    })
  }
  settingsObserver = new MutationObserver((records) => {
    // Once installed, ordinary chat/UI mutations require no work. Only run
    // again when Svelte has actually removed the settings sidebar.
    if (nativeSettingsButton?.isConnected) return
    if (nativeSettingsButton && !nativeSettingsButton.isConnected) {
      scheduleSync()
      return
    }
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : null
      if (target?.matches('.rs-setting-cont-3') || target?.closest('.rs-setting-cont-3')) {
        scheduleSync()
        return
      }
      for (const node of record.addedNodes) {
        if (node instanceof Element && (
          node.matches('.rs-setting-cont,.rs-setting-cont-2,.rs-setting-cont-3')
          || (node.matches('[class*="rs-setting-cont"]') && node.querySelector('.rs-setting-cont-3'))
        )) {
          scheduleSync()
          return
        }
      }
    }
  })
  settingsObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
  syncNativeSettingsMenu()
}

function getSystemUi(): SystemUi {
  if (systemUi?.root.host.isConnected) return systemUi
  const host = document.createElement('div')
  host.id = 'risu-mod-system-ui'
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483600;pointer-events:none;'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>
    *{box-sizing:border-box}button,summary{font:12px system-ui;cursor:pointer}
    .stack{position:fixed;display:flex;gap:6px;pointer-events:auto}.toolbar{top:12px;right:12px}.chat{right:12px;bottom:64px;flex-direction:column}
    .btn{display:flex;align-items:center;gap:5px;border:1px solid #555;border-radius:7px;padding:6px 9px;background:#202020;color:#eee;box-shadow:0 3px 12px #0005}.btn:hover{background:#333}
    .menu{display:none}.menu-items{display:none}
    .modal-layer{position:fixed;inset:0;pointer-events:none}.backdrop{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:#0008;pointer-events:auto}.modal{width:min(640px,100%);max-height:85vh;overflow:auto;border:1px solid #555;border-radius:10px;background:#1b1b1b;color:#eee;box-shadow:0 16px 50px #000a}.modal-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #444;font:600 13px system-ui}.modal-body{padding:12px}.close{border:0;background:transparent;color:#eee;font-size:18px}
    .toasts{position:fixed;right:12px;bottom:12px;display:grid;gap:6px;pointer-events:none}.toast{min-width:220px;max-width:420px;padding:9px 11px;border:1px solid #555;border-left:4px solid #60a5fa;border-radius:7px;background:#202020;color:#eee;box-shadow:0 5px 18px #0007;font:12px system-ui}.toast.success{border-left-color:#4ade80}.toast.warning{border-left-color:#fbbf24}.toast.error{border-left-color:#f87171}
  </style><div class="stack toolbar"></div><div class="stack chat"></div><details class="menu"><summary>Mods</summary><div class="menu-items"></div></details><div class="modal-layer"></div><div class="toasts"></div>`
  ;(document.body ?? document.documentElement).appendChild(host)
  ensureSettingsObserver()
  systemUi = {
    root,
    toolbar: root.querySelector('.toolbar')!,
    chat: root.querySelector('.chat')!,
    menu: root.querySelector('.menu')!,
    menuItems: root.querySelector('.menu-items')!,
    modals: root.querySelector('.modal-layer')!,
    toasts: root.querySelector('.toasts')!,
  }
  return systemUi
}

function createButton(options: UiButtonOptions) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn'
  button.dataset.modUiId = options.id
  button.title = options.title ?? options.label
  button.textContent = `${options.icon ? `${options.icon} ` : ''}${options.label}`
  button.addEventListener('click', () => void options.onClick())
  return button
}

export function addSystemButton(slot: 'toolbar' | 'chat', options: UiButtonOptions) {
  const ui = getSystemUi()
  const container = ui[slot]
  container.querySelector(`[data-mod-ui-id="${CSS.escape(options.id)}"]`)?.remove()
  const button = createButton(options)
  container.appendChild(button)
  return () => button.remove()
}

export function addSystemMenuItem(options: UiMenuItemOptions) {
  const ui = getSystemUi()
  void ui
  nativeMenuItems.set(options.id, options)
  ensureSettingsObserver()
  renderNativeSettingsPanel()
  return () => {
    nativeMenuItems.delete(options.id)
    renderNativeSettingsPanel()
  }
}

export function openSystemModal(content: HTMLElement | string, title = 'Risu Mod') {
  const ui = getSystemUi()
  const backdrop = document.createElement('div')
  backdrop.className = 'backdrop'
  const modal = document.createElement('section')
  modal.className = 'modal'
  const head = document.createElement('header')
  head.className = 'modal-head'
  const heading = document.createElement('span')
  heading.textContent = title
  const close = document.createElement('button')
  close.className = 'close'
  close.textContent = '×'
  const body = document.createElement('div')
  body.className = 'modal-body'
  typeof content === 'string' ? body.append(document.createTextNode(content)) : body.append(content)
  head.append(heading, close)
  modal.append(head, body)
  backdrop.appendChild(modal)
  ui.modals.appendChild(backdrop)
  const dispose = () => backdrop.remove()
  close.addEventListener('click', dispose)
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) dispose() })
  return dispose
}

export function showSystemToast(message: string, type = 'info', duration = 3000) {
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  getSystemUi().toasts.appendChild(toast)
  window.setTimeout(() => toast.remove(), Math.max(500, duration))
}
