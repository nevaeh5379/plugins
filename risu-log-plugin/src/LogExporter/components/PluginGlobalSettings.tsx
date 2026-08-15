import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Palette, Sliders, Plus, X, Server } from 'lucide-react';
import { Select, Input, Button, message, type SelectOption } from '../../components/ui';
import type { GlobalSettings } from '../../types';
import {
  loadArcaProxyConfig,
  saveArcaProxyConfig,
  validateArcaProxyUrl,
  type ArcaProxyConfig,
} from '../services/arcaProxyConfigService';

/**
 * Props for the PluginGlobalSettings component.
 */
export interface PluginGlobalSettingsProps {
  /** Global settings object containing persisted theme and custom selector configurations. */
  globalSettings?: Partial<GlobalSettings> | null;
  /** Callback invoked when a global setting property is modified. */
  onGlobalSettingChange: (key: string, value: unknown) => void;
}

/**
 * Available UI theme options for the plugin modal.
 */
const THEME_OPTIONS: SelectOption[] = [
  { value: 'dark', label: '다크 모던 (Zinc Slate)' },
  { value: 'classic', label: '클래식 다크' },
  { value: 'light', label: '라이트' },
];

/**
 * Fallback empty array constant to maintain reference stability across renders.
 */
const EMPTY_CLASS_LIST: string[] = [];

/**
 * Shared inline style constants for cards and form fields.
 */
const STYLES = {
  container: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  cardWithGap16: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--foreground)',
  },
  fieldContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--foreground)',
  },
  fieldDescription: {
    margin: 0,
    fontSize: '11px',
    color: 'var(--muted-foreground)',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '2px',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '6px',
  },
  tagBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'monospace',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--muted)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  },
  tagRemoveIcon: {
    cursor: 'pointer',
    opacity: 0.7,
    transition: 'opacity 0.15s ease',
  },
} as const satisfies Record<string, React.CSSProperties>;

/**
 * Props for the SelectorClassManager subcomponent.
 */
interface SelectorClassManagerProps {
  label: string;
  description: string;
  placeholder: string;
  classes: string[];
  onAddClass: (className: string) => void;
  onRemoveClass: (className: string) => void;
}

/**
 * Reusable subcomponent for managing a list of custom CSS class selectors with an input field and removable badges.
 */
const SelectorClassManager: React.FC<SelectorClassManagerProps> = ({
  label,
  description,
  placeholder,
  classes,
  onAddClass,
  onRemoveClass,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    if (!classes.includes(trimmed)) {
      onAddClass(trimmed);
    }
    setInputValue('');
  }, [inputValue, classes, onAddClass]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="setting-field" style={STYLES.fieldContainer}>
      <label style={STYLES.fieldLabel}>{label}</label>
      <p style={STYLES.fieldDescription}>{description}</p>
      <div style={STYLES.inputRow}>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <Button icon={<Plus size={14} />} onClick={handleAdd}>
          추가
        </Button>
      </div>
      {classes.length > 0 && (
        <div style={STYLES.tagList}>
          {classes.map((cls) => (
            <span key={cls} style={STYLES.tagBadge}>
              {cls}
              <X
                size={12}
                style={STYLES.tagRemoveIcon}
                onClick={() => onRemoveClass(cls)}
                aria-label={`${cls} 삭제`}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Plugin Global Settings component.
 * Provides controls for modal UI theme, ArcaLive custom proxy server configuration,
 * and custom CSS selector classes for profile images and participant names.
 */
export const PluginGlobalSettings: React.FC<PluginGlobalSettingsProps> = ({
  globalSettings,
  onGlobalSettingChange,
}) => {
  const profileClasses = useMemo(
    () =>
      Array.isArray(globalSettings?.profileClasses)
        ? globalSettings.profileClasses
        : EMPTY_CLASS_LIST,
    [globalSettings?.profileClasses]
  );

  const participantNameClasses = useMemo(
    () =>
      Array.isArray(globalSettings?.participantNameClasses)
        ? globalSettings.participantNameClasses
        : EMPTY_CLASS_LIST,
    [globalSettings?.participantNameClasses]
  );

  const uiTheme = globalSettings?.uiTheme || 'dark';

  const [proxyConfig, setProxyConfig] = useState<ArcaProxyConfig>({ url: '', token: '' });
  const [isProxyConfigLoading, setIsProxyConfigLoading] = useState(true);
  const [isProxyConfigSaving, setIsProxyConfigSaving] = useState(false);

  // Load ArcaLive proxy configuration from local plugin storage on mount
  useEffect(() => {
    let isCancelled = false;

    void loadArcaProxyConfig().then((config) => {
      if (!isCancelled) {
        setProxyConfig(config);
        setIsProxyConfigLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  /**
   * Validates and saves the ArcaLive user proxy configuration.
   */
  const handleSaveProxyConfig = async () => {
    const trimmedUrl = proxyConfig.url.trim();
    const trimmedToken = proxyConfig.token.trim();

    try {
      if (trimmedUrl || trimmedToken) {
        if (!trimmedUrl || !trimmedToken) {
          throw new Error('프록시 URL과 인증 토큰을 모두 입력해 주세요.');
        }
        validateArcaProxyUrl(trimmedUrl);
      }

      setIsProxyConfigSaving(true);
      const normalized: ArcaProxyConfig = {
        url: trimmedUrl,
        token: trimmedToken,
      };

      await saveArcaProxyConfig(normalized);
      setProxyConfig(normalized);
      message.success(
        normalized.url
          ? '아카라이브 프록시 설정을 저장했습니다.'
          : '아카라이브 프록시 설정을 비웠습니다.'
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : '프록시 설정을 저장하지 못했습니다.');
    } finally {
      setIsProxyConfigSaving(false);
    }
  };

  /**
   * Handlers for adding and removing profile image selectors.
   */
  const handleAddProfileClass = useCallback(
    (newClass: string) => {
      if (newClass && !profileClasses.includes(newClass)) {
        onGlobalSettingChange('profileClasses', [...profileClasses, newClass]);
      }
    },
    [profileClasses, onGlobalSettingChange]
  );

  const handleRemoveProfileClass = useCallback(
    (targetClass: string) => {
      onGlobalSettingChange(
        'profileClasses',
        profileClasses.filter((cls) => cls !== targetClass)
      );
    },
    [profileClasses, onGlobalSettingChange]
  );

  /**
   * Handlers for adding and removing participant name selectors.
   */
  const handleAddParticipantNameClass = useCallback(
    (newClass: string) => {
      if (newClass && !participantNameClasses.includes(newClass)) {
        onGlobalSettingChange('participantNameClasses', [...participantNameClasses, newClass]);
      }
    },
    [participantNameClasses, onGlobalSettingChange]
  );

  const handleRemoveParticipantNameClass = useCallback(
    (targetClass: string) => {
      onGlobalSettingChange(
        'participantNameClasses',
        participantNameClasses.filter((cls) => cls !== targetClass)
      );
    },
    [participantNameClasses, onGlobalSettingChange]
  );

  return (
    <div className="tab-content" style={STYLES.container}>
      {/* UI 테마 카드 */}
      <div className="shadcn-card" style={STYLES.card}>
        <div style={STYLES.cardHeader}>
          <Palette size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={STYLES.cardTitle}>UI 테마</h4>
        </div>

        <div className="setting-field" style={STYLES.fieldContainer}>
          <label style={STYLES.fieldLabel}>모달 테마</label>
          <Select
            value={uiTheme}
            onChange={(val) => onGlobalSettingChange('uiTheme', val)}
            style={{ width: '100%' }}
            options={THEME_OPTIONS}
          />
        </div>
      </div>

      {/* 아카라이브 사용자 프록시 카드 */}
      <div className="shadcn-card" style={STYLES.card}>
        <div style={STYLES.cardHeader}>
          <Server size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={STYLES.cardTitle}>아카라이브 사용자 프록시</h4>
        </div>

        <div className="setting-field" style={STYLES.fieldContainer}>
          <label style={STYLES.fieldLabel}>업로드 엔드포인트</label>
          <Input
            value={proxyConfig.url}
            disabled={isProxyConfigLoading}
            onChange={(event) =>
              setProxyConfig((current) => ({ ...current, url: event.target.value }))
            }
            placeholder="https://proxy.example.com/v1/arca/upload"
          />
        </div>

        <div className="setting-field" style={STYLES.fieldContainer}>
          <label style={STYLES.fieldLabel}>인증 토큰</label>
          <Input.Password
            value={proxyConfig.token}
            disabled={isProxyConfigLoading}
            onChange={(event) =>
              setProxyConfig((current) => ({ ...current, token: event.target.value }))
            }
            placeholder="ARCA_PROXY_TOKEN"
            autoComplete="new-password"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            loading={isProxyConfigLoading || isProxyConfigSaving}
            onClick={() => void handleSaveProxyConfig()}
          >
            저장
          </Button>
        </div>
      </div>

      {/* 커스텀 선택자 카드 */}
      <div className="shadcn-card" style={STYLES.cardWithGap16}>
        <div style={STYLES.cardHeader}>
          <Sliders size={16} style={{ color: 'var(--foreground)' }} />
          <h4 style={STYLES.cardTitle}>커스텀 선택자</h4>
        </div>

        {/* 프로필 이미지 클래스 */}
        <SelectorClassManager
          label="프로필 이미지 클래스"
          description="프로필 이미지를 탐색하기 위한 추가 CSS 선택자"
          placeholder="예: .avatar, .profile-img"
          classes={profileClasses}
          onAddClass={handleAddProfileClass}
          onRemoveClass={handleRemoveProfileClass}
        />

        {/* 참가자 이름 클래스 */}
        <SelectorClassManager
          label="참가자 이름 클래스"
          description="참가자 이름을 탐색하기 위한 추가 CSS 선택자"
          placeholder="예: .username, .name"
          classes={participantNameClasses}
          onAddClass={handleAddParticipantNameClass}
          onRemoveClass={handleRemoveParticipantNameClass}
        />
      </div>
    </div>
  );
};

export default PluginGlobalSettings;
