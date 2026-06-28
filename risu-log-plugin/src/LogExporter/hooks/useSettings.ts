import { useState, useCallback, useEffect, useRef } from 'react';
import type { RisuCharacter } from '../../types/risuai';
import type { GlobalSettings } from '../../types';
import type { LogExporterSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  loadAllCharSettings,
  loadGlobalSettings,
  saveCharSettings,
  saveGlobalSettings,
} from '../services/settingsService';

export function useSettings(character: RisuCharacter | null) {
  const [settings, setSettings] = useState<LogExporterSettings>(DEFAULT_SETTINGS);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    profileClasses: [],
    participantNameClasses: [],
  });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSettingChange = useCallback((key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGlobalSettingChange = useCallback(async (key: string, value: unknown) => {
    const newSettings: Partial<GlobalSettings> = { ...globalSettings, [key]: value } as Partial<GlobalSettings>;
    setGlobalSettings(newSettings as GlobalSettings);
    await saveGlobalSettings(newSettings);
  }, [globalSettings]);

  // Debounced character settings save
  useEffect(() => {
    if (!character?.chaId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveCharSettings(String(character.chaId), settings as unknown as Record<string, unknown>);
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [settings, character]);

  // Load settings on character change
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [allCharSettings, loadedGlobal] = await Promise.all([
          loadAllCharSettings(),
          loadGlobalSettings(),
        ]);

        const charSettings = character
          ? (allCharSettings[String(character.chaId)] as Partial<LogExporterSettings>) || {}
          : {};

        setSettings(prev => ({ ...prev, ...charSettings }));
        setGlobalSettings(loadedGlobal);
      } catch (err) {
        console.error('[Log Exporter] Failed to load settings:', err);
      }
    };

    loadSettings();
  }, [character]);

  return {
    settings,
    globalSettings,
    handleSettingChange,
    handleGlobalSettingChange,
  };
}
