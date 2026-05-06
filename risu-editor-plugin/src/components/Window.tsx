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
import React, { useRef, useCallback, useEffect, useState } from 'react'
import {
  VscChromeMinimize,
  VscChromeMaximize,
  VscChromeRestore,
  VscChromeClose,
} from 'react-icons/vsc'
import type { WindowState, WindowRect } from '../lib/windowManager'
import { clamp, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../lib/windowManager'

// ─── Resize direction ───────────────────────────────────────────────────────

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface WindowProps {
  window: WindowState
  containerRect: { width: number; height: number }
  onFocus: (id: string) => void
  onMove: (id: string, rect: WindowRect) => void
  onResize: (id: string, rect: WindowRect) => void
  onMinimize: (id: string) => void
  onMaximize: (id: string) => void
  onRestore: (id: string) => void
  onClose: (id: string) => void
  children: React.ReactNode
}

export const Window: React.FC<WindowProps> = ({
  window: win,
  containerRect,
  onFocus,
  onMove,
  onResize,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
  children,
}) => {
  const headerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState<ResizeDir | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startRect: WindowRect } | null>(null)

  // ── Focus on mousedown ──────────────────────────────────────────────────

  const handleFocus = useCallback(() => {
    onFocus(win.id)
  }, [onFocus, win.id])

  // ── Drag (header) ───────────────────────────────────────────────────────

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (win.maximized) return // can't drag maximized windows
      e.preventDefault()
      setDragging(true)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...win.rect },
      }
      onFocus(win.id)
    },
    [win, onFocus],
  )

  // ── Resize (handles) ────────────────────────────────────────────────────

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: ResizeDir) => {
      if (e.button !== 0) return
      if (win.maximized) return
      e.preventDefault()
      e.stopPropagation()
      setResizing(dir)
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...win.rect },
      }
      onFocus(win.id)
    },
    [win, onFocus],
  )

  // ── Global mouse move / up ──────────────────────────────────────────────

  useEffect(() => {
    if (!dragging && !resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const sr = dragRef.current.startRect

      if (dragging) {
        const newX = clamp(sr.x + dx, 0, containerRect.width - sr.width)
        const newY = clamp(sr.y + dy, 0, containerRect.height - sr.height)
        onMove(win.id, { ...sr, x: newX, y: newY })
      }

      if (resizing) {
        let { x, y, width, height } = sr

        if (resizing.includes('e')) {
          width = clamp(sr.width + dx, MIN_WINDOW_WIDTH, containerRect.width - sr.x)
        }
        if (resizing.includes('w')) {
          const newW = clamp(sr.width - dx, MIN_WINDOW_WIDTH, sr.x + sr.width)
          x = sr.x + sr.width - newW
          width = newW
        }
        if (resizing.includes('s')) {
          height = clamp(sr.height + dy, MIN_WINDOW_HEIGHT, containerRect.height - sr.y)
        }
        if (resizing.includes('n')) {
          const newH = clamp(sr.height - dy, MIN_WINDOW_HEIGHT, sr.y + sr.height)
          y = sr.y + sr.height - newH
          height = newH
        }

        onResize(win.id, { x, y, width, height })
      }
    }

    const handleMouseUp = () => {
      setDragging(false)
      setResizing(null)
      dragRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, resizing, win.id, containerRect, onMove, onResize])

  // ── Render ──────────────────────────────────────────────────────────────

  const { rect, minimized, maximized, zIndex } = win

  if (minimized) return null // only shown in taskbar

  const style: React.CSSProperties = maximized
    ? { top: 0, left: 0, width: '100%', height: '100%', zIndex }
    : { top: rect.y, left: rect.x, width: rect.width, height: rect.height, zIndex }

  const resizeHandles: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

  return (
    <div
      className={`re-window${maximized ? ' maximized' : ''}${dragging ? ' dragging' : ''}${resizing ? ' resizing' : ''}`}
      style={style}
      onMouseDown={handleFocus}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="re-window-header"
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={() => maximized ? onRestore(win.id) : onMaximize(win.id)}
      >
        <span className="re-window-title">{win.title}</span>
        <div className="re-window-actions">
          <button
            className="re-window-action-btn"
            onClick={(e) => { e.stopPropagation(); onMinimize(win.id) }}
            title="Minimize"
          >
            <VscChromeMinimize />
          </button>
          <button
            className="re-window-action-btn"
            onClick={(e) => { e.stopPropagation(); maximized ? onRestore(win.id) : onMaximize(win.id) }}
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <VscChromeRestore /> : <VscChromeMaximize />}
          </button>
          <button
            className="re-window-action-btn re-window-close-btn"
            onClick={(e) => { e.stopPropagation(); onClose(win.id) }}
            title="Close"
          >
            <VscChromeClose />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="re-window-body">
        {children}
      </div>

      {/* Resize handles */}
      {!maximized && resizeHandles.map((dir) => (
        <div
          key={dir}
          className={`re-window-resize-handle resize-${dir}`}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}
    </div>
  )
}
