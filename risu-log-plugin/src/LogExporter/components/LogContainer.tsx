import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import type {
  LogContainerProps,
  ColorPalette,
  ThemeKey,
  ColorKey,
  GlobalSettings,
} from '../../types';
import { THEMES, COLORS } from './constants';
import { collectCharacterAvatars } from '../services/avatarService';
import LogHeader from './LogHeader';
import LogFooter from './LogFooter';
import MessageRenderer from './MessageRenderer';

// ============================================================================
// Constants & Static Styles
// ============================================================================

const DEFAULT_CONTAINER_WIDTH = 900;
const DEFAULT_FONT_SIZE = 16;
const EXPORT_SAFETY_TIMEOUT_MS = 2000;
const MOBILE_BREAKPOINT = 1024;
const IDLE_CALLBACK_TIMEOUT_MS = 250;

const BATCH_CONFIG = {
  mobile: { initial: 24, batch: 16, timeout: 120 },
  desktop: { initial: 50, batch: 50, timeout: 60 },
} as const;

/** Style rules injected when animations and transitions are globally disabled */
const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
`;

/** Style overrides injected when rendering raw HTML theme */
const RAW_THEME_OVERRIDE_CSS = `
  .raw-message-wrapper .prose, 
  .raw-message-wrapper .chattext {
    font-size: 1em !important;
    line-height: inherit;
  }
`;

// ============================================================================
// Helper Utilities & Custom Hooks
// ============================================================================

/**
 * Resolves the effective color palette based on theme selection, color key,
 * or an explicit color override prop.
 */
function resolveEffectiveColor(
  themeKey: ThemeKey = 'basic',
  colorKey: ColorKey = 'dark',
  overrideColor?: ColorPalette,
): ColorPalette {
  if (overrideColor) {
    return overrideColor;
  }

  const themeInfo = THEMES[themeKey] || THEMES.basic;
  if (themeKey === 'basic' || themeKey === 'custom') {
    return COLORS[colorKey] || COLORS.dark;
  }

  return themeInfo.color || COLORS.dark;
}

/**
 * Computes root container styling based on theme, dimensions, and export mode.
 */
function computeContainerStyle({
  isForImageExport,
  containerWidth,
  fontSize,
  color,
  selectedThemeKey,
}: {
  isForImageExport: boolean;
  containerWidth?: number;
  fontSize?: number;
  color: ColorPalette;
  selectedThemeKey: ThemeKey;
}): React.CSSProperties {
  const isLogTheme = selectedThemeKey === 'log';

  return {
    margin: isForImageExport ? '0' : '16px auto',
    width: containerWidth ? `${containerWidth}px` : `${DEFAULT_CONTAINER_WIDTH}px`,
    maxWidth: 'none',
    boxSizing: 'border-box',
    fontSize: fontSize ? `${fontSize}px` : `${DEFAULT_FONT_SIZE}px`,
    backgroundColor: color.background,
    borderRadius: isLogTheme ? '8px' : '12px',
    overflow: 'hidden',
    padding: isLogTheme ? 0 : '24px 32px',
    border: isLogTheme ? 'none' : `1px solid ${color.border}`,
    boxShadow: isLogTheme ? 'none' : (color.shadow || 'none'),
  };
}

/**
 * Hook to manage asynchronous character avatar mapping and readiness status.
 */
function useAvatarResolution(
  nodes: Element[],
  charName: string,
  isForArca: boolean,
  globalSettings: GlobalSettings,
  preCollectedAvatarMap?: Map<string, string>,
): { avatarMap: Map<string, string>; isAvatarReady: boolean } {
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(
    () => preCollectedAvatarMap || new Map(),
  );
  const [isAvatarReady, setIsAvatarReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (preCollectedAvatarMap) {
      setAvatarMap(preCollectedAvatarMap);
      setIsAvatarReady(true);
      return;
    }

    collectCharacterAvatars(nodes, charName, isForArca, globalSettings)
      .then((map) => {
        if (isMounted) {
          setAvatarMap(map);
          setIsAvatarReady(true);
        }
      })
      .catch((error) => {
        console.error('Failed to collect character avatars:', error);
        if (isMounted) {
          setIsAvatarReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [nodes, charName, isForArca, preCollectedAvatarMap, globalSettings]);

  return { avatarMap, isAvatarReady };
}

/**
 * Hook to manage progressive batch rendering for large logs in preview mode,
 * while rendering all nodes immediately during export.
 */
function useIncrementalRendering(
  totalNodes: number,
  isExportMode: boolean,
): number {
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;

  const batchConfig = isMobile ? BATCH_CONFIG.mobile : BATCH_CONFIG.desktop;
  const initialCount = isExportMode
    ? totalNodes
    : Math.min(batchConfig.initial, totalNodes);

  const [visibleCount, setVisibleCount] = useState<number>(initialCount);

  // Reset visible count when total node count or export mode changes
  useEffect(() => {
    if (isExportMode) {
      setVisibleCount(totalNodes);
    } else {
      setVisibleCount(Math.min(batchConfig.initial, totalNodes));
    }
  }, [totalNodes, isExportMode, batchConfig.initial]);

  // Incrementally render next batch using requestIdleCallback or setTimeout
  useEffect(() => {
    if (isExportMode || visibleCount >= totalNodes) return;

    const renderNextBatch = () => {
      setVisibleCount((prev) => Math.min(prev + batchConfig.batch, totalNodes));
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(renderNextBatch, {
        timeout: IDLE_CALLBACK_TIMEOUT_MS,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = setTimeout(renderNextBatch, batchConfig.timeout);
    return () => clearTimeout(timer);
  }, [visibleCount, totalNodes, isExportMode, batchConfig.batch, batchConfig.timeout]);

  return visibleCount;
}

/**
 * Hook to track message rendering progress and safely trigger onReady callback.
 */
function useMessageReadinessSync(
  nodeCount: number,
  isExportMode: boolean,
  isAvatarReady: boolean,
  onReady?: () => void,
): { handleMessageRendered: (index: number) => void } {
  const renderedIndicesRef = useRef<Set<number>>(new Set());
  const [allMessagesReady, setAllMessagesReady] = useState(false);

  const handleMessageRendered = useCallback(
    (index: number) => {
      renderedIndicesRef.current.add(index);
      if (renderedIndicesRef.current.size >= nodeCount) {
        setAllMessagesReady(true);
      }
    },
    [nodeCount],
  );

  useEffect(() => {
    renderedIndicesRef.current.clear();
    if (nodeCount === 0) {
      setAllMessagesReady(true);
      return;
    }

    setAllMessagesReady(false);

    // Export mode renders all messages at once. As a safety net in headless/offscreen
    // environments where effect scheduling can be delayed, force allMessagesReady after a timeout.
    if (isExportMode) {
      const timer = setTimeout(() => {
        if (renderedIndicesRef.current.size < nodeCount) {
          setAllMessagesReady(true);
        }
      }, EXPORT_SAFETY_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }
  }, [nodeCount, isExportMode]);

  useEffect(() => {
    if (isAvatarReady && allMessagesReady && onReady) {
      // Use a microtask to ensure DOM is flushed before notifying onReady
      Promise.resolve().then(onReady);
    }
  }, [isAvatarReady, allMessagesReady, onReady]);

  return { handleMessageRendered };
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main container component for the chat log exporter.
 * Orchestrates theme styles, headers/footers, avatar collection, progressive rendering,
 * and message readiness synchronization.
 */
export const LogContainer: React.FC<LogContainerProps> = (props) => {
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
    isForImageExport = false,
    isForExport = false,
    disableAnimations = false,
    isEditable,
    onMessageUpdate,
    replacementRules,
  } = props;

  const isExportMode = Boolean(isForImageExport || isForExport);

  // 1. Color Palette Resolution
  const color = useMemo(
    () => resolveEffectiveColor(selectedThemeKey, selectedColorKey, colorProp),
    [selectedThemeKey, selectedColorKey, colorProp],
  );

  // 2. Avatar Resolution & Pre-fetching
  const { avatarMap, isAvatarReady } = useAvatarResolution(
    nodes,
    charInfo.name,
    isForArca,
    globalSettings,
    preCollectedAvatarMap,
  );

  // 3. Progressive / Batch Rendering in Preview
  const visibleCount = useIncrementalRendering(nodes.length, isExportMode);

  // 4. Message Readiness & onReady Trigger Synchronization
  const { handleMessageRendered } = useMessageReadinessSync(
    nodes.length,
    isExportMode,
    isAvatarReady,
    onReady,
  );

  // 5. Container Style Computation
  const containerStyle = useMemo(
    () =>
      computeContainerStyle({
        isForImageExport: Boolean(isForImageExport),
        containerWidth,
        fontSize,
        color,
        selectedThemeKey,
      }),
    [isForImageExport, containerWidth, fontSize, color, selectedThemeKey],
  );

  return (
    <div
      style={containerStyle}
      className="risu-log-container"
      data-theme={selectedThemeKey}
      role="region"
      aria-label="Chat Log Container"
    >
      {/* Animation suppression style tag */}
      {disableAnimations && <style>{DISABLE_ANIMATIONS_CSS}</style>}

      {/* Raw theme style override */}
      {selectedThemeKey === 'raw' && <style>{RAW_THEME_OVERRIDE_CSS}</style>}

      {/* Custom CSS injection */}
      {selectedThemeKey === 'custom' && customCss && <style>{customCss}</style>}

      {/* Log Header */}
      {showHeader && (
        <LogHeader
          themeKey={selectedThemeKey}
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
        />
      )}

      {/* Message List */}
      <main className="risu-log-messages">
        {nodes.slice(0, visibleCount).map((node, index) => (
          <MessageRenderer
            key={index}
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
            isEditable={isEditable}
            onMessageUpdate={onMessageUpdate}
            isSelected={selectedIndices?.has(index)}
            onSelect={onMessageSelect}
            isForExport={isForExport}
            onRendered={() => handleMessageRendered(index)}
            replacementRules={replacementRules}
            fontSize={fontSize}
          />
        ))}
      </main>

      {/* Log Footer */}
      {showFooter && (
        <LogFooter
          themeKey={selectedThemeKey}
          color={color}
          footerLeft={footerLeft}
          footerCenter={footerCenter}
          footerRight={footerRight}
        />
      )}
    </div>
  );
};

LogContainer.displayName = 'LogContainer';

export default React.memo(LogContainer);
