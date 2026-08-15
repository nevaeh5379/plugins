import { createRoot } from 'react-dom/client';
import LogContainer from '../components/LogContainer';
import type { LogContainerProps } from '../../types';
import { createOffscreenContainer } from '../utils/domUtils';

// ─── Types & Interfaces ──────────────────────────────────────────────────────

/**
 * Props required by LogContainer for offscreen HTML rendering,
 * omitting the internal `onReady` synchronization callback.
 */
export type LogContainerRenderProps = Omit<LogContainerProps, 'onReady'>;

/**
 * Configuration options for the standalone HTML document wrapper.
 */
export interface StandaloneHtmlDocumentOptions {
  /**
   * Title displayed in the browser tab and `<title>` tag.
   * @default 'Chat Log'
   */
  title?: string;

  /**
   * HTML language attribute for the `<html>` root tag.
   * @default 'ko'
   */
  language?: string;

  /**
   * Additional custom CSS rules to embed directly in the `<style>` tag.
   */
  customStyles?: string;

  /**
   * Fallback background color applied to the document `<body>`.
   * @default '#1a1b26'
   */
  backgroundColor?: string;
}

/**
 * Options to configure the HTML generation and rendering lifecycle.
 */
export interface GetLogHtmlOptions extends StandaloneHtmlDocumentOptions {
  /**
   * Maximum duration (in milliseconds) to wait for rendering and asset readiness
   * before timing out and capturing whatever DOM content is currently available.
   * @default 15000
   */
  timeoutMs?: number;

  /**
   * Width (in pixels) for the offscreen rendering container element.
   * When omitted, defaults to `props.containerWidth`.
   */
  containerWidth?: number;

  /**
   * Whether to wrap the resulting HTML snippet into a complete standalone HTML5
   * document (including `<!DOCTYPE html>`, `<head>`, meta tags, and responsive resets).
   * @default false
   */
  wrapStandaloneDocument?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default maximum wait time (15 seconds) for offscreen React rendering. */
export const DEFAULT_RENDER_TIMEOUT_MS = 15000;

/** Default fallback background color for standalone HTML exports. */
const DEFAULT_STANDALONE_BG_COLOR = '#1a1b26';

/** Default language for standalone document exports. */
const DEFAULT_STANDALONE_LANGUAGE = 'ko';

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Escapes unsafe characters for safe inclusion within HTML attributes or text nodes.
 *
 * @param text Raw string to escape.
 * @returns HTML-safe string.
 */
function escapeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wraps an HTML snippet into a complete, self-contained HTML5 document.
 * Includes responsive viewport configuration, charset meta tags, clean CSS resets,
 * and optional custom styles.
 *
 * @param bodyContent Inner HTML content to place within `<body>`.
 * @param options Styling and metadata options for the document.
 * @returns Fully formatted standalone HTML5 document string.
 */
export function buildStandaloneHtmlDocument(
  bodyContent: string,
  options: StandaloneHtmlDocumentOptions = {}
): string {
  const {
    title = 'Chat Log',
    language = DEFAULT_STANDALONE_LANGUAGE,
    customStyles = '',
    backgroundColor = DEFAULT_STANDALONE_BG_COLOR,
  } = options;

  const sanitizedTitle = escapeHtmlEntities(title);
  const trimmedStyles = customStyles.trim();

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${sanitizedTitle}</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%;
    }
    body {
      padding: 20px 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
      background-color: ${backgroundColor};
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    img, video {
      max-width: 100%;
      height: auto;
    }
    ${trimmedStyles ? `\n    ${trimmedStyles}` : ''}
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

// ─── Main Generator ──────────────────────────────────────────────────────────

/**
 * Renders the LogContainer component into a detached offscreen DOM container
 * using React 18 `createRoot`, waits until all messages and avatar assets trigger
 * `onReady`, and resolves with the rendered HTML string.
 *
 * Guaranteed cleanup: React root is safely unmounted, the offscreen DOM container
 * is removed, and any pending timeout timers are cleared upon completion.
 *
 * @param props LogContainer properties (excluding `onReady`).
 * @param options Configuration for timeout, container width, or standalone document wrapping.
 * @returns Promise resolving to the generated HTML string.
 */
export const getLogHtml = (
  props: LogContainerRenderProps,
  options?: GetLogHtmlOptions
): Promise<string> => {
  const {
    timeoutMs = DEFAULT_RENDER_TIMEOUT_MS,
    containerWidth = props.containerWidth,
    wrapStandaloneDocument = false,
    title,
    language = DEFAULT_STANDALONE_LANGUAGE,
    customStyles,
    backgroundColor = props.color?.background || DEFAULT_STANDALONE_BG_COLOR,
  } = options || {};

  return new Promise<string>((resolve) => {
    const { container, remove } = createOffscreenContainer(containerWidth);
    const root = createRoot(container);

    let isCompleted = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const finalizeAndResolve = () => {
      if (isCompleted) return;
      isCompleted = true;

      // Clear safety timeout if still pending
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      // Extract generated inner HTML before unmounting
      const rawHtml = container.innerHTML;

      // Safely unmount React root and clean up offscreen DOM container
      try {
        root.unmount();
      } catch (err) {
        console.warn('[htmlGenerator] Warning during React root unmount:', err);
      } finally {
        remove();
      }

      // Wrap in full HTML document if requested
      if (wrapStandaloneDocument) {
        const resolvedTitle =
          title ||
          (props.charInfo?.name
            ? `${props.charInfo.name}${props.charInfo.chatName ? ` - ${props.charInfo.chatName}` : ''}`
            : 'Chat Log');

        const combinedStyles = [props.customCss, customStyles]
          .filter(Boolean)
          .join('\n');

        const standaloneDoc = buildStandaloneHtmlDocument(rawHtml, {
          title: resolvedTitle,
          language,
          customStyles: combinedStyles,
          backgroundColor,
        });

        resolve(standaloneDoc);
      } else {
        resolve(rawHtml);
      }
    };

    const handleReady = () => {
      // Defer resolution to a microtask to ensure all React DOM commits have flushed
      Promise.resolve().then(finalizeAndResolve);
    };

    // Render LogContainer in the offscreen container
    root.render(
      <LogContainer
        {...props}
        onReady={handleReady}
      />
    );

    // Safety timeout: resolve with whatever HTML was rendered if onReady does not fire in time
    timeoutHandle = setTimeout(() => {
      if (!isCompleted) {
        console.warn(
          `[htmlGenerator] Render timed out after ${timeoutMs}ms; resolving with current offscreen DOM content.`
        );
        finalizeAndResolve();
      }
    }, timeoutMs);
  });
};

/**
 * Convenience helper to render a complete standalone HTML document from LogContainer props.
 *
 * @param props LogContainer properties (excluding `onReady`).
 * @param options Standalone document and generation options.
 * @returns Promise resolving to a complete `<!DOCTYPE html>` document string.
 */
export const generateStandaloneLogHtml = (
  props: LogContainerRenderProps,
  options?: Omit<GetLogHtmlOptions, 'wrapStandaloneDocument'>
): Promise<string> => {
  return getLogHtml(props, {
    ...options,
    wrapStandaloneDocument: true,
  });
};

export default getLogHtml;
