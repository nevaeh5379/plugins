/**
 * @file src/dev/main.tsx
 * @description Standalone development sandbox for the RisuAI Log Exporter Plugin.
 *
 * Used as the application entry point when running under `VITE_TEST_MODE=1` (e.g. `pnpm dev:test`).
 * Provides an isolated mock environment with virtual RisuAI chat DOM, global API bindings,
 * and an interactive launcher UI for rapid iteration and testing.
 */

import React, { useState, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { installMockRisuai } from './mockRisuai'
import { defaultMockSpec, type MockCharSpec } from './mockData'
import { showCopyPreviewModal, type ShowCopyPreviewModalOptions } from '../LogExporter/showCopyPreviewModal'

// ─── Global Dev Helpers Type Declarations ────────────────────────────────────

declare global {
  interface Window {
    /** Opens the log exporter modal programmatically from the browser DevTools console. */
    __openLogExporter?: (options?: ShowCopyPreviewModalOptions) => Promise<void>
    /** Tears down the active mock RisuAI globals and DOM nodes. */
    __cleanupMock?: () => void
    /** Active mock character and chat specification. */
    __mockSpec?: MockCharSpec
  }
}

// ─── Sandbox UI Styles ───────────────────────────────────────────────────────

const STYLES = {
  container: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxWidth: 760,
    margin: '0 auto',
    padding: '48px 24px 64px',
    color: '#e4e6eb',
    background: '#0d0f14',
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
  },
  header: {
    marginBottom: 24,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: '#ffffff',
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    background: '#2563eb',
    color: '#ffffff',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  description: {
    color: '#9499a5',
    margin: '0 0 16px 0',
    fontSize: 14,
    lineHeight: 1.6,
  },
  metaCard: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 16,
    background: '#161922',
    border: '1px solid #232836',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 24,
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    color: '#64748b',
  },
  metaValue: {
    fontWeight: 600,
    color: '#e2e8f0',
  },
  previewCard: {
    background: '#181b22',
    border: '1px solid #252a35',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
    color: '#5eabef',
  },
  previewCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  previewScrollArea: {
    maxHeight: 300,
    overflowY: 'auto' as const,
    fontSize: 13,
    lineHeight: 1.6,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    paddingRight: 4,
  },
  messageBubble: (isUser: boolean) => ({
    padding: '10px 14px',
    borderRadius: 8,
    background: isUser ? '#1e2430' : '#161a22',
    borderLeft: isUser ? '3px solid #6cb6ff' : '3px solid #7c9cf0',
  }),
  messageAuthor: (isUser: boolean) => ({
    fontSize: 11,
    fontWeight: 600,
    color: isUser ? '#6cb6ff' : '#9bb5f7',
    marginBottom: 4,
  }),
  messageText: {
    whiteSpace: 'pre-wrap' as const,
    color: '#d1d5db',
    fontSize: 13,
  },
  button: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
    transition: 'all 0.15s ease-in-out',
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  statusText: {
    fontSize: 12,
    color: '#9499a5',
    marginTop: 12,
    textAlign: 'center' as const,
  },
  errorBox: {
    marginTop: 16,
    padding: '12px 16px',
    borderRadius: 8,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    fontSize: 13,
  },
  footerNotice: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: '1px solid #1f2430',
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 1.6,
  },
  codeSnippet: {
    background: '#1a1e28',
    color: '#93c5fd',
    padding: '2px 6px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 12,
  },
} as const

// ─── Test Launcher Component ─────────────────────────────────────────────────

interface TestLauncherProps {
  spec: MockCharSpec
}

/**
 * Interactive developer launcher component displaying sandbox status and controls.
 */
function TestLauncher({ spec }: TestLauncherProps) {
  const [isOpening, setIsOpening] = useState(false)
  const [lastOpened, setLastOpened] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleOpen = useCallback(async () => {
    setIsOpening(true)
    setErrorMessage(null)
    try {
      await showCopyPreviewModal({})
      setLastOpened(new Date())
    } catch (error) {
      const errText = error instanceof Error ? error.message : String(error)
      console.error('[dev] showCopyPreviewModal error:', error)
      setErrorMessage(errText)
    } finally {
      setIsOpening(false)
    }
  }, [])

  return (
    <div style={STYLES.container}>
      <header style={STYLES.header}>
        <div style={STYLES.titleRow}>
          <h1 style={STYLES.title}>RisuAI Log Plugin</h1>
          <span style={STYLES.badge}>Dev Sandbox</span>
        </div>
        <p style={STYLES.description}>
          RisuAI 호스트 없이 가상 대화 데이터와 모킹된 Plugin API로 로그 플러그인을 독립 실행 및 테스트합니다.
        </p>
      </header>

      {/* 대화 메타데이터 정보 카드 */}
      <div style={STYLES.metaCard}>
        <div style={STYLES.metaItem}>
          <span style={STYLES.metaLabel}>캐릭터:</span>
          <span style={STYLES.metaValue}>{spec.charName}</span>
        </div>
        <div style={STYLES.metaItem}>
          <span style={STYLES.metaLabel}>유저:</span>
          <span style={STYLES.metaValue}>{spec.userName}</span>
        </div>
        <div style={STYLES.metaItem}>
          <span style={STYLES.metaLabel}>채팅:</span>
          <span style={STYLES.metaValue}>{spec.chatName}</span>
        </div>
        <div style={STYLES.metaItem}>
          <span style={STYLES.metaLabel}>메시지 수:</span>
          <span style={STYLES.metaValue}>{spec.messages.length}개</span>
        </div>
      </div>

      {/* 가상 메시지 미리보기 영역 */}
      <section style={STYLES.previewCard}>
        <div style={STYLES.previewHeader}>
          <h2 style={STYLES.previewTitle}>가상 대화 메시지 미리보기</h2>
          <span style={STYLES.previewCount}>{spec.messages.length} messages</span>
        </div>
        <div style={STYLES.previewScrollArea}>
          {spec.messages.map((m, index) => {
            const isUser = m.role === 'user'
            const author = m.name || (isUser ? spec.userName : spec.charName)
            return (
              <div key={`msg-${index}-${m.time ?? index}`} style={STYLES.messageBubble(isUser)}>
                <div style={STYLES.messageAuthor(isUser)}>{author}</div>
                <div style={STYLES.messageText}>{m.text}</div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 모달 런처 버튼 */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={isOpening}
        style={{
          ...STYLES.button,
          ...(isOpening ? STYLES.buttonDisabled : {}),
        }}
      >
        <span>📤</span>
        <span>{isOpening ? '모달 여는 중...' : '로그 내보내기 모달 열기'}</span>
      </button>

      {lastOpened && !errorMessage && (
        <p style={STYLES.statusText}>
          마지막 실행: {lastOpened.toLocaleTimeString()} — 모달 닫기: <kbd style={STYLES.codeSnippet}>Esc</kbd> 또는 닫기 버튼(×)
        </p>
      )}

      {errorMessage && (
        <div style={STYLES.errorBox}>
          <strong>모달 실행 오류:</strong> {errorMessage}
        </div>
      )}

      {/* 개발 참고 안내 */}
      <footer style={STYLES.footerNotice}>
        <strong>개발 팁:</strong> 브라우저 DevTools 콘솔에서 <code style={STYLES.codeSnippet}>window.__openLogExporter()</code>를 직접 호출하여 모달을 열 수 있습니다.
        <br />
        실제 플러그인 번들 빌드 시에는 <code style={STYLES.codeSnippet}>src/main.tsx</code>가 엔트리로 사용됩니다.
      </footer>
    </div>
  )
}

// ─── Application Bootstrap & Hot Module Replacement (HMR) ────────────────────

/**
 * Mounts the sandbox environment and registers hot reload handlers.
 */
function bootstrapDevSandbox(): () => void {
  // 1. 가상 RisuAI API 및 가상 채팅 DOM 설치
  const spec = defaultMockSpec()
  const cleanupMock = installMockRisuai(spec)

  // 2. 개발자 편의 콘솔 헬퍼 전역 노출
  window.__openLogExporter = (options?: ShowCopyPreviewModalOptions) => showCopyPreviewModal(options ?? {})
  window.__cleanupMock = cleanupMock
  window.__mockSpec = spec

  // 3. React Root 마운트
  const container = document.getElementById('root')
  if (!container) {
    throw new Error('[dev] Target container "#root" was not found in the DOM.')
  }

  // React 18 HMR 시 중복 createRoot 호출 방지
  const rootKey = '__risuDevReactRoot'
  const rootContainer = container as HTMLElement & { [rootKey]?: ReactDOM.Root }
  const root = rootContainer[rootKey] ?? ReactDOM.createRoot(container)
  rootContainer[rootKey] = root

  root.render(
    <React.StrictMode>
      <TestLauncher spec={spec} />
    </React.StrictMode>,
  )

  console.log('[dev] RisuAI mock environment initialized.')
  console.log('[dev] Press the launcher button or call window.__openLogExporter() in DevTools.')

  // 4. 모킹 및 루트 언마운트 클린업 함수 반환
  return () => {
    delete window.__openLogExporter
    delete window.__cleanupMock
    delete window.__mockSpec
    cleanupMock()
  }
}

// Sandbox 부트스트랩 실행
const teardown = bootstrapDevSandbox()

// Vite Hot Module Replacement (HMR) 클린업 등록
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown()
  })
}