export type ImageStyle = 'none' | 'gallery' | 'modern' | 'tape';

export interface CharInfo {
  name: string;
  chatName: string;
  avatarUrl: string;
  profileImageUrl?: string;
}

export interface ColorPalette {
    name?: string;
  background: string;
  text: string;
  nameColor: string;
  border: string;
  avatarBorder: string;
  shadow: string;
  cardBg: string;
  cardBgUser: string;
  // 테마별 추가 색상
  quoteBg?: string;
  quoteText?: string;
  thoughtBg?: string;
  thoughtText?: string;
  soundBg?: string;
  soundText?: string;
  separator?: string;
  textSecondary?: string;
}

export interface ThemeInfo {
name: string;
description: string;
  color?: ColorPalette;
}

export type ThemeKey = 'basic' | 'custom' | 'modern' | 'smart' | 'simple' | 'log' | 'raw';
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

// 메인 컴포넌트의 Props
export interface LogContainerProps {
  nodes: Element[];
  charInfo: CharInfo;
  selectedThemeKey?: ThemeKey;
  selectedColorKey?: ColorKey;
  color?: ColorPalette;
  customCss?: string;
  showAvatar?: boolean;
  showHeader?: boolean;
  showHeaderIcon?: boolean;
  headerTags?: string;
  headerLayout?: 'default' | 'compact' | 'banner' | 'smart' | 'cover';
  headerBannerUrl?: string;
  headerBannerBlur?: boolean;
  headerBannerAlign?: number;
  showFooter?: boolean;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  showBubble?: boolean;
  isForArca?: boolean;
  embedImagesAsBlob?: boolean;
  preCollectedAvatarMap?: Map<string, string>;
  allowHtmlRendering?: boolean;
  onReady?: () => void;
  globalSettings: GlobalSettings;
  fontSize?: number;
  containerWidth?: number;
  imageScale?: number;
  imageAlign?: 'left' | 'center' | 'right';
  imageStyle?: ImageStyle;
  imageCropActive?: boolean;
  imageCropAspectRatio?: string;
  imageCropVAlign?: number;
  imageCropHAlign?: number;
  imageCropHeight?: number;
  isEditable?: boolean;
  onMessageUpdate?: (index: number, newHtml: string) => void;
  selectedIndices?: Set<number>;
  onMessageSelect?: (index: number, e: React.MouseEvent) => void;
  isForImageExport?: boolean;
  isForExport?: boolean;
  replacementRules?: ReplacementRule[];
  disableAnimations?: boolean;
}

// 메시지 컴포넌트 Props
export interface MessageProps {
  node: Element;
  index: number;
  charInfoName: string;
  color: ColorPalette;
  themeKey: ThemeKey;
  avatarMap: Map<string, string>;
  showAvatar: boolean;
  showBubble: boolean;
  isForArca: boolean;
  embedImagesAsBlob: boolean;
  allowHtmlRendering: boolean;
  globalSettings: GlobalSettings;
  imageScale?: number;
  imageAlign?: 'left' | 'center' | 'right';
  imageStyle?: ImageStyle;
  imageCropActive?: boolean;
  imageCropAspectRatio?: string;
  imageCropVAlign?: number;
  imageCropHAlign?: number;
  imageCropHeight?: number;
  isEditable?: boolean;
  onMessageUpdate?: (index: number, newHtml: string) => void;
  isSelected?: boolean;
  onSelect?: (index: number, e: React.MouseEvent) => void;
  isForExport?: boolean;
  onRendered?: () => void;
  replacementRules?: ReplacementRule[];
  fontSize?: number;
}

export type LogNode = HTMLElement;

export interface ArcaImage {
  url: string;
  filename: string;
  isWebM: boolean;
}

export interface GlobalSettings {
  profileClasses: string[];
  participantNameClasses: string[];
  defaultClassesAdded?: boolean;
  uiTheme?: string;
  filteredParticipants?: string[];
}

export interface ReplacementRule {
  id: string;
  pattern: string;
  replacement: string;
  flags?: string;
  isRegex?: boolean;
  isEnabled?: boolean;
}

export interface LogExportSettings {
  // Format
  format?: 'basic' | 'html' | 'markdown' | 'text';
  // Theme & Color
  theme?: string;
  color?: string | ColorPalette;
  // Header
  showHeader?: boolean;
  showHeaderIcon?: boolean;
  headerTags?: string;
  headerLayout?: 'default' | 'compact' | 'banner';
  headerBannerUrl?: string;
  headerBannerBlur?: boolean;
  headerBannerAlign?: number;
  // Footer
  showFooter?: boolean;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  // Display
  showAvatar?: boolean;
  showBubble?: boolean;
  // Content
  embedImages?: boolean;
  replacementRules?: ReplacementRule[];
  expandHover?: boolean;
  disableAnimations?: boolean;
  rawHtmlView?: boolean;
  isEditable?: boolean;
  // HTML scaling
  htmlScaleMode?: 'font' | 'full';
  htmlScaleFactor?: number;
  previewFontSize?: number;
  previewWidth?: number;
  // Image export
  imageScale?: number;
  imageAlign?: 'left' | 'center' | 'right';
  imageStyle?: ImageStyle;
  imageCropActive?: boolean;
  imageCropAspectRatio?: string;
  imageCropVAlign?: number;
  imageCropHAlign?: number;
  imageCropHeight?: number;
  imageResolution?: number | 'auto';
  imageLibrary?: 'html-to-image' | 'dom-to-image' | 'snapdom';
  imageFormat?: 'png' | 'jpeg' | 'webp';
  splitImage?: 'none' | 'chunk' | 'message';
  maxImageHeight?: number;
  customCss?: string;
  customFilters?: Record<string, boolean>;
  // Arca helper
  convertWebM?: boolean;
  // Callbacks (for image export)
  onProgressStart?: (message: string, total: number) => void;
  onProgressUpdate?: (update: { current?: number; message?: string }) => void;
  onProgressEnd?: () => void;
  // External data
  charAvatarUrl?: string;
}















// Shared component prop types for headers and footers
export interface FooterProps {
  color: ColorPalette;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

export interface LogHeaderProps {
  charInfo: CharInfo;
  color: ColorPalette;
  embedImagesAsBlob: boolean;
  showHeaderIcon?: boolean;
  headerTags?: string;
  headerBannerUrl?: string;
  headerBannerBlur?: boolean;
  headerBannerAlign?: number;
  isForExport?: boolean;
  isForArca?: boolean;
}

export interface Persona {
  id: string;
  name: string;
  icon: string;
}

export interface DatabaseResponse {
  personas?: Persona[];
  selectedPersona?: string;
  userIcon?: string;
  username?: string;
  [key: string]: unknown;
}
