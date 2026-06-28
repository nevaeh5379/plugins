/* eslint-disable @typescript-eslint/no-explicit-any */
// settingsService.ts — API v3.0 기반
// localStorage → Risuai.pluginStorage / getLocalPluginStorage 로 마이그레이션
// 모든 메서드가 async가 됩니다.
import type { GlobalSettings } from '../../types'

const CHAR_SETTINGS_KEY = 'logExporterCharacterSettings'
const GLOBAL_SETTINGS_KEY = 'logExporterGlobalSettings'

const DEFAULT_PROFILE_CLASSES = ['x-risu-GH_VEX_ST_C', 'x-risu-GH_VEX_ST_U']
const DEFAULT_NAME_CLASSES = ['x-risu-GH_VEX_Head_C2', 'x-risu-GH_VEX_Head_U2']

async function safeStorageOp<T>(op: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await op()
  } catch (e) {
    console.error(`[log plugin] ${label}`, e)
    return fallback
  }
}

async function safeStorageVoid(op: () => Promise<void>, label: string): Promise<void> {
  try {
    await op()
  } catch (e) {
    console.error(`[log plugin] ${label}`, e)
  }
}

/**
 * 모든 캐릭터의 설정을 불러옵니다. (세이브 파일 단위, 동기화 지원)
 */
export const loadAllCharSettings = async (): Promise<Record<string, any>> =>
  safeStorageOp(async () => {
    const raw = await Risuai.pluginStorage.getItem(CHAR_SETTINGS_KEY)
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
  }, {}, '설정 로드 실패:')

/**
 * 단일 캐릭터 설정을 저장합니다.
 */
export const saveCharSettings = async (charId: string, settings: Record<string, unknown>): Promise<void> =>
  safeStorageVoid(async () => {
    const all = await loadAllCharSettings()
    all[charId] = { ...(all[charId] || {}), ...settings }
    await Risuai.pluginStorage.setItem(CHAR_SETTINGS_KEY, JSON.stringify(all))
  }, '캐릭터 설정 저장 실패:')

/**
 * 전역 설정을 불러옵니다.
 */
export const loadGlobalSettings = async (): Promise<GlobalSettings> =>
  safeStorageOp(async () => {
    const raw = await Risuai.pluginStorage.getItem(GLOBAL_SETTINGS_KEY)
    const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}
    if (!Array.isArray(parsed.profileClasses)) parsed.profileClasses = []
    if (!Array.isArray(parsed.participantNameClasses)) parsed.participantNameClasses = []

    // 기본 클래스 자동 추가 (한 번만)
    if (!parsed.defaultClassesAdded) {
      parsed.profileClasses = [...new Set([...parsed.profileClasses, ...DEFAULT_PROFILE_CLASSES])]
      parsed.participantNameClasses = [
        ...new Set([...parsed.participantNameClasses, ...DEFAULT_NAME_CLASSES])
      ]
      parsed.defaultClassesAdded = true
      await Risuai.pluginStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(parsed))
    }

    return parsed
  }, { profileClasses: [], participantNameClasses: [] }, '전역 설정 로드 실패:')

/**
 * 전역 설정을 저장합니다.
 */
export const saveGlobalSettings = async (newSettings: Partial<GlobalSettings>): Promise<void> =>
  safeStorageVoid(async () => {
    const existing = await loadGlobalSettings()
    const merged = { ...existing, ...newSettings }
    await Risuai.pluginStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(merged))
  }, '전역 설정 저장 실패:')
