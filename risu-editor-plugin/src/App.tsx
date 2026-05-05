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
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { FileExplorer } from './components/FileExplorer'
import { TabBar } from './components/TabBar'
import { EditorPane } from './components/EditorPane'
import { LoreEntryEditor } from './components/LoreEntryEditor'
import { Toolbar } from './components/Toolbar'
import { StatusBar } from './components/StatusBar'
import { VscWarning } from 'react-icons/vsc'
import {
  characterToVFS,
  vfsToCharacter,
  findNode,
  findParentNode,
  getModifiedFiles,
  countFiles,
  updateFileContent,
  addLoreEntryNode,
  addLoreFolderNode,
  addGreetingNode,
  deleteNode,
  renameNode,
  moveNode,
  countLoreEntries,
  rebuildGlobalLoreFromVFS,
  rebuildGreetingsFromVFS,
  type VFSNode,
} from './lib/virtualFS'
import {
  loadCharacter,
  saveCharacter,
  hideEditor,
  getMockCharacter,
} from './lib/risuaiAdapter'
import type { RisuCharacter } from './types/risuai.d.ts'
import './styles/editor.css'

import { SettingsProvider, useSettings } from './lib/settingsContext'
import { SettingsModal } from './components/SettingsModal'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

const IS_DEV = typeof Risuai === 'undefined' && typeof risuai === 'undefined'

const AUTO_SAVE_DELAY = 1500 // ms

// Keep in sync with editor.css media queries and UniversalEditor.tsx.
const MOBILE_BREAKPOINT = 768

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  )
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isMobile
}

const ThemeManager: React.FC = () => {
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'risu-light') {
      // Basic light theme mapped to our variables
      root.style.setProperty('--re-bg-editor', '#FFFFFF');
      root.style.setProperty('--re-bg-sidebar', '#F3F3F3');
      root.style.setProperty('--re-bg-titlebar', '#DDDDDD');
      root.style.setProperty('--re-bg-statusbar', '#0078D4');
      root.style.setProperty('--re-bg-tab-active', '#FFFFFF');
      root.style.setProperty('--re-bg-tab-inactive', '#ECECEC');
      root.style.setProperty('--re-bg-input', '#FFFFFF');
      root.style.setProperty('--re-bg-hover', '#E5E5E5');
      root.style.setProperty('--re-bg-selected', '#0078D4');
      root.style.setProperty('--re-fg', '#333333');
      root.style.setProperty('--re-fg-bright', '#000000');
      root.style.setProperty('--re-fg-muted', '#666666');
      root.style.setProperty('--re-fg-dim', '#999999');
      root.style.setProperty('--re-accent', '#0078D4');
      root.style.setProperty('--re-accent-hover', '#005A9E');
      root.style.setProperty('--re-border', '#CCCCCC');
      root.style.setProperty('--re-border-strong', '#AAAAAA');
    } else if (settings.theme === 'custom') {
      const ct = settings.customTheme;
      root.style.setProperty('--re-bg-editor', ct.bgEditor);
      root.style.setProperty('--re-bg-sidebar', ct.bgSidebar);
      root.style.setProperty('--re-bg-titlebar', ct.bgTitlebar);
      root.style.setProperty('--re-bg-statusbar', ct.bgStatusbar);
      root.style.setProperty('--re-bg-tab-active', ct.bgTabActive);
      root.style.setProperty('--re-bg-tab-inactive', ct.bgTabInactive);
      root.style.setProperty('--re-bg-input', ct.bgInput);
      root.style.setProperty('--re-bg-hover', ct.bgHover);
      root.style.setProperty('--re-bg-selected', ct.bgSelected);
      root.style.setProperty('--re-fg', ct.fg);
      root.style.setProperty('--re-fg-bright', ct.fgBright);
      root.style.setProperty('--re-fg-muted', ct.fgMuted);
      root.style.setProperty('--re-fg-dim', ct.fgDim);
      root.style.setProperty('--re-accent', ct.accent);
      root.style.setProperty('--re-accent-hover', ct.accentHover);
      root.style.setProperty('--re-border', ct.border);
      root.style.setProperty('--re-border-strong', ct.borderStrong);
    } else {
      // reset to original CSS (risu-dark)
      root.style.removeProperty('--re-bg-editor');
      root.style.removeProperty('--re-bg-sidebar');
      root.style.removeProperty('--re-bg-titlebar');
      root.style.removeProperty('--re-bg-statusbar');
      root.style.removeProperty('--re-bg-tab-active');
      root.style.removeProperty('--re-bg-tab-inactive');
      root.style.removeProperty('--re-bg-input');
      root.style.removeProperty('--re-bg-hover');
      root.style.removeProperty('--re-bg-selected');
      root.style.removeProperty('--re-fg');
      root.style.removeProperty('--re-fg-bright');
      root.style.removeProperty('--re-fg-muted');
      root.style.removeProperty('--re-fg-dim');
      root.style.removeProperty('--re-accent');
      root.style.removeProperty('--re-accent-hover');
      root.style.removeProperty('--re-border');
      root.style.removeProperty('--re-border-strong');
    }
  }, [settings.theme, settings.customTheme]);

  return null;
}

const AppContent: React.FC = () => {
  const [vfsRoot, setVfsRoot] = useState<VFSNode | null>(null)
  const [originalChar, setOriginalChar] = useState<RisuCharacter | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  interface EditorPaneData {
    id: string
    openTabs: VFSNode[]
    activeTabPath: string | null
  }
  const [panes, setPanes] = useState<EditorPaneData[]>([
    { id: 'pane-1', openTabs: [], activeTabPath: null }
  ])
  const [activePaneId, setActivePaneId] = useState<string>('pane-1')
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const isResizingSidebar = useRef(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()

  // Close mobile sidebar on orientation change so the layout doesn't get
  // stranded in a half-open state when the user rotates their device.
  useEffect(() => {
    if (!isMobile) return
    const close = () => setSidebarOpen(false)
    const orient = window.screen?.orientation
    if (orient && 'addEventListener' in orient) {
      orient.addEventListener('change', close)
    } else {
      window.addEventListener('orientationchange', close)
    }
    return () => {
      if (orient && 'removeEventListener' in orient) {
        orient.removeEventListener('change', close)
      } else {
        window.removeEventListener('orientationchange', close)
      }
    }
  }, [isMobile])

  const vfsRootRef = useRef(vfsRoot)
  vfsRootRef.current = vfsRoot

  const originalCharRef = useRef(originalChar)
  originalCharRef.current = originalChar

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  // ─── Load character ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let char: RisuCharacter | null
      if (IS_DEV) {
        char = getMockCharacter()
      } else {
        char = await loadCharacter()
      }

      if (!char) {
        setError('No character selected. Please select a character first.')
        setLoading(false)
        return
      }

      setOriginalChar(char)
      const vfs = characterToVFS(char)
      setVfsRoot(vfs)
      setPanes([{ id: 'pane-1', openTabs: [], activeTabPath: null }])
      setActivePaneId('pane-1')
      setSelectedPath(null)
      setAutoSaveStatus('idle')
    } catch (err) {
      setError(`Failed to load character: ${err}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const handler = () => { loadData() }
    window.addEventListener('risu-editor:reload', handler)
    return () => window.removeEventListener('risu-editor:reload', handler)
  }, [loadData])

  useEffect(() => {
    if (panes.length > 0 && !panes.some(p => p.id === activePaneId)) {
      setActivePaneId(panes[0].id)
    }
  }, [panes, activePaneId])

  // ─── File selection ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (node: VFSNode) => {
      if (node.type !== 'file') return
      setSelectedPath(node.path)

      setPanes(prev => prev.map(pane => {
        if (pane.id === activePaneId) {
          const alreadyOpen = pane.openTabs.some((t) => t.path === node.path)
          return {
            ...pane,
            activeTabPath: node.path,
            openTabs: alreadyOpen ? pane.openTabs : [...pane.openTabs, node]
          }
        }
        return pane
      }))

      if (isMobile) setSidebarOpen(false)
    },
    [activePaneId, isMobile]
  )

  // ─── Tab management ──────────────────────────────────────────────────────

  const handleTabSelect = useCallback((paneId: string, path: string) => {
    setActivePaneId(paneId)
    setSelectedPath(path)
    setPanes(prev => prev.map(p => p.id === paneId ? { ...p, activeTabPath: path } : p))
  }, [])

  const handleTabClose = useCallback(
    (paneId: string, path: string) => {
      setPanes(prev => {
        const nextPanes = prev.map(pane => {
          if (pane.id !== paneId) return pane
          const nextTabs = pane.openTabs.filter((t) => t.path !== path)
          let newActive = pane.activeTabPath
          if (pane.activeTabPath === path) {
            const closedIndex = pane.openTabs.findIndex((t) => t.path === path)
            const nextActiveTab = nextTabs[Math.min(closedIndex, nextTabs.length - 1)]
            newActive = nextActiveTab?.path ?? null
          }
          return { ...pane, openTabs: nextTabs, activeTabPath: newActive }
        })
        return nextPanes.filter(p => p.openTabs.length > 0 || nextPanes.length === 1)
      })
    },
    []
  )

  const handleTabReorder = useCallback((paneId: string, dragPath: string, dropPath: string) => {
    setPanes(prev => prev.map(pane => {
      if (pane.id !== paneId) return pane
      const sourceIdx = pane.openTabs.findIndex(t => t.path === dragPath)
      const targetIdx = pane.openTabs.findIndex(t => t.path === dropPath)
      if (sourceIdx < 0 || targetIdx < 0) return pane
      const newTabs = [...pane.openTabs]
      const [movedTab] = newTabs.splice(sourceIdx, 1)
      newTabs.splice(targetIdx, 0, movedTab)
      return { ...pane, openTabs: newTabs }
    }))
  }, [])

  const handleSplitPane = useCallback((paneId: string, nodeToOpen?: VFSNode) => {
    setPanes(prev => {
      const sourcePane = prev.find(p => p.id === paneId)
      if (!sourcePane) return prev
      const newPaneId = `pane-${Date.now()}`
      let initialTabs: VFSNode[] = []
      let initialActivePath: string | null = null
      
      if (nodeToOpen) {
        initialTabs = [nodeToOpen]
        initialActivePath = nodeToOpen.path
      } else if (sourcePane.activeTabPath && vfsRootRef.current) {
        const activeNode = findNode(vfsRootRef.current, sourcePane.activeTabPath)
        if (activeNode) {
          initialTabs = [activeNode]
          initialActivePath = activeNode.path
        }
      }
      
      const newPane: EditorPaneData = { id: newPaneId, openTabs: initialTabs, activeTabPath: initialActivePath }
      const paneIndex = prev.findIndex(p => p.id === paneId)
      const nextPanes = [...prev]
      nextPanes.splice(paneIndex + 1, 0, newPane)
      setActivePaneId(newPaneId)
      return nextPanes
    })
  }, [])

  const handleCloseAll = useCallback((paneId: string) => {
    setPanes(prev => {
      const nextPanes = prev.map(pane => pane.id === paneId ? { ...pane, openTabs: [], activeTabPath: null } : pane)
      return nextPanes.filter(p => p.openTabs.length > 0 || nextPanes.length === 1)
    })
  }, [])

  const handleCloseOthers = useCallback(
    (paneId: string, path: string) => {
      setPanes(prev => prev.map(pane => {
        if (pane.id !== paneId) return pane
        return { ...pane, openTabs: pane.openTabs.filter((t) => t.path === path), activeTabPath: path }
      }))
    },
    []
  )

  const handleCloseToLeft = useCallback(
    (paneId: string, path: string) => {
      setPanes(prev => {
        const nextPanes = prev.map(pane => {
          if (pane.id !== paneId) return pane
          const idx = pane.openTabs.findIndex((t) => t.path === path)
          const next = pane.openTabs.slice(idx)
          let newActive = pane.activeTabPath
          if (!next.some((t) => t.path === newActive)) newActive = path
          return { ...pane, openTabs: next, activeTabPath: newActive }
        })
        return nextPanes.filter(p => p.openTabs.length > 0 || nextPanes.length === 1)
      })
    },
    []
  )

  const handleCloseToRight = useCallback(
    (paneId: string, path: string) => {
      setPanes(prev => {
        const nextPanes = prev.map(pane => {
          if (pane.id !== paneId) return pane
          const idx = pane.openTabs.findIndex((t) => t.path === path)
          const next = pane.openTabs.slice(0, idx + 1)
          let newActive = pane.activeTabPath
          if (!next.some((t) => t.path === newActive)) newActive = path
          return { ...pane, openTabs: next, activeTabPath: newActive }
        })
        return nextPanes.filter(p => p.openTabs.length > 0 || nextPanes.length === 1)
      })
    },
    []
  )

  // ─── Auto-save ──────────────────────────────────────────────────────────

  const performSave = useCallback(async () => {
    const currentRoot = vfsRootRef.current
    const currentOriginalChar = originalCharRef.current
    if (!currentRoot || !currentOriginalChar || isSavingRef.current) return
    isSavingRef.current = true
    setAutoSaveStatus('saving')

    try {
      // Rebuild globalLore and alternateGreetings from VFS tree
      const updatedChar = vfsToCharacter(currentRoot, currentOriginalChar)
      updatedChar.globalLore = rebuildGlobalLoreFromVFS(currentRoot)
      updatedChar.alternateGreetings = rebuildGreetingsFromVFS(currentRoot)

      if (IS_DEV) {
        console.log('[Risu Editor] Would auto-save:', updatedChar)
        await new Promise((r) => setTimeout(r, 300))
      } else {
        const success = await saveCharacter(updatedChar)
        if (!success) throw new Error('Save failed')
      }

      setOriginalChar(updatedChar)

      // Reset dirty flags
      const cleanRoot = structuredClone(currentRoot)
      const resetDirty = (node: VFSNode) => {
        node.dirty = false
        node.children?.forEach(resetDirty)
      }
      resetDirty(cleanRoot)
      setVfsRoot(cleanRoot)

      // Update tab references
      setPanes(prev => prev.map(pane => ({
        ...pane,
        openTabs: pane.openTabs.map(tab => findNode(cleanRoot, tab.path) || tab)
      })))

      setAutoSaveStatus('saved')
      setTimeout(() => {
        setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev))
      }, 2000)
    } catch (err) {
      console.error('[Risu Editor] Auto-save error:', err)
      setAutoSaveStatus('unsaved')
    }

    isSavingRef.current = false
  }, [])

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    setAutoSaveStatus('unsaved')
    autoSaveTimerRef.current = setTimeout(() => {
      performSave()
    }, AUTO_SAVE_DELAY)
  }, [performSave])

  // Cleanup auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // ─── Editor changes ──────────────────────────────────────────────────────

  const handleEditorChange = useCallback(
    (path: string, value: string) => {
      if (!vfsRoot) return

      const newRoot = structuredClone(vfsRoot)
      updateFileContent(newRoot, path, value)
      setVfsRoot(newRoot)

      setPanes(prev => prev.map(pane => ({
        ...pane,
        openTabs: pane.openTabs.map(tab => {
          if (tab.path === path) return findNode(newRoot, path) || tab
          return tab
        })
      })))

      scheduleAutoSave()
    },
    [vfsRoot, scheduleAutoSave]
  )

  // ─── Lorebook operations ──────────────────────────────────────────────────

  const handleAddLoreEntry = useCallback(
    (parentPath: string) => {
      if (!vfsRoot) return
      const newRoot = structuredClone(vfsRoot)
      const count = countLoreEntries(newRoot)

      // If parent is a lorebook folder, extract its folderKey for the child reference
      const parentNode = findNode(newRoot, parentPath)
      const folderKey =
        parentNode?.mapping?.field === 'globalLore' && parentNode.type === 'directory'
          ? parentNode.mapping.folderKey
          : undefined

      const newNode = addLoreEntryNode(newRoot, parentPath, count, folderKey)
      if (newNode) {
        setVfsRoot(newRoot)
        scheduleAutoSave()
        // Open the new entry
        handleFileSelect(newNode)
      }
    },
    [vfsRoot, scheduleAutoSave, handleFileSelect]
  )

  const handleAddLoreFolder = useCallback(
    (parentPath: string) => {
      if (!vfsRoot) return
      const newRoot = structuredClone(vfsRoot)
      const count = countLoreEntries(newRoot)
      addLoreFolderNode(newRoot, parentPath, count)
      setVfsRoot(newRoot)
      scheduleAutoSave()
    },
    [vfsRoot, scheduleAutoSave]
  )

  const handleDeleteNode = useCallback(
    (path: string, name: string) => {
      if (!vfsRoot) return
      const confirmed = window.confirm(`"${name}" 을(를) 삭제하시겠습니까?`)
      if (!confirmed) return

      const newRoot = structuredClone(vfsRoot)
      if (deleteNode(newRoot, path)) {
        setVfsRoot(newRoot)

        // Close tab if open
        setPanes(prev => prev.map(pane => {
          const next = pane.openTabs.filter((t) => t.path !== path)
          let newActive = pane.activeTabPath
          if (newActive === path) {
            const closedIndex = pane.openTabs.findIndex((t) => t.path === path)
            const nextActiveTab = next[Math.min(closedIndex, next.length - 1)]
            newActive = nextActiveTab?.path ?? null
          }
          return { ...pane, openTabs: next, activeTabPath: newActive }
        }))

        scheduleAutoSave()
      }
    },
    [vfsRoot, scheduleAutoSave]
  )

  const handleRenameNode = useCallback(
    (path: string, newName: string) => {
      if (!vfsRoot) return
      const newRoot = structuredClone(vfsRoot)
      if (renameNode(newRoot, path, newName)) {
        // Update active paths
        const oldPath = path
        const node = findNode(newRoot, path) // won't find it — path changed
        // Find by new name: need parent path
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'))
        const renamedNode = findNode(newRoot, `${parentPath}/${newName}`)

        setVfsRoot(newRoot)

        // Update tabs and selections that referenced old path
        setPanes(prev => prev.map(pane => {
          const newTabs = pane.openTabs.map(tab => {
            if (tab.path === oldPath && renamedNode) return renamedNode
            return tab
          })
          let newActive = pane.activeTabPath
          if (newActive === oldPath && renamedNode) newActive = renamedNode.path
          return { ...pane, openTabs: newTabs, activeTabPath: newActive }
        }))

        scheduleAutoSave()
      }
    },
    [vfsRoot, scheduleAutoSave]
  )

  const handleMoveNode = useCallback(
    (sourcePath: string, targetPath: string) => {
      if (!vfsRoot) return
      const newRoot = structuredClone(vfsRoot)
      if (moveNode(newRoot, sourcePath, targetPath)) {
        setVfsRoot(newRoot)

        // Update tabs — old paths are now invalid
        const sourceNode = findNode(newRoot, sourcePath)
        const sourceName = sourcePath.substring(sourcePath.lastIndexOf('/') + 1)
        const movedNode = findNode(newRoot, `${targetPath}/${sourceName}`)

        setPanes(prev => prev.map(pane => {
          const newTabs = pane.openTabs.map(tab => {
            if (tab.path === sourcePath && movedNode) return movedNode
            return tab
          })
          let newActive = pane.activeTabPath
          if (newActive === sourcePath && movedNode) newActive = movedNode.path
          return { ...pane, openTabs: newTabs, activeTabPath: newActive }
        }))

        scheduleAutoSave()
      }
    },
    [vfsRoot, scheduleAutoSave]
  )
  // ─── Reorder operations ──────────────────────────────────────────────────
  const handleReorderNode = useCallback(
    (sourcePath: string, targetPath: string, position: 'before' | 'after') => {
      if (!vfsRoot) return

      const newRoot = structuredClone(vfsRoot)
      const sourceNode = findNode(newRoot, sourcePath)
      const targetNode = findNode(newRoot, targetPath)

      if (!sourceNode || !targetNode) return
      if (sourceNode.mapping?.field !== 'globalLore' || targetNode.mapping?.field !== 'globalLore') return

      // Find the common parent (both must be siblings in the same directory)
      const sourceParent = findParentNode(newRoot, sourcePath)
      const targetParent = findParentNode(newRoot, targetPath)
      if (!sourceParent || !targetParent || sourceParent.path !== targetParent.path) return
      if (!sourceParent.children) return

      const siblings = sourceParent.children
      const sourceIdx = siblings.findIndex((c: VFSNode) => c.path === sourcePath)
      const targetIdx = siblings.findIndex((c: VFSNode) => c.path === targetPath)
      if (sourceIdx === -1 || targetIdx === -1) return

      // Remove source from its current position
      const [moved] = siblings.splice(sourceIdx, 1)

      // Calculate insertion index after removal
      let insertIdx = targetIdx
      if (sourceIdx < targetIdx) insertIdx -= 1
      if (position === 'after') insertIdx += 1

      siblings.splice(insertIdx, 0, moved)

      setVfsRoot(newRoot)

      // Update tab references
      setPanes(prev => prev.map(pane => {
        const newTabs = pane.openTabs.map(tab => {
          return findNode(newRoot, tab.path) || tab
        })
        return { ...pane, openTabs: newTabs }
      }))

      scheduleAutoSave()
    },
    [vfsRoot, scheduleAutoSave]
  )
  // ─── Greeting operations ──────────────────────────────────────────────────

  const handleAddGreeting = useCallback(() => {
    if (!vfsRoot) return
    const newRoot = structuredClone(vfsRoot)

    // Find or create alternate_greetings directory
    const greetingsDir = newRoot.children?.find((c) => c.name === 'alternate_greetings')
    const greetingsDirPath = greetingsDir?.path || `${newRoot.path}/alternate_greetings`
    const existingCount = greetingsDir?.children?.length ?? 0

    const newNode = addGreetingNode(newRoot, greetingsDirPath, existingCount)
    if (newNode) {
      setVfsRoot(newRoot)
      scheduleAutoSave()
      handleFileSelect(newNode)
    }
  }, [vfsRoot, scheduleAutoSave, handleFileSelect])

  const handleDeleteGreeting = useCallback(
    (path: string) => {
      if (!vfsRoot) return
      const confirmed = window.confirm('이 인사말을 삭제하시겠습니까?')
      if (!confirmed) return

      const newRoot = structuredClone(vfsRoot)
      if (deleteNode(newRoot, path)) {
        setVfsRoot(newRoot)
        setPanes(prev => prev.map(pane => {
          const next = pane.openTabs.filter((t) => t.path !== path)
          let newActive = pane.activeTabPath
          if (newActive === path) {
            const closedIndex = pane.openTabs.findIndex((t) => t.path === path)
            const nextActiveTab = next[Math.min(closedIndex, next.length - 1)]
            newActive = nextActiveTab?.path ?? null
          }
          return { ...pane, openTabs: next, activeTabPath: newActive }
        }))
        scheduleAutoSave()
      }
    },
    [vfsRoot, scheduleAutoSave]
  )

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        // Immediate save (cancel pending auto-save)
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current)
          autoSaveTimerRef.current = null
        }
        performSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [performSave])

  // ─── Close ───────────────────────────────────────────────────────────────

  const handleClose = useCallback(async () => {
    const modifiedFiles = vfsRoot ? getModifiedFiles(vfsRoot) : []
    if (modifiedFiles.length > 0) {
      const confirmed = window.confirm(
        `You have ${modifiedFiles.length} unsaved change(s). Close without saving?`
      )
      if (!confirmed) return
    }
    if (!IS_DEV) {
      await hideEditor()
    }
  }, [vfsRoot])

  // ─── Computed values ─────────────────────────────────────────────────────

  const totalFiles = vfsRoot ? countFiles(vfsRoot) : 0

  // Resizer mouse handlers
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingSidebar.current = true
    document.body.style.cursor = 'col-resize'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSidebar.current) return
      let newWidth = moveEvent.clientX
      if (newWidth < 150) newWidth = 150
      if (newWidth > 600) newWidth = 600
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizingSidebar.current = false
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const getActiveFileForPane = (pane: EditorPaneData) => {
    return pane.activeTabPath && vfsRoot ? findNode(vfsRoot, pane.activeTabPath) : null
  }

  // ─── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="re-app">
        <div className="re-loading">
          <div className="re-spinner" />
          <span>Loading character data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="re-app">
        <div className="re-error-box">
          <span style={{ fontSize: '32px' }}><VscWarning /></span>
          <span>{error}</span>
          <button className="re-btn re-btn-primary" onClick={loadData}>
            Retry
          </button>
          {!IS_DEV && (
            <button className="re-btn" onClick={handleClose}>
              Close
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="re-app re-fade-in">
      <Toolbar
        characterName={originalChar?.name ?? ''}
        autoSaveStatus={autoSaveStatus}
        activeFilePath={panes.find(p => p.id === activePaneId)?.activeTabPath || null}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((p) => !p)}
        onClose={handleClose}
        onReload={loadData}
        onSplitPane={() => handleSplitPane(activePaneId)}
        onSave={performSave}
        onCloseAll={() => handleCloseAll(activePaneId)}
        onOpenSettings={() => setShowSettings(true)}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <div className="re-main">
        <div className={`re-sidebar-wrapper${sidebarOpen ? ' re-sidebar-open' : ''}`}>
          <FileExplorer
            root={vfsRoot}
            selectedPath={selectedPath}
            width={sidebarWidth}
            onFileSelect={handleFileSelect}
            onAddLoreEntry={handleAddLoreEntry}
            onAddLoreFolder={handleAddLoreFolder}
            onAddGreeting={handleAddGreeting}
            onDeleteNode={handleDeleteNode}
            onRenameNode={handleRenameNode}
            onMoveNode={handleMoveNode}
            onReorderNode={handleReorderNode}
            onDeleteGreeting={handleDeleteGreeting}
          />
        </div>
        <div className="re-sidebar-resizer" onMouseDown={handleSidebarMouseDown} />
        {isMobile && sidebarOpen && (
          <div className="re-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        <div className="re-editor-panes-container">
          {(isMobile
            ? panes.filter(p => p.id === activePaneId).length > 0
              ? panes.filter(p => p.id === activePaneId)
              : panes.slice(0, 1)
            : panes
          ).map(pane => {
            const activeFile = getActiveFileForPane(pane)
            return (
              <div key={pane.id} className="re-editor-pane-group" onClickCapture={() => setActivePaneId(pane.id)}>
                <TabBar
                  paneId={pane.id}
                  openTabs={pane.openTabs}
                  activeTabPath={pane.activeTabPath}
                  onTabSelect={handleTabSelect}
                  onTabClose={handleTabClose}
                  onTabReorder={handleTabReorder}
                  onSplitPane={handleSplitPane}
                  onCloseAll={handleCloseAll}
                  onCloseOthers={handleCloseOthers}
                  onCloseToLeft={handleCloseToLeft}
                  onCloseToRight={handleCloseToRight}
                />
                {activeFile && activeFile.mapping?.field === 'globalLore' && activeFile.mapping?.index !== undefined ? (
                  <LoreEntryEditor
                    content={activeFile.content ?? ''}
                    filePath={pane.activeTabPath!}
                    onChange={(val) => handleEditorChange(pane.activeTabPath!, val)}
                    showPreview={showPreview}
                    characterName={originalChar?.name}
                  />
                ) : (
                  <EditorPane
                    content={activeFile?.content ?? null}
                    language={activeFile?.language ?? 'plaintext'}
                    filePath={pane.activeTabPath}
                    onChange={(val) => pane.activeTabPath && handleEditorChange(pane.activeTabPath, val)}
                    showPreview={showPreview}
                    characterName={originalChar?.name}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <StatusBar
        filePath={panes.find(p => p.id === activePaneId)?.activeTabPath || null}
        language={getActiveFileForPane(panes.find(p => p.id === activePaneId) || panes[0])?.language ?? null}
        totalFiles={totalFiles}
        autoSaveStatus={autoSaveStatus}
      />
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ThemeManager />
      <AppContent />
    </SettingsProvider>
  )
}
