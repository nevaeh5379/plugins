import React, { useRef, useCallback, useEffect } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

import { useSettings } from '../../lib/settingsContext'

interface EditorWrapperProps {
  content: string
  language: string
  filePath: string
  fontSize: number
  onChange: (value: string) => void
}

export const MonacoEditorWrapper: React.FC<EditorWrapperProps> = ({
  content,
  language,
  filePath,
  fontSize,
  onChange,
}) => {
  const { settings } = useSettings()

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
  }, [filePath, content])

  return (
    <Editor
      key={filePath}
      defaultValue={content}
      language={language}
      theme={settings.theme === 'risu-light' ? 'light' : 'risu-dark'}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize: fontSize,
        lineHeight: fontSize * 1.5,
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
        suggest: { showWords: false },
      }}
      loading={
        <div className="re-loading">
          <div className="re-spinner" />
          <span>Loading Monaco Editor...</span>
        </div>
      }
    />
  )
}
