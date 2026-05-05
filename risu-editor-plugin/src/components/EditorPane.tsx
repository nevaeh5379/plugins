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
import React from 'react'
import { VscEdit } from 'react-icons/vsc'
import { PreviewPane } from './PreviewPane'
import { UniversalEditor } from './editors/UniversalEditor'

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
  if (content === null || filePath === null) {
    return (
      <div className="re-editor-pane">
        <div className="re-editor-empty">
          <div className="re-editor-empty-icon"><VscEdit /></div>
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
      <UniversalEditor
        content={content}
        language={language}
        filePath={filePath}
        onChange={onChange}
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
