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
import {
  characterToVFS,
  vfsToCharacter,
  findNode,
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

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

const IS_DEV = typeof Risuai === 'undefined' && typeof risuai === 'undefined'

const AUTO_SAVE_DELAY = 1500 // ms

export const App: React.FC = () => {
  const [vfsRoot, setVfsRoot] = useState<VFSNode | null>(null)
  const [originalChar, setOriginalChar] = useState<RisuCharacter | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [openTabs, setOpenTabs] = useState<VFSNode[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const vfsRootRef = useRef(vfsRoot)
  vfsRootRef.current = vfsRoot

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
      setOpenTabs([])
      setActiveTabPath(null)
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

  // Re-load when the user re-opens the editor (e.g. after switching character)
  useEffect(() => {
    const handler = () => { loadData() }
    window.addEventListener('risu-editor:reload', handler)
    return () => window.removeEventListener('risu-editor:reload', handler)
  }, [loadData])

  // ─── File selection ──────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (node: VFSNode) => {
      if (node.type !== 'file') return
      setSelectedPath(node.path)
      setActiveTabPath(node.path)

      // Add to open tabs if not already open
      setOpenTabs((prev) => {
        if (prev.some((t) => t.path === node.path)) return prev
        return [...prev, node]
      })
    },
    []
  )

  // ─── Tab management ──────────────────────────────────────────────────────

  const handleTabSelect = useCallback((path: string) => {
    setActiveTabPath(path)
    setSelectedPath(path)
  }, [])

  const handleTabClose = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const next = prev.filter((t) => t.path !== path)
        if (activeTabPath === path) {
          const closedIndex = prev.findIndex((t) => t.path === path)
          const newActive = next[Math.min(closedIndex, next.length - 1)]
          setActiveTabPath(newActive?.path ?? null)
          setSelectedPath(newActive?.path ?? null)
        }
        return next
      })
    },
    [activeTabPath]
  )

  const handleCloseAll = useCallback(() => {
    setOpenTabs([])
    setActiveTabPath(null)
    setSelectedPath(null)
  }, [])

  const handleCloseOthers = useCallback(
    (path: string) => {
      setOpenTabs((prev) => prev.filter((t) => t.path === path))
      setActiveTabPath(path)
      setSelectedPath(path)
    },
    []
  )

  const handleCloseToLeft = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path)
        const next = prev.slice(idx)
        if (!next.some((t) => t.path === activeTabPath)) {
          setActiveTabPath(path)
          setSelectedPath(path)
        }
        return next
      })
    },
    [activeTabPath]
  )

  const handleCloseToRight = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path)
        const next = prev.slice(0, idx + 1)
        if (!next.some((t) => t.path === activeTabPath)) {
          setActiveTabPath(path)
          setSelectedPath(path)
        }
        return next
      })
    },
    [activeTabPath]
  )

  // ─── Auto-save ──────────────────────────────────────────────────────────

  const performSave = useCallback(async () => {
    if (!vfsRootRef.current || !originalChar || isSavingRef.current) return
    isSavingRef.current = true
    setAutoSaveStatus('saving')

    try {
      const currentRoot = vfsRootRef.current

      // Rebuild globalLore and alternateGreetings from VFS tree
      const updatedChar = vfsToCharacter(currentRoot, originalChar)
      updatedChar.globalLore = rebuildGlobalLoreFromVFS(currentRoot, originalChar)
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
      setOpenTabs((prev) =>
        prev.map((tab) => {
          const updated = findNode(cleanRoot, tab.path)
          return updated || tab
        })
      )

      setAutoSaveStatus('saved')
      setTimeout(() => {
        setAutoSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev))
      }, 2000)
    } catch (err) {
      console.error('[Risu Editor] Auto-save error:', err)
      setAutoSaveStatus('unsaved')
    }

    isSavingRef.current = false
  }, [originalChar])

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
    (value: string) => {
      if (!vfsRoot || !activeTabPath) return

      // Deep clone to trigger re-render
      const newRoot = structuredClone(vfsRoot)
      updateFileContent(newRoot, activeTabPath, value)
      setVfsRoot(newRoot)

      // Update the tab reference
      setOpenTabs((prev) =>
        prev.map((tab) => {
          if (tab.path === activeTabPath) {
            const updatedNode = findNode(newRoot, activeTabPath)
            return updatedNode || tab
          }
          return tab
        })
      )

      scheduleAutoSave()
    },
    [vfsRoot, activeTabPath, scheduleAutoSave]
  )

  // ─── Lorebook operations ──────────────────────────────────────────────────

  const handleAddLoreEntry = useCallback(
    (parentPath: string) => {
      if (!vfsRoot) return
      const newRoot = structuredClone(vfsRoot)
      const count = countLoreEntries(newRoot)
      const newNode = addLoreEntryNode(newRoot, parentPath, count)
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
        setOpenTabs((prev) => {
          const next = prev.filter((t) => t.path !== path)
          if (activeTabPath === path) {
            const closedIndex = prev.findIndex((t) => t.path === path)
            const newActive = next[Math.min(closedIndex, next.length - 1)]
            setActiveTabPath(newActive?.path ?? null)
            setSelectedPath(newActive?.path ?? null)
          }
          return next
        })

        scheduleAutoSave()
      }
    },
    [vfsRoot, activeTabPath, scheduleAutoSave]
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
        setOpenTabs((prev) =>
          prev.map((tab) => {
            if (tab.path === oldPath && renamedNode) return renamedNode
            return tab
          })
        )
        if (activeTabPath === oldPath && renamedNode) {
          setActiveTabPath(renamedNode.path)
          setSelectedPath(renamedNode.path)
        }

        scheduleAutoSave()
      }
    },
    [vfsRoot, activeTabPath, scheduleAutoSave]
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

        setOpenTabs((prev) =>
          prev.map((tab) => {
            if (tab.path === sourcePath && movedNode) return movedNode
            return tab
          })
        )
        if (activeTabPath === sourcePath && movedNode) {
          setActiveTabPath(movedNode.path)
          setSelectedPath(movedNode.path)
        }

        scheduleAutoSave()
      }
    },
    [vfsRoot, activeTabPath, scheduleAutoSave]
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
        setOpenTabs((prev) => {
          const next = prev.filter((t) => t.path !== path)
          if (activeTabPath === path) {
            const closedIndex = prev.findIndex((t) => t.path === path)
            const newActive = next[Math.min(closedIndex, next.length - 1)]
            setActiveTabPath(newActive?.path ?? null)
            setSelectedPath(newActive?.path ?? null)
          }
          return next
        })
        scheduleAutoSave()
      }
    },
    [vfsRoot, activeTabPath, scheduleAutoSave]
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

  const activeFile = activeTabPath && vfsRoot ? findNode(vfsRoot, activeTabPath) : null
  const totalFiles = vfsRoot ? countFiles(vfsRoot) : 0

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
          <span style={{ fontSize: '32px' }}>⚠️</span>
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
        activeFilePath={activeTabPath}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((p) => !p)}
        onClose={handleClose}
        onReload={loadData}
      />
      <div className="re-main">
        <FileExplorer
          root={vfsRoot}
          selectedPath={selectedPath}
          onFileSelect={handleFileSelect}
          onAddLoreEntry={handleAddLoreEntry}
          onAddLoreFolder={handleAddLoreFolder}
          onAddGreeting={handleAddGreeting}
          onDeleteNode={handleDeleteNode}
          onRenameNode={handleRenameNode}
          onMoveNode={handleMoveNode}
          onDeleteGreeting={handleDeleteGreeting}
        />
        <div className="re-editor-area">
          <TabBar
            openTabs={openTabs}
            activeTabPath={activeTabPath}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onCloseAll={handleCloseAll}
            onCloseOthers={handleCloseOthers}
            onCloseToLeft={handleCloseToLeft}
            onCloseToRight={handleCloseToRight}
          />
          {activeFile && activeFile.mapping?.field === 'globalLore' && activeFile.mapping?.index !== undefined ? (
            <LoreEntryEditor
              content={activeFile.content ?? ''}
              filePath={activeTabPath}
              onChange={handleEditorChange}
              showPreview={showPreview}
              characterName={originalChar?.name}
            />
          ) : (
            <EditorPane
              content={activeFile?.content ?? null}
              language={activeFile?.language ?? 'plaintext'}
              filePath={activeTabPath}
              onChange={handleEditorChange}
              showPreview={showPreview}
              characterName={originalChar?.name}
            />
          )}
        </div>
      </div>
      <StatusBar
        filePath={activeTabPath}
        language={activeFile?.language ?? null}
        totalFiles={totalFiles}
        autoSaveStatus={autoSaveStatus}
      />
    </div>
  )
}
