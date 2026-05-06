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
import React, { useRef, useState, useCallback, useEffect } from 'react'
import { Window } from './Window'
import { Taskbar } from './Taskbar'
import type { WindowState, WindowRect } from '../lib/windowManager'
import type { ExplorerMode } from '../lib/settingsContext'
import {
  computeTileLayout,
  nextZIndex,
  resetZIndex,
  TASKBAR_HEIGHT,
} from '../lib/windowManager'

interface DesktopProps {
  windows: WindowState[]
  onWindowsChange: (windows: WindowState[]) => void
  onWindowClose: (windowId: string) => void
  renderWindowContent: (paneId: string) => React.ReactNode
  explorerMode: ExplorerMode
  explorerContent: React.ReactNode
  explorerWindowOpen?: boolean
  onToggleExplorerWindow?: () => void
  onTabDropOnDesktop?: (paneId: string, path: string, clientX: number, clientY: number) => void
  /** 탭을 다른 창에 드롭하여 합칠 때 호출 */
  onTabDropOnWindow?: (sourcePaneId: string, targetPaneId: string, path: string) => void
}

export const Desktop: React.FC<DesktopProps> = ({
  windows,
  onWindowsChange,
  onWindowClose,
  renderWindowContent,
  explorerMode,
  explorerContent,
  explorerWindowOpen = false,
  onToggleExplorerWindow,
  onTabDropOnDesktop,
  onTabDropOnWindow,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [desktopDragOver, setDesktopDragOver] = useState(false)

  // ── Measure container ───────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight })
    }
    measure()

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Tile layout on mount / window count change ──────────────────────────

  useEffect(() => {
    if (windows.length === 0) return
    // Only auto-tile if no window has a non-zero position (fresh layout)
    const hasPositioned = windows.some(
      (w) => w.rect.x !== 0 || w.rect.y !== 0 || w.restoreRect !== null,
    )
    if (hasPositioned) return

    const tiled = computeTileLayout(windows, containerSize.width, containerSize.height, TASKBAR_HEIGHT)
    onWindowsChange(tiled)
  }, [windows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Window actions ──────────────────────────────────────────────────────

  const handleFocus = useCallback(
    (id: string) => {
      onWindowsChange(
        windows.map((w) => ({
          ...w,
          zIndex: w.id === id ? nextZIndex() : w.zIndex,
        })),
      )
    },
    [windows, onWindowsChange],
  )

  const handleMove = useCallback(
    (id: string, rect: WindowRect) => {
      onWindowsChange(windows.map((w) => (w.id === id ? { ...w, rect } : w)))
    },
    [windows, onWindowsChange],
  )

  const handleResize = useCallback(
    (id: string, rect: WindowRect) => {
      onWindowsChange(windows.map((w) => (w.id === id ? { ...w, rect } : w)))
    },
    [windows, onWindowsChange],
  )

  const handleMinimize = useCallback(
    (id: string) => {
      onWindowsChange(windows.map((w) => (w.id === id ? { ...w, minimized: true } : w)))
    },
    [windows, onWindowsChange],
  )

  const handleMaximize = useCallback(
    (id: string) => {
      onWindowsChange(
        windows.map((w) =>
          w.id === id
            ? { ...w, maximized: true, restoreRect: { ...w.rect }, zIndex: nextZIndex() }
            : w,
        ),
      )
    },
    [windows, onWindowsChange],
  )

  const handleRestore = useCallback(
    (id: string) => {
      onWindowsChange(
        windows.map((w) =>
          w.id === id && w.restoreRect
            ? { ...w, maximized: false, rect: w.restoreRect, restoreRect: null }
            : { ...w, maximized: false },
        ),
      )
    },
    [windows, onWindowsChange],
  )

  const handleClose = useCallback(
    (id: string) => {
      onWindowClose(id)
    },
    [onWindowClose],
  )

  const handleTaskbarActivate = useCallback(
    (id: string) => {
      onWindowsChange(
        windows.map((w) =>
          w.id === id
            ? { ...w, minimized: false, zIndex: nextZIndex() }
            : w,
        ),
      )
    },
    [windows, onWindowsChange],
  )

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={`re-desktop${explorerMode === 'sidebar' ? ' re-desktop--sidebar' : ''}${explorerMode === 'window' && explorerWindowOpen ? ' re-desktop--explorer-open' : ''}`} ref={containerRef}>
      {explorerMode === 'sidebar' && (
        <div className="re-desktop-sidebar">
          {explorerContent}
        </div>
      )}
      {explorerMode === 'window' && explorerWindowOpen && (
        <div className="re-desktop-sidebar re-desktop-sidebar--fixed">
          {explorerContent}
        </div>
      )}
      <div
        className={`re-desktop-window-area${desktopDragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/x-risu-pane')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDesktopDragOver(true)
          }
        }}
        onDragLeave={(e) => {
          // Only set false if leaving the window area itself (not entering a child)
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setDesktopDragOver(false)
          }
        }}
        onDrop={(e) => {
          setDesktopDragOver(false)
          const paneId = e.dataTransfer.getData('application/x-risu-pane')
          const path = e.dataTransfer.getData('text/plain')
          if (paneId && path) {
            onTabDropOnDesktop?.(paneId, path, e.clientX, e.clientY)
          }
        }}
      >
        {windows.map((win) => (
          <Window
            key={win.id}
            window={win}
            containerRect={containerSize}
            onFocus={handleFocus}
            onMove={handleMove}
            onResize={handleResize}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
            onRestore={handleRestore}
            onClose={handleClose}
            onTabDrop={(sourcePaneId, path) => {
              if (sourcePaneId !== win.paneId) {
                onTabDropOnWindow?.(sourcePaneId, win.paneId, path)
              }
            }}
          >
            {renderWindowContent(win.paneId)}
          </Window>
        ))}
      </div>
      <Taskbar
      explorerMode={explorerMode}
        windows={windows}
        explorerWindowOpen={explorerWindowOpen}
        onToggleExplorerWindow={onToggleExplorerWindow}
        onActivate={handleTaskbarActivate}
      />
      
    </div>
  )
}
