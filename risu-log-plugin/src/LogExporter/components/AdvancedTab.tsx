/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect } from 'react';
import { Select, InputNumber, Alert, Divider, Typography } from 'antd';
import SettingToggle from './SettingToggle';

const { Title, Text } = Typography;

interface AdvancedTabProps {
  settings: any;
  onSettingChange: (key: string, value: any) => void;
  imageSizeWarning?: string;
}

const AdvancedTab: React.FC<AdvancedTabProps> = ({ settings, onSettingChange, imageSizeWarning }) => {

  const resolution = settings.imageResolution === 'auto' ? 1 : (Number(settings.imageResolution) || 1);
  const browserMaxHeight = 16384;
  const maxAllowedHeight = Math.floor(browserMaxHeight / resolution);

  useEffect(() => {
    if (settings.maxImageHeight > maxAllowedHeight) {
      onSettingChange('maxImageHeight', maxAllowedHeight);
    }
  }, [settings.imageResolution, settings.maxImageHeight, maxAllowedHeight, onSettingChange]);

  return (
    <div className="tab-content">
      {/* 미리보기 */}
      <div className="tab-section">
        <Title level={5} className="tab-section-title">미리보기</Title>

        <div className="setting-field">
          <Text className="setting-field-label">스케일 배율</Text>
          <InputNumber
            value={settings.htmlScaleFactor !== undefined ? settings.htmlScaleFactor : 1.0}
            onChange={(val) => onSettingChange('htmlScaleFactor', val)}
            min={0.5}
            max={3.0}
            step={0.1}
            addonAfter="배"
            style={{ width: '100%' }}
          />
        </div>

        <div className="setting-field">
          <Text className="setting-field-label">스케일 모드</Text>
          <Select
            value={settings.htmlScaleMode || 'font'}
            onChange={(val) => onSettingChange('htmlScaleMode', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'font', label: '글자만 스케일' },
              { value: 'full', label: 'HTML 전체 스케일 (레이아웃 포함)' },
            ]}
          />
        </div>

        <div className="setting-field">
          <Text className="setting-field-label">너비</Text>
          <InputNumber
            value={settings.previewWidth || 800}
            onChange={(val) => onSettingChange('previewWidth', val)}
            min={320}
            max={1920}
            step={10}
            addonAfter="px"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <Divider />

      {/* 이미지 내보내기 */}
      <div className="tab-section">
        <Title level={5} className="tab-section-title">이미지 내보내기</Title>

        {imageSizeWarning && (
          <Alert
            message={imageSizeWarning}
            type="warning"
            showIcon
            style={{ fontSize: '0.9em' }}
          />
        )}

        <div className="setting-field">
          <Text className="setting-field-label">해상도</Text>
          <Select
            value={settings.imageResolution || '1'}
            onChange={(val) => onSettingChange('imageResolution', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'auto', label: '자동' },
              { value: '1', label: '1x' },
              { value: '2', label: '2x' },
              { value: '3', label: '3x' },
              { value: '4', label: '4x' },
              { value: '8', label: '8x' },
              { value: '16', label: '16x' },
              { value: '32', label: '32x' },
              { value: '64', label: '64x' },
              { value: '128', label: '128x' },
            ]}
          />
        </div>

        <div className="setting-field">
          <Text className="setting-field-label">라이브러리</Text>
          <Select
            value={settings.imageLibrary || 'html-to-image'}
            onChange={(val) => onSettingChange('imageLibrary', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'html-to-image', label: 'html-to-image (권장)' },
              { value: 'snapdom', label: 'snapdom' },
              { value: 'dom-to-image', label: 'dom-to-image-more' },
            ]}
          />
        </div>

        <div className="setting-field">
          <Text className="setting-field-label">포맷</Text>
          <Select
            value={settings.imageFormat || 'png'}
            onChange={(val) => onSettingChange('imageFormat', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
              { value: 'webp', label: 'WebP' },
            ]}
          />
        </div>

        <div className="setting-field">
          <Text className="setting-field-label">이미지 분할</Text>
          <Select
            value={settings.splitImage || 'none'}
            onChange={(val) => onSettingChange('splitImage', val)}
            style={{ width: '100%' }}
            options={[
              { value: 'none', label: '분할 안함' },
              { value: 'chunk', label: '청크 단위 (1개 파일로 병합)' },
              { value: 'message', label: '메시지 단위 (여러 파일)' },
            ]}
          />
        </div>

        {settings.splitImage && settings.splitImage !== 'none' && (
          <div className="setting-subgroup">
            <div className="setting-field">
              <Text className="setting-field-label">최대 높이</Text>
              <InputNumber
                value={settings.maxImageHeight || 10000}
                onChange={(val) => onSettingChange('maxImageHeight', val || 10000)}
                min={1000}
                max={maxAllowedHeight}
                step={1000}
                addonAfter="px"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* 개발자 도구 */}
      <div className="tab-section">
        <Title level={5} className="tab-section-title">개발자 도구</Title>
        <SettingToggle
          label="Raw HTML 보기"
          description="생성된 HTML 코드 직접 보기"
          checked={settings.rawHtmlView}
          defaultOn={false}
          onChange={(v) => onSettingChange('rawHtmlView', v)}
        />
        <SettingToggle
          label="로그 편집 모드"
          description="메시지 직접 수정 및 삭제"
          checked={settings.isEditable}
          defaultOn={false}
          onChange={(v) => onSettingChange('isEditable', v)}
        />
        <SettingToggle
          label="CSS 애니메이션 제외"
          description="미리보기 및 저장 시 애니메이션 제거 (권장)"
          checked={settings.disableAnimations}
          defaultOn={true}
          onChange={(v) => onSettingChange('disableAnimations', v)}
        />
      </div>
    </div>
  );
};

export default AdvancedTab;