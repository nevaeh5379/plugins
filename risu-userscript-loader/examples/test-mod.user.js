// ==UserScript==
// @name         Risu Loader Test Mod
// @namespace    https://risuai.xyz/mods/test
// @version      0.3.0
// @description  Diagnostics for context, chat, parser, assets, and UI APIs in Risu Userscript Loader.
// @match        https://risuai.xyz/*
// @match        https://stable.risuai.xyz/*
// @match        https://nightly.risuai.xyz/*
// @match        http://localhost/*
// @match        http://127.0.0.1/*
// @grant        unsafeWindow
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(() => {
  'use strict'

  const definition = {
    id: 'loader.test-mod',
    name: 'Loader Test Mod',
    version: '0.3.0',
    permissions: [
      'character.read', 'character.write', 'database.read', 'parser.cbs',
      'variables.read', 'modules.read', 'context.read', 'chat.read', 'chat.write',
      'assets.read', 'assets.write', 'ui.inject',
    ],

    activate(api) {
      const mounted = api.ui.mount({
        id: 'panel',
        target: 'overlay',
        css: `
          :host { color-scheme: dark; }
          * { box-sizing: border-box; }
          .panel {
            pointer-events: auto; position: fixed; right: 16px; bottom: 58px;
            z-index: 2147483642; width: min(360px, calc(100vw - 32px));
            border: 1px solid #444; border-radius: 10px; overflow: hidden;
            background: #181818; color: #ddd; box-shadow: 0 10px 36px #0008;
            font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          }
          .header { display: flex; align-items: center; justify-content: space-between;
            padding: 9px 11px; background: #222; border-bottom: 1px solid #393939; }
          .title { font-weight: 700; color: #fff; }
          .source { color: #7dd3fc; }
          .body { display: grid; gap: 9px; padding: 11px; }
          .row { display: grid; grid-template-columns: 92px 1fr; gap: 8px; }
          .label { color: #999; }
          .value { overflow-wrap: anywhere; }
          .ok { color: #86efac; }
          .error { color: #fca5a5; white-space: pre-wrap; }
          .actions { display: flex; flex-wrap: wrap; gap: 6px; }
          button { border: 1px solid #555; border-radius: 6px; padding: 5px 8px;
            background: #292929; color: #eee; cursor: pointer; font: inherit; }
          button:hover { background: #383838; }
          button.danger { border-color: #92400e; color: #fdba74; }
          button.close { border: 0; padding: 1px 5px; background: transparent; font-size: 16px; }
          .log { max-height: 130px; overflow: auto; padding: 7px; border-radius: 6px;
            background: #101010; color: #bbb; white-space: pre-wrap; }
          .hint { color: #888; font-family: system-ui, sans-serif; }
        `,
      })

      mounted.container.innerHTML = `
        <section class="panel">
          <header class="header">
            <span class="title">Risu Loader Test</span>
            <button class="close" type="button" title="패널 닫기">×</button>
          </header>
          <div class="body">
            <div class="row"><span class="label">Hook</span><span class="value source"></span></div>
            <div class="row"><span class="label">Character</span><span class="value character">확인 전</span></div>
            <div class="row"><span class="label">Database</span><span class="value database">확인 전</span></div>
            <div class="row"><span class="label">CBS</span><span class="value cbs">확인 전</span></div>
            <div class="row"><span class="label">Markdown</span><span class="value markdown">확인 전</span></div>
            <div class="row"><span class="label">Variables</span><span class="value variables">확인 전</span></div>
            <div class="row"><span class="label">Modules</span><span class="value modules">확인 전</span></div>
            <div class="row"><span class="label">Context</span><span class="value context">확인 전</span></div>
            <div class="row"><span class="label">Chat</span><span class="value chat">확인 전</span></div>
            <div class="row"><span class="label">Asset</span><span class="value asset">확인 전</span></div>
            <div class="actions">
              <button type="button" data-action="read">읽기 테스트</button>
              <button type="button" data-action="database">DB 스냅샷</button>
              <button type="button" data-action="cbs">CBS 파싱</button>
              <button type="button" data-action="markdown">Markdown</button>
              <button type="button" data-action="variables">변수 조회</button>
              <button type="button" data-action="modules">모듈 조회</button>
              <button type="button" data-action="context">컨텍스트</button>
              <button type="button" data-action="chat">채팅 조회</button>
              <button type="button" data-action="asset-read">에셋 읽기</button>
              <button class="danger" type="button" data-action="asset-save">에셋 저장</button>
              <button class="danger" type="button" data-action="chat-write">채팅 no-op</button>
              <button class="danger" type="button" data-action="write">No-op 쓰기</button>
            </div>
            <div class="hint">No-op 쓰기는 현재 캐릭터의 복제본을 내용 변경 없이 다시 적용합니다.</div>
            <div class="log">모드가 활성화되었습니다.</div>
          </div>
        </section>
      `

      const panel = mounted.container.querySelector('.panel')
      const source = mounted.container.querySelector('.source')
      const character = mounted.container.querySelector('.character')
      const database = mounted.container.querySelector('.database')
      const cbs = mounted.container.querySelector('.cbs')
      const markdown = mounted.container.querySelector('.markdown')
      const variables = mounted.container.querySelector('.variables')
      const modules = mounted.container.querySelector('.modules')
      const context = mounted.container.querySelector('.context')
      const chat = mounted.container.querySelector('.chat')
      const asset = mounted.container.querySelector('.asset')
      const log = mounted.container.querySelector('.log')
      source.textContent = `${api.runtime.source} / ${api.runtime.version ?? 'unknown'}`

      const appendLog = (message, kind = '') => {
        const time = new Date().toLocaleTimeString()
        log.textContent = `[${time}] ${message}\n${log.textContent}`
        log.className = `log ${kind}`.trim()
        console.log(`[Risu Test Mod] ${message}`)
      }

      const readCharacter = () => {
        try {
          const current = api.character.getCurrent()
          if (!current) {
            character.textContent = '선택되지 않음'
            character.className = 'value character error'
            appendLog('현재 캐릭터가 선택되지 않았습니다.', 'error')
            return null
          }
          const summary = `${current.name ?? '(이름 없음)'} · ${current.chaId ?? 'no chaId'}`
          character.textContent = summary
          character.className = 'value character ok'
          appendLog(`캐릭터 읽기 성공: ${summary}`, 'ok')
          return current
        } catch (error) {
          character.textContent = String(error)
          character.className = 'value character error'
          appendLog(`캐릭터 읽기 실패: ${String(error)}`, 'error')
          return null
        }
      }

      mounted.container.querySelector('[data-action="read"]').addEventListener('click', readCharacter)

      mounted.container.querySelector('[data-action="database"]').addEventListener('click', () => {
        try {
          const snapshot = api.database.snapshot()
          const count = Array.isArray(snapshot?.characters) ? snapshot.characters.length : 'unknown'
          database.textContent = `characters: ${count}`
          database.className = 'value database ok'
          appendLog(`DB 스냅샷 성공: characters=${count}`, 'ok')
        } catch (error) {
          database.textContent = String(error)
          database.className = 'value database error'
          appendLog(`DB 스냅샷 미지원/실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="cbs"]').addEventListener('click', () => {
        try {
          const template = window.prompt('파싱할 CBS 텍스트', '{{char}} / {{user}}')
          if (template === null) return
          const result = api.parser.cbs(template)
          cbs.textContent = result || '(빈 문자열)'
          cbs.className = 'value cbs ok'
          appendLog(`CBS 파싱 성공: ${result}`, 'ok')
        } catch (error) {
          cbs.textContent = String(error)
          cbs.className = 'value cbs error'
          appendLog(`CBS 파싱 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="markdown"]').addEventListener('click', async () => {
        try {
          const input = window.prompt('Risu Markdown으로 렌더링할 텍스트', '**Risu** `Loader`')
          if (input === null) return
          const [full, safe] = await Promise.all([
            api.parser.markdown(input),
            Promise.resolve(api.parser.markdownSafe(input)),
          ])
          markdown.textContent = safe || '(빈 문자열)'
          markdown.className = 'value markdown ok'
          api.ui.openModal(full, { title: 'Markdown 결과(문자열)' })
          appendLog(`Markdown 파싱 성공: ${safe}`, 'ok')
        } catch (error) {
          markdown.textContent = String(error)
          markdown.className = 'value markdown error'
          appendLog(`Markdown 파싱 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="variables"]').addEventListener('click', () => {
        try {
          const values = api.variables.listEffective()
          const keys = Object.keys(values)
          variables.textContent = keys.length ? keys.map((key) => `${key}=${values[key]}`).join(', ') : '(없음)'
          variables.className = 'value variables ok'
          appendLog(`유효 변수 ${keys.length}개 조회 성공`, 'ok')
        } catch (error) {
          variables.textContent = String(error)
          variables.className = 'value variables error'
          appendLog(`변수 조회 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="modules"]').addEventListener('click', () => {
        try {
          const active = api.modules.getActive()
          modules.textContent = active.length
            ? active.map((module) => module.namespace || module.name || module.id).join(', ')
            : '(활성 모듈 없음)'
          modules.className = 'value modules ok'
          appendLog(`활성 모듈 ${active.length}개 조회 성공`, 'ok')
        } catch (error) {
          modules.textContent = String(error)
          modules.className = 'value modules error'
          appendLog(`모듈 조회 실패: ${String(error)}`, 'error')
        }
      })

      const readContext = () => {
        try {
          const characterIndex = api.context.getCurrentCharacterIndex()
          const chatIndex = api.context.getCurrentChatIndex()
          context.textContent = `character=${characterIndex}, chat=${chatIndex}`
          context.className = 'value context ok'
          appendLog(`컨텍스트 조회 성공: character=${characterIndex}, chat=${chatIndex}`, 'ok')
        } catch (error) {
          context.textContent = String(error)
          context.className = 'value context error'
          appendLog(`컨텍스트 조회 실패: ${String(error)}`, 'error')
        }
      }
      mounted.container.querySelector('[data-action="context"]').addEventListener('click', readContext)

      const readChat = () => {
        try {
          const messages = api.chat.getMessages()
          const last = api.chat.getLastMessage()
          chat.textContent = `${messages.length} messages · last=${last?.role ?? 'none'}`
          chat.className = 'value chat ok'
          appendLog(`채팅 조회 성공: ${messages.length}개 메시지`, 'ok')
          return last
        } catch (error) {
          chat.textContent = String(error)
          chat.className = 'value chat error'
          appendLog(`채팅 조회 실패: ${String(error)}`, 'error')
          return null
        }
      }
      mounted.container.querySelector('[data-action="chat"]').addEventListener('click', readChat)

      mounted.container.querySelector('[data-action="chat-write"]').addEventListener('click', async () => {
        const messages = api.chat.getMessages()
        if (!messages.length) return appendLog('No-op할 메시지가 없습니다.', 'error')
        const lastIndex = messages.length - 1
        try {
          await api.chat.updateMessage(lastIndex, { data: messages[lastIndex].data })
          appendLog(`채팅 메시지 ${lastIndex} no-op 쓰기 성공`, 'ok')
        } catch (error) {
          appendLog(`채팅 no-op 쓰기 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="asset-read"]').addEventListener('click', async () => {
        const path = window.prompt('읽을 Risu 에셋 경로', '')
        if (!path) return
        try {
          const bytes = await api.assets.read(path)
          asset.textContent = `${path} · ${bytes?.byteLength ?? 0} bytes`
          asset.className = 'value asset ok'
          appendLog(`에셋 읽기 성공: ${bytes?.byteLength ?? 0} bytes`, 'ok')
        } catch (error) {
          asset.textContent = String(error)
          asset.className = 'value asset error'
          appendLog(`에셋 읽기 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="asset-save"]').addEventListener('click', async () => {
        if (!window.confirm('테스트용 텍스트 에셋을 Risu 저장소에 추가할까요?')) return
        try {
          const bytes = new TextEncoder().encode(`Risu Loader asset test ${new Date().toISOString()}`)
          const path = await api.assets.save(bytes, { fileName: 'risu-loader-test.txt' })
          asset.textContent = path
          asset.className = 'value asset ok'
          appendLog(`에셋 저장 성공: ${path}`, 'ok')
        } catch (error) {
          asset.textContent = String(error)
          asset.className = 'value asset error'
          appendLog(`에셋 저장 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('[data-action="write"]').addEventListener('click', async () => {
        const before = readCharacter()
        if (!before) return
        try {
          await api.character.updateCurrent(before)
          const after = api.character.getCurrent()
          const sameIdentity = before.chaId === after?.chaId && before.name === after?.name
          if (!sameIdentity) throw new Error('쓰기 후 캐릭터 식별 정보가 달라졌습니다.')
          appendLog('No-op 쓰기 성공: 이름과 chaId가 유지되었습니다.', 'ok')
        } catch (error) {
          appendLog(`No-op 쓰기 실패: ${String(error)}`, 'error')
        }
      })

      mounted.container.querySelector('.close').addEventListener('click', () => panel.remove())
      readCharacter()

      api.context.onDatabaseReady(() => appendLog('데이터베이스 준비 이벤트 수신', 'ok'))
      api.context.onCharacterChange((current) => {
        const summary = current ? `${current.name ?? '(이름 없음)'} · ${current.chaId ?? 'no chaId'}` : '선택되지 않음'
        character.textContent = summary
        appendLog(`현재 캐릭터 변경 감지: ${summary}`)
      })
      api.context.onChatChange(() => {
        appendLog('현재 채팅 변경 감지')
        readContext()
        readChat()
      })

      api.ui.addToolbarButton({
        id: 'status', label: 'Loader', icon: '🧩',
        onClick: () => api.ui.toast(`Hook: ${api.runtime.source}/${api.runtime.version ?? 'unknown'}`, { type: 'success' }),
      })
      api.ui.addChatButton({
        id: 'chat-count', label: 'Messages', icon: '💬', onClick: readChat,
      })
      api.ui.addMenuItem({
        id: 'diagnostics', label: '진단 정보', icon: '🔍', order: 10,
        onClick: () => api.ui.openModal(
          `Hook: ${api.runtime.source}/${api.runtime.version ?? 'unknown'}\n등록된 테스트 API가 정상입니다.`,
          { title: 'Risu Loader Test' },
        ),
      })
    },
  }

  const page = unsafeWindow
  if (page.RisuMods) {
    void page.RisuMods.register(definition)
  } else {
    ;(page.__RISU_MOD_QUEUE__ ??= []).push(definition)
  }
})()
