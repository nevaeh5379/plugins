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
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  /** Render a nested submenu when this item is hovered */
  submenu?: MenuItem[]
  /** Render a horizontal divider above this item */
  divider?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Adjust position to keep menu inside the viewport
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let nx = x
    let ny = y
    if (rect.right > window.innerWidth) nx = Math.max(0, window.innerWidth - rect.width - 4)
    if (rect.bottom > window.innerHeight) ny = Math.max(0, window.innerHeight - rect.height - 4)
    setPos({ x: nx, y: ny })
  }, [x, y, items])

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div className="re-ctxmenu" ref={menuRef} style={{ left: pos.x, top: pos.y }}>
      {items.map((item, i) => (
        <MenuRow
          key={i}
          item={item}
          onAction={() => {
            if (!item.disabled && !item.submenu && item.onClick) {
              item.onClick()
              onClose()
            }
          }}
        />
      ))}
    </div>
  )
}

const MenuRow: React.FC<{ item: MenuItem; onAction: () => void }> = ({ item, onAction }) => {
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  if (item.divider) {
    return <div className="re-ctxmenu-divider" />
  }

  const hasSubmenu = !!item.submenu && item.submenu.length > 0

  return (
    <div
      ref={rowRef}
      className={
        're-ctxmenu-item' +
        (item.disabled ? ' disabled' : '') +
        (item.danger ? ' danger' : '') +
        (hasSubmenu ? ' has-submenu' : '')
      }
      onMouseEnter={() => setSubmenuOpen(true)}
      onMouseLeave={() => setSubmenuOpen(false)}
      onClick={onAction}
    >
      <span className="re-ctxmenu-label">{item.label}</span>
      {item.shortcut && <span className="re-ctxmenu-shortcut">{item.shortcut}</span>}
      {hasSubmenu && <span className="re-ctxmenu-arrow">▸</span>}
      {hasSubmenu && submenuOpen && rowRef.current && (
        <div
          className="re-ctxmenu re-ctxmenu-sub"
          style={{
            left: rowRef.current.offsetWidth - 4,
            top: 0,
          }}
        >
          {item.submenu!.map((sub, j) => (
            <MenuRow
              key={j}
              item={sub}
              onAction={() => {
                if (!sub.disabled && !sub.submenu && sub.onClick) {
                  sub.onClick()
                  // Close all menus
                  rowRef.current?.dispatchEvent(
                    new MouseEvent('mousedown', { bubbles: true })
                  )
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
