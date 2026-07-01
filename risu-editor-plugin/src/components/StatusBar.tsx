import React from 'react'
import type { LayoutMode } from '../lib/windowManager'
import { LuEye, LuEyeOff, LuMaximize2, LuLayoutGrid, LuColumns2 } from 'react-icons/lu'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

interface StatusBarProps {
  filePath: string | null
  language: string | null
  totalFiles: number
  autoSaveStatus: AutoSaveStatus
  backdropOpacity?: number
  setBackdropOpacity?: (opacity: number) => void
  enableBackdrop?: boolean
  setEnableBackdrop?: (enable: boolean) => void
  layoutMode?: LayoutMode
  setLayoutMode?: (mode: LayoutMode) => void
  onToggleLayoutMode?: () => void
}

export const StatusBar: React.FC<StatusBarProps> = ({
  filePath,
  language,
  totalFiles,
  autoSaveStatus,
  backdropOpacity = 0.2,
  setBackdropOpacity,
  enableBackdrop = true,
  setEnableBackdrop,
  layoutMode = 'fullscreen',
  setLayoutMode,
  onToggleLayoutMode,
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
        return 'saving'
      default:
        return ''
    }
  }

  return (
    <div className="re-statusbar">
      <div className="re-statusbar-left">
        <span className={`re-statusbar-item ${getStatusClass()}`}>{getStatusText()}</span>
        
        {/* Backdrop 투명도 컨트롤 */}
        {setEnableBackdrop && setBackdropOpacity && (
          <div className="re-statusbar-backdrop-control">
            <button
              className={`re-statusbar-btn ${enableBackdrop ? 'active' : ''}`}
              onClick={() => setEnableBackdrop(!enableBackdrop)}
              title="배경 투명화 토글"
            >
              {enableBackdrop ? <LuEye size={14} /> : <LuEyeOff size={14} />}
              <span style={{ marginLeft: '4px' }}>배경 투명화</span>
            </button>
            {enableBackdrop && (
              <div className="re-statusbar-slider-container">
                <input
                  type="range"
                  min="0.05"
                  max="0.9"
                  step="0.05"
                  value={backdropOpacity}
                  onChange={(e) => setBackdropOpacity(parseFloat(e.target.value))}
                  title="배경 불투명도 조절"
                  className="re-statusbar-slider"
                />
                <span className="re-statusbar-slider-value">{Math.round((1 - backdropOpacity) * 100)}% 투명</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="re-statusbar-right">
        {/* 레이아웃 모드 단추 */}
        {setLayoutMode && (
          <div className="re-statusbar-layout-control">
            <span className="re-statusbar-label">레이아웃:</span>
            <div className="re-statusbar-btn-group">
              <button
                className={`re-statusbar-btn ${layoutMode === 'fullscreen' ? 'active' : ''}`}
                onClick={() => setLayoutMode('fullscreen')}
                title="전체화면 모드"
              >
                <LuMaximize2 size={13} />
                <span>전체화면</span>
              </button>
              <button
                className={`re-statusbar-btn ${layoutMode === 'sidebar' ? 'active' : ''}`}
                onClick={() => setLayoutMode('sidebar')}
                title="사이드 패널 모드"
              >
                <LuColumns2 size={13} />
                <span>사이드바</span>
              </button>
              <button
                className={`re-statusbar-btn ${layoutMode === 'windowed' ? 'active' : ''}`}
                onClick={() => setLayoutMode('windowed')}
                title="멀티 윈도우 모드"
              >
                <LuLayoutGrid size={13} />
                <span>윈도우</span>
              </button>
            </div>
          </div>
        )}
        
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
