import React, { useMemo, useCallback } from 'react';
import {
  Image as ImageIcon,
  MoreHorizontal,
  Copy,
  FileCode,
  Rocket,
  Download,
  Upload,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';
import { copyToClipboard, saveAsFile, MIME_TYPES } from '../services/fileService';
import { saveAsImage } from '../services/imageService';
import { Button, Dropdown, message, type MenuItem } from '../../components/ui';
import type { ColorPalette, LogExportSettings } from '../../types';
import type { LogExporterSettings } from '../hooks/types';

// ============================================================================
// Constants & Utilities
// ============================================================================

/** Regex pattern for stripping invalid filename characters across platforms */
const FILENAME_SANITIZE_REGEX = /[/?%*:|"<>]/g;

/**
 * Sanitizes a string part so it can be safely used in filenames.
 */
function sanitizeFilenamePart(name: string): string {
  return name.replace(FILENAME_SANITIZE_REGEX, '-');
}

/**
 * Builds the standard HTML log export filename.
 */
function createHtmlExportFilename(charName: string, chatName: string): string {
  const safeCharName = sanitizeFilenamePart(charName);
  const safeChatName = sanitizeFilenamePart(chatName);
  return `Risu_Log_${safeCharName}_${safeChatName}.html`;
}

/**
 * Extracts a rendered container element and appends any enclosed style blocks
 * to ensure complete CSS capture during image rendering.
 */
function prepareElementForCapture(htmlContent: string): HTMLElement | null {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  const elementToCapture = tempDiv.querySelector<HTMLElement>('div');
  if (!elementToCapture) {
    return null;
  }

  tempDiv.querySelectorAll('style').forEach((styleTag) => {
    elementToCapture.appendChild(styleTag);
  });

  return elementToCapture;
}

// ============================================================================
// Types
// ============================================================================

export interface ActionbarProps {
  charName: string;
  chatName: string;
  getPreviewContent: () => Promise<string>;
  messageNodes: HTMLElement[];
  settings: LogExportSettings | LogExporterSettings;
  backgroundColor: string;
  color?: ColorPalette;
  charAvatarUrl: string;
  onOpenArcaHelper?: () => void;
  onProgressStart: (message: string, total?: number) => void;
  onProgressUpdate: (update: { current?: number; message?: string }) => void;
  onProgressEnd: () => void;
  onSaveLogData: () => void;
  onLoadLogData: () => void;
  onDeleteSelected?: () => void;
  hasSelection?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onInvertSelection?: () => void;
}

// ============================================================================
// Actionbar Component
// ============================================================================

/**
 * Floating bottom action bar providing quick controls for log exporting
 * (image capture, HTML copy/save, Arcalive helper, JSON backup/restore)
 * and batch selection/deletion actions during edit mode.
 */
const Actionbar: React.FC<ActionbarProps> = React.memo(({
  charName,
  chatName,
  getPreviewContent,
  messageNodes,
  settings,
  backgroundColor,
  color,
  charAvatarUrl,
  onOpenArcaHelper,
  onProgressStart,
  onProgressUpdate,
  onProgressEnd,
  onSaveLogData,
  onLoadLogData,
  onDeleteSelected,
  hasSelection = false,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
}) => {
  // --------------------------------------------------------------------------
  // Action Handlers
  // --------------------------------------------------------------------------

  const handleCopyHtml = useCallback(async () => {
    try {
      const content = await getPreviewContent();
      await copyToClipboard(content);
    } catch (err) {
      console.error('Failed to copy HTML preview content:', err);
    }
  }, [getPreviewContent]);

  const handleSaveHtml = useCallback(async () => {
    try {
      const content = await getPreviewContent();
      const filename = createHtmlExportFilename(charName, chatName);
      saveAsFile(filename, content, MIME_TYPES.HTML);
    } catch (err) {
      console.error('Failed to save HTML file:', err);
    }
  }, [charName, chatName, getPreviewContent]);

  const handleSaveAsImage = useCallback(async () => {
    const imageFormat = settings.imageFormat || 'png';
    const fullOptions: LogExportSettings = {
      ...settings,
      charAvatarUrl,
      color,
      onProgressStart,
      onProgressUpdate,
      onProgressEnd,
    };

    if (settings.format !== 'basic') {
      const content = await getPreviewContent();
      const elementToCapture = prepareElementForCapture(content);

      if (!elementToCapture) {
        message.warning('이미지를 생성할 콘텐츠가 없습니다.');
        return;
      }

      const bgColor = settings.format === 'html' ? undefined : backgroundColor;
      await saveAsImage(elementToCapture, imageFormat, charName, chatName, fullOptions, bgColor);
    } else {
      await saveAsImage(messageNodes, imageFormat, charName, chatName, fullOptions, backgroundColor);
    }
  }, [
    settings,
    charAvatarUrl,
    color,
    onProgressStart,
    onProgressUpdate,
    onProgressEnd,
    getPreviewContent,
    backgroundColor,
    charName,
    chatName,
    messageNodes,
  ]);

  // --------------------------------------------------------------------------
  // Dropdown Menu Configuration
  // --------------------------------------------------------------------------

  const exportMenuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      {
        key: 'copy',
        label: 'HTML 복사',
        icon: <Copy size={14} />,
      },
      {
        key: 'save-html',
        label: 'HTML 저장',
        icon: <FileCode size={14} />,
      },
      {
        key: 'arca',
        label: '아카라이브 헬퍼',
        icon: <Rocket size={14} />,
      },
      {
        type: 'divider',
      },
      {
        key: 'backup',
        label: 'JSON 백업',
        icon: <Download size={14} />,
      },
      {
        key: 'restore',
        label: 'JSON 복원',
        icon: <Upload size={14} />,
      },
    ];

    if (settings.isEditable) {
      items.push(
        {
          type: 'divider',
        },
        {
          key: 'select-all',
          label: '전체 선택',
          icon: <CheckSquare size={14} />,
        },
        {
          key: 'deselect-all',
          label: '전체 해제',
          icon: <Square size={14} />,
        },
        {
          key: 'invert-selection',
          label: '선택 반전',
          icon: <RefreshCw size={14} />,
        }
      );
    }

    return items;
  }, [settings.isEditable]);

  const handleMenuClick = useCallback(
    (info: { key: string }) => {
      switch (info.key) {
        case 'copy':
          handleCopyHtml();
          break;
        case 'save-html':
          handleSaveHtml();
          break;
        case 'arca':
          onOpenArcaHelper?.();
          break;
        case 'backup':
          onSaveLogData();
          break;
        case 'restore':
          onLoadLogData();
          break;
        case 'select-all':
          onSelectAll?.();
          break;
        case 'deselect-all':
          onDeselectAll?.();
          break;
        case 'invert-selection':
          onInvertSelection?.();
          break;
        default:
          break;
      }
    },
    [
      handleCopyHtml,
      handleSaveHtml,
      onOpenArcaHelper,
      onSaveLogData,
      onLoadLogData,
      onSelectAll,
      onDeselectAll,
      onInvertSelection,
    ]
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="action-bar-content">
      {/* 내보내기 및 데이터 관리 액션 그룹 */}
      <div className="action-bar-group export-group">
        <Button
          type="default"
          icon={<ImageIcon size={15} className="btn-icon" />}
          onClick={handleSaveAsImage}
          title="이미지 파일로 저장"
          className="action-bar-btn btn-save-img desktop-btn-primary"
        >
          <span className="btn-text">이미지 저장</span>
        </Button>
        <Dropdown
          menu={{ items: exportMenuItems, onClick: handleMenuClick }}
          placement="topRight"
          trigger={['click']}
        >
          <Button
            type="default"
            icon={<MoreHorizontal size={16} className="btn-icon" />}
            title="더보기 옵션 (복사, HTML 저장, 백업, 복원, 아카라이브 헬퍼)"
            aria-label="더보기 옵션"
            className="action-bar-btn btn-more desktop-btn-secondary"
          />
        </Dropdown>
      </div>

      {settings.isEditable && (
        <div
          className="action-bar-divider"
          style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'var(--border)',
            margin: '0 6px',
          }}
        />
      )}

      <div style={{ flex: 1 }} className="action-spacer" />

      {/* 편집 모드 액션 그룹 */}
      {settings.isEditable && (
        <div className="action-bar-group edit-group">
          <Button
            danger
            type="primary"
            icon={<Trash2 size={15} className="btn-icon" />}
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            title={!hasSelection ? '삭제할 메시지를 선택하세요' : '선택한 메시지 삭제'}
            className="action-bar-btn btn-delete desktop-btn-danger"
          >
            <span className="btn-text">삭제</span>
          </Button>
        </div>
      )}
    </div>
  );
});

Actionbar.displayName = 'Actionbar';

export { Actionbar };
export default Actionbar;
