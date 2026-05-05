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

    const items: MenuItem[] = []

    // Lorebook directory (root or folder)
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

      // Move-to submenu
      const folders = collectLoreFolders(root)
      const moveItems: MenuItem[] = folders
        .filter((f) => {
          // Don't show current parent
          const currentParentPath = node.path.substring(0, node.path.lastIndexOf('/'))
          return f.path !== currentParentPath
        })
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
      // Lorebook folder — rename/delete/move
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

      // Move-to submenu for folders (only to lorebook root — RisuAI no nested folders)
      const folders = collectLoreFolders(root)
      const moveItems: MenuItem[] = folders
        .filter((f) => {
          // Only allow moving to lorebook root (not into other folders)
          return f.path !== node.path && f.name === 'lorebook (root)'
        })
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
    if (sourcePath && sourcePath !== node.path) {
      if (isGlobalLore) {
        const el = e.currentTarget as HTMLElement
        const rect = el.getBoundingClientRect()
        
        if (node.type === 'directory') {
          const y = e.clientY - rect.top
          const height = rect.height
          
          if (y < height * 0.25) {
            callbacks.onReorderNode?.(sourcePath, node.path, 'before')
          } else if (y > height * 0.75) {
            callbacks.onReorderNode?.(sourcePath, node.path, 'after')
          } else {
            // Drop inside — move into this folder (files only; folders cannot nest)
            // Check if source is a folder — if so, reorder instead of nesting
            const sourceNode = findNodeByPath(root, sourcePath)
            if (sourceNode?.type === 'directory') {
              // Folders cannot be nested — reorder after instead
              callbacks.onReorderNode?.(sourcePath, node.path, 'after')
            } else {
              callbacks.onMoveNode?.(sourcePath, node.path)
            }
          }
        } else {
          const midY = rect.top + rect.height / 2
          const position = e.clientY < midY ? 'before' : 'after'
          callbacks.onReorderNode?.(sourcePath, node.path, position)
        }
      } 
      else if (isDir) {
        // Dropping on the lorebook root dir
        callbacks.onMoveNode?.(sourcePath, node.path)
      }
    }
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
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.path}
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
