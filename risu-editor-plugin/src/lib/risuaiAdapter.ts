/**
 * risup-editor-plugin, a RisuAI plugin for editing character lorebooks, prompts, and settings
 * Copyright (C) 2026 nevaeh5379
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * Risuai API Adapter: wraps the global Risuai object for use in React hooks.
 * Handles loading character data and saving changes back.
 */

import type { RisuCharacter } from '../types/risuai.d.ts'

function getApi() {
  if (typeof Risuai !== 'undefined') return Risuai
  if (typeof risuai !== 'undefined') return risuai
  return null
}

export async function loadCharacter(): Promise<RisuCharacter | null> {
  const api = getApi()
  if (!api) {
    console.warn('[Risu Editor] Risuai API not available')
    return null
  }
  try {
    const char = await api.getCharacter()
    return char as RisuCharacter
  } catch (err) {
    console.error('[Risu Editor] Failed to load character:', err)
    return null
  }
}

export async function saveCharacter(char: RisuCharacter): Promise<boolean> {
  const api = getApi()
  if (!api) return false
  try {
    await api.setCharacter(char)
    return true
  } catch (err) {
    console.error('[Risu Editor] Failed to save character:', err)
    return false
  }
}

export async function hideEditor(): Promise<void> {
  const api = getApi()
  if (api) {
    await api.hideContainer()
  }
}

export async function showEditor(): Promise<void> {
  const api = getApi()
  if (api) {
    await api.showContainer('fullscreen')
  }
}

export async function getColorScheme(): Promise<{ name: string; scheme: any } | null> {
  const api = getApi()
  if (!api) return null
  try {
    return await api.getColorScheme()
  } catch {
    return null
  }
}

/**
 * Generates a mock character for development/preview purposes.
 */
export function getMockCharacter(): RisuCharacter {
  return {
    name: 'Test Character',
    firstMessage: 'Hello! I am a test character.\n\nHow can I help you today?',
    desc: 'A friendly test character for development.',
    notes: 'Development notes here.',
    chats: [],
    chatPage: 0,
    viewScreen: 'none',
    bias: [],
    emotionImages: [],
    globalLore: [
      {
        key: 'magic,spell',
        secondkey: '',
        insertorder: 100,
        comment: 'Magic System',
        content: 'The world has a complex magic system based on elemental affinities.',
        mode: 'normal',
        alwaysActive: false,
        selective: false,
        id: 'lore_001',
      },
      {
        key: 'kingdom,castle',
        secondkey: '',
        insertorder: 100,
        comment: 'Kingdom Info',
        content: 'The kingdom of Eldoria is ruled by Queen Aria.',
        mode: 'normal',
        alwaysActive: false,
        selective: true,
        id: 'lore_002',
      },
      {
        key: '',
        secondkey: '',
        insertorder: 100,
        comment: 'World Lore',
        content: '',
        mode: 'folder',
        alwaysActive: false,
        selective: false,
        id: 'folder_001',
      },
      {
        key: 'dragon',
        secondkey: '',
        insertorder: 100,
        comment: 'Dragons',
        content: 'Dragons are ancient creatures of immense power.',
        mode: 'child',
        alwaysActive: false,
        selective: false,
        id: 'lore_003',
        folder: 'folder_001',
      },
    ],
    chaId: 'test-001',
    sdData: [],
    customscript: [
      {
        comment: 'Remove asterisks',
        in: '\\*',
        out: '',
        type: 'editdisplay',
      },
    ],
    triggerscript: [],
    utilityBot: false,
    exampleMessage: '<START>\n{{user}}: Hello!\n{{char}}: Hi there! How are you?',
    creatorNotes: 'Created for testing the editor plugin.',
    systemPrompt: 'You are a friendly assistant character.',
    postHistoryInstructions: '',
    alternateGreetings: [
      'Greetings, traveler! What brings you here?',
      'Hey! Nice to meet you!',
    ],
    tags: ['test', 'development'],
    creator: 'Developer',
    characterVersion: '1.0',
    personality: 'Friendly, helpful, curious',
    scenario: 'A test scenario for development purposes.',
    firstMsgIndex: 0,
    loreSettings: {
      tokenBudget: 2048,
      scanDepth: 5,
      recursiveScanning: false,
    },
    replaceGlobalNote: '',
    additionalText: '',
  }
}
