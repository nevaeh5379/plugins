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
import { copyToClipboard, saveAsFile, MIME_TYPES } from '../../services/fileService';
import { saveAsImage } from '../../services/imageService';
import { Button, Dropdown, message, type MenuItem } from '../../../components/ui';
import type { ColorPalette, LogExportSettings } from '../../../types';
import type { LogExporterSettings } from '../../hooks/types';

export interface MobileActionBarProps {
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
  selectedCount?: number;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onInvertSelection?: () => void;
}

const FILENAME_SANITIZE_REGEX = /[/?%*:|"<>]/g;

function sanitizeFilenamePart(name: string): string {
  return name.replace(FILENAME_SANITIZE_REGEX, '-');
}

function createHtmlExportFilename(charName: string, chatName: string): string {
  const safeCharName = sanitizeFilenamePart(charName);
  const safeChatName = sanitizeFilenamePart(chatName);
  return `Risu_Log_${safeCharName}_${safeChatName}.html`;
}

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

export const MobileActionBar: React.FC<MobileActionBarProps> = React.memo(({
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
  selectedCount = 0,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
}) => {
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

  const exportMenuItems: MenuItem[] = useMemo(() => [
    {
      key: 'copy',
      label: 'HTML 복사',
      icon: <Copy size={15} />,
    },
    {
      key: 'save-html',
      label: 'HTML 저장',
      icon: <FileCode size={15} />,
    },
    {
      key: 'arca',
      label: '아카라이브 헬퍼',
      icon: <Rocket size={15} />,
    },
    {
      type: 'divider',
    },
    {
      key: 'backup',
      label: 'JSON 백업',
      icon: <Download size={15} />,
    },
    {
      key: 'restore',
      label: 'JSON 복원',
      icon: <Upload size={15} />,
    },
  ], []);

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
    ]
  );

  return (
    <div className="mobile-action-bar-container">
      {/* Edit Mode Selection Toolbar */}
      {settings.isEditable && (
        <div className="mobile-selection-toolbar">
          <div className="mobile-selection-count">
            <span className="mobile-selection-badge">{selectedCount}개 선택됨</span>
          </div>
          <div className="mobile-selection-btn-group">
            <button
              type="button"
              className="mobile-selection-mini-btn"
              onClick={onSelectAll}
              title="전체 선택"
              aria-label="전체 선택"
            >
              <CheckSquare size={14} />
              <span>전체</span>
            </button>
            <button
              type="button"
              className="mobile-selection-mini-btn"
              onClick={onDeselectAll}
              title="전체 해제"
              aria-label="전체 해제"
            >
              <Square size={14} />
              <span>해제</span>
            </button>
            <button
              type="button"
              className="mobile-selection-mini-btn"
              onClick={onInvertSelection}
              title="선택 반전"
              aria-label="선택 반전"
            >
              <RefreshCw size={14} />
              <span>반전</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Bottom Buttons */}
      <div className="mobile-action-bar-buttons">
        {settings.isEditable && (
          <Button
            danger
            type="primary"
            icon={<Trash2 size={16} />}
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            className="mobile-delete-btn"
          >
            삭제
          </Button>
        )}

        <Button
          type="primary"
          icon={<ImageIcon size={16} />}
          onClick={handleSaveAsImage}
          className="mobile-primary-save-btn"
        >
          <span>이미지 저장</span>
        </Button>

        <Dropdown
          menu={{ items: exportMenuItems, onClick: handleMenuClick }}
          placement="topRight"
          trigger={['click']}
        >
          <button
            type="button"
            className="mobile-more-btn"
            title="더보기 옵션"
            aria-label="더보기 옵션"
          >
            <MoreHorizontal size={20} />
          </button>
        </Dropdown>
      </div>
    </div>
  );
});

MobileActionBar.displayName = 'MobileActionBar';
export default MobileActionBar;
