/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import {
  Alert,
  Input,
  InputNumber,
  Segmented,
  Select,
  Slider,
} from '../../components/ui';
import {
  AlertTriangle,
  Code,
  Crop,
  Image as ImageIcon,
  Monitor,
  Terminal,
  User,
} from 'lucide-react';
import SettingToggle from './SettingToggle';
import type { LogExporterSettings } from '../hooks/types';

// ─── Option Constants ────────────────────────────────────────────────────────

const SCALE_MODE_OPTIONS = [
  { value: 'font', label: '글자만 스케일' },
  { value: 'full', label: 'HTML 전체 스케일 (레이아웃 포함)' },
];

const AVATAR_POSITION_OPTIONS = [
  { value: 'opposite', label: '말풍선 옆 - 기본' },
  { value: 'left', label: '말풍선 옆 - 항상 좌측' },
  { value: 'right', label: '말풍선 옆 - 항상 우측' },
  { value: 'opposite-top', label: '이름 옆 - 기본' },
  { value: 'top-left', label: '이름 옆 - 항상 좌측' },
  { value: 'top-right', label: '이름 옆 - 항상 우측' },
];

const AVATAR_SHAPE_OPTIONS = [
  { value: 'theme', label: '테마 기본값' },
  { value: 'circle', label: '동그라미 (Circle)' },
  { value: 'square', label: '네모 (Square)' },
  { value: 'rounded', label: '둥근 네모 (Rounded)' },
  { value: 'squircle', label: '스쿼클 (Squircle)' },
];

const IMAGE_ALIGN_OPTIONS = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '중앙' },
  { value: 'right', label: '오른쪽' },
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

const IMAGE_RESOLUTION_OPTIONS = [
  { value: 'auto', label: '자동 (Auto)' },
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '3', label: '3x' },
  { value: '4', label: '4x' },
  { value: '8', label: '8x' },
  { value: '16', label: '16x' },
  { value: '32', label: '32x' },
  { value: '64', label: '64x' },
  { value: '128', label: '128x' },
];

const IMAGE_LIBRARY_OPTIONS = [
  { value: 'html-to-image', label: 'html-to-image (권장)' },
  { value: 'snapdom', label: 'snapdom' },
  { value: 'dom-to-image', label: 'dom-to-image-more' },
];

const IMAGE_FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

const SPLIT_IMAGE_OPTIONS = [
  { value: 'none', label: '분할 안함' },
  { value: 'chunk', label: '청크 단위 (1개 파일로 병합)' },
  { value: 'message', label: '메시지 단위 (여러 파일)' },
];

// ─── Subcomponents ──────────────────────────────────────────────────────────

interface SettingCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const SettingCard: React.FC<SettingCardProps> = ({ icon, title, children }) => (
  <div
    className="shadcn-card"
    style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: 'var(--foreground)', display: 'inline-flex' }}>{icon}</span>
      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>
        {title}
      </h4>
    </div>
    {children}
  </div>
);

interface SliderControlProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  formatter?: (val: number | string | null | undefined) => string;
  parser?: (val: string) => number;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  formatter,
  parser,
}) => {
  const activeFormatter =
    formatter ??
    (unit ? (val: any) => (val !== null && val !== undefined ? `${val}${unit}` : '') : undefined);

  const activeParser =
    parser ??
    (unit
      ? (str: string) => {
          const parsed = parseFloat(str?.replace(unit, '') || `${min}`);
          return isNaN(parsed) ? min : parsed;
        }
      : undefined);

  return (
    <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', userSelect: 'none' }}>
        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
          {label}
        </label>
        {description && (
          <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
            {description}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(val) => onChange(val)}
          style={{ flex: 1 }}
        />
        <InputNumber
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(val) => {
            if (val !== null && val !== undefined) {
              onChange(val);
            }
          }}
          formatter={activeFormatter}
          parser={activeParser}
          style={{ width: '80px', textAlign: 'center' }}
        />
      </div>
    </div>
  );
};

// ─── Component Props ────────────────────────────────────────────────────────

export interface AdvancedTabProps {
  settings: Partial<LogExporterSettings> & Record<string, any>;
  onSettingChange: (key: string, value: any) => void;
  imageSizeWarning?: string;
}

// ─── Main Component ─────────────────────────────────────────────────────────

/**
 * Advanced settings panel for customizing preview scaling, avatar placement,
 * image cropping/aspect ratio, capture engine parameters, CSS injection, and developer tooling.
 */
const AdvancedTab: React.FC<AdvancedTabProps> = ({
  settings,
  onSettingChange,
  imageSizeWarning,
}) => {
  // Max browser canvas texture height is roughly 16384px.
  // Proactively adjust split ceiling based on export resolution.
  const resolutionFactor =
    settings.imageResolution === 'auto' ? 1 : Number(settings.imageResolution) || 1;
  const browserMaxHeight = 16384;
  const maxAllowedHeight = Math.floor(browserMaxHeight / resolutionFactor);

  useEffect(() => {
    const currentMaxHeight = settings.maxImageHeight ?? 10000;
    if (currentMaxHeight > maxAllowedHeight) {
      onSettingChange('maxImageHeight', maxAllowedHeight);
    }
  }, [settings.imageResolution, settings.maxImageHeight, maxAllowedHeight, onSettingChange]);

  const isCropActive = Boolean(settings.imageCropActive);
  const cropAspectRatio = settings.imageCropAspectRatio || 'original';
  const showAvatar = settings.showAvatar !== false;
  const isSplitActive = Boolean(settings.splitImage && settings.splitImage !== 'none');

  return (
    <div
      className="tab-content"
      style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* 1. 미리보기 & 스케일 */}
      <SettingCard icon={<Monitor size={16} />} title="미리보기 및 뷰포트">
        <SliderControl
          label="스케일 배율"
          description="텍스트 및 레이아웃 확대/축소"
          value={settings.htmlScaleFactor !== undefined ? settings.htmlScaleFactor : 1.0}
          min={0.5}
          max={3.0}
          step={0.1}
          unit="배"
          onChange={(val) => onSettingChange('htmlScaleFactor', val)}
        />

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            스케일 모드
          </label>
          <Select
            value={settings.htmlScaleMode || 'font'}
            onChange={(val) => onSettingChange('htmlScaleMode', val)}
            style={{ width: '100%' }}
            options={SCALE_MODE_OPTIONS}
          />
        </div>

        <SliderControl
          label="미리보기 너비"
          description="기본 캔버스 가로 해상도"
          value={settings.previewWidth || 800}
          min={320}
          max={1920}
          step={10}
          unit="px"
          onChange={(val) => onSettingChange('previewWidth', val)}
        />
      </SettingCard>

      {/* 2. 아바타 고급 설정 */}
      <SettingCard icon={<User size={16} />} title="아바타 고급 설정">
        <SettingToggle
          label="아바타 표시"
          description="프로필 이미지 노출 여부"
          checked={showAvatar}
          defaultOn={true}
          onChange={(v) => onSettingChange('showAvatar', v)}
        />

        {showAvatar && (
          <div
            className="setting-subgroup"
            style={{
              paddingLeft: '12px',
              borderLeft: '2px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
                아바타 위치
              </label>
              <Select
                value={settings.avatarPosition || 'opposite'}
                onChange={(val) => onSettingChange('avatarPosition', val)}
                style={{ width: '100%' }}
                options={AVATAR_POSITION_OPTIONS}
              />
            </div>

            <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
                아바타 모양
              </label>
              <Select
                value={settings.avatarShape || 'theme'}
                onChange={(val) => onSettingChange('avatarShape', val)}
                style={{ width: '100%' }}
                options={AVATAR_SHAPE_OPTIONS}
              />
            </div>
          </div>
        )}
      </SettingCard>

      {/* 3. 이미지 표시 및 크롭 */}
      <SettingCard icon={<Crop size={16} />} title="이미지 표시 및 크롭">
        <SliderControl
          label="이미지 크기"
          value={settings.imageScale || 100}
          min={1}
          max={100}
          step={1}
          unit="%"
          onChange={(val) => onSettingChange('imageScale', val)}
        />

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            이미지 정렬
          </label>
          <Segmented
            value={settings.imageAlign || 'left'}
            onChange={(val) => onSettingChange('imageAlign', val)}
            options={IMAGE_ALIGN_OPTIONS}
            block
          />
        </div>

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            이미지 스타일
          </label>
          <Select
            value={settings.imageStyle || 'none'}
            onChange={(val) => onSettingChange('imageStyle', val)}
            style={{ width: '100%' }}
            options={IMAGE_STYLE_OPTIONS}
          />
        </div>

        <SettingToggle
          label="이미지 크롭 활성화"
          description="지정된 비율로 자르고 원하는 초점을 맞춥니다"
          checked={isCropActive}
          defaultOn={false}
          onChange={(v) => onSettingChange('imageCropActive', v)}
        />

        {isCropActive && (
          <div
            className="setting-subgroup"
            style={{
              paddingLeft: '12px',
              borderLeft: '2px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
                크롭 비율
              </label>
              <Select
                value={cropAspectRatio}
                onChange={(val) => onSettingChange('imageCropAspectRatio', val)}
                style={{ width: '100%' }}
                options={CROP_ASPECT_RATIO_OPTIONS}
              />
            </div>

            {cropAspectRatio === 'custom' && (
              <SliderControl
                label="사용자 지정 세로 비율"
                description="가로 폭 대비 세로 높이 배율"
                value={settings.imageCropHeight !== undefined ? settings.imageCropHeight : 1.0}
                min={0.1}
                max={3.0}
                step={0.01}
                onChange={(val) => onSettingChange('imageCropHeight', val)}
              />
            )}

            {cropAspectRatio !== 'original' && (
              <>
                <SliderControl
                  label="세로 초점 위치"
                  description="0%: 상단/얼굴 ~ 100%: 하단/다리"
                  value={settings.imageCropVAlign !== undefined ? settings.imageCropVAlign : 50}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(val) => onSettingChange('imageCropVAlign', val)}
                />

                <SliderControl
                  label="가로 초점 위치"
                  description="0%: 좌측 ~ 100%: 우측"
                  value={settings.imageCropHAlign !== undefined ? settings.imageCropHAlign : 50}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(val) => onSettingChange('imageCropHAlign', val)}
                />
              </>
            )}
          </div>
        )}
      </SettingCard>

      {/* 4. 이미지 내보내기 & 렌더러 */}
      <SettingCard icon={<ImageIcon size={16} />} title="이미지 내보내기 및 엔진">
        {imageSizeWarning && (
          <Alert
            message={imageSizeWarning}
            type="warning"
            showIcon
            icon={<AlertTriangle size={15} />}
            style={{ fontSize: '12px', borderRadius: 'var(--radius)' }}
          />
        )}

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            해상도 배율
          </label>
          <Select
            value={String(settings.imageResolution || '1')}
            onChange={(val) => onSettingChange('imageResolution', val)}
            style={{ width: '100%' }}
            options={IMAGE_RESOLUTION_OPTIONS}
          />
        </div>

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            캡처 라이브러리
          </label>
          <Select
            value={settings.imageLibrary || 'html-to-image'}
            onChange={(val) => onSettingChange('imageLibrary', val)}
            style={{ width: '100%' }}
            options={IMAGE_LIBRARY_OPTIONS}
          />
        </div>

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            포맷
          </label>
          <Select
            value={settings.imageFormat || 'png'}
            onChange={(val) => onSettingChange('imageFormat', val)}
            style={{ width: '100%' }}
            options={IMAGE_FORMAT_OPTIONS}
          />
        </div>

        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            이미지 분할
          </label>
          <Select
            value={settings.splitImage || 'none'}
            onChange={(val) => onSettingChange('splitImage', val)}
            style={{ width: '100%' }}
            options={SPLIT_IMAGE_OPTIONS}
          />
        </div>

        {isSplitActive && (
          <div
            className="setting-subgroup"
            style={{
              paddingLeft: '12px',
              borderLeft: '2px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '4px',
            }}
          >
            <SliderControl
              label="최대 높이"
              description={`최대 허용: ${maxAllowedHeight.toLocaleString()}px`}
              value={settings.maxImageHeight || 10000}
              min={1000}
              max={maxAllowedHeight}
              step={1000}
              unit="px"
              onChange={(val) => onSettingChange('maxImageHeight', val || 10000)}
            />
          </div>
        )}

        <SettingToggle
          label="이미지 Base64 내장"
          description="내보내기 시 이미지를 인라인 데이터로 변환"
          checked={settings.embedImages}
          defaultOn={true}
          onChange={(v) => onSettingChange('embedImages', v)}
        />
      </SettingCard>

      {/* 5. 커스텀 CSS 주입 */}
      <SettingCard icon={<Code size={16} />} title="커스텀 CSS 주입">
        <div className="setting-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)' }}>
            사용자 지정 스타일시트
          </label>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted-foreground)' }}>
            내보낼 HTML 및 미리보기에 직접 주입할 CSS 규칙을 작성합니다.
          </p>
          <Input.TextArea
            value={settings.customCss || ''}
            onChange={(e) => onSettingChange('customCss', e.target.value)}
            placeholder="/* 예: .risu-bubble { border-radius: 12px; } */"
            autoSize={{ minRows: 4, maxRows: 12 }}
            style={{ fontFamily: 'monospace', fontSize: '12px', width: '100%' }}
          />
        </div>
      </SettingCard>

      {/* 6. 개발자 도구 및 고급 제어 */}
      <SettingCard icon={<Terminal size={16} />} title="개발자 도구 및 고급 제어">
        <SettingToggle
          label="Raw HTML 보기"
          description="생성된 HTML 소스 코드 직접 보기"
          checked={settings.rawHtmlView}
          defaultOn={false}
          onChange={(v) => onSettingChange('rawHtmlView', v)}
        />
        <SettingToggle
          label="로그 편집 모드"
          description="메시지 내용 직접 수정 및 삭제"
          checked={settings.isEditable}
          defaultOn={false}
          onChange={(v) => onSettingChange('isEditable', v)}
        />
        <SettingToggle
          label="CSS 애니메이션 제외"
          description="미리보기 및 이미지 캡처 시 애니메이션 비활성화 (권장)"
          checked={settings.disableAnimations}
          defaultOn={true}
          onChange={(v) => onSettingChange('disableAnimations', v)}
        />
        <SettingToggle
          label="HTML 렌더링 허용"
          description="메시지 본문의 임의 HTML 태그 렌더링 (주의 필요)"
          checked={settings.allowHtmlRendering}
          defaultOn={false}
          onChange={(v) => onSettingChange('allowHtmlRendering', v)}
        />
        <SettingToggle
          label="호버 요소 펼치기"
          description="접힌 요소 및 스포일러 자동 펼침"
          checked={settings.expandHover}
          defaultOn={false}
          onChange={(v) => onSettingChange('expandHover', v)}
        />
      </SettingCard>
    </div>
  );
};

export default AdvancedTab;