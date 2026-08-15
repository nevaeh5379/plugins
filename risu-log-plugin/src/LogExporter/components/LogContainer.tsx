import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
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

/** Number of extra messages rendered above/below the visible viewport in preview mode. */
const VIRTUAL_OVERSCAN = 8;

/** Fallback height (px) for messages that have not yet been measured. */
const ESTIMATED_MESSAGE_HEIGHT = 120;

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
 * Hook to virtualize the message list in preview mode, rendering only the
 * messages within (and slightly beyond) the visible viewport. Export mode
 * renders every node immediately.
 *
 * Message heights are measured in scaled screen coordinates (via
 * `getBoundingClientRect`) so they stay consistent with the scroll container's
 * `scrollTop`, which is also in scaled coordinates.
 */
function useVirtualizedRange(
  totalNodes: number,
  isExportMode: boolean,
  listRef: React.RefObject<HTMLElement | null>,
): { start: number; end: number; topPad: number; bottomPad: number } {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [listTop, setListTop] = useState(0);
  const [measureVersion, setMeasureVersion] = useState(0);
  const heightsRef = useRef<number[]>([]);
  const startRef = useRef(0);

  // Locate the scroll container and track its scroll position / size.
  useEffect(() => {
    if (isExportMode) return;
    const list = listRef.current;
    if (!list) return;

    const scrollEl = list.closest('.preview-viewport') as HTMLElement | null;
    if (!scrollEl) return;

    let rafId = 0;
    const measure = () => {
      rafId = 0;
      const listRect = list.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      setListTop(listRect.top - scrollRect.top + scrollEl.scrollTop);
      setScrollTop(scrollEl.scrollTop);
      setViewportHeight(scrollEl.clientHeight);
    };
    const scheduleMeasure = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(measure);
    };

    scheduleMeasure();
    scrollEl.addEventListener('scroll', scheduleMeasure, { passive: true });
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(scrollEl);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      scrollEl.removeEventListener('scroll', scheduleMeasure);
      ro.disconnect();
    };
  }, [isExportMode, listRef, totalNodes]);

  // Measure rendered message heights (scaled) and store them for offset math.
  useLayoutEffect(() => {
    if (isExportMode) return;
    const list = listRef.current;
    if (!list) return;

    const children = Array.from(list.children) as HTMLElement[];
    const start = startRef.current;
    const heights = heightsRef.current;
    let changed = false;

    children.forEach((child, i) => {
      const idx = start + i;
      const h = child.getBoundingClientRect().height;
      if (h > 0 && heights[idx] !== h) {
        heights[idx] = h;
        changed = true;
      }
    });

    if (changed) {
      setMeasureVersion((v) => v + 1);
    }
  }, [isExportMode, listRef, measureVersion]);

  // Compute the visible slice and spacer paddings from measured offsets.
  const { start, end, topPad, bottomPad } = useMemo(() => {
    if (isExportMode) {
      return { start: 0, end: totalNodes, topPad: 0, bottomPad: 0 };
    }

    // `measureVersion` is read to invalidate this memo when message heights change.
    void measureVersion;

    const heights = heightsRef.current;
    const offsets: number[] = new Array(totalNodes + 1);
    offsets[0] = 0;
    for (let i = 0; i < totalNodes; i++) {
      offsets[i + 1] = offsets[i] + (heights[i] || ESTIMATED_MESSAGE_HEIGHT);
    }
    const totalHeight = offsets[totalNodes];

    const localScrollTop = Math.max(0, scrollTop - listTop);
    const viewBottom = localScrollTop + viewportHeight;
    const overscan = VIRTUAL_OVERSCAN * ESTIMATED_MESSAGE_HEIGHT;

    let start = 0;
    for (let i = 0; i < totalNodes; i++) {
      if (offsets[i + 1] > localScrollTop - overscan) {
        start = i;
        break;
      }
    }

    let end = totalNodes;
    for (let i = start; i < totalNodes; i++) {
      if (offsets[i] > viewBottom + overscan) {
        end = i;
        break;
      }
    }

    start = Math.max(0, start);
    end = Math.min(totalNodes, end);

    return {
      start,
      end,
      topPad: offsets[start],
      bottomPad: totalHeight - offsets[end],
    };
  }, [isExportMode, totalNodes, scrollTop, viewportHeight, listTop, measureVersion]);

  startRef.current = start;

  return { start, end, topPad, bottomPad };
}

/**
 * Hook to track message rendering progress and safely trigger onReady callback.
 *
 * - Export mode: waits for every message to report rendered (with a safety
 *   timeout for headless/offscreen environments).
 * - Preview mode: only the visible slice is rendered, so `onReady` fires after
 *   the initial visible batch has painted (used for dimension measurement).
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

    // Preview mode: only the visible slice renders, so mark ready after the
    // initial paint to allow dimension measurement.
    const timer = setTimeout(() => setAllMessagesReady(true), 0);
    return () => clearTimeout(timer);
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

  // 3. Virtualized message range (preview) / full render (export)
  const messageListRef = useRef<HTMLElement>(null);
  const { start, end, topPad, bottomPad } = useVirtualizedRange(
    nodes.length,
    isExportMode,
    messageListRef,
  );

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
      <main className="risu-log-messages" ref={messageListRef}>
        {topPad > 0 && <div style={{ height: topPad }} aria-hidden="true" />}
        {nodes.slice(start, end).map((node, i) => {
          const index = start + i;
          return (
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
          );
        })}
        {bottomPad > 0 && <div style={{ height: bottomPad }} aria-hidden="true" />}
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
