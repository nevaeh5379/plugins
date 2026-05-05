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
import { FaRedo, FaColumns, FaCog } from "react-icons/fa"
import { MenuBar } from './MenuBar'
import { FaX, FaBars } from 'react-icons/fa6'
type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

interface ToolbarProps {
  characterName: string
  autoSaveStatus: AutoSaveStatus
  activeFilePath: string | null
  showPreview: boolean
  onTogglePreview: () => void
  onClose: () => void
  onReload: () => void
  onSplitPane?: () => void
  onSave?: () => void
  onCloseAll?: () => void
  onOpenSettings?: () => void
  onToggleSidebar?: () => void
}

export const Toolbar: React.FC<ToolbarProps> = ({
  characterName,
  autoSaveStatus,
  activeFilePath,
  showPreview,
  onTogglePreview,
  onClose,
  onReload,
  onSplitPane,
  onSave,
  onCloseAll,
  onOpenSettings,
  onToggleSidebar,
}) => {
  // Build breadcrumb from active file path
  const breadcrumbs = activeFilePath
    ? activeFilePath.split('/').filter(Boolean)
    : []

  const getAutoSaveLabel = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return 'Saved'
      case 'unsaved':
        return 'Unsaved'
      default:
        return ''
    }
  }

  const getAutoSaveClass = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return 'saving'
      case 'saved':
        return 'saved'
      case 'unsaved':
        return 'unsaved'
      default:
        return ''
    }
  }

  return (
    <div className="re-toolbar">
      <div className="re-toolbar-left">
        <button
          className="re-btn re-btn-icon re-toolbar-hamburger"
          onClick={onToggleSidebar}
          title="Toggle sidebar"
        >
          <FaBars />
        </button>
        <span className="re-toolbar-title">Risu Editor</span>
        <MenuBar 
          onSave={onSave || (() => {})} 
          onReload={onReload} 
          onSplitPane={onSplitPane || (() => {})} 
          onCloseAll={onCloseAll || (() => {})} 
          onCloseEditor={onClose} 
          onSettings={onOpenSettings || (() => {})}
        />
        <span style={{ color: 'var(--re-border-light)', margin: '0 4px' }}>│</span>
        <span className="re-toolbar-charname">{characterName || 'No Character'}</span>
        {autoSaveStatus !== 'idle' && (
          <div className={`re-autosave-indicator ${getAutoSaveClass()}`}>
            <span className="re-autosave-dot" />
            <span>{getAutoSaveLabel()}</span>
          </div>
        )}
      </div>

      {/* Breadcrumb navigation */}
      {breadcrumbs.length > 0 && (
        <div className="re-toolbar-breadcrumb">
          {breadcrumbs.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="re-breadcrumb-sep">›</span>}
              <span className="re-breadcrumb-part">{part}</span>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="re-toolbar-right">
        {/* RisuAI 내에 있는 렌더링 함수를 가져온 뒤 구현해야할 듯 */}
        {/* <button
          className={`re-btn re-btn-preview${showPreview ? ' active' : ''}`}
          onClick={onTogglePreview}
          title="미리보기 토글 (Preview)"
        >
          👁 Preview
        </button> */}
        {/* <button
          className="re-btn"
          onClick={onSplitPane}
          title="에디터 분할 (Split Pane)"
        >
          <FaColumns />
        </button>
        <button
          className="re-btn"
          onClick={onOpenSettings}
          title="설정 (Settings)"
        >
          <FaCog />
        </button>
        <button
          className="re-btn"
          onClick={onReload}
          title="데이터 새로고침 (Reload)"
        >
          <FaRedo />
        </button> */}
        <button className="re-btn re-btn-icon" onClick={onClose} title="Close editor">
          <FaX />
        </button>
      </div>
    </div>
  )
}
