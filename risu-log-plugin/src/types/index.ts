/**
 * @file index.ts
 * @description Central shared TypeScript type definitions and interfaces for the RisuAI Log Plugin.
 * Contains domain models, theme configurations, image capture settings, component prop contracts,
 * and data models for log rendering and multi-format export pipelines.
 */

import type React from 'react';

// ============================================================================
// 1. Theme & Color Palette Definitions
// ============================================================================

/**
 * Built-in visual theme identifiers supported by the log renderer.
 */
export type ThemeKey =
  | 'basic'
  | 'custom'
  | 'modern'
  | 'smart'
  | 'simple'
  | 'log'
  | 'raw';

/**
 * Built-in color preset identifiers available across themes.
 */
export type ColorKey =
  | 'dark'
  | 'classic'
  | 'light'
  | 'sepia'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'cyberpunk'
  | 'monochrome'
  | 'highcontrast'
  | 'darkcontrast';

/**
 * Complete color palette definition specifying CSS colors used across
 * background, text, borders, message cards, and special formatted blocks.
 */
export interface ColorPalette {
  /** Optional human-readable display name of the palette */
  name?: string;
  /** Main container background color (e.g., '#1e1e1e') */
  background: string;
  /** Primary body text color */
  text: string;
  /** Character / participant name label color */
  nameColor: string;
  /** Outer container and divider border color */
  border: string;
  /** Avatar frame border color */
  avatarBorder: string;
  /** Box shadow styling string for message cards / containers */
  shadow: string;
  /** Background color for AI character message cards */
  cardBg: string;
  /** Background color for user message cards */
  cardBgUser: string;

  // --- Theme-Specific Optional Colors ---
  /** Background color for blockquotes / narration segments */
  quoteBg?: string;
  /** Text color inside blockquotes / narration segments */
  quoteText?: string;
  /** Background color for internal monologue / thought bubbles */
  thoughtBg?: string;
  /** Text color inside internal monologue / thought bubbles */
  thoughtText?: string;
  /** Background color for sound effect / audio tags */
  soundBg?: string;
  /** Text color inside sound effect / audio tags */
  soundText?: string;
  /** Color of horizontal separators / message dividers */
  separator?: string;
  /** Secondary / muted text color (timestamps, metadata, etc.) */
  textSecondary?: string;
}

/**
 * Theme descriptor object containing metadata and optional default palette.
 */
export interface ThemeInfo {
  /** Display name of the theme */
  name: string;
  /** Short description explaining the visual style and characteristics */
  description: string;
  /** Optional custom or preset color palette bundled with this theme */
  color?: ColorPalette;
}

// ============================================================================
// 2. Image, Layout & Visual Styling Literal Types
// ============================================================================

/**
 * Visual frame decoration styles for embedded chat images.
 */
export type ImageStyle = 'none' | 'gallery' | 'modern' | 'tape';

/**
 * Horizontal alignment options for embedded chat images.
 */
export type ImageAlign = 'left' | 'center' | 'right';

/**
 * Aspect ratio presets or custom ratio string for image cropping.
 * Uses `(string & {})` to maintain IDE autocompletion for presets while allowing custom strings.
 */
export type ImageCropAspectRatio =
  | 'original'
  | '1:1'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | 'custom'
  | (string & {});

/**
 * Supported layout configurations for the log header section.
 */
export type HeaderLayout =
  | 'default'
  | 'compact'
  | 'banner'
  | 'smart'
  | 'cover';

/**
 * Positioning of the avatar relative to the chat message bubble.
 */
export type AvatarPosition =
  | 'left'
  | 'right'
  | 'opposite'
  | 'top-left'
  | 'top-right'
  | 'opposite-top';

/**
 * Border frame shape for participant avatars.
 */
export type AvatarShape =
  | 'theme'
  | 'circle'
  | 'square'
  | 'rounded'
  | 'squircle';

/**
 * Target output format for exporting chat logs.
 */
export type ExportFormat = 'basic' | 'html' | 'markdown' | 'text';

/**
 * Scaling mode applied to HTML preview and standalone HTML export.
 */
export type HtmlScaleMode = 'font' | 'full';

/**
 * Resolution scale factor for image rendering ('auto' or numeric multiplier).
 */
export type ImageResolution = number | 'auto';

/**
 * DOM-to-image capture library backend.
 */
export type ImageLibrary = 'html-to-image' | 'dom-to-image' | 'snapdom';

/**
 * Output image format for rendered screenshot files.
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/**
 * Slicing strategy for splitting large logs into multiple image chunks.
 */
export type SplitImageMode = 'none' | 'chunk' | 'message';

/**
 * Map of custom CSS class names to their enabled/disabled filter state.
 */
export type CustomFiltersMap = Record<string, boolean>;

// ============================================================================
// 3. Image Cropping, Display & ArcaLive Media Types
// ============================================================================

/**
 * Configuration options for image cropping and focal positioning.
 */
export interface ImageCropOptions {
  /** Whether image cropping / aspect-ratio bounding is active */
  imageCropActive?: boolean;
  /** Aspect ratio preset or custom string value (e.g. '1:1', '16:9') */
  imageCropAspectRatio?: ImageCropAspectRatio;
  /** Vertical focal alignment percentage (0-100, default 50) */
  imageCropVAlign?: number;
  /** Horizontal focal alignment percentage (0-100, default 50) */
  imageCropHAlign?: number;
  /** Custom aspect ratio height multiplier when aspect ratio is 'custom' */
  imageCropHeight?: number;
}

/**
 * Consolidated display options for embedded chat images.
 */
export interface ImageDisplayOptions extends ImageCropOptions {
  /** Image scale factor percentage (e.g. 100 = 100%) */
  imageScale?: number;
  /** Image horizontal alignment */
  imageAlign?: ImageAlign;
  /** Visual frame style for images */
  imageStyle?: ImageStyle;
}

/**
 * Image metadata extracted for ArcaLive export uploads.
 */
export interface ArcaImage {
  /** Source URL of the image or converted asset */
  url: string;
  /** File name assigned during upload packaging */
  filename: string;
  /** Whether the original source was a WebM video/animation */
  isWebM: boolean;
  /** Optional placeholder string or BBCode replacement token */
  placeholder?: string;
}

/**
 * Result of ArcaLive content generation containing the formatted BBCode HTML and media list.
 */
export interface ArcaContentResult {
  /** Formatted HTML string ready for ArcaLive posting */
  html: string;
  /** List of media items to be uploaded to ArcaLive */
  images: ArcaImage[];
}

/**
 * Options for generating ArcaLive content.
 */
export interface GenerateArcaContentOptions {
  /** Whether WebM video/animation files should be converted to animated WebP */
  convertWebM: boolean;
}

// ============================================================================
// 4. Character, Persona & Database Types
// ============================================================================

/**
 * Basic character and active chat session metadata used in headers and avatars.
 */
export interface CharInfo {
  /** Primary character name */
  name: string;
  /** Active chat session title */
  chatName: string;
  /** Character avatar asset URL or data URI */
  avatarUrl: string;
  /** Optional dedicated profile / background image URL */
  profileImageUrl?: string;
}

/**
 * Persona profile information retrieved from RisuAI database.
 */
export interface Persona {
  /** Unique persona identifier */
  id?: string;
  /** Persona display name */
  name: string;
  /** Persona icon asset ID or URL */
  icon: string;
  /** Persona prompt/description */
  personaPrompt?: string;
  /** Whether persona uses large portrait display */
  largePortrait?: boolean;
  /** Persona user notes */
  note?: string;
  /** Forward compatibility index signature */
  [key: string]: unknown;
}

/**
 * Raw response format returned by RisuAI database queries.
 */
export interface DatabaseResponse {
  /** List of available user personas */
  personas?: Persona[];
  /** Identifier of the currently active persona */
  selectedPersona?: string;
  /** User avatar icon asset ID or URL */
  userIcon?: string;
  /** User display name */
  username?: string;
  /** Active UI theme name */
  theme?: string;
  /** Active text theme name */
  textTheme?: string;
  /** Global custom CSS injection */
  customCSS?: string;
  /** Extensible database record key-value pairs */
  [key: string]: unknown;
}

// ============================================================================
// 5. Rules & Global Plugin Settings
// ============================================================================

/**
 * Regular expression or string replacement rule for text transformation.
 */
export interface ReplacementRule {
  /** Unique rule identifier */
  id: string;
  /** Search pattern (plain text or regex pattern) */
  pattern: string;
  /** Replacement string (supports regex capture groups like $1, $2) */
  replacement: string;
  /** Regex flags (e.g., 'g', 'i', 'm') */
  flags?: string;
  /** Whether pattern should be evaluated as a regular expression */
  isRegex?: boolean;
  /** Whether this replacement rule is currently active */
  isEnabled?: boolean;
}

/**
 * Global plugin configuration settings persisted across sessions.
 */
export interface GlobalSettings {
  /** CSS class selectors identifying character avatar/profile elements */
  profileClasses: string[];
  /** CSS class selectors identifying participant name header elements */
  participantNameClasses: string[];
  /** Whether default class selectors have been populated */
  defaultClassesAdded?: boolean;
  /** RisuAI host UI theme identifier (e.g., 'dark', 'light') */
  uiTheme?: string;
  /** List of participant names excluded from the rendered log */
  filteredParticipants?: string[];
}

// ============================================================================
// 6. Log Export Settings & Progress Callbacks
// ============================================================================

/**
 * Progress status update payload emitted during long-running export tasks.
 */
export interface ProgressUpdatePayload {
  /** Current completed step index */
  current?: number;
  /** Status description message shown to the user */
  message?: string;
}

/**
 * Optional callback handlers for tracking asynchronous export lifecycle events.
 */
export interface LogExportProgressCallbacks {
  /** Callback fired when an asynchronous export process begins */
  onProgressStart?: (message: string, total: number) => void;
  /** Callback fired with progress status updates */
  onProgressUpdate?: (update: ProgressUpdatePayload) => void;
  /** Callback fired when the export process completes */
  onProgressEnd?: () => void;
}

/**
 * Comprehensive settings schema controlling log rendering, visual theming,
 * preview scaling, ArcaLive compatibility, and image capture options.
 */
export interface LogExportSettings
  extends ImageDisplayOptions,
    LogExportProgressCallbacks {
  // --- Format & Theming ---
  /** Target export format */
  format?: ExportFormat;
  /** Active theme key or custom theme name */
  theme?: ThemeKey | string;
  /** Active color palette key or custom ColorPalette object */
  color?: ColorKey | ColorPalette | string;
  /** Custom user-provided CSS styling string */
  customCss?: string;

  // --- Header Options ---
  /** Whether to render the header section */
  showHeader?: boolean;
  /** Whether to display the character icon in header */
  showHeaderIcon?: boolean;
  /** Comma-separated tag string rendered in header */
  headerTags?: string;
  /** Header visual layout style */
  headerLayout?: HeaderLayout;
  /** URL for the banner background image */
  headerBannerUrl?: string;
  /** Whether background blur filter is applied to the banner image */
  headerBannerBlur?: boolean;
  /** Banner vertical focal alignment percentage (0-100) */
  headerBannerAlign?: number;

  // --- Footer Options ---
  /** Whether to render the footer section */
  showFooter?: boolean;
  /** Left-aligned footer text */
  footerLeft?: string;
  /** Centered footer text */
  footerCenter?: string;
  /** Right-aligned footer text */
  footerRight?: string;

  // --- Avatar & Bubble Options ---
  /** Whether avatars are visible */
  showAvatar?: boolean;
  /** Relative positioning of avatars */
  avatarPosition?: AvatarPosition;
  /** Visual shape of avatar frames */
  avatarShape?: AvatarShape;
  /** Whether chat bubbles are rendered around messages */
  showBubble?: boolean;
  /** Whether hovering expands collapsed content */
  expandHover?: boolean;

  // --- Content & Transformations ---
  /** Whether images are converted to inline base64/blob data */
  embedImages?: boolean;
  /** List of text replacement / regex transformation rules */
  replacementRules?: ReplacementRule[];
  /** Whether CSS animations and transitions are disabled */
  disableAnimations?: boolean;
  /** Whether raw HTML source view is toggled */
  rawHtmlView?: boolean;
  /** Whether inline message editing is enabled */
  isEditable?: boolean;
  /** Compatibility mode flag for ArcaLive export formatting */
  isForArca?: boolean;
  /** Whether arbitrary HTML rendering is permitted in messages */
  allowHtmlRendering?: boolean;
  /** User-defined CSS class filter toggles */
  customFilters?: CustomFiltersMap;

  // --- HTML Preview & Scaling ---
  /** Method used to apply HTML preview scaling */
  htmlScaleMode?: HtmlScaleMode;
  /** HTML zoom / font scale multiplier */
  htmlScaleFactor?: number;
  /** Base preview font size in pixels */
  previewFontSize?: number;
  /** Target width for the preview container in pixels */
  previewWidth?: number;

  // --- Image Capture & Splitting ---
  /** Resolution multiplier for exported images */
  imageResolution?: ImageResolution;
  /** DOM-to-image library backend used for image capture */
  imageLibrary?: ImageLibrary;
  /** Output file format for exported images */
  imageFormat?: ImageFormat;
  /** Image splitting mode for oversized logs */
  splitImage?: SplitImageMode;
  /** Maximum pixel height before triggering image splitting */
  maxImageHeight?: number;

  // --- ArcaLive Export Options ---
  /** Whether WebM video/animations are converted to animated WebP */
  convertWebM?: boolean;

  // --- External Character Data ---
  /** Override URL for character avatar image */
  charAvatarUrl?: string;
}

// ============================================================================
// 7. Component Prop Interfaces
// ============================================================================

/**
 * DOM node representing a single parsed chat message element.
 */
export type LogNode = HTMLElement;

/**
 * Props for the main `LogContainer` component which renders the full chat log.
 */
export interface LogContainerProps extends ImageDisplayOptions {
  /** Array of DOM elements representing the parsed chat log messages */
  nodes: Element[];
  /** Character and active chat session metadata */
  charInfo: CharInfo;
  /** Selected theme preset key */
  selectedThemeKey?: ThemeKey;
  /** Selected color preset key */
  selectedColorKey?: ColorKey;
  /** Active resolved color palette */
  color?: ColorPalette;
  /** Custom CSS string injected into the container scope */
  customCss?: string;
  /** Whether character avatars are visible */
  showAvatar?: boolean;
  /** Whether the header section is rendered */
  showHeader?: boolean;
  /** Whether character icon is shown in header */
  showHeaderIcon?: boolean;
  /** Header tag string (comma-separated or formatted text) */
  headerTags?: string;
  /** Header layout preset */
  headerLayout?: HeaderLayout;
  /** Header banner background image URL */
  headerBannerUrl?: string;
  /** Whether background blur is applied to banner */
  headerBannerBlur?: boolean;
  /** Banner vertical alignment percentage (0-100) */
  headerBannerAlign?: number;
  /** Whether the footer section is rendered */
  showFooter?: boolean;
  /** Left-aligned footer text */
  footerLeft?: string;
  /** Centered footer text */
  footerCenter?: string;
  /** Right-aligned footer text */
  footerRight?: string;
  /** Whether speech bubbles are rendered around messages */
  showBubble?: boolean;
  /** Whether rendering in ArcaLive compatibility mode */
  isForArca?: boolean;
  /** Whether embedded images should be resolved as blob URLs */
  embedImagesAsBlob?: boolean;
  /** Pre-collected mapping of character names to avatar asset URLs */
  preCollectedAvatarMap?: Map<string, string>;
  /** Whether arbitrary HTML rendering is permitted */
  allowHtmlRendering?: boolean;
  /** Callback invoked once all messages have finished initial render */
  onReady?: () => void;
  /** Global plugin settings (class selectors, filters, UI theme) */
  globalSettings: GlobalSettings;
  /** Base font size in pixels */
  fontSize?: number;
  /** Container max-width in pixels */
  containerWidth?: number;
  /** Whether inline message content editing is enabled */
  isEditable?: boolean;
  /** Handler fired when a message's HTML content is updated */
  onMessageUpdate?: (index: number, newHtml: string) => void;
  /** Set of message indices currently selected */
  selectedIndices?: Set<number>;
  /** Handler fired when a message card is clicked for selection */
  onMessageSelect?: (index: number, e: React.MouseEvent) => void;
  /** Whether rendering inside an offscreen container for image capture */
  isForImageExport?: boolean;
  /** Whether rendering for general export (HTML / markdown / image) */
  isForExport?: boolean;
  /** Whether CSS animations and transitions are disabled */
  disableAnimations?: boolean;
  /** Relative positioning of avatars */
  avatarPosition?: AvatarPosition;
  /** Visual shape of avatar frames */
  avatarShape?: AvatarShape;
  /** List of text replacement / regex transformation rules */
  replacementRules?: ReplacementRule[];
}

/**
 * Props for individual `MessageRenderer` and theme-specific message components.
 */
export interface MessageProps extends ImageDisplayOptions {
  /** DOM element containing the parsed message content */
  node: Element;
  /** Zero-based message index within the current log */
  index: number;
  /** Primary character name for speaker resolution */
  charInfoName: string;
  /** Active resolved color palette */
  color: ColorPalette;
  /** Active theme key */
  themeKey: ThemeKey;
  /** Pre-collected map of character names to avatar URLs */
  avatarMap: Map<string, string>;
  /** Whether avatar should be displayed for this message */
  showAvatar: boolean;
  /** Whether speech bubble styling should be applied */
  showBubble: boolean;
  /** Whether rendering for ArcaLive export */
  isForArca: boolean;
  /** Whether image elements should use blob URLs */
  embedImagesAsBlob: boolean;
  /** Whether arbitrary HTML rendering is permitted */
  allowHtmlRendering: boolean;
  /** Global plugin settings */
  globalSettings: GlobalSettings;
  /** Whether message content is editable inline */
  isEditable?: boolean;
  /** Handler fired when message content is updated */
  onMessageUpdate?: (index: number, newHtml: string) => void;
  /** Whether this message is currently selected */
  isSelected?: boolean;
  /** Handler fired when this message is clicked for selection */
  onSelect?: (index: number, e: React.MouseEvent) => void;
  /** Whether rendering for export pipeline */
  isForExport?: boolean;
  /** Callback fired after this message finishes rendering */
  onRendered?: () => void;
  /** List of text replacement rules */
  replacementRules?: ReplacementRule[];
  /** Base font size in pixels */
  fontSize?: number;
}

/**
 * Props for the log header component variants.
 */
export interface LogHeaderProps {
  /** Character and active chat session metadata */
  charInfo: CharInfo;
  /** Active color palette */
  color: ColorPalette;
  /** Whether images should be embedded as blobs */
  embedImagesAsBlob: boolean;
  /** Whether to render character avatar in header */
  showHeaderIcon?: boolean;
  /** Tag string to display in header badge */
  headerTags?: string;
  /** Header banner background image URL */
  headerBannerUrl?: string;
  /** Whether banner background blur is enabled */
  headerBannerBlur?: boolean;
  /** Banner vertical alignment percentage (0-100) */
  headerBannerAlign?: number;
  /** Whether rendering for export */
  isForExport?: boolean;
  /** Whether rendering in ArcaLive compatibility mode */
  isForArca?: boolean;
  /** Optional active theme key */
  themeKey?: ThemeKey | string;
  /** Optional chosen header layout */
  layout?: HeaderLayout;
}

/**
 * Props for the log footer component variants.
 */
export interface FooterProps {
  /** Active color palette */
  color: ColorPalette;
  /** Left-aligned footer text */
  footerLeft?: string;
  /** Centered footer text */
  footerCenter?: string;
  /** Right-aligned footer text */
  footerRight?: string;
}

/**
 * Props for the LogFooter dispatcher component.
 */
export interface LogFooterProps extends FooterProps {
  /** Active theme preset key */
  themeKey?: ThemeKey;
}

// ============================================================================
// 8. Re-exports
// ============================================================================

export * from './risuai';
