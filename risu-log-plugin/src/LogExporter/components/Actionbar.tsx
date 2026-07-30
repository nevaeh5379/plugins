/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { copyToClipboard, saveAsFile } from '../services/fileService';
import { saveAsImage } from '../services/imageService';
import { THEMES, COLORS } from './constants';
import { Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
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
  RefreshCw
} from 'lucide-react';

interface ActionbarProps {
  charName: string;
  chatName: string;
  getPreviewContent: () => Promise<string>;
  messageNodes: HTMLElement[];
  settings: any;
  backgroundColor: string;
  color?: any;
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

const Actionbar: React.FC<ActionbarProps> = ({
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
  hasSelection,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
}) => {

  const handleCopyHtml = async () => {
    const content = await getPreviewContent();
    copyToClipboard(content);
  };

  const handleSaveHtml = async () => {
    const content = await getPreviewContent();
    const safeCharName = charName.replace(/[\/\?%\*:|"<>]/g, '-');
    const safeChatName = chatName.replace(/[\/\?%\*:|"<>]/g, '-');
    const filename = `Risu_Log_${safeCharName}_${safeChatName}.html`;
    saveAsFile(filename, content, 'text/html;charset=utf-8');
  };

  const handleSaveAsImage = async () => {
    const imageFormat = settings.imageFormat || 'png';
    const fullOptions = {
      ...settings,
      charAvatarUrl,
      themes: THEMES,
      colors: COLORS,
      color: color,
      onProgressStart,
      onProgressUpdate,
      onProgressEnd,
    };

    if (settings.format !== 'basic') {
      const content = await getPreviewContent();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const elementToCapture = tempDiv.querySelector('div');

      if (!elementToCapture) {
        message.warning('이미지를 생성할 콘텐츠가 없습니다.');
        return;
      }

      tempDiv.querySelectorAll('style').forEach(style => {
        elementToCapture.appendChild(style);
      });

      const bgColor = (settings.format === 'html') ? undefined : backgroundColor;
      await saveAsImage(elementToCapture, imageFormat, charName, chatName, fullOptions, bgColor);
    } else {
      await saveAsImage(messageNodes, imageFormat, charName, chatName, fullOptions, backgroundColor);
    }
  };

  const exportMenuItems: MenuProps['items'] = [
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
    ...(settings.isEditable ? [
      {
        type: 'divider' as const,
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
    ] : [])
  ];

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    if (info.key === 'copy') {
      handleCopyHtml();
    } else if (info.key === 'save-html') {
      handleSaveHtml();
    } else if (info.key === 'arca') {
      if (onOpenArcaHelper) onOpenArcaHelper();
    } else if (info.key === 'backup') {
      onSaveLogData();
    } else if (info.key === 'restore') {
      onLoadLogData();
    } else if (info.key === 'select-all') {
      if (onSelectAll) onSelectAll();
    } else if (info.key === 'deselect-all') {
      if (onDeselectAll) onDeselectAll();
    } else if (info.key === 'invert-selection') {
      if (onInvertSelection) onInvertSelection();
    }
  };

  return (
    <div className="action-bar-content">
      {/* 내보내기 및 데이터 관리 액션 그룹 */}
      <div className="action-bar-group export-group">
        <Button
          type="primary"
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
          getPopupContainer={() => document.getElementById('log-exporter-react-modal-root') || document.body}
        >
          <Button
            type="default"
            icon={<MoreHorizontal size={16} className="btn-icon" />}
            title="더보기 옵션 (복사, HTML 저장, 백업, 복원, 아카라이브 헬퍼)"
            className="action-bar-btn btn-more desktop-btn-secondary"
          />
        </Dropdown>
      </div>

      {settings.isEditable && (
        <div className="action-bar-divider" style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', margin: '0 6px' }}></div>
      )}

      <div style={{ flex: 1 }} className="action-spacer"></div>

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
};

export default Actionbar;

