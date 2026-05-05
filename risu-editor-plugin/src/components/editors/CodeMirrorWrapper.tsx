import React, { useCallback, useMemo } from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { useSettings } from '../../lib/settingsContext'

interface EditorWrapperProps {
  content: string
  language: string
  filePath: string
  fontSize: number
  onChange: (value: string) => void
}

export const CodeMirrorWrapper: React.FC<EditorWrapperProps> = ({
  content,
  fontSize,
  onChange,
}) => {
  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  const { settings } = useSettings()

  return (
    <div style={{ fontSize: `${fontSize}px`, height: '100%', overflow: 'auto', background: settings.theme === 'custom' ? settings.customTheme.bgEditor : 'var(--re-bg-editor)' }}>
      <CodeMirror
        value={content}
        height="100%"
        theme={settings.theme === 'risu-light' ? 'light' : 'dark'}
        onChange={handleChange}
        extensions={[EditorView.lineWrapping]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
      />
    </div>
  )
}
