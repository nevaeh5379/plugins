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

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

interface StatusBarProps {
  filePath: string | null
  language: string | null
  totalFiles: number
  autoSaveStatus: AutoSaveStatus
}

export const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  language,
  totalFiles,
  autoSaveStatus,
}) => {
  const getStatusText = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return '⏳ Auto-saving...'
      case 'saved':
        return '✓ Auto-saved'
      case 'unsaved':
        return '● Unsaved changes'
      default:
        return '✓ No changes'
    }
  }

  const getStatusClass = () => {
    switch (autoSaveStatus) {
      case 'saved':
        return 'saved'
      case 'unsaved':
        return 'modified'
      case 'saving':
        return 'modified'
      default:
        return ''
    }
  }

  return (
    <div className="re-statusbar">
      <div className="re-statusbar-left">
        <span className={`re-statusbar-item ${getStatusClass()}`}>{getStatusText()}</span>
      </div>
      <div className="re-statusbar-right">
        {filePath && (
          <>
            <span className="re-statusbar-item">{language?.toUpperCase() || 'TEXT'}</span>
            <span className="re-statusbar-item">{filePath}</span>
          </>
        )}
        <span className="re-statusbar-item">{totalFiles} files</span>
      </div>
    </div>
  )
}
