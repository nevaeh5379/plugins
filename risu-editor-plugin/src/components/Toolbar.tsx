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
import { LuMenu, LuX, LuRotateCw, LuSettings, LuMaximize2, LuMinimize2 } from 'react-icons/lu'
import { MenuBar } from './MenuBar'
import type { LayoutMode } from '../lib/windowManager'
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
  layoutMode?: LayoutMode
  onToggleLayoutMode?: () => void
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
  layoutMode,
  onToggleLayoutMode,
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
          <LuMenu size={16} />
        </button>
        <span className="re-toolbar-title">Risu Editor</span>
        <MenuBar 
          onSave={onSave || (() => {})} 
          onReload={onReload} 
          onSplitPane={onSplitPane || (() => {})} 
          onCloseAll={onCloseAll || (() => {})} 
          onCloseEditor={onClose} 
          onSettings={onOpenSettings || (() => {})}
          layoutMode={layoutMode}
          onToggleLayoutMode={onToggleLayoutMode}
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
        {onOpenSettings && (
          <button
            className="re-btn re-btn-icon"
            onClick={onOpenSettings}
            title="Settings"
          >
            <LuSettings size={16} />
          </button>
        )}
        {onToggleLayoutMode && (
          <button
            className="re-btn re-btn-icon"
            onClick={onToggleLayoutMode}
            title={layoutMode === 'windowed' ? '전체화면 모드로 전환' : '창 모드로 전환'}
          >
            {layoutMode === 'windowed' ? <LuMaximize2 size={16} /> : <LuMinimize2 size={16} />}
          </button>
        )}
        <button className="re-btn re-btn-icon" onClick={onClose} title="Close editor">
          <LuX size={16} />
        </button>
      </div>
    </div>
  )
}
