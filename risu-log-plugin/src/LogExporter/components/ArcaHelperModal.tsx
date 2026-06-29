/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback } from 'react';
import { createZipFromMediaList } from '../../services/zipService';
import { copyToClipboard } from '../services/fileService';
import type { CharInfo, ArcaImage } from '../../types';
import { getLogHtml } from '../services/htmlGenerator';
import { getExportHtmlStyles } from '../services/logGenerator';
import { Modal, Steps, Button, Alert, Input, Spin } from 'antd';
import { DownloadOutlined, FileAddOutlined, CopyOutlined, ArrowLeftOutlined } from '@ant-design/icons';

interface ArcaHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageNodes: HTMLElement[];
  charInfo: CharInfo;
  settings: any;
  globalSettings: any;
  uiTheme: string;
  colorPalette: any;
}

type Step = 'intro' | 'paste_urls' | 'done';

const ArcaHelperModal: React.FC<ArcaHelperModalProps> = ({ isOpen, onClose, messageNodes, charInfo, settings, globalSettings, colorPalette }) => {
  const [step, setStep] = useState<Step>('intro');
  const [baseHtml, setBaseHtml] = useState('');
  const [images, setImages] = useState<ArcaImage[]>([]);
  const [pastedHtml, setPastedHtml] = useState('');
  const [finalHtml, setFinalHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRestart = () => {
    setStep('intro');
    setBaseHtml('');
    setImages([]);
    setPastedHtml('');
    setFinalHtml('');
    setError(null);
  };

  const handleClose = () => {
    handleRestart();
    onClose();
  };

  const generateInitialFiles = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const logHtml = await getLogHtml({
        nodes: messageNodes,
        charInfo,
        selectedThemeKey: settings.theme,
        color: colorPalette,
        showAvatar: settings.showAvatar,
        showHeader: settings.showHeader,
        showHeaderIcon: settings.showHeaderIcon,
        headerTags: settings.headerTags,
        headerLayout: settings.headerLayout,
        headerBannerUrl: settings.headerBannerUrl,
        headerBannerBlur: settings.headerBannerBlur,
        headerBannerAlign: settings.headerBannerAlign,
        showFooter: settings.showFooter,
        footerLeft: settings.footerLeft,
        footerCenter: settings.footerCenter,
        footerRight: settings.footerRight,
        showBubble: settings.showBubble,
        embedImagesAsBlob: false,
        globalSettings,
        isForExport: true,
        isForArca: true,
        allowHtmlRendering: !!settings.allowHtmlRendering,
        disableAnimations: !!settings.disableAnimations,
        imageCropActive: !!settings.imageCropActive,
        imageCropAspectRatio: settings.imageCropAspectRatio || 'original',
        imageCropVAlign: settings.imageCropVAlign !== undefined ? Number(settings.imageCropVAlign) : 50,
        imageCropHAlign: settings.imageCropHAlign !== undefined ? Number(settings.imageCropHAlign) : 50,
        imageCropHeight: settings.imageCropHeight !== undefined ? Number(settings.imageCropHeight) : 1,
        imageScale: settings.imageScale !== undefined ? Number(settings.imageScale) : 100,
        imageAlign: settings.imageAlign || 'left',
        imageStyle: settings.imageStyle || 'none',
      });

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = logHtml;

      const collectedImages: ArcaImage[] = [];
      const processedUrls = new Set<string>();
      let mediaCounter = 0;
      
      // 1. Process Banner Header first
      const headerElement = tempDiv.querySelector('[data-is-banner-header="true"]') as HTMLDivElement;
      if (headerElement && headerElement.style.backgroundImage) {
        const style = headerElement.style.backgroundImage;
        const urlRegex = /url\("([^"]+)"\)/;
        const match = style.match(urlRegex);

        if (match && match[1]) {
            const bannerUrl = match[1];
            if (bannerUrl && !bannerUrl.startsWith('data:')) {
                processedUrls.add(bannerUrl);
                mediaCounter++;
                const extension = 'jpg';
                const filename = `${String(mediaCounter).padStart(3, '0')}.${extension}`;
                collectedImages.push({ url: bannerUrl, filename, isWebM: false });
                
                const placeholder = `__TOLOG_PLACEHOLDER_${bannerUrl}__`;
                headerElement.style.backgroundImage = style.replace(bannerUrl, placeholder);
            }
        }
      }

      // 2. Process other media elements
      const mediaElements = Array.from(tempDiv.querySelectorAll('img, video'));

      for (const el of mediaElements) {
        const isVideo = el.tagName === 'VIDEO';
        const src = isVideo ? ((el as HTMLVideoElement).querySelector('source')?.src || (el as HTMLVideoElement).src) : (el as HTMLImageElement).src;

        if (!src || src.startsWith('data:')) continue;

        if (!processedUrls.has(src)) {
          processedUrls.add(src);
          mediaCounter++;
          
          const urlLower = src.toLowerCase();
          const isWebM = urlLower.includes('.webm') || urlLower.includes('2e7765626d');
          const extension = isWebM && settings.convertWebM ? 'webp' : ((el as HTMLElement).dataset.extension || 'jpg');
          const filename = `${String(mediaCounter).padStart(3, '0')}.${extension}`;

          collectedImages.push({ url: src, filename, isWebM });
        }
        
        const placeholder = `__TOLOG_PLACEHOLDER_${src}__`;
        if (isVideo) {
          (el as HTMLVideoElement).src = placeholder;
          const source = el.querySelector('source');
          if (source) source.src = placeholder;
        } else {
          (el as HTMLImageElement).src = placeholder;
        }
      }

      const cssStyles = await getExportHtmlStyles(settings);
      setBaseHtml(`<style>${cssStyles}</style>\n${tempDiv.innerHTML}`);
      setImages(collectedImages);

      if (collectedImages.length > 0) {
        const blob = await createZipFromMediaList(collectedImages, { convertWebM: settings.convertWebM });
        const safeCharName = charInfo.name.replace(/[/?%*:"<>]/g, '-');
        const zipFilename = `Arca_Images_${safeCharName}.zip`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = zipFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }
      
      setStep('paste_urls');
    } catch (e: any) {      
      console.error('[Arca Helper] Step 1 failed:', e);
      setError(`파일 생성 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [messageNodes, charInfo, settings, globalSettings, colorPalette]);

  const generateFinalHtml = () => {
    if (!pastedHtml) {
      setError('아카라이브 HTML 코드를 붙여넣어 주세요.');
      return;
    }
    setError(null);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pastedHtml;
    
    const newImageUrls = Array.from(tempDiv.querySelectorAll('img')).map(img => img.src);
    
    if (newImageUrls.length !== images.length) {
        setError(`이미지 개수가 일치하지 않습니다. 원본 (${images.length}개) vs 붙여넣은 코드 (${newImageUrls.length}개)`);
        return;
    }

    let finalOutputHtml = baseHtml;
    images.forEach((imageInfo, index) => {
      const placeholder = `__TOLOG_PLACEHOLDER_${imageInfo.url}__`;
      const newUrl = newImageUrls[index];
      if (newUrl) {
        finalOutputHtml = finalOutputHtml.replace(new RegExp(placeholder, 'g'), newUrl);
      }
    });

    setFinalHtml(finalOutputHtml);
    setStep('done');
  };

  const currentStepNum = step === 'intro' ? 0 : step === 'paste_urls' ? 1 : 2;

  const renderContent = () => {
    if (isProcessing) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', gap: '16px' }}>
                <Spin size="large" />
                <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>파일 생성 및 압축 중...</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>잠시만 기다려주세요.</div>
            </div>
        );
    }

    switch (step) {
      case 'intro':
        return (
          <div className="arca-helper-step" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="arca-instruction-card" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    1단계: 이미지 파일 다운로드
                </h4>
                <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-secondary)' }}>아카라이브에 업로드할 이미지들을 ZIP 파일로 묶어 다운로드합니다.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border-color)', fontSize: '0.9em' }}>
                    <div>1. 하단의 <b>'이미지 ZIP 생성'</b> 버튼을 클릭하세요.</div>
                    <div>2. 다운로드된 ZIP 파일의 압축을 풀어주세요.</div>
                </div>
            </div>
          </div>
        );
      case 'paste_urls':
        return (
          <div className="arca-helper-step" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="arca-instruction-card" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                    2단계: 이미지 URL 붙여넣기
                </h4>
                <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-secondary)' }}>압축 푼 이미지들을 아카라이브 글쓰기 창에 업로드한 후, HTML 코드를 가져오세요.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--border-color)', fontSize: '0.9em' }}>
                    <div>1. 아카라이브 편집기를 <b>HTML 모드</b>로 전환합니다.</div>
                    <div>2. 업로드된 이미지 태그(<code>{'<img>'}</code>) 전체를 복사합니다.</div>
                </div>
            </div>
            <Input.TextArea 
              className="arca-paste-area"
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              placeholder="여기에 아카라이브 편집기에서 복사한 <img> 태그들을 붙여넣으세요..."
              autoSize={{ minRows: 6, maxRows: 12 }}
              style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
            />
          </div>
        );
      case 'done':
        return (
          <div className="arca-helper-step" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="arca-instruction-card" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#52c41a' }}>
                    3단계: 최종 HTML 복사
                </h4>
                <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-secondary)' }}>완성되었습니다! 아래 코드를 복사하여 아카라이브 <b>HTML 편집기</b>에 그대로 붙여넣으세요.</p>
            </div>
            <Input.TextArea 
              className="arca-paste-area"
              value={finalHtml} 
              readOnly
              autoSize={{ minRows: 6, maxRows: 12 }}
              style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <Modal
      title="아카라이브 도우미"
      open={isOpen}
      onCancel={handleClose}
      width={650}
      className="arca-helper-modal"
      transitionName=""
      maskTransitionName=""
      footer={[
        step === 'intro' && (
          <Button 
            key="zip" 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={generateInitialFiles} 
            loading={isProcessing}
          >
            이미지 ZIP 생성
          </Button>
        ),
        step === 'paste_urls' && (
          <Button 
            key="html" 
            type="primary" 
            icon={<FileAddOutlined />} 
            onClick={generateFinalHtml}
          >
            최종 HTML 생성
          </Button>
        ),
        step === 'done' && (
          <Button 
            key="copy" 
            type="primary" 
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
            icon={<CopyOutlined />} 
            onClick={() => copyToClipboard(finalHtml)}
          >
            HTML 코드 복사
          </Button>
        ),
        step !== 'intro' && (
          <Button 
            key="restart" 
            icon={<ArrowLeftOutlined />} 
            onClick={handleRestart}
          >
            처음부터 다시
          </Button>
        ),
        <Button key="close" onClick={handleClose}>
          닫기
        </Button>
      ].filter(Boolean)}
    >
      <div className="arca-modal-body" style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Steps
          current={currentStepNum}
          size="small"
          items={[
            { title: '이미지 저장' },
            { title: 'URL 붙여넣기' },
            { title: '완료' },
          ]}
          style={{ marginBottom: '8px' }}
        />
        
        {error && (
          <Alert 
            message={error} 
            type="error" 
            showIcon 
            style={{ fontSize: '0.9em' }}
          />
        )}
        
        <div className="arca-content-body">
            {renderContent()}
        </div>
      </div>
    </Modal>
  );
};

export default ArcaHelperModal;
