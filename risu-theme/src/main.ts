import type { RisuModDefinition, RisuModApi } from './types'
import {
  THEMES,
  loadState,
  saveState,
  getTheme,
  DEFAULT_THEME_ID,
  DEFAULT_STATE,
  type ThemeState,
  type ThemePalette,
  ALL_VAR_NAMES,
} from './themes'
import { LAYOUT_PRESETS, buildLayoutPatch, type RisuLayoutDb } from './layouts'

const COLOR_STYLE_ID = 'risu-theme-color'

// ---------------------------------------------------------------------------
// Color (CSS variables) generation
// ---------------------------------------------------------------------------

function buildColorCss(state: ThemeState): string {
  const theme = getTheme(state.themeId) ?? getTheme(DEFAULT_THEME_ID)!
  const lines: string[] = []

  lines.push(':root {')

  const bg =
    state.bgOpacity != null && state.bgOpacity < 1
      ? withAlpha(theme.base.bgcolor, state.bgOpacity)
      : theme.base.bgcolor
  lines.push(`  --risu-theme-bgcolor: ${bg} !important;`)
  lines.push(`  --risu-theme-darkbg: ${theme.base.darkbg} !important;`)
  lines.push(`  --risu-theme-borderc: ${theme.base.borderc} !important;`)
  lines.push(`  --risu-theme-selected: ${theme.base.selected} !important;`)
  lines.push(`  --risu-theme-draculared: ${theme.base.draculared} !important;`)
  lines.push(`  --risu-theme-textcolor: ${theme.base.textcolor} !important;`)
  lines.push(`  --risu-theme-textcolor2: ${theme.base.textcolor2} !important;`)
  lines.push(`  --risu-theme-darkborderc: ${theme.base.darkborderc} !important;`)
  lines.push(`  --risu-theme-darkbutton: ${theme.base.darkbutton} !important;`)

  const rampNames = ['primary', 'secondary', 'danger', 'success', 'neutral'] as const
  for (const name of rampNames) {
    const ramp = theme.ramps[name]
    for (let i = 0; i < 10; i++) {
      const step = i === 0 ? 50 : i * 100
      const varName = `--risu-theme-${name}-${step}`
      lines.push(`  ${varName}: ${ramp[i]} !important;`)
    }
  }

  const font = theme.font
  if (font) {
    const family = state.fontOverride ?? font.family
    if (family) lines.push(`  --risu-font-family: ${family} !important;`)
    if (font.animationSpeed) lines.push(`  --risu-animation-speed: ${font.animationSpeed} !important;`)
    if (font.standard) lines.push(`  --FontColorStandard: ${font.standard} !important;`)
    if (font.bold) lines.push(`  --FontColorBold: ${font.bold} !important;`)
    if (font.italic) lines.push(`  --FontColorItalic: ${font.italic} !important;`)
    if (font.italicBold) lines.push(`  --FontColorItalicBold: ${font.italicBold} !important;`)
    if (font.quote1) lines.push(`  --FontColorQuote1: ${font.quote1} !important;`)
    if (font.quote2) lines.push(`  --FontColorQuote2: ${font.quote2} !important;`)
  }

  lines.push('}')

  if (state.roundness != null && state.roundness !== 1) {
    lines.push('')
    lines.push(':root {')
    lines.push(`  --risu-theme-radius-scale: ${state.roundness};`)
    lines.push('}')
    lines.push(
      `:root * { border-radius: calc(var(--risu-theme-radius-scale, 1) * 0.375rem) !important; }`,
    )
  }

  return lines.join('\n')
}

function withAlpha(hex: string, opacity: number): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return hex
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

function applyColor(state: ThemeState): void {
  let style = document.getElementById(COLOR_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = COLOR_STYLE_ID
    document.documentElement.prepend(style)
  }
  style.textContent = buildColorCss(state)
}

function disableColor(): void {
  document.getElementById(COLOR_STYLE_ID)?.remove()
}

// ---------------------------------------------------------------------------
// Layout: apply via RisuAI DB mutation (reactive Svelte re-render)
// ---------------------------------------------------------------------------

/** Layout DB fields we snapshot/restore. */
const LAYOUT_DB_FIELDS: (keyof RisuLayoutDb)[] = [
  'theme', 'fixedChatTextarea', 'classicMaxWidth', 'menuSideBar',
  'hamburgerButtonBottom', 'sideBarSize', 'textAreaSize', 'textAreaTextSize',
  'lineHeight', 'roundIcons', 'showFolderName', 'fullScreen', 'customCSS',
  'newMessageButtonStyle', 'font', 'customFont',
]

function snapshotLayout(db: Record<string, unknown>): Record<string, unknown> {
  const snap: Record<string, unknown> = {}
  for (const f of LAYOUT_DB_FIELDS) {
    if (f in db) snap[f] = db[f]
  }
  return snap
}

function restoreLayout(
  db: Record<string, unknown>,
  snap: Record<string, unknown> | null,
): void {
  if (!snap) return
  for (const f of LAYOUT_DB_FIELDS) {
    if (f in snap) db[f] = snap[f]
    else if (f in db) delete db[f]
  }
}

// ---------------------------------------------------------------------------
// Combined apply / disable
// ---------------------------------------------------------------------------

interface ApplyContext {
  api: RisuModApi
  state: ThemeState
}

function applyAll(ctx: ApplyContext): void {
  if (!ctx.state.enabled) {
    disableAll(ctx)
    return
  }
  applyColor(ctx.state)
  void applyLayout(ctx)
}

function disableAll(ctx: ApplyContext): void {
  disableColor()
  void restoreLayoutViaApi(ctx)
}

async function applyLayout(ctx: ApplyContext): Promise<void> {
  const { api, state } = ctx
  const patch = buildLayoutPatch(state, await readDb(api))

  // Always read current DB to snapshot the user's original layout on first run.
  if (!state.savedLayout) {
    const db = await readDb(api)
    state.savedLayout = snapshotLayout(db as Record<string, unknown>)
    saveState(state)
  }

  if (!patch) {
    // classic: restore the user's original layout
    const db = await readDb(api)
    restoreLayout(db as Record<string, unknown>, state.savedLayout)
    await api.database.update(db)
    return
  }

  const db = await readDb(api)
  // preserve user's own customCSS if we haven't snapshotted yet
  const userCss = (db.customCSS as string | undefined) ?? ''
  Object.assign(db, patch.db)
  db.customCSS = (patch.db.customCSS === undefined ? userCss : '') + patch.customCss
  await api.database.update(db)
}

async function restoreLayoutViaApi(ctx: ApplyContext): Promise<void> {
  const { api, state } = ctx
  if (!state.savedLayout) return
  const db = await readDb(api)
  restoreLayout(db as Record<string, unknown>, state.savedLayout)
  await api.database.update(db)
}

async function readDb(api: RisuModApi): Promise<Record<string, unknown>> {
  return api.database.snapshot<Record<string, unknown>>()
}

// ---------------------------------------------------------------------------
// Re-apply color when RisuAI overwrites :root style
// ---------------------------------------------------------------------------

function watchRisuThemeOverwrites(state: ThemeState): () => void {
  const root = document.documentElement
  let scheduled = false
  const reapply = () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      if (state.enabled) applyColor(state)
    })
  }

  const observer = new MutationObserver((mutations) => {
    if (!state.enabled) return
    for (const m of mutations) {
      if (m.type !== 'attributes' || m.attributeName !== 'style') continue
      const style = root.getAttribute('style') ?? ''
      const saw = ALL_VAR_NAMES.some((v) => style.includes(v))
      if (!saw) continue
      reapply()
      break
    }
  })
  observer.observe(root, { attributes: true, attributeFilter: ['style'] })

  const id = window.setInterval(() => {
    if (state.enabled) {
      const style = document.getElementById(COLOR_STYLE_ID)
      if (!style || style.textContent === '') applyColor(state)
    }
  }, 2000)

  return () => {
    observer.disconnect()
    window.clearInterval(id)
  }
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

const PANEL_CSS = `
.risu-theme-panel{margin:0;padding:0;font-family:'Inter',system-ui,sans-serif;color:#e5e7eb;background:#0f172a;border:1px solid #334155;border-radius:14px;padding:16px;width:340px;max-height:82vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,.55);position:relative;box-sizing:border-box;line-height:1.4}
.risu-theme-panel *{box-sizing:border-box}
.risu-theme-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.risu-theme-title{font-size:15px;font-weight:600;color:#f8fafc;margin:0}
.risu-theme-sub{font-size:11px;color:#64748b;margin:0 0 12px}
.risu-theme-close{background:#1e293b;color:#94a3b8;border:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1}
.risu-theme-close:hover{background:#334155;color:#f1f5f9}
.risu-theme-section{font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px}
.risu-theme-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0}
.risu-theme-label{font-size:13px;color:#cbd5e1}
.risu-theme-select{flex:1;background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:6px 8px;font-size:13px}
.risu-theme-check{position:relative;width:38px;height:22px;flex:0 0 auto}
.risu-theme-check input{opacity:0;width:0;height:0}
.risu-theme-slider{position:absolute;inset:0;background:#475569;border-radius:999px;transition:.2s;cursor:pointer}
.risu-theme-slider:before{content:"";position:absolute;height:16px;width:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.risu-theme-check input:checked + .risu-theme-slider{background:#22c55e}
.risu-theme-check input:checked + .risu-theme-slider:before{transform:translateX(16px)}
.risu-theme-range{flex:1;-webkit-appearance:none;appearance:none;height:4px;background:#334155;border-radius:4px;outline:none}
.risu-theme-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;background:#22d3ee;border-radius:50%;cursor:pointer}
.risu-theme-range::-moz-range-thumb{width:14px;height:14px;background:#22d3ee;border:none;border-radius:50%;cursor:pointer}
.risu-theme-text{flex:1;background:#1e293b;color:#f1f5f9;border:1px solid #334155;border-radius:6px;padding:6px 8px;font-size:13px}
.risu-theme-swatches{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:6px 0 4px}
.risu-theme-sw{height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.1);cursor:pointer;font-size:0}
.risu-theme-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:6px 0}
.risu-theme-pill{background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:8px;padding:8px 10px;font-size:12px;cursor:pointer;text-align:left;transition:.15s}
.risu-theme-pill:hover{border-color:#475569;color:#f1f5f9}
.risu-theme-pill.active{border-color:#22d3ee;color:#f1f5f9;background:#0c2735}
.risu-theme-pill b{display:block;font-size:12px;font-weight:600;margin-bottom:2px}
.risu-theme-pill span{display:block;font-size:10px;color:#64748b;line-height:1.3}
.risu-theme-pill.active span{color:#94a3b8}
.risu-theme-btn{background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:6px;padding:7px 10px;font-size:12px;cursor:pointer;width:100%}
.risu-theme-btn:hover{border-color:#475569;color:#f1f5f9}
.risu-theme-hint{font-size:11px;color:#64748b;margin-top:10px;line-height:1.4}
.risu-theme-divider{height:1px;background:#1e293b;margin:12px 0}
`

function createPanel(
  state: ThemeState,
  onChange: (next: ThemeState) => void,
): HTMLElement {
  const host = document.createElement('div')
  host.className = 'risu-theme-panel'

  const styleEl = document.createElement('style')
  styleEl.textContent = PANEL_CSS
  host.appendChild(styleEl)

  const wrap = document.createElement('div')
  host.appendChild(wrap)

  const header = document.createElement('div')
  header.className = 'risu-theme-h'
  const title = document.createElement('h3')
  title.className = 'risu-theme-title'
  title.textContent = 'Risu Theme'
  const closeBtn = document.createElement('button')
  closeBtn.className = 'risu-theme-close'
  closeBtn.textContent = '×'
  closeBtn.title = 'Close'
  header.append(title, closeBtn)
  wrap.appendChild(header)
  const sub = document.createElement('p')
  sub.className = 'risu-theme-sub'
  sub.textContent = '색상 테마 + 레이아웃 프리셋 (DB 기반)'
  wrap.appendChild(sub)

  const makeRow = (label: string): HTMLElement => {
    const row = document.createElement('div')
    row.className = 'risu-theme-row'
    const lab = document.createElement('span')
    lab.className = 'risu-theme-label'
    lab.textContent = label
    row.appendChild(lab)
    wrap.appendChild(row)
    return row
  }

  const makeSection = (text: string) => {
    const s = document.createElement('div')
    s.className = 'risu-theme-section'
    s.textContent = text
    wrap.appendChild(s)
  }

  // -- enabled toggle
  const enRow = makeRow('테마 켜기')
  const enLabel = document.createElement('label')
  enLabel.className = 'risu-theme-check'
  const enInput = document.createElement('input')
  enInput.type = 'checkbox'
  enInput.checked = state.enabled
  const enSlider = document.createElement('span')
  enSlider.className = 'risu-theme-slider'
  enLabel.append(enInput, enSlider)
  enRow.appendChild(enLabel)
  enInput.addEventListener('change', () => {
    state.enabled = enInput.checked
    onChange(state)
  })

  // -- color preset
  makeSection('색상 프리셋')
  const themeRow = makeRow('Preset')
  const sel = document.createElement('select')
  sel.className = 'risu-theme-select'
  for (const t of THEMES) {
    const o = document.createElement('option')
    o.value = t.id
    o.textContent = t.label
    if (t.id === state.themeId) o.selected = true
    sel.appendChild(o)
  }
  themeRow.appendChild(sel)
  sel.addEventListener('change', () => {
    state.themeId = sel.value
    renderSwatches(getTheme(state.themeId) ?? THEMES[0])
    onChange(state)
  })

  // swatches preview
  const swRow = makeRow('')
  swRow.removeChild(swRow.querySelector('.risu-theme-label')!)
  const sw = document.createElement('div')
  sw.className = 'risu-theme-swatches'
  swRow.appendChild(sw)
  const renderSwatches = (theme: ThemePalette) => {
    sw.innerHTML = ''
    const colors = [
      theme.base.bgcolor,
      theme.base.darkbg,
      theme.ramps.primary[5],
      theme.ramps.secondary[5],
      theme.ramps.danger[5],
      theme.ramps.success[5],
      theme.ramps.neutral[5],
      theme.base.textcolor,
      theme.base.borderc,
      theme.base.selected,
    ]
    for (const c of colors) {
      const d = document.createElement('div')
      d.className = 'risu-theme-sw'
      d.style.background = c
      d.title = c
      sw.appendChild(d)
    }
  }
  renderSwatches(getTheme(state.themeId) ?? THEMES[0])

  // background opacity
  const bgRow = makeRow('배경 투명도')
  const bgRange = document.createElement('input')
  bgRange.type = 'range'
  bgRange.className = 'risu-theme-range'
  bgRange.min = '0.2'
  bgRange.max = '1'
  bgRange.step = '0.05'
  bgRange.value = String(state.bgOpacity ?? 1)
  bgRow.appendChild(bgRange)
  bgRange.addEventListener('input', () => {
    state.bgOpacity = parseFloat(bgRange.value)
    onChange(state)
  })

  // roundness
  const rdRow = makeRow('모서리 둥글기')
  const rdRange = document.createElement('input')
  rdRange.type = 'range'
  rdRange.className = 'risu-theme-range'
  rdRange.min = '0'
  rdRange.max = '2'
  rdRange.step = '0.1'
  rdRange.value = String(state.roundness ?? 1)
  rdRow.appendChild(rdRange)
  rdRange.addEventListener('input', () => {
    state.roundness = parseFloat(rdRange.value)
    onChange(state)
  })

  // font override
  const fontRow = makeRow('폰트 오버라이드')
  const fontInput = document.createElement('input')
  fontInput.type = 'text'
  fontInput.className = 'risu-theme-text'
  fontInput.placeholder = '예) Inter, sans-serif'
  fontInput.value = state.fontOverride ?? ''
  fontRow.appendChild(fontInput)
  let fontTimer: number | undefined
  fontInput.addEventListener('input', () => {
    state.fontOverride = fontInput.value.trim() || undefined
    window.clearTimeout(fontTimer)
    fontTimer = window.setTimeout(() => onChange(state), 300)
  })

  // -- layout
  makeSection('레이아웃 프리셋')
  const grid = document.createElement('div')
  grid.className = 'risu-theme-grid'
  wrap.appendChild(grid)
  const pills: Record<string, HTMLButtonElement> = {}
  for (const p of LAYOUT_PRESETS) {
    const pill = document.createElement('button')
    pill.className = 'risu-theme-pill'
    if ((state.layout ?? 'classic') === p.id) pill.classList.add('active')
    const b = document.createElement('b')
    b.textContent = p.label
    const s = document.createElement('span')
    s.textContent = p.description
    pill.append(b, s)
    pill.addEventListener('click', () => {
      state.layout = p.id
      for (const k of Object.keys(pills)) {
        pills[k].classList.toggle('active', k === p.id)
      }
      onChange(state)
    })
    pills[p.id] = pill
    grid.appendChild(pill)
  }

  // -- reset
  const divider2 = document.createElement('div')
  divider2.className = 'risu-theme-divider'
  wrap.appendChild(divider2)

  const resetBtn = document.createElement('button')
  resetBtn.textContent = '기본값으로 초기화'
  resetBtn.className = 'risu-theme-btn'
  wrap.appendChild(resetBtn)
  resetBtn.addEventListener('click', () => {
    Object.assign(state, { ...DEFAULT_STATE, savedLayout: state.savedLayout })
    enInput.checked = state.enabled
    sel.value = state.themeId
    bgRange.value = String(state.bgOpacity)
    rdRange.value = String(state.roundness)
    fontInput.value = state.fontOverride ?? ''
    for (const k of Object.keys(pills)) {
      pills[k].classList.toggle('active', k === state.layout)
    }
    renderSwatches(getTheme(state.themeId)!)
    onChange(state)
  })

  const hint = document.createElement('div')
  hint.className = 'risu-theme-hint'
  hint.textContent =
    '색상은 CSS 변수로, 레이아웃은 RisuAI DB 설정을 직접 변경해 Svelte가 자동 재렌더링합니다. Classic 선택 시 원래 설정 복원.'
  wrap.appendChild(hint)

  return host
}

// ---------------------------------------------------------------------------
// Mod
// ---------------------------------------------------------------------------

const mod: RisuModDefinition = {
  id: 'io.risu.theme',
  name: 'Risu Theme',
  version: '0.3.0',
  permissions: ['ui.inject', 'database.read', 'database.write'],
  activate(api: RisuModApi) {
    const state: ThemeState = loadState()
    const ctx: ApplyContext = { api, state }

    let applyTimer: number | undefined
    const persistAndApply = (next: ThemeState) => {
      Object.assign(state, next)
      saveState(state)
      // debounce layout DB writes (they're async + trigger re-render)
      window.clearTimeout(applyTimer)
      applyTimer = window.setTimeout(() => applyAll(ctx), 150)
    }

    // Apply on load
    window.clearTimeout(applyTimer)
    applyTimer = window.setTimeout(() => applyAll(ctx), 300)

    const stopWatcher = watchRisuThemeOverwrites(state)

    const openPanel = () => {
      const { container, unmount } = api.ui.mount({
        id: 'risu-theme-panel',
        target: 'overlay',
        css: `:host{pointer-events:none}.risu-theme-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;background:rgba(2,6,23,.55);backdrop-filter:blur(2px)}.risu-theme-panel{pointer-events:auto}`,
      })
      const overlay = document.createElement('div')
      overlay.className = 'risu-theme-overlay'
      const panel = createPanel(state, persistAndApply)
      const close = panel.querySelector('.risu-theme-close') as HTMLButtonElement
      const doClose = () => unmount()
      close.addEventListener('click', doClose)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) doClose()
      })
      overlay.appendChild(panel)
      container.appendChild(overlay)
    }

    const toolbarCleanup = api.ui.addToolbarButton({
      id: 'risu-theme-open',
      label: 'Theme',
      title: 'Open Risu Theme panel',
      onClick: openPanel,
    })

    const menuCleanup = api.ui.addMenuItem({
      id: 'risu-theme-open-menu',
      label: 'Theme Settings',
      order: 80,
      onClick: openPanel,
    })

    api.lifecycle.onUnload(() => {
      window.clearTimeout(applyTimer)
      void restoreLayoutViaApi(ctx)
      disableColor()
      stopWatcher()
      toolbarCleanup?.()
      menuCleanup?.()
    })

    return () => {
      window.clearTimeout(applyTimer)
      void restoreLayoutViaApi(ctx)
      disableColor()
      stopWatcher()
      toolbarCleanup?.()
      menuCleanup?.()
    }
  },
}

if (unsafeWindow.RisuMods) unsafeWindow.RisuMods.register(mod)
else (unsafeWindow.__RISU_MOD_QUEUE__ ??= []).push(mod)