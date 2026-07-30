export type ThemeMode = 'dark' | 'light'

export interface ThemePalette {
  id: string
  label: string
  mode: ThemeMode
  /** Base RisuAI color-scheme variables (mapped to --risu-theme-*). */
  base: {
    bgcolor: string
    darkbg: string
    borderc: string
    selected: string
    draculared: string
    textcolor: string
    textcolor2: string
    darkborderc: string
    darkbutton: string
  }
  /** Tailwind-style 50..900 ramps (primary/secondary/danger/success/neutral). */
  ramps: {
    primary: string[]
    secondary: string[]
    danger: string[]
    success: string[]
    neutral: string[]
  }
  /** Optional font/text theme overrides. */
  font?: {
    family?: string
    animationSpeed?: string
    standard?: string
    bold?: string
    italic?: string
    italicBold?: string
    quote1?: string
    quote2?: string
  }
}

const draculaRamp = (hex500: string) => hex500

export const THEMES: ThemePalette[] = [
  {
    id: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    mode: 'dark',
    base: {
      bgcolor: '#1e1e2e',
      darkbg: '#181825',
      borderc: '#cba6f7',
      selected: '#313244',
      draculared: '#f38ba8',
      textcolor: '#cdd6f4',
      textcolor2: '#a6adc8',
      darkborderc: '#45475a',
      darkbutton: '#313244',
    },
    ramps: {
      primary: ['#eff1f5', '#e4e7f4', '#d4d9f1', '#b8c2ec', '#9ba7e6', '#89b4fa', '#7690e0', '#6170d4', '#4c5cc9', '#3a48a8'],
      secondary: ['#f5e9ff', '#ead5ff', '#dabfff', '#c4a3ff', '#ab87f7', '#cba6f7', '#b192f5', '#9a7ee3', '#836bcf', '#6c58b8'],
      danger: ['#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f38ba8', '#e35d77', '#c93f5b', '#a83250', '#8b2a47', '#6e2238'],
      success: ['#d4f9e3', '#a8f0c4', '#7ee6a0', '#52d982', '#26c593', '#11a06a', '#0c875a', '#0a6d4a', '#08543a', '#053c2a'],
      neutral: ['#f5f5f7', '#e9e9ee', '#d8d8e0', '#c2c2cc', '#a6a6b3', '#8b8b9a', '#6c6c7a', '#4c4c58', '#2c2c34', '#1a1a22'],
    },
    font: {
      family: "'Inter', 'Segoe UI', Roboto, Arial, sans-serif",
      animationSpeed: '0.18s',
      standard: '#cdd6f4',
      bold: '#f9e2af',
      italic: '#f9e2af',
      italicBold: '#f9e2af',
      quote1: '#89dceb',
      quote2: '#f5c2e7',
    },
  },
  {
    id: 'tokyonight-storm',
    label: 'Tokyo Night Storm',
    mode: 'dark',
    base: {
      bgcolor: '#24283b',
      darkbg: '#1a1b26',
      borderc: '#7aa2f7',
      selected: '#2d3550',
      draculared: '#f7768e',
      textcolor: '#e0e6f0',
      textcolor2: '#9aa5ce',
      darkborderc: '#414868',
      darkbutton: '#414868',
    },
    ramps: {
      primary: ['#e9ecff', '#d4dbff', '#b8c5ff', '#94afff', '#7aa2f7', '#5f87e0', '#4f72cc', '#3f5cb8', '#334a9c', '#28387c'],
      secondary: ['#f0e7ff', '#dec8ff', '#c9a5ff', '#b07eff', '#bb9af7', '#a380e0', '#8d66c9', '#724db2', '#5a399b', '#43277e'],
      danger: ['#ffd6e6', '#ffb3cf', '#ff84ad', '#f869a1', '#f7768e', '#e35a73', '#bf4760', '#a13a54', '#82314a', '#61263f'],
      success: ['#c6ffe6', '#9bffd2', '#6ce8b3', '#42d098', '#1db987', '#0a9d6e', '#0a8260', '#0a694f', '#085440', '#063d30'],
      neutral: ['#eef1ff', '#dde2f1', '#c4cbe2', '#a6b1d2', '#8794c0', '#737aa8', '#5c6388', '#414868', '#2b3458', '#1a1e34'],
    },
    font: {
      family: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
      animationSpeed: '0.15s',
      standard: '#c0caf5',
      bold: '#7dcfff',
      italic: '#9d7cd8',
      italicBold: '#9d7cd8',
      quote1: '#7dcfff',
      quote2: '#e0af68',
    },
  },
  {
    id: 'rosepine',
    label: 'Rosé Pine',
    mode: 'dark',
    base: {
      bgcolor: '#191724',
      darkbg: '#1f1d2e',
      borderc: '#ebbcba',
      selected: '#26233a',
      draculared: '#eb6f92',
      textcolor: '#e0def4',
      textcolor2: '#908caa',
      darkborderc: '#403d52',
      darkbutton: '#26233a',
    },
    ramps: {
      primary: ['#f7f0f5', '#e9d6e6', '#dab8d9', '#c797c9', '#b678ba', '#ebbcba', '#c9a0be', '#a87fa3', '#8b5e8c', '#6f4373'],
      secondary: ['#eef0f9', '#dcdcef', '#c4c6e3', '#a7a9d4', '#8b8ec5', '#c4a7e7', '#a989cc', '#8b6fb0', '#725796', '#5a3f7c'],
      danger: ['#fde2e9', '#f7c5d6', '#ee9bb6', '#e2729a', '#eb6f92', '#cc557a', '#a93f5f', '#8b3050', '#6e2440', '#561a31'],
      success: ['#dff6e8', '#b8ebca', '#8ddcae', '#5fce8c', '#3eb468', '#2a9550', '#1f7d42', '#176536', '#0f4d2a', '#083a20'],
      neutral: ['#f4f1f8', '#e7e2f1', '#d3ccdf', '#b6adc7', '#948dab', '#908caa', '#736a8a', '#5b557a', '#403d52', '#2a2740'],
    },
    font: {
      family: "'Fira Code', 'JetBrains Mono', monospace",
      animationSpeed: '0.2s',
      standard: '#e0def4',
      bold: '#ebbcba',
      italic: '#c4a7e7',
      italicBold: '#c4a7e7',
      quote1: '#31748f',
      quote2: '#f6c177',
    },
  },
  {
    id: 'nordic',
    label: 'Nordic',
    mode: 'dark',
    base: {
      bgcolor: '#2e3440',
      darkbg: '#242933',
      borderc: '#88c0d0',
      selected: '#3b4252',
      draculared: '#bf616a',
      textcolor: '#e5e9f0',
      textcolor2: '#81a1c1',
      darkborderc: '#434c5e',
      darkbutton: '#3b4252',
    },
    ramps: {
      primary: ['#e8eef6', '#d4e0ee', '#b8c9e3', '#9aafcf', '#7d96bb', '#88c0d0', '#73a9bc', '#5f8fa5', '#4b7589', '#395b6d'],
      secondary: ['#e3eafa', '#ced9ee', '#b0c0e6', '#92a6d8', '#748cc9', '#81a1c1', '#6a82a8', '#52618a', '#3e4b6f', '#2a3553'],
      danger: ['#f5d8de', '#ecb3bf', '#de8a9c', '#cd5f75', '#bf616a', '#a8474f', '#883640', '#6d2a32', '#541f28', '#3b141b'],
      success: ['#d8f0e4', '#a8e0c3', '#7ccda0', '#51b97c', '#3aa055', '#2d8543', '#236c38', '#1a5430', '#123c24', '#0a2717'],
      neutral: ['#f2f4f8', '#e5e9f0', '#d1d8e4', '#b4becf', '#9aa3b5', '#7e8aa0', '#647088', '#4c566a', '#3a4255', '#272d3e'],
    },
    font: {
      family: "'Inter', 'Segoe UI', sans-serif",
      animationSpeed: '0.22s',
      standard: '#e5e9f0',
      bold: '#88c0d0',
      italic: '#ebcb8b',
      italicBold: '#ebcb8b',
      quote1: '#81a1c1',
      quote2: '#a3be8c',
    },
  },
  {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    mode: 'dark',
    base: {
      bgcolor: '#002b36',
      darkbg: '#00323b',
      borderc: '#2aa198',
      selected: '#073642',
      draculared: '#dc322f',
      textcolor: '#93a1a1',
      textcolor2: '#586e75',
      darkborderc: '#073642',
      darkbutton: '#073642',
    },
    ramps: {
      primary: ['#e5f6f9', '#c8eef3', '#a3e0e9', '#73cdd9', '#3fbab9', '#2aa198', '#258979', '#1f7063', '#175648', '#0e3d34'],
      secondary: ['#fdf0e6', '#faddc6', '#f4c598', '#ecab6a', '#e3a049', '#cb8b34', '#a87129', '#855923', '#5f4019', '#3c2812'],
      danger: ['#fbe3e3', '#f5bfbf', '#ec9393', '#df6666', '#dc322f', '#b32522', '#8f1e1c', '#6d1815', '#4a110f', '#2c0a09'],
      success: ['#d8f5e6', '#a8e6c4', '#73d3a0', '#46bf7c', '#2da85a', '#859900', '#6c7d00', '#566400', '#3f4a00', '#2a3000'],
      neutral: ['#f6f0e8', '#e9dfcf', '#d3c2a3', '#b6a07c', '#9b8562', '#837766', '#6c6155', '#554d44', '#3c3830', '#26231e'],
    },
    font: {
      family: "'Source Code Pro', 'Inconsolata', monospace",
      animationSpeed: '0.2s',
      standard: '#93a1a1',
      bold: '#268bd2',
      italic: '#b58900',
      italicBold: '#cb4b16',
      quote1: '#2aa198',
      quote2: '#d33682',
    },
  },
  {
    id: 'paper-light',
    label: 'Paper Light',
    mode: 'light',
    base: {
      bgcolor: '#fbfbf9',
      darkbg: '#f1efe9',
      borderc: '#5c6a72',
      selected: '#e8e6df',
      draculared: '#c8553d',
      textcolor: '#2d3540',
      textcolor2: '#6b7280',
      darkborderc: '#d1ccc0',
      darkbutton: '#e8e6df',
    },
    ramps: {
      primary: ['#eef4fb', '#dbe9f6', '#bcd6ef', '#93bde0', '#6ba3d0', '#4a89c0', '#3a6fa0', '#2d5680', '#234260', '#1a2e40'],
      secondary: ['#f6f0fb', '#ecdcf5', '#d9bde9', '#c19bda', '#a476cb', '#8a55bb', '#6e3f9a', '#543079', '#3c2158', '#271538'],
      danger: ['#fdebe9', '#f8d1cc', '#f0a99e', '#e58071', '#d65847', '#c8553d', '#a8442f', '#843322', '#61251a', '#3f160f'],
      success: ['#e6f5ec', '#c5e8d2', '#9bd3b0', '#6ebd8c', '#43a368', '#2d8a4f', '#1f7040', '#16562f', '#0d3d20', '#062414'],
      neutral: ['#f9f8f4', '#ece9e0', '#d6d0c1', '#b8b1a0', '#9c947f', '#7c7363', '#5e574a', '#423d35', '#2a2620', '#18150f'],
    },
    font: {
      family: "'Georgia', 'Cambria', 'Times New Roman', serif",
      animationSpeed: '0.25s',
      standard: '#2d3540',
      bold: '#1a202c',
      italic: '#6b7280',
      italicBold: '#6b7280',
      quote1: '#4a89c0',
      quote2: '#c19bda',
    },
  },
]

export const DEFAULT_THEME_ID = 'catppuccin-mocha'

export interface ThemeState {
  enabled: boolean
  themeId: string
  /** Accent ramp override (optional). When set, overrides the theme's primary ramp. */
  accentOverride?: string
  /** Override base background opacity (0..1). 1 = opaque. */
  bgOpacity?: number
  /** Custom font family override. */
  fontOverride?: string
  /** Rounded corner scale multiplier (1 = default). */
  roundness?: number
  /** Layout preset id (defined in layouts.ts). */
  layout?: string
  /** Saved snapshot of the user's original RisuAI layout DB fields, so we
   *  can restore them when the theme is disabled or switched to 'classic'. */
  savedLayout?: Record<string, unknown> | null
}

export const DEFAULT_STATE: ThemeState = {
  enabled: true,
  themeId: DEFAULT_THEME_ID,
  bgOpacity: 1,
  roundness: 1,
  layout: 'bubble',
  savedLayout: null,
}

const STORAGE_KEY = 'risu-theme-state'

export function loadState(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<ThemeState>
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveState(state: ThemeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function getTheme(id: string): ThemePalette | undefined {
  return THEMES.find((t) => t.id === id)
}

/** Set of every base variable name we may touch on :root. */
export const BASE_VAR_NAMES = [
  '--risu-theme-bgcolor',
  '--risu-theme-darkbg',
  '--risu-theme-borderc',
  '--risu-theme-selected',
  '--risu-theme-draculared',
  '--risu-theme-textcolor',
  '--risu-theme-textcolor2',
  '--risu-theme-darkborderc',
  '--risu-theme-darkbutton',
] as const

/** Set of every ramp variable name we may touch on :root. */
export const RAMP_VAR_NAMES = (
  ['primary', 'secondary', 'danger', 'success', 'neutral'] as const
).flatMap((name) =>
  Array.from({ length: 10 }, (_, i) => `--risu-theme-${name}-${i * 100 || 50}`),
)

/** Set of every font/text variable name we may touch on :root. */
export const FONT_VAR_NAMES = [
  '--risu-font-family',
  '--risu-animation-speed',
  '--FontColorStandard',
  '--FontColorBold',
  '--FontColorItalic',
  '--FontColorItalicBold',
  '--FontColorQuote1',
  '--FontColorQuote2',
] as const

export const ALL_VAR_NAMES = [...BASE_VAR_NAMES, ...RAMP_VAR_NAMES, ...FONT_VAR_NAMES] as const