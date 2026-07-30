import type { ThemeState } from './themes'

/**
 * Layout presets that mutate RisuAI's own database settings (`DBState.db`)
 * via the loader's `database.update` API, plus an optional `customCSS`
 * payload injected through RisuAI's native custom-CSS field. Because these
 * flip real RisuAI settings, Svelte reactivity re-renders the layout natively
 * — no DOM surgery, no fragile MutationObserver hacks.
 */

export type LayoutPresetId =
  | 'classic'
  | 'compact'
  | 'spacious'
  | 'bubble'
  | 'immersive'
  | 'minimal'

export interface LayoutPreset {
  id: LayoutPresetId
  label: string
  description: string
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'RisuAI 기본 레이아웃. 변경 없음.',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: '좁은 사이드바, 작은 폰트, 입력창 고정. 정보 밀집.',
  },
  {
    id: 'spacious',
    label: 'Spacious',
    description: '넓은 사이드바, 여유 행간, 큰 입력창, 둥근 메시지.',
  },
  {
    id: 'bubble',
    label: 'Bubble Chat',
    description: "RisuAI 내장 mobilechat 테마로 좌우 버블 전환 + 입력창 고정.",
  },
  {
    id: 'immersive',
    label: 'Immersive',
    description: '전체화면, 사이드바 메뉴형, 배경 최대폭 해제, 입력창 플로팅.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: '설정 패널 메뉴형 사이드바 + 최소 폭 + 중앙 정렬.',
  },
]

/** Subset of RisuAI DBState.db fields we touch. */
export interface RisuLayoutDb {
  theme: string
  fixedChatTextarea: boolean
  classicMaxWidth: boolean
  menuSideBar: boolean
  hamburgerButtonBottom: boolean
  sideBarSize: number
  textAreaSize: number
  textAreaTextSize: number
  lineHeight: number
  roundIcons: boolean
  showFolderName: boolean
  fullScreen: boolean
  customCSS: string
  newMessageButtonStyle?: string
  font?: string
  customFont?: string
}

/** Compute the DB patch + customCSS for a given preset. Returns null for
 *  'classic' (no changes). The caller merges this into the full DB snapshot. */
export function buildLayoutPatch(
  state: ThemeState,
  currentDb: Record<string, unknown>,
): { db: Partial<RisuLayoutDb>; customCss: string } | null {
  const preset = state.layout ?? 'classic'
  if (preset === 'classic') return null

  // base custom CSS that every non-classic preset gets (rounded messages,
  // soft shadows) — appended to the user's existing customCSS.
  const baseCss = `
/* risu-theme layout: ${preset} */
.risu-chat{border-radius:0.9rem !important;box-shadow:0 2px 12px rgba(0,0,0,.18) !important}
.default-chat-screen{scrollbar-width:thin !important}
.risu-chat::-webkit-scrollbar{width:8px !important}
.risu-chat::-webkit-scrollbar-thumb{background:var(--risu-theme-borderc) !important;border-radius:4px !important}
`

  switch (preset) {
    case 'compact':
      return {
        db: {
          theme: currentDb.theme as string,
          fixedChatTextarea: true,
          classicMaxWidth: false,
          menuSideBar: false,
          hamburgerButtonBottom: true,
          sideBarSize: 0,
          textAreaSize: 0,
          textAreaTextSize: 0,
          lineHeight: 1.15,
          roundIcons: true,
          showFolderName: false,
          fullScreen: false,
          newMessageButtonStyle: 'bottom-right',
        },
        customCss: baseCss + `
.text-input-area{font-size:.95rem !important;padding:.4rem !important}
.setting-area{padding:.75rem !important}
.risu-chat{padding:.5rem .75rem !important;margin:.15rem 0 !important}
`,
      }

    case 'spacious':
      return {
        db: {
          theme: currentDb.theme as string,
          fixedChatTextarea: true,
          classicMaxWidth: true,
          menuSideBar: false,
          hamburgerButtonBottom: false,
          sideBarSize: 2,
          textAreaSize: 2,
          textAreaTextSize: 2,
          lineHeight: 1.6,
          roundIcons: false,
          showFolderName: true,
          fullScreen: false,
          newMessageButtonStyle: 'bottom-center',
        },
        customCss: baseCss + `
.text-input-area{font-size:1.1rem !important;padding:.85rem 1rem !important}
.setting-area{padding:1.5rem !important}
.risu-chat{padding:1rem 1.25rem !important;margin:.5rem 0 !important}
.default-chat-screen{gap:.5rem !important;padding:.5rem 1rem !important}
`,
      }

    case 'bubble':
      return {
        db: {
          theme: 'mobilechat',
          fixedChatTextarea: true,
          classicMaxWidth: false,
          menuSideBar: false,
          hamburgerButtonBottom: false,
          sideBarSize: 1,
          textAreaSize: 1,
          textAreaTextSize: 1,
          lineHeight: 1.45,
          roundIcons: true,
          showFolderName: false,
          fullScreen: false,
          newMessageButtonStyle: 'floating-circle',
        },
        customCss: baseCss + `,
/* bubble accent: user/char tint overrides for mobilechat theme */
.risu-chat .bg-gray-100{background:color-mix(in srgb,var(--risu-theme-primary-600) 25%,var(--risu-theme-bgcolor)) !important;color:var(--risu-theme-textcolor) !important}
.risu-chat .text-gray-800{color:var(--risu-theme-textcolor) !important}
`,
      }

    case 'immersive':
      return {
        db: {
          theme: currentDb.theme as string,
          fixedChatTextarea: true,
          classicMaxWidth: false,
          menuSideBar: true,
          hamburgerButtonBottom: false,
          sideBarSize: 0,
          textAreaSize: 1,
          textAreaTextSize: 1,
          lineHeight: 1.5,
          roundIcons: true,
          showFolderName: false,
          fullScreen: true,
          newMessageButtonStyle: 'bottom-center',
        },
        customCss: baseCss + `
.default-chat-screen{padding:.5rem 2rem !important}
.default-chat-screen > div:has(.text-input-area){max-width:48rem !important;margin:0 auto .75rem !important;border-radius:1rem !important}
.risu-chat{max-width:48rem !important;margin-left:auto !important;margin-right:auto !important}
`,
      }

    case 'minimal':
      return {
        db: {
          theme: currentDb.theme as string,
          fixedChatTextarea: true,
          classicMaxWidth: true,
          menuSideBar: true,
          hamburgerButtonBottom: true,
          sideBarSize: 0,
          textAreaSize: 0,
          textAreaTextSize: 0,
          lineHeight: 1.4,
          roundIcons: true,
          showFolderName: false,
          fullScreen: false,
          newMessageButtonStyle: 'bottom-center',
        },
        customCss: baseCss + `
.default-chat-screen{padding:.5rem !important;max-width:42rem !important;margin:0 auto !important}
.risu-chat{max-width:42rem !important;margin-left:auto !important;margin-right:auto !important}
.default-chat-screen > div:has(.text-input-area){max-width:42rem !important;margin:0 auto .5rem !important}
`,
      }
  }

  return null
}