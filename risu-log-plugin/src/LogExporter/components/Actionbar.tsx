import React from 'react';
import { copyToClipboard, saveAsFile } from '../services/fileService';
import { saveAsImage } from '../services/imageService';
import { THEMES, COLORS } from './constants';
import { Button } from 'antd';
import {
  CopyOutlined,
  SaveOutlined,
  PictureOutlined,
  RocketOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
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

            // HTML 형식은 Risu AI 원본 스타일을 사용하므로 backgroundColor를 전달하지 않음
            // Markdown/Text는 단순 텍스트이므로 배경색 필요
            const bgColor = (settings.format === 'html') ? undefined : backgroundColor;
            await saveAsImage(elementToCapture, imageFormat, charName, chatName, fullOptions, bgColor);
        } else {
            await saveAsImage(messageNodes, imageFormat, charName, chatName, fullOptions, backgroundColor);
        }
    };

  return (
    <>
        <Button 
            type="primary" 
            icon={<CopyOutlined />} 
            onClick={handleCopyHtml} 
            title="HTML을 클립보드에 복사"
            className="action-bar-btn"
        >
            복사
        </Button>
        <Button 
            type="default" 
            icon={<SaveOutlined />} 
            onClick={handleSaveHtml} 
            title="HTML 파일로 저장"
            className="action-bar-btn"
        >
            HTML 저장
        </Button>
        <Button 
            type="primary"
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }} 
            icon={<PictureOutlined />} 
            onClick={handleSaveAsImage} 
            title="이미지 파일로 저장"
            className="action-bar-btn"
        >
            이미지 저장
        </Button>
        <Button 
            type="default" 
            icon={<RocketOutlined />} 
            onClick={onOpenArcaHelper} 
            title="아카라이브 업로드 도우미"
            className="action-bar-btn"
        >
            아카라이브 헬퍼
        </Button>
        
        <div style={{flex: 1}} className="action-spacer"></div>
        
        <Button 
            type="default" 
            icon={<DownloadOutlined />} 
            onClick={onSaveLogData} 
            title="로그 데이터를 JSON으로 저장"
            className="action-bar-btn"
        >
            저장
        </Button>
        <Button 
            type="default" 
            icon={<UploadOutlined />} 
            onClick={onLoadLogData} 
            title="저장된 로그 데이터 불러오기"
            className="action-bar-btn"
        >
            불러오기
        </Button>
        {settings.isEditable && (
            <Button 
                danger
                type="primary"
                icon={<DeleteOutlined />}
                onClick={onDeleteSelected}
                disabled={!hasSelection}
                title={!hasSelection ? '삭제할 메시지를 선택하세요' : '선택한 메시지 삭제'}
                className="action-bar-btn"
            >
                삭제
            </Button>
        )}
    </>
  );
};

export default Actionbar;
