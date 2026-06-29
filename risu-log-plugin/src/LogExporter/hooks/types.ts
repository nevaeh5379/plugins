import type { ThemeKey, ColorKey, ImageStyle, ReplacementRule } from '../../types';

export interface LogExporterSettings {
  format: 'basic' | 'html' | 'markdown' | 'text';
  theme: ThemeKey;
  color: ColorKey;
  customCss: string;
  showAvatar: boolean;
  showBubble: boolean;
  showHeader: boolean;
  showHeaderIcon: boolean;
  headerTags: string;
  headerLayout: 'default' | 'compact' | 'banner';
  headerBannerUrl: string;
  headerBannerBlur: boolean;
  headerBannerAlign: number;
  showFooter: boolean;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  imageScale: number;
  imageAlign: 'left' | 'center' | 'right';
  imageStyle: ImageStyle;
  imageCropActive: boolean;
  imageCropAspectRatio: string;
  imageCropVAlign: number;
  imageCropHAlign: number;
  imageCropHeight: number;
  embedImages: boolean;
  expandHover: boolean;
  imageResolution: number | 'auto';
  imageLibrary: 'html-to-image' | 'dom-to-image' | 'snapdom';
  imageFormat: 'png' | 'jpeg' | 'webp';
  previewFontSize: number;
  htmlScaleFactor: number;
  htmlScaleMode: 'font' | 'full';
  previewWidth: number;
  rawHtmlView: boolean;
  isEditable: boolean;
  splitImage: 'none' | 'chunk' | 'message';
  maxImageHeight: number;
  replacementRules: ReplacementRule[];
  disableAnimations: boolean;
  isForArca: boolean;
  allowHtmlRendering: boolean;
  customFilters: Record<string, boolean>;
  avatarPosition?: 'left' | 'right' | 'opposite' | 'top-left' | 'top-right' | 'opposite-top';
  avatarShape?: 'theme' | 'circle' | 'square' | 'rounded' | 'squircle';
}

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
};

export interface ProgressState {
  active: boolean;
  message: string;
  current: number;
  total: number;
}

export const INITIAL_PROGRESS: ProgressState = {
  active: false,
  message: '',
  current: 0,
  total: 0,
};

export interface EstimatedImageSize {
  width: number;
  height: number;
  maxMessageHeight: number;
}

export interface CharInfoState {
  charName: string;
  chatName: string;
  charAvatarUrl: string;
}
