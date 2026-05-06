import React, { createContext, useContext, useState, useEffect } from 'react';

export type EditorType = 'monaco' | 'codemirror' | 'ace' | 'simple';
export type ThemeType = 'risu-dark' | 'risu-light' | 'custom';
export type ExplorerMode = 'sidebar' | 'window';

export interface CustomThemeColors {
  bgEditor: string;
  bgSidebar: string;
  bgTitlebar: string;
  bgStatusbar: string;
  bgTabActive: string;
  bgTabInactive: string;
  bgInput: string;
  bgHover: string;
  bgSelected: string;
  fg: string;
  fgBright: string;
  fgMuted: string;
  fgDim: string;
  accent: string;
  accentHover: string;
  border: string;
  borderStrong: string;
}

export const defaultCustomTheme: CustomThemeColors = {
  bgEditor: '#1F1F1F',
  bgSidebar: '#181818',
  bgTitlebar: '#181818',
  bgStatusbar: '#181818',
  bgTabActive: '#1F1F1F',
  bgTabInactive: '#181818',
  bgInput: '#313131',
  bgHover: '#2A2D2E',
  bgSelected: '#04395E',
  fg: '#CCCCCC',
  fgBright: '#FFFFFF',
  fgMuted: '#9D9D9D',
  fgDim: '#868686',
  accent: '#0078D4',
  accentHover: '#026EC1',
  border: '#2B2B2B',
  borderStrong: '#313131',
};

export interface EditorSettings {
  desktopEditor: EditorType;
  mobileEditor: EditorType;
  fontSize: number;
  theme: ThemeType;
  customTheme: CustomThemeColors;
  explorerMode: ExplorerMode;
}

const defaultSettings: EditorSettings = {
  desktopEditor: 'monaco',
  mobileEditor: 'codemirror',
  fontSize: 14,
  theme: 'risu-dark',
  customTheme: defaultCustomTheme,
  explorerMode: 'sidebar',
};

interface SettingsContextType {
  settings: EditorSettings;
  updateSettings: (newSettings: Partial<EditorSettings>) => void;
  updateCustomTheme: (colors: Partial<CustomThemeColors>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<EditorSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        let saved: string | null = null;
        if (typeof Risuai !== 'undefined' && Risuai.pluginStorage) {
          saved = await Risuai.pluginStorage.getItem('risu-editor-settings');
        } else {
          saved = localStorage.getItem('risu-editor-settings');
        }

        if (saved) {
          setSettings({ ...defaultSettings, ...JSON.parse(saved) });
        }
      } catch (e) {
        console.error('Failed to parse settings', e);
      } finally {
        setIsLoaded(true);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const saveSettings = async () => {
      try {
        const val = JSON.stringify(settings);
        if (typeof Risuai !== 'undefined' && Risuai.pluginStorage) {
          await Risuai.pluginStorage.setItem('risu-editor-settings', val);
        } else {
          localStorage.setItem('risu-editor-settings', val);
        }
      } catch (e) {
        console.error('Failed to save settings', e);
      }
    };

    saveSettings();
  }, [settings, isLoaded]);

  const updateSettings = (newSettings: Partial<EditorSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const updateCustomTheme = (colors: Partial<CustomThemeColors>) => {
    setSettings((prev) => ({
      ...prev,
      customTheme: { ...prev.customTheme, ...colors },
    }));
  };

  if (!isLoaded) {
    return null; // Or a loading spinner if preferred
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, updateCustomTheme }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
