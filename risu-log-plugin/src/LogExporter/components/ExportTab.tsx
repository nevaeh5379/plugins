import React from 'react';
import {
  Segmented,
  Select,
  Input,
  Slider,
  InputNumber,
  Divider,
  Typography,
} from '../../components/ui';
import type { LogExportSettings, ColorPalette, ThemeInfo } from '../../types';
import {
  FileText,
  Code,
  FileCode,
  AlignLeft,
  Palette,
  Eye,
  Image as ImageIcon,
  Crop,
  Layers,
} from 'lucide-react';
import SettingToggle from './SettingToggle';

const { Title, Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

const FORMAT_OPTIONS = [
  { label: '기본', value: 'basic', icon: <FileText size={14} /> },
  { label: 'HTML', value: 'html', icon: <Code size={14} /> },
  { label: '마크다운', value: 'markdown', icon: <FileCode size={14} /> },
  { label: '텍스트', value: 'text', icon: <AlignLeft size={14} /> },
];

const HEADER_LAYOUT_OPTIONS = [
  { value: 'default', label: '기본' },
  { value: 'compact', label: '컴팩트' },
  { value: 'banner', label: '배너' },
  { value: 'smart', label: '스마트' },
  { value: 'cover', label: '커버' },
];

const IMAGE_ALIGN_OPTIONS = [
  { label: '왼쪽', value: 'left' },
  { label: '중앙', value: 'center' },
  { label: '오른쪽', value: 'right' },
];

const IMAGE_STYLE_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'gallery', label: '갤러리 (클래식 액자)' },
  { value: 'modern', label: '모던 (현대 액자)' },
  { value: 'tape', label: '테이프 (메모)' },
];

const CROP_ASPECT_RATIO_OPTIONS = [
  { value: 'original', label: '원본 비율 (높이 제한 없음)' },
  { value: '1:1', label: '1:1 (정사각형)' },
  { value: '3:4', label: '3:4 (세로형 인물/피규어)' },
  { value: '4:3', label: '4:3 (가로형 표준)' },
  { value: '9:16', label: '9:16 (스마트폰 세로)' },
  { value: '16:9', label: '16:9 (시네마틱 가로)' },
  { value: 'custom', label: '사용자 지정 비율' },
];

// ============================================================================
// Sub-components & Helpers
// ============================================================================

interface PercentageSliderFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
}

/** Reusable percentage slider and number input pair */
const PercentageSliderField: React.FC<PercentageSliderFieldProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  defaultValue = 50,
  onChange,
}) => {
  const displayVal = typeof value === 'number' && !isNaN(value) ? value : defaultValue;

  const parsePercent = (val?: string | null): number => {
    if (!val) return defaultValue;
    const parsed = parseFloat(val.replace('%', ''));
    return isNaN(parsed) ? defaultValue : Math.min(max, Math.max(min, parsed));
  };

  return (
    <div className="setting-field">
      <Text className="setting-field-label">{label}</Text>
      <div className="setting-slider-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Slider
          min={min}
          max={max}
          value={displayVal}
          onChange={(val) => onChange(typeof val === 'number' ? val : val[0])}
          style={{ flex: 1 }}
        />
        <InputNumber
          min={min}
          max={max}
          value={displayVal}
          onChange={(val) => onChange(val !== null && val !== undefined ? Number(val) : defaultValue)}
          style={{ width: '70px', textAlign: 'center' }}
          formatter={(v) => `${v}%`}
          parser={parsePercent}
        />
      </div>
    </div>
  );
};

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
    {icon}
    <Title level={5} className="tab-section-title" style={{ margin: 0 }}>
      {title}
    </Title>
  </div>
);

// ============================================================================
// Section Components
// ============================================================================

interface StyleSectionProps {
  settings: LogExportSettings;
  onSettingChange: (key: string, value: unknown) => void;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

const StyleSection: React.FC<StyleSectionProps> = ({
  settings,
  onSettingChange,
  themes,
  colors,
}) => {
  const selectedTheme = typeof settings.theme === 'string' ? settings.theme : 'basic';
  const selectedColor = typeof settings.color === 'string' ? settings.color : 'dark';

  return (
    <div className="tab-section">
      <SectionHeader icon={<Palette size={16} />} title="스타일" />

      <div className="setting-field">
        <Text className="setting-field-label">테마</Text>
        <Select
          value={selectedTheme}
          onChange={(val) => onSettingChange('theme', val)}
          style={{ width: '100%' }}
        >
          {Object.entries(themes).map(([key, theme]) => (
            <Select.Option value={key} key={key}>
              {theme.name}
            </Select.Option>
          ))}
        </Select>
      </div>

      <div className="setting-field">
        <Text className="setting-field-label">색상</Text>
        <Select
          value={selectedColor}
          onChange={(val) => onSettingChange('color', val)}
          style={{ width: '100%' }}
        >
          {Object.entries(colors).map(([key, palette]) => (
            <Select.Option value={key} key={key}>
              {palette.name || key}
            </Select.Option>
          ))}
        </Select>
      </div>

      <div className="setting-field">
        <Text className="setting-field-label">헤더 레이아웃</Text>
        <Select
          value={settings.headerLayout || 'default'}
          onChange={(val) => onSettingChange('headerLayout', val)}
          style={{ width: '100%' }}
          options={HEADER_LAYOUT_OPTIONS}
        />
      </div>
    </div>
  );
};

interface DisplayOptionsSectionProps {
  settings: LogExportSettings;
  onSettingChange: (key: string, value: unknown) => void;
}

const DisplayOptionsSection: React.FC<DisplayOptionsSectionProps> = ({
  settings,
  onSettingChange,
}) => {
  const isHeaderVisible = settings.showHeader !== false;
  const isFooterVisible = settings.showFooter !== false;

  return (
    <div className="tab-section">
      <SectionHeader icon={<Eye size={16} />} title="표시 옵션" />

      <SettingToggle
        label="아바타"
        description="프로필 이미지 표시"
        checked={settings.showAvatar}
        onChange={(v) => onSettingChange('showAvatar', v)}
      />
      <SettingToggle
        label="말풍선"
        description="메시지 말풍선 스타일"
        checked={settings.showBubble}
        onChange={(v) => onSettingChange('showBubble', v)}
      />
      <SettingToggle
        label="헤더"
        description="상단 정보 표시"
        checked={settings.showHeader}
        onChange={(v) => onSettingChange('showHeader', v)}
      />

      {isHeaderVisible && (
        <div className="setting-subgroup">
          <SettingToggle
            label="헤더 아이콘"
            description="헤더 프로필 이미지 표시"
            checked={settings.showHeaderIcon}
            onChange={(v) => onSettingChange('showHeaderIcon', v)}
          />
          <div className="setting-field">
            <Text className="setting-field-label">헤더 태그</Text>
            <Input
              value={settings.headerTags || ''}
              onChange={(e) => onSettingChange('headerTags', e.target.value)}
              placeholder="쉼표로 태그 구분"
            />
          </div>
          {settings.headerLayout === 'banner' && (
            <>
              <div className="setting-field">
                <Text className="setting-field-label">배너 이미지 URL</Text>
                <Input
                  value={settings.headerBannerUrl || ''}
                  onChange={(e) => onSettingChange('headerBannerUrl', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <SettingToggle
                label="블러 효과"
                description="배너 이미지에 블러 효과 적용"
                checked={settings.headerBannerBlur}
                onChange={(v) => onSettingChange('headerBannerBlur', v)}
              />
              <PercentageSliderField
                label="이미지 정렬"
                value={settings.headerBannerAlign ?? 50}
                min={0}
                max={100}
                defaultValue={50}
                onChange={(val) => onSettingChange('headerBannerAlign', val)}
              />
            </>
          )}
        </div>
      )}

      <SettingToggle
        label="푸터"
        description="하단 정보 표시"
        checked={settings.showFooter}
        onChange={(v) => onSettingChange('showFooter', v)}
      />
      {isFooterVisible && (
        <div className="setting-subgroup">
          <div className="setting-field">
            <Text className="setting-field-label">푸터 (왼쪽)</Text>
            <Input
              value={settings.footerLeft || ''}
              onChange={(e) => onSettingChange('footerLeft', e.target.value)}
            />
          </div>
          <div className="setting-field">
            <Text className="setting-field-label">푸터 (중앙)</Text>
            <Input
              value={settings.footerCenter || ''}
              onChange={(e) => onSettingChange('footerCenter', e.target.value)}
            />
          </div>
          <div className="setting-field">
            <Text className="setting-field-label">푸터 (오른쪽)</Text>
            <Input
              value={settings.footerRight || ''}
              onChange={(e) => onSettingChange('footerRight', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface ImageSectionProps {
  settings: LogExportSettings;
  onSettingChange: (key: string, value: unknown) => void;
}

const ImageSection: React.FC<ImageSectionProps> = ({ settings, onSettingChange }) => {
  const isCropActive = Boolean(settings.imageCropActive);
  const cropRatio = settings.imageCropAspectRatio || 'original';

  return (
    <div className="tab-section">
      <SectionHeader icon={<ImageIcon size={16} />} title="이미지" />

      <PercentageSliderField
        label="이미지 크기"
        value={settings.imageScale ?? 100}
        min={1}
        max={100}
        defaultValue={100}
        onChange={(val) => onSettingChange('imageScale', val)}
      />

      <div className="setting-field">
        <Text className="setting-field-label">이미지 정렬</Text>
        <Segmented
          value={settings.imageAlign || 'left'}
          onChange={(val) => onSettingChange('imageAlign', val)}
          options={IMAGE_ALIGN_OPTIONS}
          block
        />
      </div>

      <div className="setting-field">
        <Text className="setting-field-label">이미지 스타일</Text>
        <Select
          value={settings.imageStyle || 'none'}
          onChange={(val) => onSettingChange('imageStyle', val)}
          style={{ width: '100%' }}
          options={IMAGE_STYLE_OPTIONS}
        />
      </div>

      <div className="setting-field" style={{ marginTop: '16px' }}>
        <SettingToggle
          label="이미지 크롭 활성화"
          description="이미지를 특정 비율로 자르고 원하는 초점을 맞춥니다"
          checked={isCropActive}
          onChange={(v) => onSettingChange('imageCropActive', v)}
        />
      </div>

      {isCropActive && (
        <div style={{ paddingLeft: '12px', borderLeft: '2px solid #eaeaea', marginTop: '12px' }}>
          <div className="setting-field">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Crop size={14} style={{ color: 'var(--muted-foreground)' }} />
              <Text className="setting-field-label">크롭 비율</Text>
            </div>
            <Select
              value={cropRatio}
              onChange={(val) => onSettingChange('imageCropAspectRatio', val)}
              style={{ width: '100%' }}
              options={CROP_ASPECT_RATIO_OPTIONS}
            />
          </div>

          {cropRatio === 'custom' && (
            <div className="setting-field">
              <Text className="setting-field-label">
                사용자 지정 세로 비율 (가로 대비 세로 높이)
              </Text>
              <div
                className="setting-slider-row"
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <Slider
                  min={0.1}
                  max={3.0}
                  step={0.01}
                  value={settings.imageCropHeight ?? 1.0}
                  onChange={(val) =>
                    onSettingChange('imageCropHeight', typeof val === 'number' ? val : val[0])
                  }
                  style={{ flex: 1 }}
                />
                <InputNumber
                  min={0.1}
                  max={3.0}
                  step={0.01}
                  value={settings.imageCropHeight ?? 1.0}
                  onChange={(val) => onSettingChange('imageCropHeight', val ?? 1.0)}
                  style={{ width: '70px', textAlign: 'center' }}
                />
              </div>
            </div>
          )}

          {cropRatio !== 'original' && (
            <>
              <PercentageSliderField
                label="세로 초점 위치 (0%: 상단/얼굴 ~ 100%: 하단/다리)"
                value={settings.imageCropVAlign ?? 50}
                min={0}
                max={100}
                defaultValue={50}
                onChange={(val) => onSettingChange('imageCropVAlign', val)}
              />

              <PercentageSliderField
                label="가로 초점 위치 (0%: 좌측 ~ 100%: 우측)"
                value={settings.imageCropHAlign ?? 50}
                min={0}
                max={100}
                defaultValue={50}
                onChange={(val) => onSettingChange('imageCropHAlign', val)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface HtmlOptionsSectionProps {
  settings: LogExportSettings;
  onSettingChange: (key: string, value: unknown) => void;
}

const HtmlOptionsSection: React.FC<HtmlOptionsSectionProps> = ({
  settings,
  onSettingChange,
}) => (
  <div className="tab-section">
    <SectionHeader icon={<Layers size={16} />} title="HTML 옵션" />
    <SettingToggle
      label="이미지 내장"
      description="이미지를 Base64로 포함"
      checked={settings.embedImages}
      onChange={(v) => onSettingChange('embedImages', v)}
    />
    <SettingToggle
      label="호버 요소 펼치기"
      description="접힌 요소 자동 펼침"
      checked={settings.expandHover}
      defaultOn={false}
      onChange={(v) => onSettingChange('expandHover', v)}
    />
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export interface ExportTabProps {
  settings: LogExportSettings;
  onSettingChange: (key: string, value: unknown) => void;
  themes: Record<string, ThemeInfo>;
  colors: Record<string, ColorPalette>;
}

const ExportTab: React.FC<ExportTabProps> = ({
  settings,
  onSettingChange,
  themes,
  colors,
}) => {
  const currentFormat = settings.format || 'basic';
  const isBasicFormat = currentFormat === 'basic';
  const isHtmlFormat = currentFormat === 'html';
  const isCustomTheme = settings.theme === 'custom';

  return (
    <div className="tab-content">
      {/* 출력 형식 */}
      <div className="tab-section">
        <SectionHeader icon={<FileText size={16} />} title="출력 형식" />
        <Segmented
          value={currentFormat}
          onChange={(val) => onSettingChange('format', val)}
          options={FORMAT_OPTIONS}
          block
        />
      </div>

      {/* 기본 형식 설정 */}
      {isBasicFormat && (
        <>
          <Divider />
          <StyleSection
            settings={settings}
            onSettingChange={onSettingChange}
            themes={themes}
            colors={colors}
          />

          {isCustomTheme && (
            <>
              <Divider />
              <div className="tab-section">
                <SectionHeader icon={<Code size={16} />} title="커스텀 CSS" />
                <Input.TextArea
                  value={settings.customCss || ''}
                  onChange={(e) => onSettingChange('customCss', e.target.value)}
                  placeholder="여기에 CSS 코드를 입력하세요..."
                  autoSize={{ minRows: 5, maxRows: 15 }}
                />
              </div>
            </>
          )}

          <Divider />
          <DisplayOptionsSection
            settings={settings}
            onSettingChange={onSettingChange}
          />

          <Divider />
          <ImageSection
            settings={settings}
            onSettingChange={onSettingChange}
          />
        </>
      )}

      {/* HTML 형식 설정 */}
      {isHtmlFormat && (
        <>
          <Divider />
          <HtmlOptionsSection
            settings={settings}
            onSettingChange={onSettingChange}
          />
        </>
      )}
    </div>
  );
};

export default ExportTab;