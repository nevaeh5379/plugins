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
/**
 * Virtual File System: maps RisuAI character data to a file tree structure.
 *
 * Each character field becomes a "virtual file" that can be opened and edited
 * in the Monaco editor.
 */

import type { RisuCharacter, LoreBook, CustomScript, LoreSettings } from '../types/risuai.d.ts'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VFSNode {
  /** Display name */
  name: string
  /** Full virtual path (e.g., "/lorebook/entry_name.json") */
  path: string
  /** 'file' or 'directory' */
  type: 'file' | 'directory'
  /** For files: content as string */
  content?: string
  /** For files: editor language id */
  language?: string
  /** For directories: children */
  children?: VFSNode[]
  /** Whether content has been modified */
  dirty?: boolean
  /** Mapping back to character field */
  mapping?: VFSMapping
  /** Icon hint */
  icon?: string
  /** Whether the file is read-only */
  readOnly?: boolean
}

export interface VFSMapping {
  /** Character field name */
  field: string
  /** For array fields, the index */
  index?: number
  /** For lorebook entries, the entry reference */
  loreId?: string
  /** For nested fields */
  subfield?: string
}

// ─── Character → VFS ─────────────────────────────────────────────────────────

function sanitizeFileName(name: string): string {
  // Strip Unicode private-use prefix used internally for folder keys ()
  // so it doesn't end up in display filenames.
  return name
    .replace(/[-]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 50) || 'unnamed'
}

// ─── Lorebook serialization ──────────────────────────────────────────────────

/**
 * Stable key order so the on-disk JSON has a consistent shape regardless of
 * how the source character was constructed.
 */
const LORE_FIELDS: Array<keyof LoreBook> = [
  'comment',
  'key',
  'secondkey',
  'content',
  'mode',
  'alwaysActive',
  'selective',
  'insertorder',
  'activationPercent',
  'useRegex',
  'folder',
  'id',
]

export function serializeLoreEntry(entry: LoreBook): string {
  const out: Record<string, unknown> = {}
  for (const k of LORE_FIELDS) {
    const v = (entry as any)[k]
    if (v === undefined) continue
    out[k] = v
  }
  // Preserve any extra fields we didn't enumerate above
  for (const [k, v] of Object.entries(entry)) {
    if (!(k in out) && v !== undefined) out[k] = v
  }
  return JSON.stringify(out, null, 2)
}

function createTextFile(
  name: string,
  parentPath: string,
  content: string,
  field: string,
  index?: number,
  language = 'markdown'
): VFSNode {
  return {
    name,
    path: `${parentPath}/${name}`,
    type: 'file',
    content: content ?? '',
    language,
    dirty: false,
    mapping: { field, index },
    icon: language === 'json' ? '{ }' : '📄',
  }
}

function buildLoreBookTree(loreEntries: LoreBook[], parentPath: string): VFSNode[] {
  const children: VFSNode[] = []

  // Folders are identified by mode === 'folder'. Children reference their
  // parent folder via the parent's `key` field (NOT id) — RisuAI generates
  // folder keys as 'folder:<uuid>' (see lorebook.svelte.ts:addLorebookFolder)
  // and child entries store that key verbatim in their `folder` field
  // (see LoreBookData.svelte). So the lookup must be folder.key → child.folder.
  const folderMap = new Map<string, VFSNode>()
  const usedNames = new Set<string>()

  const uniqueName = (base: string): string => {
    let name = base
    let n = 2
    while (usedNames.has(name)) {
      name = `${base}_${n++}`
    }
    usedNames.add(name)
    return name
  }

  for (let i = 0; i < loreEntries.length; i++) {
    const folder = loreEntries[i]
    if (folder.mode !== 'folder') continue
    const baseName = sanitizeFileName(folder.comment || `folder_${i}`)
    const folderName = uniqueName(baseName)
    const folderPath = `${parentPath}/${folderName}`
    const folderNode: VFSNode = {
      name: folderName,
      path: folderPath,
      type: 'directory',
      children: [],
      icon: '📂',
      mapping: { field: 'globalLore', index: i },
    }
    if (folder.key) folderMap.set(folder.key, folderNode)
    children.push(folderNode)
  }

  // Non-folder entries: write each as a markdown file with frontmatter.
  for (let i = 0; i < loreEntries.length; i++) {
    const entry = loreEntries[i]
    if (entry.mode === 'folder') continue

    const entryBase = sanitizeFileName(entry.comment || entry.key || `entry_${i}`) + '.json'
    const entryName = uniqueName(entryBase)
    const entryContent = serializeLoreEntry(entry)

    const targetFolder = entry.folder ? folderMap.get(entry.folder) : undefined

    const entryNode: VFSNode = {
      name: entryName,
      path: targetFolder
        ? `${targetFolder.path}/${entryName}`
        : `${parentPath}/${entryName}`,
      type: 'file',
      content: entryContent,
      language: 'json',
      dirty: false,
      mapping: { field: 'globalLore', index: i, loreId: entry.id },
      icon: '📖',
    }

    if (targetFolder) {
      targetFolder.children!.push(entryNode)
    } else {
      children.push(entryNode)
    }
  }

  return children
}

export function characterToVFS(char: RisuCharacter): VFSNode {
  const rootName = sanitizeFileName(char.name || 'Character')
  const rootPath = `/${rootName}`

  const root: VFSNode = {
    name: rootName,
    path: rootPath,
    type: 'directory',
    children: [],
    icon: '👤',
  }

  // ── Text fields as markdown files ──
  const textFields: [string, string, string][] = [
    ['system_prompt.md', char.systemPrompt, 'systemPrompt'],
    ['first_message.md', char.firstMessage, 'firstMessage'],
    ['description.md', char.desc, 'desc'],
    ['personality.md', char.personality, 'personality'],
    ['scenario.md', char.scenario, 'scenario'],
    ['example_messages.md', char.exampleMessage, 'exampleMessage'],
    ['post_history.md', char.postHistoryInstructions, 'postHistoryInstructions'],
    ['creator_notes.md', char.creatorNotes, 'creatorNotes'],
    ['additional_text.md', char.additionalText, 'additionalText'],
    ['global_note.md', char.replaceGlobalNote, 'replaceGlobalNote'],
  ]

  if (char.translatorNote) {
    textFields.push(['translator_note.md', char.translatorNote, 'translatorNote'])
  }
  if (char.notes) {
    textFields.push(['notes.md', char.notes, 'notes'])
  }

  for (const [fileName, content, field] of textFields) {
    if (content !== undefined) {
      root.children!.push(createTextFile(fileName, rootPath, content, field))
    }
  }

  // ── Alternate greetings ──
  if (char.alternateGreetings && char.alternateGreetings.length > 0) {
    const greetingsDir: VFSNode = {
      name: 'alternate_greetings',
      path: `${rootPath}/alternate_greetings`,
      type: 'directory',
      children: [],
      icon: '💬',
    }
    for (let i = 0; i < char.alternateGreetings.length; i++) {
      greetingsDir.children!.push(
        createTextFile(
          `greeting_${i}.md`,
          greetingsDir.path,
          char.alternateGreetings[i],
          'alternateGreetings',
          i
        )
      )
    }
    root.children!.push(greetingsDir)
  }

  // ── Lorebook ──
  const lorebookDir: VFSNode = {
    name: 'lorebook',
    path: `${rootPath}/lorebook`,
    type: 'directory',
    children: [],
    icon: '📚',
  }

  // Lore settings
  if (char.loreSettings) {
    lorebookDir.children!.push({
      name: '_settings.json',
      path: `${rootPath}/lorebook/_settings.json`,
      type: 'file',
      content: JSON.stringify(char.loreSettings, null, 2),
      language: 'json',
      dirty: false,
      mapping: { field: 'loreSettings' },
      icon: '⚙️',
    })
  }

  if (char.globalLore && char.globalLore.length > 0) {
    lorebookDir.children!.push(...buildLoreBookTree(char.globalLore, lorebookDir.path))
  }
  root.children!.push(lorebookDir)

  // ── Regex scripts ──
  if (char.customscript && char.customscript.length > 0) {
    const regexDir: VFSNode = {
      name: 'regex',
      path: `${rootPath}/regex`,
      type: 'directory',
      children: [],
      icon: '🔧',
    }
    for (let i = 0; i < char.customscript.length; i++) {
      const script = char.customscript[i]
      const scriptName = sanitizeFileName(script.comment || `regex_${i}`) + '.json'
      regexDir.children!.push({
        name: scriptName,
        path: `${rootPath}/regex/${scriptName}`,
        type: 'file',
        content: JSON.stringify(script, null, 2),
        language: 'json',
        dirty: false,
        mapping: { field: 'customscript', index: i },
        icon: '{ }',
      })
    }
    root.children!.push(regexDir)
  }

  // ── Settings (metadata) ──
  const settingsData = {
    name: char.name,
    tags: char.tags,
    creator: char.creator,
    characterVersion: char.characterVersion,
    viewScreen: char.viewScreen,
    utilityBot: char.utilityBot,
    removedQuotes: char.removedQuotes,
    bias: char.bias,
    firstMsgIndex: char.firstMsgIndex,
    supaMemory: char.supaMemory,
    lorePlus: char.lorePlus,
    nickname: char.nickname,
    license: char.license,
  }
  root.children!.push({
    name: 'settings.json',
    path: `${rootPath}/settings.json`,
    type: 'file',
    content: JSON.stringify(settingsData, null, 2),
    language: 'json',
    dirty: false,
    mapping: { field: '_settings' },
    icon: '⚙️',
  })

  return root
}

// ─── VFS → Character ─────────────────────────────────────────────────────────

function collectAllFiles(node: VFSNode): VFSNode[] {
  if (node.type === 'file') return [node]
  const files: VFSNode[] = []
  for (const child of node.children || []) {
    files.push(...collectAllFiles(child))
  }
  return files
}

export function vfsToCharacter(
  vfsRoot: VFSNode,
  originalChar: RisuCharacter
): RisuCharacter {
  const char = structuredClone(originalChar)
  const allFiles = collectAllFiles(vfsRoot)

  for (const file of allFiles) {
    if (!file.mapping || !file.dirty) continue
    const { field, index } = file.mapping
    const content = file.content ?? ''

    switch (field) {
      // Simple text fields
      case 'systemPrompt':
      case 'firstMessage':
      case 'desc':
      case 'personality':
      case 'scenario':
      case 'exampleMessage':
      case 'postHistoryInstructions':
      case 'creatorNotes':
      case 'additionalText':
      case 'replaceGlobalNote':
      case 'translatorNote':
      case 'notes':
        ;(char as any)[field] = content
        break

      // Alternate greetings
      case 'alternateGreetings':
        if (index !== undefined) {
          if (!char.alternateGreetings) char.alternateGreetings = []
          char.alternateGreetings[index] = content
        }
        break

      // Lorebook entries (JSON, possibly edited via form UI or raw)
      case 'globalLore':
        if (index !== undefined && char.globalLore[index]) {
          try {
            const parsed = JSON.parse(content) as Partial<LoreBook>
            char.globalLore[index] = {
              ...char.globalLore[index],
              ...parsed,
            }
          } catch {
            // Invalid JSON — skip rather than corrupt the entry.
          }
        }
        break

      // Lorebook settings
      case 'loreSettings':
        try {
          char.loreSettings = JSON.parse(content) as LoreSettings
        } catch {
          // Invalid JSON, skip
        }
        break

      // Custom scripts
      case 'customscript':
        if (index !== undefined) {
          try {
            const parsed = JSON.parse(content) as CustomScript
            char.customscript[index] = parsed
          } catch {
            // Invalid JSON, skip
          }
        }
        break

      // Settings metadata
      case '_settings':
        try {
          const settings = JSON.parse(content)
          if (settings.name) char.name = settings.name
          if (settings.tags) char.tags = settings.tags
          if (settings.creator) char.creator = settings.creator
          if (settings.characterVersion) char.characterVersion = settings.characterVersion
          if (settings.viewScreen) char.viewScreen = settings.viewScreen
          if (settings.utilityBot !== undefined) char.utilityBot = settings.utilityBot
          if (settings.removedQuotes !== undefined) char.removedQuotes = settings.removedQuotes
          if (settings.bias) char.bias = settings.bias
          if (settings.firstMsgIndex !== undefined) char.firstMsgIndex = settings.firstMsgIndex
          if (settings.supaMemory !== undefined) char.supaMemory = settings.supaMemory
          if (settings.lorePlus !== undefined) char.lorePlus = settings.lorePlus
          if (settings.nickname !== undefined) char.nickname = settings.nickname
          if (settings.license !== undefined) char.license = settings.license
        } catch {
          // Invalid JSON, skip
        }
        break
    }
  }

  return char
}

// ─── Utility functions ───────────────────────────────────────────────────────

export function findNode(root: VFSNode, path: string): VFSNode | null {
  if (root.path === path) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, path)
      if (found) return found
    }
  }
  return null
}

export function findParentNode(root: VFSNode, path: string): VFSNode | null {
  if (root.children) {
    for (const child of root.children) {
      if (child.path === path) return root
      const found = findParentNode(child, path)
      if (found) return found
    }
  }
  return null
}

export function getModifiedFiles(root: VFSNode): VFSNode[] {
  const files = collectAllFiles(root)
  return files.filter((f) => f.dirty)
}

export function countFiles(root: VFSNode): number {
  return collectAllFiles(root).length
}

export function updateFileContent(root: VFSNode, path: string, content: string): boolean {
  const node = findNode(root, path)
  if (node && node.type === 'file') {
    node.content = content
    node.dirty = true
    return true
  }
  return false
}

// ─── Node manipulation ──────────────────────────────────────────────────────

/** Generate a simple unique id */
function generateId(): string {
  return 'lore_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8)
}

/**
 * Add a new lorebook entry node under a given parent directory.
 * Returns the newly created node path.
 */
export function addLoreEntryNode(
  root: VFSNode,
  parentPath: string,
  existingLoreCount: number,
  folderKey?: string
): VFSNode | null {
  const parent = findNode(root, parentPath)
  if (!parent || parent.type !== 'directory') return null

  const id = generateId()
  const entryIndex = existingLoreCount
  const baseName = `new_entry_${entryIndex}.json`
  const entryPath = `${parentPath}/${baseName}`

  const newEntry: LoreBook = {
    key: '',
    secondkey: '',
    insertorder: 100,
    comment: `New Entry ${entryIndex}`,
    content: '',
    mode: folderKey ? 'child' : 'normal',
    alwaysActive: false,
    selective: false,
    id,
    ...(folderKey ? { folder: folderKey } : {}),
  }

  const node: VFSNode = {
    name: baseName,
    path: entryPath,
    type: 'file',
    content: serializeLoreEntry(newEntry),
    language: 'json',
    dirty: true,
    mapping: { field: 'globalLore', index: entryIndex, loreId: id },
    icon: '📖',
  }

  parent.children = parent.children || []
  parent.children.push(node)
  return node
}

/**
 * Add a new lorebook folder node under a given parent directory.
 */
export function addLoreFolderNode(
  root: VFSNode,
  parentPath: string,
  existingLoreCount: number
): VFSNode | null {
  const parent = findNode(root, parentPath)
  if (!parent || parent.type !== 'directory') return null

  const id = generateId()
  const folderIndex = existingLoreCount
  const folderName = `new_folder_${folderIndex}`
  const folderPath = `${parentPath}/${folderName}`

  const node: VFSNode = {
    name: folderName,
    path: folderPath,
    type: 'directory',
    children: [],
    icon: '📂',
    dirty: true,
    mapping: { field: 'globalLore', index: folderIndex },
  }

  parent.children = parent.children || []
  parent.children.push(node)
  return node
}

/**
 * Add a new alternate greeting node.
 */
export function addGreetingNode(
  root: VFSNode,
  greetingsDirPath: string,
  greetingIndex: number
): VFSNode | null {
  let parent = findNode(root, greetingsDirPath)

  // If the greetings directory doesn't exist, create it
  if (!parent) {
    const rootNode = root
    parent = {
      name: 'alternate_greetings',
      path: greetingsDirPath,
      type: 'directory',
      children: [],
      icon: '💬',
    }
    rootNode.children = rootNode.children || []
    // Insert before lorebook
    const loreIdx = rootNode.children.findIndex(
      (c) => c.name === 'lorebook'
    )
    if (loreIdx >= 0) {
      rootNode.children.splice(loreIdx, 0, parent)
    } else {
      rootNode.children.push(parent)
    }
  }

  const baseName = `greeting_${greetingIndex}.md`
  const node: VFSNode = {
    name: baseName,
    path: `${greetingsDirPath}/${baseName}`,
    type: 'file',
    content: '',
    language: 'markdown',
    dirty: true,
    mapping: { field: 'alternateGreetings', index: greetingIndex },
  }

  parent.children = parent.children || []
  parent.children.push(node)
  return node
}

/**
 * Delete a node from the VFS tree.
 * Returns true if the node was found and deleted.
 */
export function deleteNode(root: VFSNode, path: string): boolean {
  const parent = findParentNode(root, path)
  if (!parent || !parent.children) return false
  const idx = parent.children.findIndex((c) => c.path === path)
  if (idx === -1) return false
  parent.children.splice(idx, 1)
  return true
}

/**
 * Rename a node (updates name, path, and all children paths recursively).
 */
export function renameNode(root: VFSNode, path: string, newName: string): boolean {
  const node = findNode(root, path)
  if (!node) return false

  const parent = findParentNode(root, path)
  if (!parent) return false

  const parentPath = parent.path
  const oldPath = node.path
  node.name = newName
  node.path = `${parentPath}/${newName}`
  node.dirty = true

  // Update children paths recursively
  const updateChildPaths = (n: VFSNode, oldBase: string, newBase: string) => {
    if (n.children) {
      for (const child of n.children) {
        child.path = child.path.replace(oldBase, newBase)
        updateChildPaths(child, oldBase, newBase)
      }
    }
  }

  if (node.type === 'directory') {
    updateChildPaths(node, oldPath, node.path)
  }

  return true
}

/**
 * Move a node to a different parent directory.
 */
export function moveNode(root: VFSNode, sourcePath: string, targetDirPath: string): boolean {
  const node = findNode(root, sourcePath)
  if (!node) return false

  const targetDir = findNode(root, targetDirPath)
  if (!targetDir || targetDir.type !== 'directory') return false

  // Don't move into self or descendant
  if (targetDirPath.startsWith(sourcePath)) return false

  // Remove from old parent
  const oldParent = findParentNode(root, sourcePath)
  if (!oldParent || !oldParent.children) return false
  const idx = oldParent.children.findIndex((c) => c.path === sourcePath)
  if (idx === -1) return false
  oldParent.children.splice(idx, 1)

  // Update paths
  const oldPath = node.path
  node.path = `${targetDirPath}/${node.name}`
  node.dirty = true

  const updateChildPaths = (n: VFSNode, oldBase: string, newBase: string) => {
    if (n.children) {
      for (const child of n.children) {
        child.path = child.path.replace(oldBase, newBase)
        updateChildPaths(child, oldBase, newBase)
      }
    }
  }

  if (node.type === 'directory') {
    updateChildPaths(node, oldPath, node.path)
  }

  // Update folder reference for lorebook entries
  if (node.mapping?.field === 'globalLore' && targetDir.mapping?.field === 'globalLore') {
    // Moving into a lorebook folder — update the folder reference in the JSON
    if (node.type === 'file' && node.content) {
      try {
        const parsed = JSON.parse(node.content) as Partial<LoreBook>
        // The folder key is typically the folder entry's `key` field or its `id`
        // We look at the target folder's mapping to find the right key
        const targetFolderNode = targetDir
        const folderLoreIndex = targetFolderNode.mapping?.index
        if (folderLoreIndex !== undefined) {
          // We'll set a placeholder; vfsToCharacter rebuild will handle it
          parsed.folder = targetDir.mapping?.loreId || targetDir.name
          parsed.mode = 'child'
          node.content = JSON.stringify(parsed, null, 2)
        }
      } catch { /* skip */ }
    }
  } else if (node.mapping?.field === 'globalLore' && node.type === 'file') {
    // Moving to lorebook root — remove folder reference
    try {
      const parsed = JSON.parse(node.content!) as Partial<LoreBook>
      delete parsed.folder
      if (parsed.mode === 'child') parsed.mode = 'normal'
      node.content = JSON.stringify(parsed, null, 2)
      node.dirty = true
    } catch { /* skip */ }
  }

  targetDir.children = targetDir.children || []
  targetDir.children.push(node)
  return true
}

/**
 * Collect all lorebook folder paths for the move-to submenu.
 */
export function collectLoreFolders(root: VFSNode): { name: string; path: string }[] {
  const folders: { name: string; path: string }[] = []

  const walk = (node: VFSNode) => {
    if (
      node.type === 'directory' &&
      node.mapping?.field === 'globalLore'
    ) {
      folders.push({ name: node.name, path: node.path })
    }
    // Also include the lorebook root directory
    if (node.type === 'directory' && node.name === 'lorebook') {
      // Only add if not already included via mapping
      if (!folders.some((f) => f.path === node.path)) {
        folders.push({ name: '📚 lorebook (root)', path: node.path })
      }
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child)
      }
    }
  }

  walk(root)
  return folders
}

/**
 * Count total lorebook entries (files + folders) for index assignment.
 */
export function countLoreEntries(root: VFSNode): number {
  const lorebookDir = root.children?.find((c) => c.name === 'lorebook')
  if (!lorebookDir) return 0

  let count = 0
  const walk = (node: VFSNode) => {
    if (node.mapping?.field === 'globalLore') count++
    if (node.children) node.children.forEach(walk)
  }
  // Count within lorebook dir children (not the dir itself)
  lorebookDir.children?.forEach(walk)
  return count
}

/**
 * Rebuild the globalLore array from the VFS tree structure.
 * This handles additions, deletions, and reorderings.
 */
export function rebuildGlobalLoreFromVFS(root: VFSNode, originalChar: RisuCharacter): LoreBook[] {
  const lorebookDir = root.children?.find((c) => c.name === 'lorebook')
  if (!lorebookDir || !lorebookDir.children) return originalChar.globalLore

  const loreEntries: LoreBook[] = []
  const folderKeyMap = new Map<string, string>() // folderPath -> folderKey

  // First pass: collect folder entries
  const processFolders = (children: VFSNode[]) => {
    for (const child of children) {
      if (child.type === 'directory' && child.mapping?.field === 'globalLore') {
        const originalIndex = child.mapping.index
        let folderEntry: LoreBook
        if (originalIndex !== undefined && originalChar.globalLore[originalIndex]) {
          folderEntry = { ...originalChar.globalLore[originalIndex] }
          // Override comment if renamed
          if (child.dirty) {
            folderEntry.comment = child.name
          }
        } else {
          // New folder
          folderEntry = {
            key: 'folder:' + generateId(),
            secondkey: '',
            insertorder: 100,
            comment: child.name,
            content: '',
            mode: 'folder',
            alwaysActive: false,
            selective: false,
            id: generateId(),
          }
        }
        folderKeyMap.set(child.path, folderEntry.key)
        loreEntries.push(folderEntry)

        // Process children of this folder
        if (child.children) {
          for (const fc of child.children) {
            if (fc.type === 'file' && fc.mapping?.field === 'globalLore') {
              processLoreFile(fc, folderEntry.key)
            }
          }
        }
      }
    }
  }

  const processLoreFile = (node: VFSNode, folderKey?: string) => {
    if (!node.content) return
    try {
      const parsed = JSON.parse(node.content) as LoreBook
      if (folderKey) {
        parsed.folder = folderKey
        if (parsed.mode !== 'child') parsed.mode = 'child'
      } else {
        delete parsed.folder
      }
      loreEntries.push(parsed)
    } catch {
      // If JSON is invalid, try to preserve the original
      const originalIndex = node.mapping?.index
      if (originalIndex !== undefined && originalChar.globalLore[originalIndex]) {
        loreEntries.push(originalChar.globalLore[originalIndex])
      }
    }
  }

  // Process lorebook children: folders first, then root-level files
  const folders = lorebookDir.children.filter(
    (c) => c.type === 'directory' && c.mapping?.field === 'globalLore'
  )
  const rootFiles = lorebookDir.children.filter(
    (c) => c.type === 'file' && c.mapping?.field === 'globalLore'
  )

  processFolders(folders)
  for (const file of rootFiles) {
    processLoreFile(file)
  }

  return loreEntries
}

/**
 * Rebuild alternateGreetings from VFS tree.
 */
export function rebuildGreetingsFromVFS(root: VFSNode): string[] {
  const greetingsDir = root.children?.find((c) => c.name === 'alternate_greetings')
  if (!greetingsDir || !greetingsDir.children) return []

  return greetingsDir.children
    .filter((c) => c.type === 'file' && c.mapping?.field === 'alternateGreetings')
    .sort((a, b) => (a.mapping?.index ?? 0) - (b.mapping?.index ?? 0))
    .map((c) => c.content ?? '')
}
