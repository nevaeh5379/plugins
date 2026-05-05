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
import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { VFSNode } from '../lib/virtualFS'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { collectLoreFolders } from '../lib/virtualFS'

import {
  VscFolder,
  VscFolderOpened,
  VscFile,
  VscJson,
  VscBook,
  VscLibrary,
  VscAccount,
  VscComment,
  VscSettingsGear,
  VscTools,
  VscAdd,
  VscNewFolder,
  VscTrash,
  VscEdit,
  VscArrowSwap,
  VscChevronRight,
  VscChevronDown
} from 'react-icons/vsc'

// ─── Event callbacks ─────────────────────────────────────────────────────────

export interface FileExplorerCallbacks {
  onFileSelect: (node: VFSNode) => void
  onAddLoreEntry?: (parentPath: string) => void
  onAddLoreFolder?: (parentPath: string) => void
  onAddGreeting?: () => void
  onDeleteNode?: (path: string, name: string) => void
  onRenameNode?: (path: string, newName: string) => void
  onMoveNode?: (sourcePath: string, targetPath: string) => void
  onReorderNode?: (sourcePath: string, targetPath: string, position: 'before' | 'after') => void
  onDeleteGreeting?: (path: string) => void
}

interface FileExplorerProps extends FileExplorerCallbacks {
  root: VFSNode | null
  selectedPath: string | null
  width?: number
}

// ─── Context Menu State ──────────────────────────────────────────────────────

interface CtxMenuState {
  x: number
  y: number
  items: MenuItem[]
}

// ─── Tree Item ───────────────────────────────────────────────────────────────

interface TreeItemProps {
  node: VFSNode
  root: VFSNode
  depth: number
  selectedPath: string | null
  callbacks: FileExplorerCallbacks
  expandedPaths: Set<string>
  toggleExpand: (path: string) => void
  renamingPath: string | null
  setRenamingPath: (path: string | null) => void
  setCtxMenu: (menu: CtxMenuState | null) => void
  dragSourcePath: string | null
  setDragSourcePath: (path: string | null) => void
  dragOverPath: string | null
  setDragOverPath: (path: string | null) => void
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  root,
  depth,
  selectedPath,
  callbacks,
  expandedPaths,
  toggleExpand,
  renamingPath,
  setRenamingPath,
  setCtxMenu,
  dragSourcePath,
  setDragSourcePath,
  dragOverPath,
  setDragOverPath,
}) => {
  const isDir = node.type === 'directory'
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path
  const isRenaming = renamingPath === node.path
  const isDragging = dragSourcePath === node.path
  const isDragOver = dragOverPath === node.path

  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  const handleClick = () => {
    if (isRenaming) return
    if (isDir) {
      toggleExpand(node.path)
    } else {
      callbacks.onFileSelect(node)
    }
  }

  // ─── Right-click context menus ──────────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const items = buildContextMenuItems(node, root, callbacks, setRenamingPath)
    if (items.length > 0) {
      setCtxMenu({ x: e.clientX, y: e.clientY, items })
    }
  }

  // ─── Rename handlers ───────────────────────────────────────────────────

  const handleRenameSubmit = (newName: string) => {
    if (newName.trim() && newName !== node.name) {
      callbacks.onRenameNode?.(node.path, newName.trim())
    }
    setRenamingPath(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit((e.target as HTMLInputElement).value)
    } else if (e.key === 'Escape') {
      setRenamingPath(null)
    }
  }

  // ─── Drag & Drop handlers ─────────────────────────────────────────────

  const isGlobalLore = node.mapping?.field === 'globalLore'
  const isLorebookRoot = node.name === 'lorebook'
  const isLorebookFolder = isDir && isGlobalLore
  
  const canDrag = isGlobalLore
  // Lorebook root can accept anything; folders can accept files; files can be reorder targets
  const canDrop = isLorebookRoot || isGlobalLore

  const handleDragStart = (e: React.DragEvent) => {
    if (!canDrag) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
    setDragSourcePath(node.path)
    // Optional: add transparency to dragged item
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDragSourcePath(null)
    setDragOverPath(null)
    if (e.target instanceof HTMLElement) e.target.style.opacity = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPath(node.path)
    
    if (isGlobalLore && node.path !== dragSourcePath) {
      const el = e.currentTarget as HTMLElement
      const rect = el.getBoundingClientRect()
      
      // If it's a directory, allow dropping INTO it by using the middle 50%
      // (only for files — folders cannot be nested in RisuAI)
      if (node.type === 'directory') {
        const y = e.clientY - rect.top
        const height = rect.height
        
        // Check if dragging a folder — if so, don't show "drop inside" visual
        const sourceNode = dragSourcePath ? findNodeByPath(root, dragSourcePath) : null
        const isDraggingFolder = sourceNode?.type === 'directory'
        
        if (y < height * 0.25) {
          el.style.borderTop = '2px solid var(--re-accent)';
          el.style.borderBottom = '';
          el.style.backgroundColor = '';
        } else if (y > height * 0.75) {
          el.style.borderBottom = '2px solid var(--re-accent)';
          el.style.borderTop = '';
          el.style.backgroundColor = '';
        } else if (!isDraggingFolder) {
          el.style.borderTop = '';
          el.style.borderBottom = '';
          el.style.backgroundColor = 'var(--re-bg-hover)';
        } else {
          // Dragging a folder over another folder — show reorder indicator instead
          el.style.borderBottom = '2px solid var(--re-accent)';
          el.style.borderTop = '';
          el.style.backgroundColor = '';
        }
      } else {
        // For files, just top/bottom half
        const midY = rect.top + rect.height / 2
        if (e.clientY < midY) {
          el.style.borderTop = '2px solid var(--re-accent)';
          el.style.borderBottom = '';
        } else {
          el.style.borderBottom = '2px solid var(--re-accent)';
          el.style.borderTop = '';
        }
      }
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (dragOverPath === node.path) {
      setDragOverPath(null)
    }
    if (isGlobalLore) {
      const el = e.currentTarget as HTMLElement
      el.style.borderTop = '';
      el.style.borderBottom = '';
      el.style.backgroundColor = '';
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverPath(null)

    if (isGlobalLore) {
      const el = e.currentTarget as HTMLElement
      el.style.borderTop = '';
      el.style.borderBottom = '';
      el.style.backgroundColor = '';
    }

    const sourcePath = e.dataTransfer.getData('text/plain')
    applyDropAction(sourcePath, node, e.currentTarget as HTMLElement, e.clientY, root, callbacks)
  }

  // ─── Touch drag-drop + long-press context menu ───────────────────────────
  // HTML5 drag/drop doesn't fire on touch devices. We replicate it manually
  // and share the drop logic via applyDropAction / buildContextMenuItems.

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchDragModeRef = useRef(false)

  const cancelTouchTimer = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
  }

  const clearDropVisuals = (path: string | null) => {
    if (!path) return
    const el = document.querySelector(`[data-vfs-path="${CSS.escape(path)}"]`) as HTMLElement | null
    if (el) {
      el.style.borderTop = ''
      el.style.borderBottom = ''
      el.style.backgroundColor = ''
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || isRenaming) return
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    touchDragModeRef.current = false

    cancelTouchTimer()
    touchTimerRef.current = setTimeout(() => {
      // Long-press fired without drag → open context menu
      if (touchStartRef.current && !touchDragModeRef.current) {
        const items = buildContextMenuItems(node, root, callbacks, setRenamingPath)
        if (items.length > 0) {
          setCtxMenu({ x: touchStartRef.current.x, y: touchStartRef.current.y, items })
        }
      }
      touchTimerRef.current = null
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    const dist = Math.hypot(dx, dy)

    if (!touchDragModeRef.current && dist > 10) {
      // Movement before long-press fires → cancel menu, attempt drag
      cancelTouchTimer()
      if (canDrag) {
        touchDragModeRef.current = true
        setDragSourcePath(node.path)
      } else {
        // Not draggable — let the browser scroll
        touchStartRef.current = null
        return
      }
    }

    if (touchDragModeRef.current) {
      // Prevent scroll while dragging
      e.preventDefault()

      const targetEl = document
        .elementFromPoint(t.clientX, t.clientY)
        ?.closest('.re-tree-item') as HTMLElement | null
      const targetPath = targetEl?.dataset.vfsPath || null

      if (targetPath !== dragOverPath) {
        clearDropVisuals(dragOverPath)
        setDragOverPath(targetPath)
      }

      if (targetEl && targetPath && targetPath !== node.path) {
        // Mirror the visual logic in handleDragOver
        const rect = targetEl.getBoundingClientRect()
        const targetNode = findNodeByPath(root, targetPath)
        const targetIsGlobalLore = targetNode?.mapping?.field === 'globalLore'
        if (targetIsGlobalLore) {
          if (targetNode!.type === 'directory') {
            const y = t.clientY - rect.top
            const h = rect.height
            const sourceIsFolder = node.type === 'directory'
            if (y < h * 0.25) {
              targetEl.style.borderTop = '2px solid var(--re-accent)'
              targetEl.style.borderBottom = ''
              targetEl.style.backgroundColor = ''
            } else if (y > h * 0.75) {
              targetEl.style.borderBottom = '2px solid var(--re-accent)'
              targetEl.style.borderTop = ''
              targetEl.style.backgroundColor = ''
            } else if (!sourceIsFolder) {
              targetEl.style.borderTop = ''
              targetEl.style.borderBottom = ''
              targetEl.style.backgroundColor = 'var(--re-bg-hover)'
            } else {
              targetEl.style.borderBottom = '2px solid var(--re-accent)'
              targetEl.style.borderTop = ''
              targetEl.style.backgroundColor = ''
            }
          } else {
            const midY = rect.top + rect.height / 2
            if (t.clientY < midY) {
              targetEl.style.borderTop = '2px solid var(--re-accent)'
              targetEl.style.borderBottom = ''
            } else {
              targetEl.style.borderBottom = '2px solid var(--re-accent)'
              targetEl.style.borderTop = ''
            }
          }
        }
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    cancelTouchTimer()

    if (touchDragModeRef.current) {
      const t = e.changedTouches[0]
      const targetEl = document
        .elementFromPoint(t.clientX, t.clientY)
        ?.closest('.re-tree-item') as HTMLElement | null
      const targetPath = targetEl?.dataset.vfsPath
      if (targetEl && targetPath && targetPath !== node.path) {
        const targetNode = findNodeByPath(root, targetPath)
        if (targetNode) {
          applyDropAction(node.path, targetNode, targetEl, t.clientY, root, callbacks)
        }
      }
      clearDropVisuals(dragOverPath)
      setDragSourcePath(null)
      setDragOverPath(null)
    }

    touchStartRef.current = null
    touchDragModeRef.current = false
  }

  const handleTouchCancel = () => {
    cancelTouchTimer()
    if (touchDragModeRef.current) {
      clearDropVisuals(dragOverPath)
      setDragSourcePath(null)
      setDragOverPath(null)
    }
    touchStartRef.current = null
    touchDragModeRef.current = false
  }

  // ─── Icon ──────────────────────────────────────────────────────────────

  const getIcon = () => {
    if (isDir) {
      if (node.icon === 'character') return <VscAccount />
      if (node.icon === 'message') return <VscComment />
      if (node.icon === 'lorebook') return <VscLibrary />
      if (node.icon === 'folder') return isExpanded ? <VscFolderOpened /> : <VscFolder />
      if (node.icon === 'wrench') return <VscTools />
      return isExpanded ? <VscFolderOpened /> : <VscFolder />
    }
    if (node.icon === 'json') return <VscJson />
    if (node.icon === 'book') return <VscBook />
    if (node.icon === 'gear') return <VscSettingsGear />
    return <VscFile />
  }

  // ─── Class computation ─────────────────────────────────────────────────

  let className = 're-tree-item'
  if (isSelected) className += ' selected'
  if (node.dirty) className += ' dirty'
  if (isDragging) className += ' dragging'
  if (isDragOver) className += ' drag-over'

  return (
    <>
      <div
        className={className}
        style={{ '--depth': depth } as React.CSSProperties}
        data-vfs-path={node.path}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.path}
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {isDir && (
          <span className={`re-tree-chevron${isExpanded ? ' open' : ''}`}><VscChevronRight /></span>
        )}
        {!isDir && <span style={{ width: 14 }} />}
        <span className="re-tree-icon">{getIcon()}</span>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="re-tree-rename-input"
            defaultValue={node.name}
            onBlur={(e) => handleRenameSubmit(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="re-tree-name">{node.name}</span>
        )}
      </div>
      {isDir && isExpanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              root={root}
              depth={depth + 1}
              selectedPath={selectedPath}
              callbacks={callbacks}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              renamingPath={renamingPath}
              setRenamingPath={setRenamingPath}
              setCtxMenu={setCtxMenu}
              dragSourcePath={dragSourcePath}
              setDragSourcePath={setDragSourcePath}
              dragOverPath={dragOverPath}
              setDragOverPath={setDragOverPath}
            />
          ))}
        </>
      )}
    </>
  )
}

// ─── File Explorer ───────────────────────────────────────────────────────────

export const FileExplorer: React.FC<FileExplorerProps> = ({
  root,
  selectedPath,
  width,
  ...callbacks
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (root) {
      initial.add(root.path)
      root.children?.forEach((child) => {
        if (child.type === 'directory') {
          initial.add(child.path)
        }
      })
    }
    return initial
  })

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null)
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // ─── Keyboard shortcuts (F2 + Delete) ──────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPath) return

      if (e.key === 'F2') {
        e.preventDefault()
        setRenamingPath(selectedPath)
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (root) {
          const node = findNodeByPath(root, selectedPath)
          if (node && (node.mapping?.field === 'globalLore' || node.mapping?.field === 'alternateGreetings')) {
            callbacks.onDeleteNode?.(node.path, node.name)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPath, root, callbacks])

  if (!root) {
    return (
      <div className="re-sidebar" style={width ? { width, minWidth: width } : undefined}>
        <div className="re-sidebar-header">Explorer</div>
        <div className="re-sidebar-tree">
          <div style={{ padding: '20px 12px', color: 'var(--re-text-muted)', fontSize: '12px' }}>
            No character loaded
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="re-sidebar" style={width ? { width, minWidth: width } : undefined}>
      <div className="re-sidebar-header">Explorer</div>
      <div className="re-sidebar-tree">
        <TreeItem
          node={root}
          root={root}
          depth={0}
          selectedPath={selectedPath}
          callbacks={callbacks}
          expandedPaths={expandedPaths}
          toggleExpand={toggleExpand}
          renamingPath={renamingPath}
          setRenamingPath={setRenamingPath}
          setCtxMenu={setCtxMenu}
          dragSourcePath={dragSourcePath}
          setDragSourcePath={setDragSourcePath}
          dragOverPath={dragOverPath}
          setDragOverPath={setDragOverPath}
        />
      </div>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

// Quick helper to avoid importing findNode from virtualFS in the keyboard handler
function findNodeByPath(root: VFSNode, path: string): VFSNode | null {
  if (root.path === path) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByPath(child, path)
      if (found) return found
    }
  }
  return null
}

// ─── Shared drop logic (used by both mouse drag-drop and touch drag-drop) ──
function applyDropAction(
  sourcePath: string | null | undefined,
  targetNode: VFSNode,
  targetEl: HTMLElement,
  clientY: number,
  root: VFSNode,
  callbacks: FileExplorerCallbacks
) {
  if (!sourcePath || sourcePath === targetNode.path) return
  const targetIsGlobalLore = targetNode.mapping?.field === 'globalLore'
  const targetIsLorebookRoot = targetNode.name === 'lorebook'
  const targetIsDir = targetNode.type === 'directory'

  if (targetIsGlobalLore) {
    const rect = targetEl.getBoundingClientRect()
    if (targetIsDir) {
      const y = clientY - rect.top
      const h = rect.height
      if (y < h * 0.25) {
        callbacks.onReorderNode?.(sourcePath, targetNode.path, 'before')
      } else if (y > h * 0.75) {
        callbacks.onReorderNode?.(sourcePath, targetNode.path, 'after')
      } else {
        const sourceNode = findNodeByPath(root, sourcePath)
        if (sourceNode?.type === 'directory') {
          callbacks.onReorderNode?.(sourcePath, targetNode.path, 'after')
        } else {
          callbacks.onMoveNode?.(sourcePath, targetNode.path)
        }
      }
    } else {
      const midY = rect.top + rect.height / 2
      const position: 'before' | 'after' = clientY < midY ? 'before' : 'after'
      callbacks.onReorderNode?.(sourcePath, targetNode.path, position)
    }
  } else if (targetIsLorebookRoot && targetIsDir) {
    callbacks.onMoveNode?.(sourcePath, targetNode.path)
  }
}

// ─── Shared context-menu builder (mouse right-click + touch long-press) ────
function buildContextMenuItems(
  node: VFSNode,
  root: VFSNode,
  callbacks: FileExplorerCallbacks,
  setRenamingPath: (path: string | null) => void
): MenuItem[] {
  const items: MenuItem[] = []
  const isDir = node.type === 'directory'
  const isLorebookRoot = node.name === 'lorebook'
  const isLorebookFolder = isDir && node.mapping?.field === 'globalLore'
  const isLorebookFile = node.type === 'file' && node.mapping?.field === 'globalLore'
  const isGreetingsDir = node.name === 'alternate_greetings'
  const isGreetingFile = node.type === 'file' && node.mapping?.field === 'alternateGreetings'

  if (isLorebookRoot) {
    items.push({
      label: '새 로어북 추가',
      icon: <VscAdd />,
      onClick: () => callbacks.onAddLoreEntry?.(node.path),
    })
    items.push({
      label: '새 폴더 추가',
      icon: <VscNewFolder />,
      onClick: () => callbacks.onAddLoreFolder?.(node.path),
    })
  }

  if (isLorebookFolder) {
    items.push({
      label: '새 로어북 추가',
      icon: <VscAdd />,
      onClick: () => callbacks.onAddLoreEntry?.(node.path),
    })
  }

  if (isDir && isGreetingsDir) {
    items.push({
      label: '새 인사말 추가',
      icon: <VscAdd />,
      onClick: () => callbacks.onAddGreeting?.(),
    })
  }

  if (isGreetingFile) {
    items.push({
      label: '이 인사말 제거',
      icon: <VscTrash />,
      danger: true,
      onClick: () => callbacks.onDeleteGreeting?.(node.path),
    })
  }

  if (isLorebookFile) {
    items.push({
      label: '제목 바꾸기',
      icon: <VscEdit />,
      shortcut: 'F2',
      onClick: () => setRenamingPath(node.path),
    })
    items.push({
      label: '삭제하기',
      icon: <VscTrash />,
      shortcut: 'Delete',
      danger: true,
      onClick: () => callbacks.onDeleteNode?.(node.path, node.name),
    })

    const folders = collectLoreFolders(root)
    const currentParentPath = node.path.substring(0, node.path.lastIndexOf('/'))
    const moveItems: MenuItem[] = folders
      .filter((f) => f.path !== currentParentPath)
      .map((f) => ({
        label: f.name,
        onClick: () => callbacks.onMoveNode?.(node.path, f.path),
      }))

    if (moveItems.length > 0) {
      items.push({ label: '', divider: true })
      items.push({
        label: '이동',
        icon: <VscArrowSwap />,
        submenu: moveItems,
      })
    }
  }

  if (isDir && node.mapping?.field === 'globalLore') {
    items.push({ label: '', divider: true })
    items.push({
      label: '폴더 이름 바꾸기',
      icon: <VscEdit />,
      shortcut: 'F2',
      onClick: () => setRenamingPath(node.path),
    })
    items.push({
      label: '폴더 삭제하기',
      icon: <VscTrash />,
      shortcut: 'Delete',
      danger: true,
      onClick: () => callbacks.onDeleteNode?.(node.path, node.name),
    })

    const folders = collectLoreFolders(root)
    const moveItems: MenuItem[] = folders
      .filter((f) => f.path !== node.path && f.name === 'lorebook (root)')
      .map((f) => ({
        label: f.name,
        onClick: () => callbacks.onMoveNode?.(node.path, f.path),
      }))

    if (moveItems.length > 0) {
      items.push({
        label: '이동',
        icon: <VscArrowSwap />,
        submenu: moveItems,
      })
    }
  }

  return items
}
