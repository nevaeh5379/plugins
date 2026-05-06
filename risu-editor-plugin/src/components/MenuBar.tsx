import React, { useState, useRef, useEffect } from 'react'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { VscSave, VscRefresh, VscCloseAll, VscChromeClose, VscSettingsGear, VscSplitHorizontal, VscScreenFull, VscScreenNormal } from 'react-icons/vsc'
import type { LayoutMode } from '../lib/windowManager'

interface MenuBarProps {
  onSave: () => void
  onReload: () => void
  onSplitPane: () => void
  onCloseAll: () => void
  onCloseEditor: () => void
  onSettings: () => void
  layoutMode?: LayoutMode
  onToggleLayoutMode?: () => void
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onSave,
  onReload,
  onSplitPane,
  onCloseAll,
  onCloseEditor,
  onSettings,
  layoutMode,
  onToggleLayoutMode,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const menuRefs = {
    File: useRef<HTMLDivElement>(null),
    View: useRef<HTMLDivElement>(null),
  }

  const handleMenuClick = (menuName: string, ref: React.RefObject<HTMLDivElement>) => {
    if (activeMenu === menuName) {
      setActiveMenu(null)
      setMenuPos(null)
      return
    }
    setActiveMenu(menuName)
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setMenuPos({ x: rect.left, y: rect.bottom })
    }
  }

  const getMenuItems = (menuName: string): MenuItem[] => {
    switch (menuName) {
      case 'File':
        return [
          { label: 'Save (저장)', icon: <VscSave />, shortcut: 'Ctrl+S', onClick: onSave },
          { label: 'Reload (새로고침)', icon: <VscRefresh />, onClick: onReload },
          { label: '', divider: true },
          { label: 'Close All Tabs (모두 닫기)', icon: <VscCloseAll />, onClick: onCloseAll },
          { label: 'Close Editor (에디터 닫기)', icon: <VscChromeClose />, onClick: onCloseEditor },
          { label: '', divider: true },
          { label: 'Settings', icon: <VscSettingsGear />, onClick: onSettings },
        ]
      case 'View':
        return [
          { label: 'Split Pane (에디터 분할)', icon: <VscSplitHorizontal />, onClick: onSplitPane },
          ...(onToggleLayoutMode
            ? [
                {
                  label: layoutMode === 'windowed'
                    ? '전체화면 모드 (Fullscreen)'
                    : '창 모드 (Windowed)',
                  icon: layoutMode === 'windowed' ? <VscScreenFull /> : <VscScreenNormal />,
                  shortcut: 'Ctrl+Shift+W',
                  onClick: onToggleLayoutMode,
                },
              ]
            : []),
        ]
      default:
        return []
    }
  }

  return (
    <div className="re-menubar">
      <div
        ref={menuRefs.File}
        className={`re-menubar-item ${activeMenu === 'File' ? 'active' : ''}`}
        onClick={() => handleMenuClick('File', menuRefs.File)}
      >
        File
      </div>
      <div
        ref={menuRefs.View}
        className={`re-menubar-item ${activeMenu === 'View' ? 'active' : ''}`}
        onClick={() => handleMenuClick('View', menuRefs.View)}
      >
        View
      </div>

      {activeMenu && menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={getMenuItems(activeMenu)}
          onClose={() => {
            setActiveMenu(null)
            setMenuPos(null)
          }}
        />
      )}
    </div>
  )
}
