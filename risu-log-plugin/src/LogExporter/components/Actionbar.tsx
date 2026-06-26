import React from 'react';
import { copyToClipboard, saveAsFile } from '../services/fileService';
import { saveAsImage } from '../services/imageService';
import { THEMES, COLORS } from './constants';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
  CopyOutlined,
  SaveOutlined,
  PictureOutlined,
  RocketOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';

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
}

const Actionbar: React.FC<ActionbarProps> = ({ charName, chatName, getPreviewContent, messageNodes, settings, backgroundColor, color, charAvatarUrl, onOpenArcaHelper, onProgressStart, onProgressUpdate, onProgressEnd, onSaveLogData, onLoadLogData, onDeleteSelected, hasSelection }) => {

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
                alert('이미지를 생성할 콘텐츠가 없습니다.');
                return;
            }

            // Append style elements to the capture element so they are processed during image rendering
            tempDiv.querySelectorAll('style').forEach(style => {
                elementToCapture.appendChild(style);
            });

            // HTML 형식은 Risu AI 원본 스타일을 사용하므로 backgroundColor를 전달하지 않음
            // Markdown/Text는 단순 텍스트이므로 배경색 필요
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
            icon: <CopyOutlined />,
        },
        {
            key: 'save-html',
            label: 'HTML 저장',
            icon: <SaveOutlined />,
        },
        {
            key: 'arca',
            label: '아카라이브 헬퍼',
            icon: <RocketOutlined />,
        },
    ];

    const handleMenuClick: MenuProps['onClick'] = (info) => {
        if (info.key === 'copy') {
            handleCopyHtml();
        } else if (info.key === 'save-html') {
            handleSaveHtml();
        } else if (info.key === 'arca') {
            if (onOpenArcaHelper) onOpenArcaHelper();
        }
    };

  return (
    <div className="action-bar-content" style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* 내보내기 액션 그룹 */}
        <div className="action-bar-group export-group" style={{ display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap' }}>
            <Button 
                type="primary"
                icon={<PictureOutlined />} 
                onClick={handleSaveAsImage} 
                title="이미지 파일로 저장"
                className="action-bar-btn btn-save-img"
            >
                이미지 저장
            </Button>
            <Dropdown 
                menu={{ items: exportMenuItems, onClick: handleMenuClick }} 
                placement="bottomRight"
                trigger={['click']}
            >
                <Button 
                    type="default" 
                    icon={<EllipsisOutlined />} 
                    title="기타 내보내기 옵션 (복사, HTML 저장, 아카라이브 헬퍼)"
                    className="action-bar-btn btn-more"
                />
            </Dropdown>
        </div>
        
        {/* 구분선 */}
        <div className="action-bar-divider" style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-color)', margin: '0 4px' }}></div>
        
        {/* 데이터 백업/복원 그룹 */}
        <div className="action-bar-group backup-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Button 
                type="default" 
                icon={<DownloadOutlined />} 
                onClick={onSaveLogData} 
                title="대화 내용 및 설정을 JSON 파일로 백업"
                className="action-bar-btn btn-backup"
            >
                백업
            </Button>
            <Button 
                type="default" 
                icon={<UploadOutlined />} 
                onClick={onLoadLogData} 
                title="백업된 JSON 파일에서 대화 및 설정 복원"
                className="action-bar-btn btn-restore"
            >
                복원
            </Button>
        </div>
        
        <div style={{flex: 1}} className="action-spacer"></div>
        
        {/* 편집 모드 액션 그룹 */}
        {settings.isEditable && (
            <div className="action-bar-group edit-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button 
                    danger
                    type="primary"
                    icon={<DeleteOutlined />}
                    onClick={onDeleteSelected}
                    disabled={!hasSelection}
                    title={!hasSelection ? '삭제할 메시지를 선택하세요' : '선택한 메시지 삭제'}
                    className="action-bar-btn btn-delete"
                >
                    삭제
                </Button>
            </div>
        )}
    </div>
  );
};

export default Actionbar;
