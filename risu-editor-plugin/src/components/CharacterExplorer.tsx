import React, { useMemo, useState } from 'react'
import {
  VscAccount, VscBook, VscChevronDown, VscChevronRight, VscCode,
  VscFile, VscFolder, VscFolderOpened, VscJson, VscRefresh,
} from 'react-icons/vsc'
import type { VFSNode } from '../lib/virtualFS'

function iconFor(node: VFSNode, open: boolean) {
  if (node.type === 'directory') return open ? <VscFolderOpened /> : <VscFolder />
  if (node.icon === 'book') return <VscBook />
  if (node.icon === 'character') return <VscAccount />
  if (node.language === 'json') return <VscJson />
  if (node.language === 'javascript' || node.language === 'lua') return <VscCode />
  return <VscFile />
}

const TreeNode: React.FC<{
  node: VFSNode
  depth: number
  selected: string | null
  expanded: Set<string>
  onToggle(path: string): void
  onOpen(node: VFSNode): void
}> = ({ node, depth, selected, expanded, onToggle, onOpen }) => {
  const open = expanded.has(node.path)
  return <>
    <button
      className={`re-explorer-row${selected === node.path ? ' active' : ''}`}
      style={{ paddingLeft: 8 + depth * 13 }}
      onClick={() => node.type === 'directory' ? onToggle(node.path) : onOpen(node)}
      title={node.name}
    >
      <span className="re-explorer-chevron">{node.type === 'directory' ? open ? <VscChevronDown /> : <VscChevronRight /> : null}</span>
      <span className="re-explorer-icon">{iconFor(node, open)}</span>
      <span>{node.name}</span>
    </button>
    {node.type === 'directory' && open && node.children?.map((child) => (
      <TreeNode key={child.path} node={child} depth={depth + 1} selected={selected} expanded={expanded} onToggle={onToggle} onOpen={onOpen} />
    ))}
  </>
}

export const CharacterExplorer: React.FC<{
  root: VFSNode | null
  loading: boolean
  onOpen(node: VFSNode): void
  onRefresh(): void
  onNative(): void
}> = ({ root, loading, onOpen, onRefresh, onNative }) => {
  const initialExpanded = useMemo(() => new Set(root ? [root.path] : []), [root])
  const [expanded, setExpanded] = useState(initialExpanded)
  const [selected, setSelected] = useState<string | null>(null)
  const toggle = (path: string) => setExpanded((current) => {
    const next = new Set(current)
    next.has(path) ? next.delete(path) : next.add(path)
    return next
  })
  const open = (node: VFSNode) => { setSelected(node.path); onOpen(node) }

  return <aside className="re-character-explorer">
    <header className="re-explorer-header">
      <div><strong>CHARACTER</strong><span>{root?.name ?? 'No character'}</span></div>
      <button onClick={onRefresh} title="새로고침"><VscRefresh /></button>
    </header>
    <div className="re-explorer-section-title"><span>OPEN EDITORS</span><small>파일을 눌러 창으로 엽니다</small></div>
    <div className="re-explorer-tree">
      {loading ? <div className="re-explorer-empty">캐릭터를 불러오는 중…</div>
        : root ? <TreeNode node={root} depth={0} selected={selected} expanded={expanded} onToggle={toggle} onOpen={open} />
          : <div className="re-explorer-empty">선택된 캐릭터가 없습니다.</div>}
    </div>
    <footer className="re-explorer-footer"><button onClick={onNative}>기본 캐릭터 UI로 돌아가기</button></footer>
  </aside>
}
