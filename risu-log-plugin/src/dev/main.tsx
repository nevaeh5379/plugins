// src/dev/main.tsx — RisuAI 없이 로그 플러그인을 테스트하기 위한 진입점
// VITE_TEST_MODE=1 일 때 vite 가 이 파일을 index.html entry 로 사용합니다.
//
// 실행: pnpm dev:test  (또는 VITE_TEST_MODE=1 pnpm dev)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { installMockRisuai } from './mockRisuai'
import { defaultMockSpec } from './mockData'
import { showCopyPreviewModal } from '../LogExporter/showCopyPreviewModal'

// 1. Risuai 글로벌 API 모킹 설치 (가상 채팅 DOM 주입 포함)
const spec = defaultMockSpec()
const cleanupMock = installMockRisuai(spec)

// 2. 간단한 테스트 런처 UI 렌더
function TestLauncher() {
  const [open, setOpen] = React.useState(false)

  const handleOpen = async () => {
    setOpen(true)
    try {
      await showCopyPreviewModal({})
    } catch (e) {
      console.error('[dev] showCopyPreviewModal error:', e)
    }
  }

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 720,
      margin: '0 auto',
      padding: '48px 24px',
      color: '#e4e6eb',
      background: '#0d0f14',
      minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: 24, margin: '0 0 8px 0' }}>
        RisuAI Log Plugin — 테스트 서버
      </h1>
      <p style={{ color: '#9499a5', margin: '0 0 24px 0', fontSize: 14, lineHeight: 1.6 }}>
        RisuAI 없이 가상 메시지로 로그 내보내기 플러그인을 테스트합니다.<br/>
        캐릭터: <strong>{spec.charName}</strong> · 채팅: <strong>{spec.chatName}</strong> · 메시지 {spec.messages.length}개
      </p>

      <div style={{
        background: '#181b22',
        border: '1px solid #252a35',
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 16, margin: '0 0 12px 0', color: '#5eabef' }}>가상 메시지 미리보기</h2>
        <div style={{ maxHeight: 280, overflowY: 'auto', fontSize: 13, lineHeight: 1.6 }}>
          {spec.messages.map((m, i) => (
            <div key={i} style={{
              marginBottom: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: m.role === 'user' ? '#22262f' : '#1c1f26',
              borderLeft: m.role === 'user' ? '3px solid #6cb6ff' : '3px solid #7c9cf0',
            }}>
              <div style={{ fontSize: 11, color: '#9499a5', marginBottom: 2 }}>
                {m.role === 'user' ? spec.userName : spec.charName}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleOpen}
        style={{
          background: '#5eabef',
          color: '#0d0f14',
          border: 'none',
          borderRadius: 8,
          padding: '12px 24px',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        📤 로그 내보내기 모달 열기
      </button>

      {open && (
        <p style={{ fontSize: 12, color: '#9499a5', marginTop: 12, textAlign: 'center' }}>
          모달이 열렸습니다. 닫으려면 모달 내 닫기 버튼(×) 또는 Esc.
        </p>
      )}

      <div style={{ marginTop: 32, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        <strong>참고:</strong> 이 페이지는 VITE_TEST_MODE=1 로 실행 시 노출됩니다.
        실제 플러그인 빌드(<code>pnpm build</code>) 시에는 <code>src/main.tsx</code> 가 entry 로 사용됩니다.
      </div>
    </div>
  )
}

// 런처 렌더
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestLauncher />
  </React.StrictMode>,
)

// 개발 편의: 콘솔에서 수동 호출 가능하도록 노출
;(globalThis as any).__openLogExporter = () => showCopyPreviewModal({})
;(globalThis as any).__cleanupMock = cleanupMock

console.log('[dev] RisuAI mock installed. 가상 메시지로 로그 플러그인을 테스트합니다.')
console.log('[dev] 모달을 열려면 페이지의 버튼 클릭 또는 __openLogExporter() 호출')