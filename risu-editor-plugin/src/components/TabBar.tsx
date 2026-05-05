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
import { VscClose, VscSplitHorizontal, VscCloseAll, VscArrowLeft, VscArrowRight } from 'react-icons/vsc'

interface TabBarProps {
  paneId: string
  openTabs: VFSNode[]
  activeTabPath: string | null
  onTabSelect: (paneId: string, path: string) => void
  onTabClose: (paneId: string, path: string) => void
  onTabReorder: (paneId: string, dragPath: string, dropPath: string) => void
  onSplitPane?: (paneId: string, node?: VFSNode) => void
  onCloseAll?: (paneId: string) => void
  onCloseOthers?: (paneId: string, path: string) => void
  onCloseToLeft?: (paneId: string, path: string) => void
  onCloseToRight?: (paneId: string, path: string) => void
}

interface CtxMenuState {
  x: number
  y: number
  items: MenuItem[]
}

export const TabBar: React.FC<TabBarProps> = ({
  paneId,
  openTabs,
  activeTabPath,
  onTabSelect,
  onTabClose,
  onTabReorder,
  onSplitPane,
  onCloseAll,
  onCloseOthers,
  onCloseToLeft,
  onCloseToRight,
}) => {
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tabPath: string) => {
      e.preventDefault()
      const tabIndex = openTabs.findIndex((t) => t.path === tabPath)

      const items: MenuItem[] = [
        {
          label: '오른쪽으로 분할',
          icon: <VscSplitHorizontal />,
          onClick: () => onSplitPane?.(paneId, openTabs[tabIndex]),
        },
        { label: '', divider: true },
        {
          label: '닫기',
          icon: <VscClose />,
          shortcut: 'Ctrl+W',
          onClick: () => onTabClose(paneId, tabPath),
        },
        {
          label: '이것 제외 닫기',
          icon: <VscClose />,
          onClick: () => onCloseOthers?.(paneId, tabPath),
          disabled: openTabs.length <= 1,
        },
        { label: '', divider: true },
        {
          label: '왼쪽에 모두 닫기',
          icon: <VscArrowLeft />,
          onClick: () => onCloseToLeft?.(paneId, tabPath),
          disabled: tabIndex <= 0,
        },
        {
          label: '오른쪽 모두 닫기',
          icon: <VscArrowRight />,
          onClick: () => onCloseToRight?.(paneId, tabPath),
          disabled: tabIndex >= openTabs.length - 1,
        },
        { label: '', divider: true },
        {
          label: '모두 닫기',
          icon: <VscCloseAll />,
          onClick: () => onCloseAll?.(paneId),
        },
      ]

      setCtxMenu({ x: e.clientX, y: e.clientY, items })
    },
    [paneId, openTabs, onTabClose, onCloseAll, onCloseOthers, onCloseToLeft, onCloseToRight, onSplitPane]
  )

  const handleDragStart = (e: React.DragEvent, tabPath: string) => {
    e.dataTransfer.setData('text/plain', tabPath)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, tabPath: string) => {
    e.preventDefault()
    setDragOverPath(tabPath)
  }

  const handleDrop = (e: React.DragEvent, tabPath: string) => {
    e.preventDefault()
    setDragOverPath(null)
    const sourcePath = e.dataTransfer.getData('text/plain')
    if (sourcePath && sourcePath !== tabPath) {
      onTabReorder(paneId, sourcePath, tabPath)
    }
  }

  if (openTabs.length === 0) return null

  return (
    <>
      <div className="re-tabbar">
        {openTabs.map((tab) => (
          <div
            key={tab.path}
            className={`re-tab${activeTabPath === tab.path ? ' active' : ''}${tab.dirty ? ' dirty' : ''}${dragOverPath === tab.path ? ' drag-over' : ''}`}
            onClick={() => onTabSelect(paneId, tab.path)}
            onContextMenu={(e) => handleContextMenu(e, tab.path)}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.path)}
            onDragOver={(e) => handleDragOver(e, tab.path)}
            onDragLeave={() => setDragOverPath(null)}
            onDrop={(e) => handleDrop(e, tab.path)}
            title={tab.path}
          >
            <span className="re-tab-name">{tab.name}</span>
            <span
              className="re-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(paneId, tab.path)
              }}
            >
              <VscClose />
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
