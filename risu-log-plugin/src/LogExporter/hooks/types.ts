import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type {
  ThemeKey,
  ColorKey,
  ImageStyle,
  ReplacementRule,
  ColorPalette,
  GlobalSettings,
} from '../../types';
import type { RisuCharacter } from '../../types/risuai';
import type { UIClassInfo } from '../utils/domUtils';

// ─── Export & Layout Literal Types ──────────────────────────────────────────

/** Supported log export formats */
export type ExportFormat = 'basic' | 'html' | 'markdown' | 'text';

/** Header layout style options */
export type HeaderLayout = 'default' | 'compact' | 'banner';

/** Alignment options for embedded images */
export type ImageAlign = 'left' | 'center' | 'right';

/** Aspect ratio presets or custom value for image cropping */
export type ImageCropAspectRatio = 'original' | '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | 'custom' | string;

/** Image export resolution multiplier ('auto' or numeric factor) */
export type ImageResolution = number | 'auto';

/** Underlying DOM-to-image capture library */
export type ImageLibrary = 'html-to-image' | 'dom-to-image' | 'snapdom';

/** File format for exported image files */
export type ImageFormat = 'png' | 'jpeg' | 'webp';

/** Scaling mode for HTML preview/export */
export type HtmlScaleMode = 'font' | 'full';

/** Strategy for splitting tall exported images */
export type SplitImageMode = 'none' | 'chunk' | 'message';

/** Positioning of avatar relative to the chat bubble */
export type AvatarPosition =
  | 'left'
  | 'right'
  | 'opposite'
  | 'top-left'
  | 'top-right'
  | 'opposite-top';

/** Shape of the avatar frame */
export type AvatarShape = 'theme' | 'circle' | 'square' | 'rounded' | 'squircle';

/** Map of custom CSS class names to their enabled/disabled filter states */
export type CustomFiltersMap = Record<string, boolean>;

// ─── Log Exporter Settings ──────────────────────────────────────────────────

/**
 * Comprehensive settings schema controlling the Log Exporter UI,
 * markdown/HTML formatting, theme styling, and image capture behavior.
 */
export interface LogExporterSettings {
  // --- Format & General Options ---
  /** Target export format */
  format: ExportFormat;
  /** Active theme preset key */
  theme: ThemeKey;
  /** Active color palette key */
  color: ColorKey;
  /** Custom user-provided CSS styling */
  customCss: string;

  // --- Header Options ---
  /** Whether to render the header section */
  showHeader: boolean;
  /** Whether to display the character icon in header */
  showHeaderIcon: boolean;
  /** Comma-separated tag string for the header */
  headerTags: string;
  /** Header visual layout mode */
  headerLayout: HeaderLayout;
  /** URL for the banner background image */
  headerBannerUrl: string;
  /** Whether background blur is applied to banner */
  headerBannerBlur: boolean;
  /** Banner vertical alignment percentage (0-100) */
  headerBannerAlign: number;

  // --- Footer Options ---
  /** Whether to render the footer section */
  showFooter: boolean;
  /** Left-aligned footer text */
  footerLeft: string;
  /** Centered footer text */
  footerCenter: string;
  /** Right-aligned footer text */
  footerRight: string;

  // --- Avatar & Bubble Options ---
  /** Whether avatars are visible */
  showAvatar: boolean;
  /** Relative avatar positioning */
  avatarPosition?: AvatarPosition;
  /** Avatar frame shape */
  avatarShape?: AvatarShape;
  /** Whether chat bubbles are rendered around messages */
  showBubble: boolean;
  /** Whether hovering expands collapsed content */
  expandHover: boolean;

  // --- Image Display & Cropping ---
  /** Image scale percentage (e.g. 100 = 100%) */
  imageScale: number;
  /** Text alignment for images */
  imageAlign: ImageAlign;
  /** Frame style decoration for images */
  imageStyle: ImageStyle;
  /** Whether image cropping is enabled */
  imageCropActive: boolean;
  /** Aspect ratio preset or custom string */
  imageCropAspectRatio: ImageCropAspectRatio;
  /** Crop vertical focal alignment percentage (0-100) */
  imageCropVAlign: number;
  /** Crop horizontal focal alignment percentage (0-100) */
  imageCropHAlign: number;
  /** Custom aspect ratio height multiplier when aspect ratio is 'custom' */
  imageCropHeight: number;
  /** Whether images are converted to inline blob/base64 data */
  embedImages: boolean;

  // --- Image Capture & Export Options ---
  /** Resolution multiplier for exported images ('auto' or numeric factor) */
  imageResolution: ImageResolution;
  /** DOM-to-image library backend used for capture */
  imageLibrary: ImageLibrary;
  /** Output file format for exported images */
  imageFormat: ImageFormat;
  /** Image splitting mode for oversized logs */
  splitImage: SplitImageMode;
  /** Maximum pixel height before triggering image splitting */
  maxImageHeight: number;

  // --- Preview & Scaling Options ---
  /** Base preview font size in pixels */
  previewFontSize: number;
  /** HTML zoom / font scale multiplier */
  htmlScaleFactor: number;
  /** Method used to apply HTML scaling */
  htmlScaleMode: HtmlScaleMode;
  /** Target width for the preview container in pixels */
  previewWidth: number;

  // --- Content & Workflow Options ---
  /** Whether raw HTML view is toggled */
  rawHtmlView: boolean;
  /** Whether inline message editing is enabled */
  isEditable: boolean;
  /** Text replacement / regex transformation rules */
  replacementRules: ReplacementRule[];
  /** Whether CSS animations are disabled in output */
  disableAnimations: boolean;
  /** Compatibility mode flag for ArcaLive export */
  isForArca: boolean;
  /** Whether arbitrary HTML rendering is permitted in messages */
  allowHtmlRendering: boolean;
  /** User-defined CSS class filter toggles */
  customFilters: CustomFiltersMap;
  /** Whether WebM animated media is converted to WebP for ArcaLive export */
  convertWebM?: boolean;
}

/**
 * Default settings applied when opening the Log Exporter or resetting options.
 */
export const DEFAULT_SETTINGS: LogExporterSettings = {
  format: 'basic',
  theme: 'basic',
  color: 'dark',
  customCss: '',
  showAvatar: true,
  showBubble: true,
  showHeader: true,
  showHeaderIcon: true,
  headerTags: '',
  headerLayout: 'default',
  headerBannerUrl: '',
  headerBannerBlur: true,
  headerBannerAlign: 50,
  showFooter: true,
  footerLeft: '',
  footerCenter: 'Created by Log Plugin',
  footerRight: '',
  imageScale: 100,
  imageAlign: 'left',
  imageStyle: 'none',
  imageCropActive: false,
  imageCropAspectRatio: 'original',
  imageCropVAlign: 50,
  imageCropHAlign: 50,
  imageCropHeight: 1.0,
  embedImages: true,
  expandHover: false,
  imageResolution: 1,
  imageLibrary: 'html-to-image',
  imageFormat: 'png',
  previewFontSize: 16,
  htmlScaleFactor: 1.0,
  htmlScaleMode: 'font',
  previewWidth: 800,
  rawHtmlView: false,
  isEditable: false,
  splitImage: 'none',
  maxImageHeight: 10000,
  replacementRules: [],
  disableAnimations: true,
  isForArca: false,
  allowHtmlRendering: false,
  customFilters: {},
  avatarPosition: 'opposite',
  avatarShape: 'theme',
  convertWebM: true,
};

// ─── Progress Hook Types ────────────────────────────────────────────────────

/**
 * State representing asynchronous task progress (e.g. image export, bundling).
 */
export interface ProgressState {
  /** Whether a progress operation is currently in progress */
  active: boolean;
  /** Status description message shown to the user */
  message: string;
  /** Current completed step index */
  current: number;
  /** Total number of steps in the operation */
  total: number;
}

/**
 * Initial idle progress state.
 */
export const INITIAL_PROGRESS: ProgressState = {
  active: false,
  message: '',
  current: 0,
  total: 0,
};

/**
 * Update payload passed to `updateProgress`.
 */
export interface ProgressUpdate {
  current?: number;
  message?: string;
}

/**
 * Return type contract for the `useProgress` hook.
 */
export interface UseProgressResult {
  progress: ProgressState;
  startProgress: (message: string, total?: number) => void;
  updateProgress: (update: ProgressUpdate) => void;
  endProgress: () => void;
}

// ─── Log Data Hook Types ────────────────────────────────────────────────────

/**
 * Basic character and chat session metadata for headers and previews.
 */
export interface CharInfoState {
  charName: string;
  chatName: string;
  charAvatarUrl: string;
}

/**
 * Input configuration options for `useLogData`.
 */
export interface UseLogDataOptions {
  startIndex?: number;
  endIndex?: number;
  singleMessage?: boolean;
}

/**
 * Return type contract for the `useLogData` hook.
 */
export interface UseLogDataResult {
  isLoading: boolean;
  error: string | null;
  charInfo: CharInfoState;
  messageNodes: HTMLElement[];
  character: RisuCharacter | null;
  participants: Set<string>;
  uiClasses: UIClassInfo[];
  preCollectedAvatarMap: Map<string, string>;
  setMessageNodes: Dispatch<SetStateAction<HTMLElement[]>>;
  setCharacter: Dispatch<SetStateAction<RisuCharacter | null>>;
}

// ─── Theme Hook Types ───────────────────────────────────────────────────────

/**
 * Return type contract for the `useTheme` hook.
 */
export interface UseThemeResult {
  uiTheme: string;
  colorPalette: ColorPalette;
  backgroundColor: string;
  closedRef: MutableRefObject<boolean>;
}

// ─── Settings Hook Types ────────────────────────────────────────────────────

/**
 * Return type contract for the `useSettings` hook.
 */
export interface UseSettingsResult {
  settings: LogExporterSettings;
  globalSettings: GlobalSettings;
  handleSettingChange: (key: string, value: unknown) => void;
  handleGlobalSettingChange: (key: string, value: unknown) => Promise<void>;
}

// ─── Image Size Warning Hook Types ──────────────────────────────────────────

/**
 * Estimated rendered dimensions of the log preview container for export warning checks.
 */
export interface EstimatedImageSize {
  /** Total estimated width in pixels */
  width: number;
  /** Total estimated height in pixels */
  height: number;
  /** Maximum single message height in pixels */
  maxMessageHeight: number;
}

// ─── Selection Hook Types ───────────────────────────────────────────────────

/**
 * Return type contract for the generic `useSelection` hook.
 */
export interface UseSelectionResult<T> {
  selectedIndices: Set<number>;
  lastSelectedIndex: number | null;
  handleSelectionChange: (newSelection: Set<number>) => void;
  handleLastSelectedIndexChange: (index: number | null) => void;
  selectAll: () => void;
  deselectAll: () => void;
  invertSelection: () => void;
  deleteSelected: () => T[];
  getFilteredItems: () => T[];
  hasSelection: boolean;
}
