// ==UserScript==
// @name         Risu Hello Mod
// @match        https://risuai.xyz/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

const mod = {
  id: 'example.hello',
  name: 'Hello Mod',
  version: '0.1.0',
  permissions: ['character.read', 'ui.inject'],
  activate(api) {
    const { container } = api.ui.mount({ id: 'hello', target: 'overlay' })
    const button = document.createElement('button')
    button.style.cssText = 'pointer-events:auto;position:fixed;right:16px;top:16px'
    button.textContent = 'Current character'
    button.onclick = () => console.log(api.character.getCurrent())
    container.appendChild(button)
  },
}

if (unsafeWindow.RisuMods) unsafeWindow.RisuMods.register(mod)
else (unsafeWindow.__RISU_MOD_QUEUE__ ??= []).push(mod)
