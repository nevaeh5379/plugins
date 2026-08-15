/**
 * @file LogExporter.tsx
 * @description Primary entry point and facade for the RisuAI Log Exporter module.
 *
 * Provides:
 * 1. Declarative React component (`LogExporter`) for rendering styled chat logs.
 * 2. Imperative DOM lifecycle API (`renderLog`, `unmountLog`) using React 18/19 roots.
 * 3. Modal launchers (`openLogExporterModal`, `showLogExporterModal`, `showCopyPreviewModal`).
 * 4. Re-exports of all essential types, interfaces, and container components.
 */

/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import LogContainer from './components/LogContainer';
import {
  showCopyPreviewModal,
  type ShowCopyPreviewModalOptions,
} from './showCopyPreviewModal';
import type {
  LogContainerProps,
  ColorPalette,
  ThemeKey,
  ColorKey,
  GlobalSettings,
  ReplacementRule,
  ImageStyle,
  CharInfo,
  LogExportSettings,
  ThemeInfo,
  AvatarPosition,
  AvatarShape,
  HeaderLayout,
  MessageProps,
} from '../types';
import type {
  LogExporterSettings,
  CharInfoState,
  EstimatedImageSize,
} from './hooks/types';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Props for the `LogExporter` component (alias for `LogContainerProps`).
 */
export type LogExporterProps = LogContainerProps;

/**
 * Handle returned by `renderLog` to allow fine-grained imperative lifecycle control
 * over a mounted React root (e.g. updating props, inspecting mount status, or unmounting).
 */
export interface RenderLogHandle {
  /** The React 18/19 Root instance used for rendering */
  readonly root: Root;
  /** Returns true if the root has already been unmounted */
  readonly isUnmounted: () => boolean;
  /** Unmounts the rendered LogContainer and cleans up DOM listeners */
  readonly unmount: () => void;
  /** Updates the rendered LogContainer with new props */
  readonly update: (nextProps: LogContainerProps) => void;
}

// ============================================================================
// Main Container Component
// ============================================================================

/**
 * LogExporter - Main React container component for rendering styled chat logs.
 *
 * Wraps `LogContainer` with `React.memo` to eliminate redundant renders,
 * providing clean prop forwarding and strict TypeScript typings.
 *
 * Supports theme selection, custom colors, avatars, headers/footers,
 * inline editable messages, progressive rendering, and export previews.
 */
export const LogExporter: React.NamedExoticComponent<LogExporterProps> =
  React.memo<LogExporterProps>(function LogExporter(
    props: LogExporterProps,
  ): React.JSX.Element {
    return <LogContainer {...props} />;
  });

LogExporter.displayName = 'LogExporter';

// Re-export LogContainer for direct import and backwards compatibility
export { LogContainer };

// ============================================================================
// Imperative DOM Rendering API
// ============================================================================

/**
 * Imperatively renders the LogContainer component into a target DOM element.
 *
 * Wraps the component inside `React.StrictMode` and returns a controller handle
 * (`RenderLogHandle`) that allows callers to dynamically update props or safely unmount.
 *
 * @param container - Target DOM element or document fragment to render into
 * @param props - Configuration and data props for LogContainer
 * @returns Handle for controlling the mounted React root
 * @throws {TypeError} If `container` is null or undefined
 *
 * @example
 * ```ts
 * const handle = renderLog(document.getElementById('log-target')!, {
 *   nodes: chatElements,
 *   charInfo: { name: 'Assistant', chatName: 'Chat', avatarUrl: '' },
 *   globalSettings: { profileClasses: [], participantNameClasses: [] },
 * });
 *
 * // Dynamically update props:
 * handle.update({ ...props, fontSize: 18 });
 *
 * // Later, when cleaning up:
 * handle.unmount();
 * ```
 */
export const renderLog = (
  container: Element | DocumentFragment,
  props: LogContainerProps,
): RenderLogHandle => {
  if (!container) {
    throw new TypeError(
      '[LogExporter] Target container element must not be null or undefined.',
    );
  }

  const root = createRoot(container);
  let unmounted = false;

  root.render(
    <React.StrictMode>
      <LogExporter {...props} />
    </React.StrictMode>,
  );

  return {
    get root() {
      return root;
    },
    isUnmounted: () => unmounted,
    unmount: () => {
      if (unmounted) {
        return;
      }
      unmounted = true;
      try {
        root.unmount();
      } catch (err) {
        console.warn('[LogExporter] Error unmounting root:', err);
      }
    },
    update: (nextProps: LogContainerProps) => {
      if (unmounted) {
        console.warn(
          '[LogExporter] Cannot update props on an already unmounted root.',
        );
        return;
      }
      root.render(
        <React.StrictMode>
          <LogExporter {...nextProps} />
        </React.StrictMode>,
      );
    },
  };
};

/**
 * Safely unmounts a LogExporter instance previously created via `renderLog`
 * using its handle.
 *
 * @param handle - Controller handle returned by `renderLog` (or null/undefined)
 *
 * @example
 * ```ts
 * const handle = renderLog(container, props);
 * // Later:
 * unmountLog(handle);
 * ```
 */
export const unmountLog = (handle?: RenderLogHandle | null): void => {
  if (handle && typeof handle.unmount === 'function') {
    handle.unmount();
  }
};

// ============================================================================
// Modal Triggering Utilities
// ============================================================================

/**
 * Triggers and opens the Log Exporter fullscreen preview and export modal.
 *
 * @param options - Filtering and export options (e.g. startIndex, endIndex, singleMessage)
 * @returns Promise that resolves once the modal opens
 *
 * @example
 * ```ts
 * await openLogExporterModal({ startIndex: 0, endIndex: 10 });
 * ```
 */
export async function openLogExporterModal(
  options: ShowCopyPreviewModalOptions = {},
): Promise<void> {
  await showCopyPreviewModal(options);
}

// Aliases for convenience and backward compatibility
export { showCopyPreviewModal, openLogExporterModal as showLogExporterModal };

// ============================================================================
// Type Re-exports
// ============================================================================

export type {
  // Container & Modal Types
  LogContainerProps,
  MessageProps,
  ShowCopyPreviewModalOptions,

  // Settings & State Types
  LogExporterSettings,
  LogExportSettings,
  GlobalSettings,
  CharInfoState,
  CharInfo,
  EstimatedImageSize,

  // Theme & Styling Types
  ThemeKey,
  ThemeInfo,
  ColorKey,
  ColorPalette,
  ImageStyle,
  AvatarPosition,
  AvatarShape,
  HeaderLayout,

  // Rule Types
  ReplacementRule,
};

// Default export
export default LogExporter;
