import React, { useCallback } from 'react'
import AceEditor from 'react-ace'
import { useSettings } from '../../lib/settingsContext'

// Import Ace Editor modules dynamically or just standard ones
import 'ace-builds/src-noconflict/mode-json'
import 'ace-builds/src-noconflict/mode-markdown'
import 'ace-builds/src-noconflict/mode-javascript'
import 'ace-builds/src-noconflict/mode-text'
import 'ace-builds/src-noconflict/theme-twilight'
import 'ace-builds/src-noconflict/theme-github'

interface EditorWrapperProps {
  content: string
  language: string
  filePath: string
  fontSize: number
  onChange: (value: string) => void
}

export const AceEditorWrapper: React.FC<EditorWrapperProps> = ({
  content,
  language,
  fontSize,
  onChange,
}) => {
  const { settings } = useSettings()

  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  let mode = 'text'
  if (language === 'json') mode = 'json'
  else if (language === 'markdown') mode = 'markdown'
  else if (language === 'javascript' || language === 'typescript') mode = 'javascript'

  const aceTheme = settings.theme === 'risu-light' ? 'github' : 'twilight'

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <AceEditor
        mode={mode}
        theme={aceTheme}
        onChange={handleChange}
        value={content}
        name="ace-editor"
        editorProps={{ $blockScrolling: true }}
        fontSize={fontSize}
        width="100%"
        height="100%"
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          showLineNumbers: true,
          tabSize: 2,
        }}
      />
    </div>
  )
}
