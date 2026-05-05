import React, { useState, useEffect } from 'react'
import { useSettings } from '../../lib/settingsContext'
import { MonacoEditorWrapper } from './MonacoEditorWrapper'
import { CodeMirrorWrapper } from './CodeMirrorWrapper'
import { AceEditorWrapper } from './AceEditorWrapper'
import { SimpleEditorWrapper } from './SimpleEditorWrapper'

interface UniversalEditorProps {
  content: string
  language: string
  filePath: string
  onChange: (value: string) => void
}

export const UniversalEditor: React.FC<UniversalEditorProps> = (props) => {
  const { settings } = useSettings()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const currentEditorType = isMobile ? settings.mobileEditor : settings.desktopEditor

  const renderEditor = () => {
    switch (currentEditorType) {
      case 'monaco':
        return <MonacoEditorWrapper {...props} fontSize={settings.fontSize} />
      case 'codemirror':
        return <CodeMirrorWrapper {...props} fontSize={settings.fontSize} />
      case 'ace':
        return <AceEditorWrapper {...props} fontSize={settings.fontSize} />
      case 'simple':
        return <SimpleEditorWrapper {...props} fontSize={settings.fontSize} />
      default:
        // fallback
        return <CodeMirrorWrapper {...props} fontSize={settings.fontSize} />
    }
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderEditor()}
    </div>
  )
}
