/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useEffect, useState } from 'react';
import { Button, Space, Spin } from 'antd';
import LogContainer from './LogContainer';
import type { LogContainerProps } from '../../types';
import { getLogHtml } from '../services/htmlGenerator';

interface PreviewPanelProps {
  settings: any;
  logContainerProps: Omit<LogContainerProps, 'onReady'>;
  otherFormatContent: string;
  selectedIndices: Set<number>;
  onSelectionChange: (newSelection: Set<number>) => void;
  onLastSelectedIndexChange: (index: number | null) => void;
  lastSelectedIndex: number | null;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onInvertSelection?: () => void;
  onDimensionsChange: (dims: { width: number, height: number, maxMessageHeight: number }) => void;
  isConverting: boolean;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  settings, 
  logContainerProps, 
  otherFormatContent,
  selectedIndices,
  onSelectionChange,
  onLastSelectedIndexChange,
  lastSelectedIndex,
  onSelectAll,
  onDeselectAll,
  onInvertSelection,
  onDimensionsChange,
  isConverting,
}) => {
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [rawHtmlContent, setRawHtmlContent] = useState('');

  const isBasicFormat = settings.format === 'basic' || !settings.format;

  const onReady = React.useCallback(() => {
    if (previewContentRef.current) {
      const element = previewContentRef.current;
      let maxMessageHeight = 0;
      const messageElements = element.querySelectorAll('.chat-message-container');
      messageElements.forEach(msg => {
          if ((msg as HTMLElement).offsetHeight > maxMessageHeight) {
              maxMessageHeight = (msg as HTMLElement).offsetHeight;
          }
      });

      onDimensionsChange({
        width: element.offsetWidth,
        height: element.offsetHeight,
        maxMessageHeight: maxMessageHeight,
      });
    }
  }, [onDimensionsChange]);

  const handleMessageSelect = (index: number, e: React.MouseEvent) => {
    const newSelection = new Set(selectedIndices);
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
    } else {
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
    }
    onSelectionChange(newSelection);
    onLastSelectedIndexChange(index);
  };

  useEffect(() => {
    if (settings.rawHtmlView) {
      if (isBasicFormat) {
        getLogHtml(logContainerProps).then(setRawHtmlContent);
      } else {
        setRawHtmlContent(otherFormatContent);
      }
    }
  }, [settings.rawHtmlView, logContainerProps, otherFormatContent, isBasicFormat]);

  useEffect(() => {
    if (shadowHostRef.current && !isBasicFormat && !settings.rawHtmlView) {
        if (!shadowHostRef.current.shadowRoot) {
            shadowHostRef.current.attachShadow({ mode: 'open' });
        }
        const shadowRoot = shadowHostRef.current.shadowRoot!;
        shadowRoot.innerHTML = `
            <style>
                :host {
                    all: initial;
                    display: block;
                }
                img, video {
                    max-width: 100%;
                    height: auto;
                    display: block;
                }
            </style>
            ${otherFormatContent}
        `;
    }
  }, [otherFormatContent, isBasicFormat, settings.rawHtmlView]);

  const renderContent = () => {
    if (settings.rawHtmlView) {
      return <textarea readOnly style={{width: '100%', height: '100%', whiteSpace: 'pre-wrap', wordWrap: 'break-word', backgroundColor: '#1a1b26', color: '#c0caf5', border: 'none'}} value={rawHtmlContent}></textarea>;
    }
    if (isBasicFormat) {
      return <LogContainer {...logContainerProps} onReady={onReady} selectedIndices={selectedIndices} onMessageSelect={handleMessageSelect} />;
    }
    return <div ref={shadowHostRef}></div>;
  };

  const showSpinner = !isBasicFormat && isConverting;

  return (
    <>
        {settings.isEditable && (
            <div className="desktop-preview-toolbar">
                <Space className="desktop-selection-controls" size={6}>
                    <Button size="small" onClick={onSelectAll} title="모든 메시지 선택">전체 선택</Button>
                    <Button size="small" onClick={onDeselectAll} title="모든 선택 해제">전체 해제</Button>
                    <Button size="small" onClick={onInvertSelection} title="선택 상태 반전">선택 반전</Button>
                </Space>
            </div>
        )}
        <div className="desktop-preview-content" ref={previewContentRef} style={{ position: 'relative' }}>
            {showSpinner && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(26, 27, 38, 0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    backdropFilter: 'blur(3px)',
                    gap: '12px',
                    borderRadius: '8px'
                }}>
                    <Spin size="large" />
                    <span style={{ color: '#c0caf5', fontSize: '14px', fontWeight: 500 }}>로딩 및 변환 중...</span>
                </div>
            )}
            <div className="log-exporter-modal-preview">
                {renderContent()}
            </div>
        </div>
    </>
  );
};

export default PreviewPanel;