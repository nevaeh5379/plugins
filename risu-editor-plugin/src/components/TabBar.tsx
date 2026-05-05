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
import React, { useState, useCallback } from 'react'
import type { VFSNode } from '../lib/virtualFS'
import { ContextMenu, type MenuItem } from './ContextMenu'

interface TabBarProps {
  openTabs: VFSNode[]
  activeTabPath: string | null
  onTabSelect: (path: string) => void
  onTabClose: (path: string) => void
  onCloseAll?: () => void
  onCloseOthers?: (path: string) => void
  onCloseToLeft?: (path: string) => void
  onCloseToRight?: (path: string) => void
}

interface CtxMenuState {
  x: number
  y: number
  items: MenuItem[]
}

export const TabBar: React.FC<TabBarProps> = ({
  openTabs,
  activeTabPath,
  onTabSelect,
  onTabClose,
  onCloseAll,
  onCloseOthers,
  onCloseToLeft,
  onCloseToRight,
}) => {
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabPath: string) => {
      e.preventDefault()
      const tabIndex = openTabs.findIndex((t) => t.path === tabPath)

      const items: MenuItem[] = [
        {
          label: '닫기',
          shortcut: 'Ctrl+W',
          onClick: () => onTabClose(tabPath),
        },
        {
          label: '이것 제외 닫기',
          onClick: () => onCloseOthers?.(tabPath),
          disabled: openTabs.length <= 1,
        },
        { label: '', divider: true },
        {
          label: '왼쪽에 모두 닫기',
          onClick: () => onCloseToLeft?.(tabPath),
          disabled: tabIndex <= 0,
        },
        {
          label: '오른쪽 모두 닫기',
          onClick: () => onCloseToRight?.(tabPath),
          disabled: tabIndex >= openTabs.length - 1,
        },
        { label: '', divider: true },
        {
          label: '모두 닫기',
          onClick: () => onCloseAll?.(),
        },
      ]

      setCtxMenu({ x: e.clientX, y: e.clientY, items })
    },
    [openTabs, onTabClose, onCloseAll, onCloseOthers, onCloseToLeft, onCloseToRight]
  )

  if (openTabs.length === 0) return null

  return (
    <>
      <div className="re-tabbar">
        {openTabs.map((tab) => (
          <div
            key={tab.path}
            className={`re-tab${activeTabPath === tab.path ? ' active' : ''}${tab.dirty ? ' dirty' : ''}`}
            onClick={() => onTabSelect(tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
            title={tab.path}
          >
            <span className="re-tab-name">{tab.name}</span>
            <span
              className="re-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.path)
              }}
            >
              ×
            </span>
          </div>
        ))}
      </div>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  )
}
