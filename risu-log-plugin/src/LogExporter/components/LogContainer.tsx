import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { LogContainerProps, ColorPalette } from '../../types';
import { THEMES, COLORS } from './constants';
import { collectCharacterAvatars } from '../services/avatarService';
import LogHeader from './LogHeader';
import LogFooter from './LogFooter';
import MessageRenderer from './MessageRenderer';


const LogContainer: React.FC<LogContainerProps> = (props) => {
  const {
    nodes,
    charInfo,
    selectedThemeKey = 'basic',
    selectedColorKey = 'dark',
    color: colorProp,
    customCss,
    showAvatar = true,
    showHeader = true,
    showHeaderIcon,
    headerTags,
    headerLayout,
    headerBannerUrl,
    headerBannerBlur,
    headerBannerAlign,
    showFooter = true,
    footerLeft,
    footerCenter,
    footerRight,
    showBubble = true,
    isForArca = false,
    embedImagesAsBlob = true,
    preCollectedAvatarMap,
    allowHtmlRendering = false,
    onReady,
    globalSettings,
    fontSize,
    containerWidth,
    imageScale,
    imageAlign,
    imageStyle,
    imageCropActive,
    imageCropAspectRatio,
    imageCropVAlign,
    imageCropHAlign,
    imageCropHeight,
    selectedIndices,
    onMessageSelect,
    isForImageExport,
    isForExport,
    disableAnimations,
  } = props;

  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(preCollectedAvatarMap || new Map());
  const [isAvatarReady, setIsAvatarReady] = useState(false);

  // Incremental rendering for long logs in preview mode.
  // When exporting images or files, render everything immediately.
  const isMobilePreview = !isForImageExport
    && !isForExport
    && typeof window !== 'undefined'
    && window.matchMedia('(max-width: 1024px)').matches;
  const initialBatchSize = isMobilePreview ? 24 : 50;
  const renderBatchSize = isMobilePreview ? 16 : 50;
  const [visibleCount, setVisibleCount] = useState(
    isForImageExport || isForExport ? nodes.length : Math.min(initialBatchSize, nodes.length),
  );

  useEffect(() => {
    if (isForImageExport || isForExport) {
      setVisibleCount(nodes.length);
    } else {
      setVisibleCount(Math.min(initialBatchSize, nodes.length));
    }
  }, [nodes, isForImageExport, isForExport, initialBatchSize]);

  useEffect(() => {
    if (isForImageExport || isForExport) return;
    if (visibleCount >= nodes.length) return;

    const renderNextBatch = () => {
      setVisibleCount(prev => Math.min(prev + renderBatchSize, nodes.length));
    };

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(renderNextBatch, { timeout: 250 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = globalThis.setTimeout(renderNextBatch, isMobilePreview ? 120 : 60);
    return () => globalThis.clearTimeout(timer);
  }, [visibleCount, nodes.length, isForImageExport, isForExport, isMobilePreview, renderBatchSize]);

  const renderedIndicesRef = useRef<Set<number>>(new Set());
  const [allMessagesReady, setAllMessagesReady] = useState(false);

  const handleMessageRendered = useCallback((index: number) => {
    renderedIndicesRef.current.add(index);
    if (renderedIndicesRef.current.size >= nodes.length) {
        setAllMessagesReady(true);
    }
  }, [nodes.length]);

  const themeInfo = THEMES[selectedThemeKey] || THEMES.basic;
  const color: ColorPalette = colorProp 
    || ((selectedThemeKey === 'basic' || selectedThemeKey === 'custom') ? (COLORS[selectedColorKey] || COLORS.dark) : (themeInfo.color || COLORS.dark));

  useEffect(() => {
    let isMounted = true;
    if (!preCollectedAvatarMap) {
      collectCharacterAvatars(nodes, charInfo.name, isForArca, globalSettings).then(map => {
        if (isMounted) {
          setAvatarMap(map);
          setIsAvatarReady(true);
        }
      });
    } else {
      setAvatarMap(preCollectedAvatarMap);
      setIsAvatarReady(true);
    }
    return () => { isMounted = false; };
  }, [nodes, charInfo.name, isForArca, preCollectedAvatarMap, globalSettings]);

  useEffect(() => {
    renderedIndicesRef.current.clear();
    if (nodes.length === 0) {
        setAllMessagesReady(true);
    } else {
        setAllMessagesReady(false);
        // Export mode renders all messages at once. Each MessageRenderer calls
        // onRendered via useMessageProcessor, but in some environments (e.g. headless
        // / offscreen containers) useEffect timing can be unreliable. As a safety
        // net, force allMessagesReady after a short delay if onRendered hasn't fired
        // for every node.
        if (isForImageExport || isForExport) {
          const timer = setTimeout(() => {
            if (renderedIndicesRef.current.size < nodes.length) {
              setAllMessagesReady(true);
            }
          }, 2000);
          return () => clearTimeout(timer);
        }
    }
  }, [nodes, isForImageExport, isForExport]);


  useEffect(() => {
    if (isAvatarReady && allMessagesReady && onReady) {
      // Use a microtask to ensure the DOM is updated before the callback fires
      Promise.resolve().then(onReady);
    }
  }, [isAvatarReady, allMessagesReady, onReady]);

  const containerStyle: React.CSSProperties = {
      margin: isForImageExport ? '0' : '16px auto',
      width: containerWidth ? `${containerWidth}px` : '900px',
      maxWidth: 'none',
      boxSizing: 'border-box',
      fontSize: fontSize ? `${fontSize}px` : '16px',
      backgroundColor: color.background,
      borderRadius: selectedThemeKey === 'log' ? '8px' : '12px',
      overflow: 'hidden',
      padding: selectedThemeKey === 'log' ? 0 : '24px 32px',
      border: selectedThemeKey === 'log' ? 'none' : `1px solid ${color.border}`,
      boxShadow: selectedThemeKey === 'log' ? 'none' : (color.shadow || 'none'),
  };

  return (
    <div style={containerStyle}>
      {disableAnimations && (
        <style>{`
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
          }
        `}</style>
      )}
      {selectedThemeKey === 'raw' && (
        <style>{`
          .raw-message-wrapper .prose, 
          .raw-message-wrapper .chattext {
            font-size: 1em !important;
            line-height: inherit;
          }
        `}</style>
      )}
      {selectedThemeKey === 'custom' && customCss && <style>{customCss}</style>}
      {showHeader && <LogHeader 
        themeKey={selectedThemeKey} // 테마 키 전달
        layout={headerLayout} 
        charInfo={charInfo} 
        color={color}
        embedImagesAsBlob={embedImagesAsBlob} 
        showHeaderIcon={showHeaderIcon} 
        headerTags={headerTags} 
        headerBannerUrl={headerBannerUrl}
        headerBannerBlur={headerBannerBlur}
        headerBannerAlign={headerBannerAlign}
        isForExport={isForExport}
        isForArca={isForArca}
      />}
      <main>
        {nodes.slice(0, visibleCount).map((node, index) => (
          <MessageRenderer
            key={index} // It's better to have a unique key from the message data
            node={node}
            index={index}
            charInfoName={charInfo.name}
            color={color}
            themeKey={selectedThemeKey}
            avatarMap={avatarMap}
            showAvatar={showAvatar}
            showBubble={showBubble}
            isForArca={isForArca}
            embedImagesAsBlob={embedImagesAsBlob}
            allowHtmlRendering={allowHtmlRendering}
            globalSettings={globalSettings}
            imageScale={imageScale}
            imageAlign={imageAlign}
            imageStyle={imageStyle}
            imageCropActive={imageCropActive}
            imageCropAspectRatio={imageCropAspectRatio}
            imageCropVAlign={imageCropVAlign}
            imageCropHAlign={imageCropHAlign}
            imageCropHeight={imageCropHeight}
            isEditable={props.isEditable}
            onMessageUpdate={props.onMessageUpdate}
            isSelected={selectedIndices?.has(index)}
            onSelect={onMessageSelect}
            isForExport={isForExport}
            onRendered={() => handleMessageRendered(index)}
            replacementRules={props.replacementRules}
            fontSize={fontSize}
          />
        ))}
      </main>
      {showFooter && <LogFooter themeKey={selectedThemeKey} color={color} footerLeft={footerLeft} footerCenter={footerCenter} footerRight={footerRight} />}
    </div>
  );
};

export default LogContainer;
