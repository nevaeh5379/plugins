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
import React, { useRef, useCallback, useEffect } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { PreviewPane } from './PreviewPane'

interface EditorPaneProps {
  content: string | null
  language: string
  filePath: string | null
  onChange: (value: string) => void
  showPreview?: boolean
  characterName?: string
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  content,
  language,
  filePath,
  onChange,
  showPreview = false,
  characterName,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    editor.focus()
  }, [])

  const handleChange: OnChange = useCallback(
    (value) => {
      if (value !== undefined) {
        onChange(value)
      }
    },
    [onChange]
  )

  // Update editor content when file path changes
  useEffect(() => {
    if (editorRef.current && content !== null) {
      const currentModel = editorRef.current.getModel()
      if (currentModel) {
        const currentValue = currentModel.getValue()
        if (currentValue !== content) {
          editorRef.current.setValue(content)
        }
      }
    }
  }, [filePath]) // eslint-disable-line react-hooks/exhaustive-deps

  if (content === null || filePath === null) {
    return (
      <div className="re-editor-pane">
        <div className="re-editor-empty">
          <div className="re-editor-empty-icon">📝</div>
          <div className="re-editor-empty-text">Risu Editor</div>
          <div className="re-editor-empty-hint">
            Select a file from the explorer to start editing
          </div>
        </div>
      </div>
    )
  }

  const isPreviewable = language === 'markdown' || filePath.endsWith('.md')

  const editorContent = (
    <div className="re-editor-pane">
      <Editor
        key={filePath}
        defaultValue={content}
        language={language}
        theme="risu-dark"
        onChange={handleChange}
        onMount={handleMount}
        options={{
          fontSize: 14,
          lineHeight: 22,
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingStrategy: 'advanced',
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          suggest: {
            showWords: false,
          },
        }}
        loading={
          <div className="re-loading">
            <div className="re-spinner" />
            <span>Loading editor...</span>
          </div>
        }
      />
    </div>
  )

  if (showPreview && isPreviewable) {
    return (
      <div className="re-editor-split">
        {editorContent}
        <PreviewPane content={content} characterName={characterName} />
      </div>
    )
  }

  return editorContent
}
