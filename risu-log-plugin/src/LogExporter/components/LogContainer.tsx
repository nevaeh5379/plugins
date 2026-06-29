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
    avatarPosition,
    avatarShape,
  } = props;

  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(preCollectedAvatarMap || new Map());
  const [isAvatarReady, setIsAvatarReady] = useState(false);

  // Incremental rendering for long logs in preview mode.
  // When exporting images or files, render everything immediately.
  const [visibleCount, setVisibleCount] = useState(isForImageExport || isForExport ? nodes.length : 50);

  useEffect(() => {
    if (isForImageExport || isForExport) {
      setVisibleCount(nodes.length);
    } else {
      setVisibleCount(Math.min(50, nodes.length));
    }
  }, [nodes, isForImageExport, isForExport]);

  useEffect(() => {
    if (isForImageExport || isForExport) return;
    if (visibleCount >= nodes.length) return;

    const timer = setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 50, nodes.length));
    }, 80); // Load chunks of 50 messages every 80ms
    return () => clearTimeout(timer);
  }, [visibleCount, nodes.length, isForImageExport, isForExport]);

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
    }
  }, [nodes]);


  useEffect(() => {
    if (isAvatarReady && allMessagesReady && onReady) {
      // Use a microtask to ensure the DOM is updated before the callback fires
      Promise.resolve().then(onReady);
    }
  }, [isAvatarReady, allMessagesReady, onReady]);

  const containerStyle: React.CSSProperties = {
      margin: isForImageExport ? '0' : '16px auto',
      maxWidth: containerWidth ? `${containerWidth}px` : '900px',
      fontSize: fontSize ? `${fontSize}px` : '16px',
      backgroundColor: color.background,
      borderRadius: selectedThemeKey === 'log' ? '8px' : '12px',
      overflow: 'hidden',
      padding: selectedThemeKey === 'log' ? '12px 0' : '24px 32px',
      border: `1px solid ${color.border}`,
      boxShadow: color.shadow || 'none',
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
      {selectedThemeKey === 'log' && (
        <style>{`
          .chat-message-container .prose, 
          .chat-message-container .chattext,
          .chat-message-container .prose > *,
          .chat-message-container .chattext > * {
            max-width: 100% !important;
            width: 100% !important;
            margin-left: 0 !important;
            padding-left: 0 !important;
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
            avatarPosition={avatarPosition}
            avatarShape={avatarShape}
          />
        ))}
      </main>
      {showFooter && <LogFooter themeKey={selectedThemeKey} color={color} footerLeft={footerLeft} footerCenter={footerCenter} footerRight={footerRight} />}
    </div>
  );
};

export default LogContainer;