export interface TransformResult {
  supported: boolean
  code?: string
  reason?: string
  strategy?: string
}

function absolute(specifier: string, baseUrl: string) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return specifier
  return new URL(specifier, baseUrl).href
}

export function absolutizeImports(source: string, baseUrl: string): string {
  // Risu's development entry uses ordinary quoted ESM imports. Production
  // instrumentation will replace this with an AST-backed transformer.
  return source
    .replace(/(\bfrom\s*|\bimport\s*)(["'])(\.?\.?\/|\/)([^"']*)(\2)/g,
      (_match, prefix: string, quote: string, start: string, rest: string) =>
        `${prefix}${quote}${absolute(start + rest, baseUrl)}${quote}`)
    .replace(/(\bimport\s*\(\s*)(["'])(\.?\.?\/|\/)([^"']*)(\2\s*\))/g,
      (_match, prefix: string, quote: string, start: string, rest: string, suffix: string) =>
        `${prefix}${quote}${absolute(start + rest, baseUrl)}${suffix}`)
}

export function rewriteProductionEntry(
  source: string,
  entryUrl: string,
  databaseUrl: string,
  bridgeUrl: string,
): string {
  const resolve = (specifier: string) => {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) return specifier
    const resolved = new URL(specifier, entryUrl).href
    return resolved === databaseUrl ? bridgeUrl : resolved
  }
  return source
    .replace(/(\bfrom\s*|\bimport\s*)(["'])(\.?\.?\/|\/)([^"']*)(\2)/g,
      (_match, prefix: string, quote: string, start: string, rest: string) =>
        `${prefix}${quote}${resolve(start + rest)}${quote}`)
    .replace(/(\bimport\s*\(\s*)(["'`])(\.?\.?\/|\/)([^"'`]*)(\2\s*\))/g,
      (_match, prefix: string, quote: string, start: string, rest: string, suffix: string) =>
        `${prefix}${quote}${resolve(start + rest)}${suffix}`)
}

export function transformDevelopmentEntry(source: string, entryUrl: string): TransformResult {
  if (!entryUrl.endsWith('/src/main.ts')) {
    return { supported: false, reason: 'Not a Vite development entry.' }
  }

  const storageUrl = new URL('/src/ts/storage/database.svelte.ts', entryUrl).href
  const parserUrl = new URL('/src/ts/parser/parser.svelte.ts', entryUrl).href
  const modulesUrl = new URL('/src/ts/process/modules.ts', entryUrl).href
  const globalApiUrl = new URL('/src/ts/globalApi.svelte.ts', entryUrl).href
  const instrumented = `import {
  getCurrentCharacter as __rlGetCharacter,
  setCurrentCharacter as __rlSetCharacter,
  getDatabase as __rlGetDatabase,
  setDatabase as __rlSetDatabase
} from ${JSON.stringify(storageUrl)};
import { risuChatParser as __rlChatParser, ParseMarkdown as __rlMarkdown, parseMarkdownSafe as __rlMarkdownSafe } from ${JSON.stringify(parserUrl)};
import { getModules as __rlGetModules } from ${JSON.stringify(modulesUrl)};
import { readImage as __rlReadAsset, saveAsset as __rlSaveAsset } from ${JSON.stringify(globalApiUrl)};

const __rlClone = (value, seen = new WeakMap()) => {
  try { return structuredClone(value); } catch {}
  if (value === null || typeof value !== 'object')
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const output = []; seen.set(value, output);
    for (const item of value) output.push(__rlClone(item, seen));
    return output;
  }
  const output = {}; seen.set(value, output);
  for (const key of Object.keys(value)) {
    try { const item = __rlClone(value[key], seen); if (item !== undefined) output[key] = item; } catch {}
  }
  return output;
};
const __rlPairs = (text) => String(text ?? '').split('\\n').map((line) => line.split('=')).filter(([key, value]) => key && value);
const __rlChat = () => { const character = __rlGetCharacter(); return character?.chats?.[character.chatPage]; };
const __rlGetVar = (key) => {
  const character = __rlGetCharacter(), chat = __rlChat();
  if (!character || !chat) return 'null';
  chat.scriptstate ??= {};
  const stored = chat.scriptstate['$' + key];
  if (stored !== undefined && stored !== null) return String(stored);
  return __rlPairs(character.defaultVariables).concat(__rlPairs(__rlGetDatabase().templateDefaultVariables)).find(([name]) => name === key)?.[1] ?? 'null';
};
globalThis.__RISU_LOADER_HOOK__ = Object.freeze({
  source: 'instrumented',
  version: 'source-dev',
  getCurrentCharacter: () => structuredClone(__rlGetCharacter({ snapshot: true })),
  setCurrentCharacter: (character) => __rlSetCharacter(structuredClone(character)),
  getDatabaseSnapshot: () => __rlClone(__rlGetDatabase({ snapshot: true })),
  updateDatabase: (database) => __rlSetDatabase(structuredClone(database)),
  parseCBS: (text, options = {}) => __rlChatParser(String(text), { ...options }),
  getChatVariable: (key) => __rlGetVar(String(key)),
  setChatVariable: (key, value) => { const chat = __rlChat(); if (!chat) throw new Error('No current chat is selected.'); chat.scriptstate ??= {}; chat.scriptstate['$' + String(key)] = String(value); },
  getGlobalVariable: (key) => __rlGetDatabase().globalChatVariables?.[String(key)] ?? 'null',
  setGlobalVariable: (key, value) => { const db = __rlGetDatabase(); db.globalChatVariables ??= {}; db.globalChatVariables[String(key)] = String(value); },
  listEffectiveVariables: () => {
    const character = __rlGetCharacter(), chat = __rlChat(), output = {};
    for (const [key, value] of __rlPairs(__rlGetDatabase().templateDefaultVariables)) output[key] = value;
    for (const [key, value] of __rlPairs(character?.defaultVariables)) output[key] = value;
    for (const [key, value] of Object.entries(chat?.scriptstate ?? {})) if (key.startsWith('$')) output[key.slice(1)] = String(value);
    return output;
  },
  getActiveModules: () => __rlClone(__rlGetModules()),
  getCurrentCharacterIndex: () => { const character = __rlGetCharacter(); return __rlGetDatabase().characters?.findIndex((item) => item?.chaId === character?.chaId) ?? -1; },
  getCurrentChat: () => __rlClone(__rlChat()),
  readAsset: async (path) => __rlClone(await __rlReadAsset(String(path))),
  saveAsset: async (data, customId = '', fileName = '') => __rlSaveAsset(new Uint8Array(data), customId, fileName),
  parseMarkdown: (text, options = {}) => __rlMarkdown(String(text), options.character ?? __rlGetCharacter(), options.mode ?? 'normal', options.chatID ?? -1, options.cbsConditions ?? {}),
  parseMarkdownSafe: (text, forbidTags = []) => __rlMarkdownSafe(String(text), { forbidTags })
});
globalThis.dispatchEvent(new CustomEvent('risu-loader:hook-ready'));
`
  return { supported: true, code: instrumented, strategy: 'vite-source-entry' }
}

export function inspectProductionBundle(source: string): TransformResult {
  if (!source.includes('characters')) {
    return { supported: false, strategy: 'production-ast', reason: 'Missing characters semantic anchor.' }
  }

  let tree: any
  try {
    tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  } catch (error) {
    return { supported: false, strategy: 'production-ast', reason: `Bundle parse failed: ${String(error)}` }
  }

  interface Candidate {
    name: string
    start: number
    end: number
    readsCharacters: boolean
    writesCharacters: boolean
    returnsValue: boolean
    score: number
  }
  const candidates: Candidate[] = []

  ancestor(tree, {
    FunctionDeclaration(node: any, ancestors: any[]) {
      if (ancestors[ancestors.length - 2]?.type !== 'Program' || !node.id?.name) return
      candidates.push(analyzeFunction(node.id.name, node, source))
    },
    VariableDeclarator(node: any, ancestors: any[]) {
      const parentDeclaration = ancestors[ancestors.length - 2]
      const program = ancestors[ancestors.length - 3]
      if (program?.type !== 'Program' || parentDeclaration?.type !== 'VariableDeclaration') return
      if (node.id?.type !== 'Identifier') return
      if (!node.init || !['ArrowFunctionExpression', 'FunctionExpression'].includes(node.init.type)) return
      candidates.push(analyzeFunction(node.id.name, node.init, source))
    },
  } as any)

  const getters = candidates
    .filter((candidate) => candidate.readsCharacters && candidate.returnsValue && !candidate.writesCharacters)
    .sort((a, b) => b.score - a.score)
  const setters = candidates
    .filter((candidate) => candidate.writesCharacters)
    .sort((a, b) => b.score - a.score)

  const getter = chooseCandidate(getters)
  const setter = chooseCandidate(setters)
  if (!getter || !setter) {
    return {
      supported: false,
      strategy: 'production-ast',
      reason: `Ambiguous runtime bindings (getters=${summarize(getters)}, setters=${summarize(setters)}).`,
    }
  }

  const bridge = `\n;globalThis.__RISU_LOADER_HOOK__=Object.freeze({
source:'instrumented',version:'bundle-auto',
getCurrentCharacter:()=>structuredClone(${getter.name}({snapshot:true})),
setCurrentCharacter:(character)=>${setter.name}(structuredClone(character))
});globalThis.dispatchEvent(new CustomEvent('risu-loader:hook-ready'));\n`
  return { supported: true, code: source + bridge, strategy: 'production-ast' }
}

function analyzeFunction(name: string, node: any, source: string) {
  const body = source.slice(node.start, node.end)
  let writesCharacters = false
  let returnsValue = false
  ancestor(node, {
    AssignmentExpression(assignment: any) {
      const left = source.slice(assignment.left.start, assignment.left.end)
      if (/\.characters(?:\?\.)?\s*\[/.test(left)) writesCharacters = true
    },
    ReturnStatement(statement: any) {
      if (statement.argument) returnsValue = true
    },
  } as any)
  const readsCharacters = /\.characters(?:\?\.)?\s*\[/.test(body)
  let score = 0
  if (readsCharacters) score += 4
  if (writesCharacters) score += 5
  if (returnsValue) score += 2
  if (/snapshot/.test(body)) score += 3
  if (/\.characters\s*=\s*\[\]/.test(body)) score += 2
  if (body.length < 500) score += 1
  return { name, start: node.start, end: node.end, readsCharacters, writesCharacters, returnsValue, score }
}

function chooseCandidate<T extends { score: number }>(candidates: T[]): T | null {
  if (!candidates[0] || candidates[0].score < 6) return null
  if (candidates[1] && candidates[1].score === candidates[0].score) return null
  return candidates[0]
}

function summarize(candidates: Array<{ name: string; score: number }>) {
  return candidates.slice(0, 3).map((candidate) => `${candidate.name}:${candidate.score}`).join(',') || 'none'
}
import { parse } from 'acorn'
import { ancestor } from 'acorn-walk'
