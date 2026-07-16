import React, { useCallback, useEffect, useRef, useState } from 'react'
import { VscChromeClose, VscChromeMaximize, VscChromeRestore, VscSave } from 'react-icons/vsc'
import { UniversalEditor } from './components/editors/UniversalEditor'
import { SettingsProvider } from './lib/settingsContext'
import './styles/editor.css'

export interface EditorRequest {
  id: number
  title: string
  value: string
  language: string
  save(value: string): void | Promise<void>
}

interface Rect { x: number; y: number; width: number; height: number }

const initialRect = (id: number): Rect => {
  const width = Math.min(900, Math.max(420, window.innerWidth - 80))
  const height = Math.min(680, Math.max(320, window.innerHeight - 100))
  const offset = ((id - 1) % 8) * 24
  return {
    x: Math.max(16, Math.min((window.innerWidth - width) / 2 + offset, window.innerWidth - 160)),
    y: Math.max(16, Math.min((window.innerHeight - height) / 2 + offset, window.innerHeight - 80)),
    width, height,
  }
}

const EditorWindow: React.FC<{
  request: EditorRequest
  active: boolean
  zIndex: number
  onFocus(): void
  onClose(): void
}> = ({ request, active, zIndex, onFocus, onClose }) => {
  const [value, setValue] = useState(request.value)
  const [savedValue, setSavedValue] = useState(request.value)
  const [saving, setSaving] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [rect, setRect] = useState<Rect>(() => initialRect(request.id))
  const restoreRect = useRef<Rect | null>(null)
  const drag = useRef<{ x: number; y: number; rect: Rect } | null>(null)
  const resize = useRef<{ x: number; y: number; rect: Rect } | null>(null)
  const dirty = value !== savedValue

  useEffect(() => {
    setValue(request.value)
    setSavedValue(request.value)
  }, [request])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await request.save(value)
      setSavedValue(value)
    } finally {
      setSaving(false)
    }
  }, [request, value])

  const close = useCallback(() => {
    if (dirty && !window.confirm('저장하지 않은 변경사항을 버리고 닫을까요?')) return
    onClose()
  }, [dirty, onClose])

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!active) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [active, save, close])

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (drag.current) {
        const nextX = drag.current.rect.x + event.clientX - drag.current.x
        const nextY = drag.current.rect.y + event.clientY - drag.current.y
        setRect((current) => ({ ...current, x: Math.max(0, Math.min(nextX, window.innerWidth - 120)), y: Math.max(0, Math.min(nextY, window.innerHeight - 36)) }))
      }
      if (resize.current) {
        setRect((current) => ({
          ...current,
          width: Math.max(360, Math.min(resize.current!.rect.width + event.clientX - resize.current!.x, window.innerWidth - current.x)),
          height: Math.max(240, Math.min(resize.current!.rect.height + event.clientY - resize.current!.y, window.innerHeight - current.y)),
        }))
      }
    }
    const up = () => { drag.current = null; resize.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [])

  const toggleMaximize = () => {
    if (maximized) {
      if (restoreRect.current) setRect(restoreRect.current)
      setMaximized(false)
    } else {
      restoreRect.current = rect
      setMaximized(true)
    }
  }

  const style: React.CSSProperties = maximized
    ? { inset: 8, width: 'auto', height: 'auto', zIndex }
    : { left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex }

  return (
    <div className={`re-vscode-window${active ? ' active' : ''}`} style={style} onMouseDown={onFocus}>
      <header
        className="re-window-titlebar"
        onMouseDown={(event) => {
          if (event.button !== 0 || maximized || (event.target as Element).closest('button')) return
          drag.current = { x: event.clientX, y: event.clientY, rect }
          event.preventDefault()
        }}
        onDoubleClick={toggleMaximize}
      >
        <div className="re-window-brand"><span className="re-vscode-mark">&lt;/&gt;</span><span>Risu Editor</span></div>
        <div className="re-window-title">{request.title}{dirty ? ' •' : ''}</div>
        <div className="re-window-actions">
          <button onClick={() => void save()} disabled={!dirty || saving} title="저장 (Ctrl+S)"><VscSave /></button>
          <button onClick={toggleMaximize} title={maximized ? '이전 크기' : '최대화'}>{maximized ? <VscChromeRestore /> : <VscChromeMaximize />}</button>
          <button className="re-close" onClick={close} title="닫기"><VscChromeClose /></button>
        </div>
      </header>
      <div className="re-editor-tab"><span>{request.title}</span>{dirty && <i />}</div>
      <div className="re-editor-body">
        <UniversalEditor content={value} language={request.language} filePath={`${request.id}-${request.title}`} onChange={setValue} />
      </div>
      <footer className="re-statusbar"><span>{saving ? '저장 중…' : dirty ? '수정됨' : '저장됨'}</span><span>{request.language} · UTF-8</span></footer>
      {!maximized && <div className="re-resize-handle" onMouseDown={(event) => { resize.current = { x: event.clientX, y: event.clientY, rect }; event.preventDefault() }} />}
    </div>
  )
}

export const App: React.FC<{
  requests: EditorRequest[]
  onClose(id: number): void
}> = ({ requests, onClose }) => {
  const [order, setOrder] = useState<number[]>([])

  useEffect(() => {
    setOrder((current) => {
      const live = current.filter((id) => requests.some((request) => request.id === id))
      for (const request of requests) if (!live.includes(request.id)) live.push(request.id)
      return live
    })
  }, [requests])

  if (requests.length === 0) return null
  const focus = (id: number) => setOrder((current) => [...current.filter((item) => item !== id), id])
  const activeId = order[order.length - 1] ?? requests[requests.length - 1]?.id

  return <SettingsProvider>{requests.map((request) => {
    const index = order.indexOf(request.id)
    return <EditorWindow
      key={request.id}
      request={request}
      active={request.id === activeId}
      zIndex={100 + (index < 0 ? requests.indexOf(request) : index)}
      onFocus={() => focus(request.id)}
      onClose={() => onClose(request.id)}
    />
  })}</SettingsProvider>
}
