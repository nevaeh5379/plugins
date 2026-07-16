import type { RisuModDefinition } from '../types'

export const diagnosticsMod: RisuModDefinition = {
  id: 'loader.diagnostics',
  name: 'Loader Diagnostics',
  version: '0.1.0',
  permissions: ['character.read', 'ui.inject'],
  activate(api) {
    const mounted = api.ui.mount({
      id: 'badge',
      target: 'body',
      css: `
        button { position:fixed; right:12px; bottom:12px; z-index:2147483640;
          border:1px solid #555; border-radius:999px; padding:6px 10px;
          background:#181818; color:#ddd; font:12px system-ui; cursor:pointer; }
      `,
    })
    const button = document.createElement('button')
    button.textContent = `Risu Mods · ${api.runtime.source}`
    button.title = '클릭하면 현재 캐릭터 연결 상태를 콘솔에 출력합니다.'
    button.addEventListener('click', () => {
      console.log('[Risu Mods] current character', api.character.getCurrent())
    })
    mounted.container.appendChild(button)
  },
}
