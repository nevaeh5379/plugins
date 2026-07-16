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
    .menu{position:fixed;left:12px;bottom:12px;pointer-events:auto;color:#eee}.menu>summary{list-style:none;border:1px solid #555;border-radius:999px;padding:7px 10px;background:#202020}.menu[open]>summary{border-radius:7px 7px 0 0}.menu-items{min-width:180px;padding:5px;border:1px solid #555;border-radius:0 7px 7px 7px;background:#181818;display:grid;gap:3px}.menu-items button{border:0;border-radius:5px;padding:7px;text-align:left;background:transparent;color:#eee}.menu-items button:hover{background:#333}
    .modal-layer{position:fixed;inset:0;pointer-events:none}.backdrop{position:absolute;inset:0;display:grid;place-items:center;padding:20px;background:#0008;pointer-events:auto}.modal{width:min(640px,100%);max-height:85vh;overflow:auto;border:1px solid #555;border-radius:10px;background:#1b1b1b;color:#eee;box-shadow:0 16px 50px #000a}.modal-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #444;font:600 13px system-ui}.modal-body{padding:12px}.close{border:0;background:transparent;color:#eee;font-size:18px}
    .toasts{position:fixed;right:12px;bottom:12px;display:grid;gap:6px;pointer-events:none}.toast{min-width:220px;max-width:420px;padding:9px 11px;border:1px solid #555;border-left:4px solid #60a5fa;border-radius:7px;background:#202020;color:#eee;box-shadow:0 5px 18px #0007;font:12px system-ui}.toast.success{border-left-color:#4ade80}.toast.warning{border-left-color:#fbbf24}.toast.error{border-left-color:#f87171}
  </style><div class="stack toolbar"></div><div class="stack chat"></div><details class="menu"><summary>Mods</summary><div class="menu-items"></div></details><div class="modal-layer"></div><div class="toasts"></div>`
  ;(document.body ?? document.documentElement).appendChild(host)
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
  ui.menuItems.querySelector(`[data-mod-ui-id="${CSS.escape(options.id)}"]`)?.remove()
  const button = createButton(options)
  button.className = ''
  button.dataset.order = String(options.order ?? 0)
  button.addEventListener('click', () => { ui.menu.open = false })
  const siblings = [...ui.menuItems.children] as HTMLElement[]
  const before = siblings.find((item) => Number(item.dataset.order ?? 0) > (options.order ?? 0))
  ui.menuItems.insertBefore(button, before ?? null)
  return () => button.remove()
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
