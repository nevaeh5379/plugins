/**
 * useSettings.ts
 *
 * Custom React hook for managing LogExporter settings and global plugin configurations.
 * Handles asynchronous loading from storage, debounced persistence for character-specific
 * settings, immediate persistence for global settings, and safe unmount flushing.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { RisuCharacter } from '../../types/risuai';
import type { GlobalSettings } from '../../types';
import type { LogExporterSettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  DEFAULT_GLOBAL_SETTINGS,
  loadAllCharSettings,
  loadGlobalSettings,
  saveCharSettings,
  saveGlobalSettings,
} from '../services/settingsService';

// ============================================================================
// Constants & Types
// ============================================================================

/** Debounce interval in milliseconds for saving character settings */
const SAVE_DEBOUNCE_DELAY_MS = 500;

export type SettingChangeHandler = <K extends keyof LogExporterSettings>(
  key: K | string,
  value: LogExporterSettings[K] | unknown
) => void;

export type GlobalSettingChangeHandler = <K extends keyof GlobalSettings>(
  key: K | string,
  value: GlobalSettings[K] | unknown
) => Promise<void>;

export interface UseSettingsReturn {
  /** Current Log Exporter configuration for the active character */
  settings: LogExporterSettings;
  /** Global plugin settings shared across all characters */
  globalSettings: GlobalSettings;
  /** Callback to update a character-specific exporter setting */
  handleSettingChange: SettingChangeHandler;
  /** Callback to update and persist a global plugin setting */
  handleGlobalSettingChange: GlobalSettingChangeHandler;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merges loaded character settings onto defaults to ensure all required fields are present.
 */
function mergeWithDefaultSettings(
  savedSettings: unknown,
  defaults: LogExporterSettings = DEFAULT_SETTINGS
): LogExporterSettings {
  if (savedSettings && typeof savedSettings === 'object' && !Array.isArray(savedSettings)) {
    return {
      ...defaults,
      ...(savedSettings as Partial<LogExporterSettings>),
    };
  }
  return { ...defaults };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing LogExporter settings and global plugin configurations.
 *
 * @param character - The currently active RisuAI character (or null if none selected).
 * @returns Settings states and change handlers.
 */
export function useSettings(character: RisuCharacter | null): UseSettingsReturn {
  const [settings, setSettings] = useState<LogExporterSettings>(DEFAULT_SETTINGS);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);

  const charId = character?.chaId ? String(character.chaId).trim() : null;

  // Refs for tracking mutable state without triggering re-renders
  const settingsRef = useRef<LogExporterSettings>(settings);
  settingsRef.current = settings;

  const charIdRef = useRef<string | null>(charId);
  charIdRef.current = charId;

  const isDirtyRef = useRef<boolean>(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Immediately flushes any pending debounced character settings save.
   */
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = undefined;
    }

    if (isDirtyRef.current && charIdRef.current) {
      const targetCharId = charIdRef.current;
      const targetSettings = settingsRef.current as unknown as Record<string, unknown>;
      isDirtyRef.current = false;
      void saveCharSettings(targetCharId, targetSettings);
    }
  }, []);

  /**
   * Updates a single character-level setting and marks state as dirty for auto-saving.
   */
  const handleSettingChange: SettingChangeHandler = useCallback((key, value) => {
    isDirtyRef.current = true;
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /**
   * Updates a global plugin setting and persists the change to storage.
   */
  const handleGlobalSettingChange: GlobalSettingChangeHandler = useCallback(
    async (key, value) => {
      setGlobalSettings(prev => ({
        ...prev,
        [key]: value,
      }));
      await saveGlobalSettings({ [key]: value } as Partial<GlobalSettings>);
    },
    []
  );

  // ── Load Settings on Character Change ──────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    // Flush any pending unsaved changes from previous character before loading new one
    flushPendingSave();

    const loadSettings = async () => {
      try {
        const [allCharSettings, loadedGlobal] = await Promise.all([
          loadAllCharSettings(),
          loadGlobalSettings(),
        ]);

        if (isCancelled) return;

        const rawCharSettings = charId ? allCharSettings[charId] : undefined;
        const resolvedSettings = mergeWithDefaultSettings(rawCharSettings);

        // Reset dirty flag since these are freshly loaded values
        isDirtyRef.current = false;
        setSettings(resolvedSettings);
        setGlobalSettings(loadedGlobal);
      } catch (err) {
        if (!isCancelled) {
          console.error('[Log Exporter] Failed to load settings:', err);
        }
      }
    };

    void loadSettings();

    return () => {
      isCancelled = true;
    };
  }, [charId, flushPendingSave]);

  // ── Debounced Auto-Save for Character Settings ─────────────────────────
  useEffect(() => {
    // Only schedule save if user made changes and character is valid
    if (!isDirtyRef.current || !charId) {
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      if (charId && isDirtyRef.current) {
        isDirtyRef.current = false;
        void saveCharSettings(charId, settings as unknown as Record<string, unknown>);
      }
      saveTimerRef.current = undefined;
    }, SAVE_DEBOUNCE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [settings, charId]);

  // ── Flush Pending Saves on Unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  return {
    settings,
    globalSettings,
    handleSettingChange,
    handleGlobalSettingChange,
  };
}
