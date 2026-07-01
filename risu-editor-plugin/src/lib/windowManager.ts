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

/**
 * Window Manager — types and utilities for the internal windowing system.
 *
 * Since the RisuAI plugin API only supports `showContainer('fullscreen')`,
 * we implement a desktop-style window manager inside the plugin iframe using
 * absolutely-positioned, draggable, resizable windows.
 */

export type LayoutMode = 'fullscreen' | 'windowed' | 'sidebar'

export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  id: string
  paneId: string
  title: string
  rect: WindowRect
  minimized: boolean
  maximized: boolean
  zIndex: number
  /** Saved rect before maximize, so we can restore it. */
  restoreRect: WindowRect | null
}

// ─── Tile layout ────────────────────────────────────────────────────────────

/**
 * Compute tile positions for N windows inside a container of the given size.
 * Returns a copy of `windows` with updated `rect` values.
 *
 * Layout strategy:
 *   1 window  → full container
 *   2 windows → side-by-side (left / right)
 *   3 windows → left half + right-top + right-bottom
 *   4 windows → 2×2 grid
 *   5+        → 2-column grid with roughly equal rows
 */
export function computeTileLayout(
  windows: WindowState[],
  containerWidth: number,
  containerHeight: number,
  taskbarHeight: number = 40,
): WindowState[] {
  const n = windows.length
  if (n === 0) return windows

  const availHeight = containerHeight - taskbarHeight
  const gap = 4

  const cols = n <= 2 ? n : n === 3 ? 2 : 2
  const rows = n <= 2 ? 1 : n === 3 ? 2 : Math.ceil(n / 2)

  const cellW = (containerWidth - gap * (cols + 1)) / cols
  const cellH = (availHeight - gap * (rows + 1)) / rows

  return windows.map((w, i) => {
    let col: number
    let row: number

    if (n === 3) {
      // left half + right-top + right-bottom
      if (i === 0) { col = 0; row = 0; }
      else if (i === 1) { col = 1; row = 0; }
      else { col = 1; row = 1; }
    } else {
      col = i % cols
      row = Math.floor(i / cols)
    }

    // For n=3, first window spans full height
    const ww = (n === 3 && i === 0) ? cellW : cellW
    const wh = (n === 3 && i === 0) ? availHeight - gap * 2 : cellH

    return {
      ...w,
      rect: {
        x: gap + col * (cellW + gap),
        y: gap + row * (cellH + gap),
        width: ww,
        height: wh,
      },
      maximized: false,
      minimized: false,
    }
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let _nextZIndex = 100

export function nextZIndex(): number {
  return ++_nextZIndex
}

export function resetZIndex(): void {
  _nextZIndex = 100
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export const MIN_WINDOW_WIDTH = 300
export const MIN_WINDOW_HEIGHT = 200
export const TASKBAR_HEIGHT = 40
