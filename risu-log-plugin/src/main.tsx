/// <reference path="./vite-env.d.ts" />

// 테스트 모드(VITE_TEST_MODE=1)에서는 dev 진입점을 로드하고 종료합니다.
// 실제 플러그인 빌드 모드에서는 아래 RisuAI Plugin API 초기화 코드가 실행됩니다.
if (import.meta.env.VITE_TEST_MODE === '1') {
  import('./dev/main')
} else {
  // ─── 플러그인 진입점 (RisuAI Plugin API v3.0) ────────────────────────────
  ;(async () => {
    try {
      const { setupMessageButtons, teardownMessageButtons, openExportModalForCurrentChat } = await import('./injector/injector')

      // 1. 채팅 화면 액션 버튼 등록 (v3.0 공식 API)
      const exportBtn = await Risuai.registerButton(
        {
          name: '로그 플러그인',
          icon:
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
          iconType: 'html',
          location: 'chat',
          id: 'risu-tolog-export'
        },
        async () => {
          await openExportModalForCurrentChat()
        }
      )

      // 2. 메시지별 버튼 주입 (getRootDocument + SafeMutationObserver)
      await setupMessageButtons()

      // 3. 플러그인 언로드 시 정리
      await Risuai.onUnload(async () => {
        try {
          if (exportBtn?.id) {
            await Risuai.unregisterUIPart(exportBtn.id)
          }
          await teardownMessageButtons()
          console.log('[log plugin] Plugin unloaded.')
        } catch (e) {
          console.error('[log plugin] Unload error:', e)
        }
      })

      console.log('[log plugin] Plugin initialized (API v3.0).')
    } catch (error) {
      console.error('[log plugin] Init error:', (error as Error)?.message || error)
    }
  })()
}