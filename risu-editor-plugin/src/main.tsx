/**
 * risup-editor-plugin, a RisuAI plugin for editing character lorebooks, prompts, and settings
 * Copyright (C) 2026 nevaeh5379
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import './lib/monacoSetup'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { FloatingEditorHost } from './components/FloatingEditor'

/**
 * Risu Editor Plugin - Entry Point
 *
 * This plugin provides a Monaco Editor-based IDE interface for editing
 * character lorebooks, prompts, and settings within RisuAI.
 */

// Check if we're running inside the RisuAI plugin iframe
const isPlugin = typeof Risuai !== 'undefined' || typeof risuai !== 'undefined'

function mountApp() {
  let rootEl = document.getElementById('root')
  if (!rootEl) {
    rootEl = document.createElement('div')
    rootEl.id = 'root'
    document.body.appendChild(rootEl)
  }

  // Reset body styles for fullscreen
  document.body.style.margin = '0'
  document.body.style.padding = '0'
  document.body.style.overflow = 'hidden'
  document.body.style.width = '100%'
  document.body.style.height = '100%'
  document.documentElement.style.width = '100%'
  document.documentElement.style.height = '100%'

  const root = createRoot(rootEl)
  root.render(React.createElement(App))
  return root
}

// ─── Helper functions for DOM Injection ──────────────────────────────────────

function getFieldFromLabel(labelText: string): string | null {
  const text = labelText.trim().toLowerCase();
  
  if (text.includes('설명') || text.includes('description')) return 'desc';
  if (text.includes('첫 메시지') || text.includes('first message') || text.includes('첫 대사')) return 'firstMessage';
  if (text.includes('시스템 프롬프트') || text.includes('system prompt')) return 'systemPrompt';
  if (text.includes('성격') || text.includes('personality')) return 'personality';
  if (text.includes('시나리오') || text.includes('scenario')) return 'scenario';
  if (text.includes('예시 메시지') || text.includes('example message')) return 'exampleMessage';
  if (text.includes('작가의 노트') || text.includes('creator notes') || text.includes('creator\'s notes') || text.includes('제작자 코멘트')) return 'creatorNotes';
  if (text.includes('번역가의 노트') || text.includes('translator note')) return 'translatorNote';
  if (text.includes('추가 텍스트') || text.includes('additional text')) return 'additionalText';
  if (text.includes('글로벌 노트') || text.includes('global note')) return 'replaceGlobalNote';
  
  return null;
}

async function isClickInside(element: any, e: any): Promise<boolean> {
  if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number') {
    return false;
  }
  try {
    const rect = await element.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  } catch (err) {
    console.error('[Risu Editor] isClickInside check failed:', err);
    return false;
  }
}

async function injectQuickEditButtons(api: any, floatingEditor: FloatingEditorHost | null) {
  try {
    const rootDoc = await api.getRootDocument()
    // 1. 캐릭터 설정 사이드바(.setting-area) 내부에 있는 .text-textcolor 요소를 찾습니다. (로어북 등 다른 Svelte 돔 크래시 예방)
    const labels = await rootDoc.querySelectorAll('.setting-area .text-textcolor')
    const labelsArray = await api.unwarpSafeArray(labels)
    
    for (const label of labelsArray) {
      const text = await label.textContent()
      if (!text) continue
      
      const field = getFieldFromLabel(text)
      if (!field) continue
      
      // 2. 부모 요소를 찾아 그 아래의 자식들 중에서 이 라벨 바로 뒤에 오는 TextAreaInput 컨테이너를 1대1 매핑하여 찾습니다.
      const parentNode = await label.getParent()
      if (!parentNode) continue
      
      const children = await parentNode.getChildren()
      const childrenArray = await api.unwarpSafeArray(children)
      
      let labelIdx = -1
      for (let i = 0; i < childrenArray.length; i++) {
        const childText = await childrenArray[i].textContent()
        if (childText === text) {
          labelIdx = i
          break
        }
      }
      if (labelIdx === -1) continue
      
      let textareaContainer = null
      for (let i = labelIdx + 1; i < childrenArray.length; i++) {
        const child = childrenArray[i]
        const className = await child.getClassName()
        
        // 텍스트 영역 래퍼 div 가 직접 자식인 경우 (예: .border.border-darkborderc 클래스를 갖고 있음)
        if (className && className.includes('border') && className.includes('border-darkborderc')) {
          textareaContainer = child
          break
        }
        
        // 혹시 자식 노드의 내부에 들어있는 경우 (예: TextAreaInput 래퍼 div 하위에 있을 때)
        const innerContainer = await child.querySelector('.border.border-darkborderc')
        if (innerContainer) {
          textareaContainer = innerContainer
          break
        }
        
        // 만약 도중에 다른 라벨(.text-textcolor)을 만나면 이 라벨에 매치되는 입력 상자가 누락된 것이므로 중단
        if (className && className.includes('text-textcolor') && !className.includes('text-textcolor2')) {
          break
        }
      }
      if (!textareaContainer) continue
      
      // 3. 이미 버튼이 주입되어 있는지 확인합니다.
      const alreadyInjected = await textareaContainer.querySelector('.re-injected-quick-edit-btn')
      if (alreadyInjected) continue
      
      // 4. 버튼 생성
      const btn = await rootDoc.createElement('button')
      await btn.setClassName('re-injected-quick-edit-btn')
      await btn.setAttribute('x-field', field)
      await btn.setAttribute('x-injected', 'true')
      
      // Lucide Edit3 SVG 아이콘
      await btn.setInnerHTML('<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-3"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>')
      
      // 인라인 스타일 (CSS 파일에서도 보완 가능)
      await btn.setStyle('position', 'absolute')
      await btn.setStyle('top', '4px')
      await btn.setStyle('right', '4px')
      await btn.setStyle('zIndex', '60')
      
      await btn.addEventListener('click', async (e: any) => {
        try {
          if (e && e.stopPropagation) e.stopPropagation();
        } catch {}

        // RisuAI API v3.0 addEventListener 버그 우회 검증 (버튼 영역 밖에서의 엉뚱한 전역 클릭 무시)
        if (!(await isClickInside(btn, e))) return;

        // 플로팅 에디터 열기 — 호스트 DOM에 직접 패널 주입
        if (!floatingEditor) return
        await floatingEditor.open(field)
      })
      
      await textareaContainer.appendChild(btn)
    }
  } catch (err) {
    console.error('[Risu Editor] Button injection error:', err)
  }
}

// ─── Initialize Plugin ──────────────────────────────────────────────────────

if (isPlugin) {
  // ── Plugin Mode ──
  ;(async () => {
    try {
      const api = typeof Risuai !== 'undefined' ? Risuai : risuai
 
      // Pre-mount React into the (hidden) iframe so body has content before
      // the host transitions display:none → display:block.
      let appRoot: ReturnType<typeof createRoot> | null = mountApp()
 
      const openEditor = async () => {
        if (!appRoot) appRoot = mountApp()
        // Tell App.tsx to refresh — user may have switched characters.
        window.dispatchEvent(new CustomEvent('risu-editor:reload'))
        await api.showContainer('fullscreen')
      }
 
      await api.registerSetting(
        'Risu Editor',
        openEditor,
        '📝',
        'html',
        'risu-editor-settings'
      )
 
      await api.registerButton(
        {
          name: 'Open Editor',
          icon: '📝',
          iconType: 'html',
          location: 'action',
          id: 'risu-editor-action',
        },
        openEditor
      )
 
      // DOM 감시 및 주입 시작
      const floatingEditor = new FloatingEditorHost(api)

      try {
        const rootDoc = await api.getRootDocument()
        const body = await rootDoc.querySelector('body')
        if (body) {
          const observer = await api.createMutationObserver(async () => {
            await injectQuickEditButtons(api, floatingEditor)
          })
          await observer.observe(body, { childList: true, subtree: true })
          // 최초 주입 1회 실행
          await injectQuickEditButtons(api, floatingEditor)
        }
      } catch (domErr) {
        console.error('[Risu Editor] DOM observer initialization failed:', domErr)
      }

      await api.onUnload(async () => {
        floatingEditor.destroy()
        if (appRoot) {
          appRoot.unmount()
          appRoot = null
        }
      })
 
      console.log('[Risu Editor] initialized')
    } catch (error) {
      console.error('[Risu Editor] init error:', error)
    }
  })()
} else {
  // ── Development Mode (standalone) ──
  mountApp()
}
