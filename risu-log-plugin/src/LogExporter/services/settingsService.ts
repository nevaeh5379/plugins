/**
 * settingsService.ts
 *
 * Provides persistence and migration services for RisuAI Plugin API v3.0 storage.
 * Handles both per-character exporter settings and global plugin configurations.
 */

import type { GlobalSettings } from '../../types'

// ============================================================================
// Storage Keys & Constants
// ============================================================================

export const STORAGE_KEYS = {
  CHAR_SETTINGS: 'logExporterCharacterSettings',
  GLOBAL_SETTINGS: 'logExporterGlobalSettings',
} as const

/**
 * Default CSS class selectors for character avatar/profile images in Risu chat.
 */
export const DEFAULT_PROFILE_CLASSES: readonly string[] = Object.freeze([
  'x-risu-GH_VEX_ST_C',
  'x-risu-GH_VEX_ST_U',
])

/**
 * Default CSS class selectors for participant name elements in Risu chat.
 */
export const DEFAULT_NAME_CLASSES: readonly string[] = Object.freeze([
  'x-risu-GH_VEX_Head_C2',
  'x-risu-GH_VEX_Head_U2',
])

/**
 * Default fallback global settings when nothing has been configured yet.
 */
export const DEFAULT_GLOBAL_SETTINGS: Readonly<GlobalSettings> = Object.freeze({
  profileClasses: [...DEFAULT_PROFILE_CLASSES],
  participantNameClasses: [...DEFAULT_NAME_CLASSES],
  defaultClassesAdded: true,
})

// ============================================================================
// Types
// ============================================================================

export type CharacterSettings = Record<string, unknown>
export type CharacterSettingsMap = Record<string, CharacterSettings>

// ============================================================================
// Helper Utilities & Safe Storage Wrappers
// ============================================================================

/**
 * Retrieves the RisuAI pluginStorage instance if available in the global runtime.
 */
function getPluginStorage() {
  if (typeof risuai !== 'undefined' && risuai?.pluginStorage) {
    return risuai.pluginStorage
  }
  if (typeof Risuai !== 'undefined' && Risuai?.pluginStorage) {
    return Risuai.pluginStorage
  }
  throw new Error('RisuAI pluginStorage is not available in the current environment.')
}

/**
 * Defensively parses stored data from plugin storage.
 * Handles stringified JSON, pre-parsed objects, primitives, null/undefined, and malformed inputs.
 */
function parseStorageRecord(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {}
  }

  if (typeof raw === 'object') {
    return Array.isArray(raw) ? {} : (raw as Record<string, unknown>)
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) {
      return {}
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Malformed JSON string; return empty record fallback
    }
  }

  return {}
}

/**
 * Normalizes an array of class name selectors by removing non-string or whitespace-only items.
 */
function sanitizeClassList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }
  return input
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

/**
 * Safely executes an asynchronous storage operation, returning a fallback value on failure.
 */
async function safeStorageOp<T>(op: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await op()
  } catch (error) {
    console.error(`[log plugin] ${label}`, error)
    return fallback
  }
}

/**
 * Safely executes a void asynchronous storage operation, catching and logging any errors.
 */
async function safeStorageVoid(op: () => Promise<void>, label: string): Promise<void> {
  try {
    await op()
  } catch (error) {
    console.error(`[log plugin] ${label}`, error)
  }
}

// ============================================================================
// Service API
// ============================================================================

/**
 * Loads settings for all characters from synchronized plugin storage.
 *
 * @returns A dictionary mapping character IDs to their respective setting objects.
 */
export const loadAllCharSettings = async (): Promise<CharacterSettingsMap> =>
  safeStorageOp(
    async () => {
      const storage = getPluginStorage()
      const raw = await storage.getItem(STORAGE_KEYS.CHAR_SETTINGS)
      const parsed = parseStorageRecord(raw)

      const result: CharacterSettingsMap = {}
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = value as CharacterSettings
        }
      }

      return result
    },
    {},
    '설정 로드 실패:'
  )

/**
 * Persists settings for a specific character into synchronized plugin storage.
 * Performs a shallow merge with any existing settings for the character.
 *
 * @param charId - The unique identifier of the character.
 * @param settings - The partial or full settings to persist.
 */
export const saveCharSettings = async (
  charId: string,
  settings: Record<string, unknown>
): Promise<void> =>
  safeStorageVoid(async () => {
    const trimmedId = charId?.trim()
    if (!trimmedId) {
      console.warn('[log plugin] saveCharSettings called with an empty character ID.')
      return
    }

    const storage = getPluginStorage()
    const all = await loadAllCharSettings()
    all[trimmedId] = { ...(all[trimmedId] || {}), ...settings }
    await storage.setItem(STORAGE_KEYS.CHAR_SETTINGS, JSON.stringify(all))
  }, '캐릭터 설정 저장 실패:')

/**
 * Loads the global plugin settings from storage.
 * Automatically injects default profile and participant name classes on first run.
 *
 * @returns The resolved GlobalSettings object.
 */
export const loadGlobalSettings = async (): Promise<GlobalSettings> =>
  safeStorageOp(
    async () => {
      const storage = getPluginStorage()
      const raw = await storage.getItem(STORAGE_KEYS.GLOBAL_SETTINGS)
      const parsed = parseStorageRecord(raw)

      const profileClasses = sanitizeClassList(parsed.profileClasses)
      const participantNameClasses = sanitizeClassList(parsed.participantNameClasses)
      const defaultClassesAdded = Boolean(parsed.defaultClassesAdded)

      const settings: GlobalSettings = {
        ...parsed,
        profileClasses,
        participantNameClasses,
        defaultClassesAdded,
      }

      // Automatically migrate and append default classes on first launch
      if (!settings.defaultClassesAdded) {
        settings.profileClasses = Array.from(
          new Set([...settings.profileClasses, ...DEFAULT_PROFILE_CLASSES])
        )
        settings.participantNameClasses = Array.from(
          new Set([...settings.participantNameClasses, ...DEFAULT_NAME_CLASSES])
        )
        settings.defaultClassesAdded = true

        await storage.setItem(STORAGE_KEYS.GLOBAL_SETTINGS, JSON.stringify(settings))
      }

      return settings
    },
    { profileClasses: [], participantNameClasses: [] },
    '전역 설정 로드 실패:'
  )

/**
 * Persists global plugin settings by merging the provided partial settings with existing ones.
 *
 * @param newSettings - The partial global settings updates to apply.
 */
export const saveGlobalSettings = async (newSettings: Partial<GlobalSettings>): Promise<void> =>
  safeStorageVoid(async () => {
    const storage = getPluginStorage()
    const existing = await loadGlobalSettings()
    const merged: GlobalSettings = { ...existing, ...newSettings }
    await storage.setItem(STORAGE_KEYS.GLOBAL_SETTINGS, JSON.stringify(merged))
  }, '전역 설정 저장 실패:')

