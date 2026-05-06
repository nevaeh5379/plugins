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
import React from 'react'
import { VscFileCode } from 'react-icons/vsc'
import type { WindowState } from '../lib/windowManager'
import { FaFolder } from 'react-icons/fa'

interface TaskbarProps {
  windows: WindowState[]
  explorerMode: 'window' | 'sidebar' | 'none'
  explorerWindowOpen?: boolean
  onToggleExplorerWindow?: () => void
  onActivate: (id: string) => void
}

export const Taskbar: React.FC<TaskbarProps> = ({ windows, explorerMode, explorerWindowOpen, onToggleExplorerWindow, onActivate }) => {
  // Show taskbar if there are windows OR if explorer toggle button is needed
  if (windows.length === 0 && explorerMode !== 'window') return null

  return (
    <div className="re-taskbar">
      {explorerMode === 'window' && (
        <button
          className={`re-explorer-toggle${explorerWindowOpen ? ' active' : ''}`}
          onClick={onToggleExplorerWindow}
          title={explorerWindowOpen ? '파일 탐색기 닫기' : '파일 탐색기 열기'}
        >
          <FaFolder/>
        </button>
      )}
      {windows.map((win) => {
        const isActive = !win.minimized
        return (
          <button
            key={win.id}
            className={`re-taskbar-item${isActive ? ' active' : ''}`}
            onClick={() => onActivate(win.id)}
            title={win.title}
          >
            <VscFileCode className="re-taskbar-item-icon" />
            <span className="re-taskbar-item-label">{win.title}</span>
          </button>
        )
      })}
    </div>
  )
}
