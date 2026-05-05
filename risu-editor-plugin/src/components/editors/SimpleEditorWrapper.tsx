import React, { useCallback } from 'react'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/themes/prism-twilight.css'

interface EditorWrapperProps {
  content: string
  language: string
  filePath: string
  fontSize: number
  onChange: (value: string) => void
}

export const SimpleEditorWrapper: React.FC<EditorWrapperProps> = ({
  content,
  language,
  fontSize,
  onChange,
}) => {
  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  let lang = Prism.languages.text
  if (language === 'json' && Prism.languages.json) lang = Prism.languages.json
  else if (language === 'markdown' && Prism.languages.markdown) lang = Prism.languages.markdown
  else if ((language === 'javascript' || language === 'typescript') && Prism.languages.javascript) lang = Prism.languages.javascript

  return (
    <div style={{ height: '100%', overflow: 'auto', background: 'var(--re-bg-editor)' }}>
      <Editor
        value={content}
        onValueChange={handleChange}
        highlight={code => Prism.highlight(code, lang, language)}
        padding={15}
        style={{
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontSize: fontSize,
          color: 'var(--re-fg)',
          minHeight: '100%',
        }}
      />
    </div>
  )
}
