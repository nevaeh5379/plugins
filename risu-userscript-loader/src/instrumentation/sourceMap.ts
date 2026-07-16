import { parse } from 'acorn'
import { generatedPositionFor, LEAST_UPPER_BOUND, TraceMap } from '@jridgewell/trace-mapping'
import { fetchText } from './fetch'

interface SourceMapJson {
  sources: string[]
  sourcesContent?: Array<string | null>
}

export interface ProductionBridge {
  bridgeUrl: string
  databaseUrl: string
  getterExport: string
}

export async function createProductionBridge(
  entrySource: string,
  entryUrl: string,
): Promise<ProductionBridge> {
  const databaseSpecifier = findDatabaseSpecifier(entrySource)
  if (!databaseSpecifier) throw new Error('The entry does not import a database.svelte chunk.')
  const databaseUrl = new URL(databaseSpecifier, entryUrl).href
  const databaseSource = await fetchText(databaseUrl)
  const mapRef = /\/\/# sourceMappingURL=([^\s]+)/.exec(databaseSource)?.[1]
  if (!mapRef) throw new Error('The database chunk does not publish a source map.')
  const rawMap = JSON.parse(await fetchText(new URL(mapRef, databaseUrl).href)) as SourceMapJson

  const sourceIndex = rawMap.sources.findIndex((source) => source.endsWith('/database.svelte.ts'))
  const originalSource = rawMap.sourcesContent?.[sourceIndex]
  if (sourceIndex < 0 || !originalSource) throw new Error('database.svelte.ts was not found in source map.')

  const getterLocal = locateGeneratedBinding(
    databaseSource,
    rawMap,
    rawMap.sources[sourceIndex],
    originalSource,
    'getCurrentCharacter',
  )
  // Locating both functions prevents a similarly named unrelated getter from
  // being accepted, even though object-preserving writes only need the getter.
  locateGeneratedBinding(
    databaseSource,
    rawMap,
    rawMap.sources[sourceIndex],
    originalSource,
    'setCurrentCharacter',
  )
  const getterExport = findExportedName(databaseSource, getterLocal)
  if (!getterExport) throw new Error(`Generated getter ${getterLocal} is not exported by the database chunk.`)
  const databaseGetterLocal = locateGeneratedBinding(
    databaseSource,
    rawMap,
    rawMap.sources[sourceIndex],
    originalSource,
    'getDatabase',
  )
  const databaseSetterLocal = locateGeneratedBinding(
    databaseSource,
    rawMap,
    rawMap.sources[sourceIndex],
    originalSource,
    'setDatabase',
  )
  const databaseGetterExport = findExportedName(databaseSource, databaseGetterLocal)
  const databaseSetterExport = findExportedName(databaseSource, databaseSetterLocal)
  if (!databaseGetterExport || !databaseSetterExport) {
    throw new Error('Generated database getter/setter is not exported by the database chunk.')
  }
  const parserExport = locateExportedFunction(
    databaseSource,
    rawMap,
    '/parser/parser.svelte.ts',
    'risuChatParser',
  )
  const modulesExport = locateExportedFunction(
    databaseSource,
    rawMap,
    '/process/modules.ts',
    'getModules',
  )
  const markdownExport = locateExportedFunction(
    databaseSource, rawMap, '/parser/parser.svelte.ts', 'ParseMarkdown',
  )
  const markdownSafeExport = locateExportedFunction(
    databaseSource, rawMap, '/parser/parser.svelte.ts', 'parseMarkdownSafe',
  )
  const readAssetExport = locateExportedFunction(
    databaseSource, rawMap, '/globalApi.svelte.ts', 'readImage',
  )
  const saveAssetExport = locateExportedFunction(
    databaseSource, rawMap, '/globalApi.svelte.ts', 'saveAsset',
  )

  const bridgeCode = `
import {
  ${getterExport} as __risuGetCharacter,
  ${databaseGetterExport} as __risuGetDatabase,
  ${databaseSetterExport} as __risuSetDatabase,
  ${parserExport} as __risuChatParser,
  ${modulesExport} as __risuGetModules,
  ${markdownExport} as __risuParseMarkdown,
  ${markdownSafeExport} as __risuParseMarkdownSafe,
  ${readAssetExport} as __risuReadAsset,
  ${saveAssetExport} as __risuSaveAsset
} from ${JSON.stringify(databaseUrl)};
export * from ${JSON.stringify(databaseUrl)};
const __risuClone = (value, seen = new WeakMap()) => {
  try { return structuredClone(value); } catch {}
  if (value === null || typeof value !== 'object')
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const output = []; seen.set(value, output);
    for (const item of value) output.push(__risuClone(item, seen));
    return output;
  }
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
  if (value instanceof Map) {
    const output = new Map(); seen.set(value, output);
    try { for (const [key, item] of value) output.set(__risuClone(key, seen), __risuClone(item, seen)); return output; } catch {}
  }
  if (value instanceof Set) {
    const output = new Set(); seen.set(value, output);
    try { for (const item of value) output.add(__risuClone(item, seen)); return output; } catch {}
  }
  const output = {}; seen.set(value, output);
  for (const key of Object.keys(value)) {
    try { const item = __risuClone(value[key], seen); if (item !== undefined) output[key] = item; } catch {}
  }
  return output;
};
const __risuPairs = (text) => {
  const output = [];
  for (const line of String(text ?? '').split('\\n')) {
    const [key, value] = line.split('=');
    if (key && value) output.push([key, value]);
  }
  return output;
};
const __risuCurrentChat = () => {
  const character = __risuGetCharacter();
  return character?.chats?.[character.chatPage];
};
const __risuGetChatVariable = (key) => {
  const character = __risuGetCharacter();
  const chat = __risuCurrentChat();
  if (!character || !chat) return 'null';
  chat.scriptstate ??= {};
  const stored = chat.scriptstate['$' + key];
  if (stored !== undefined && stored !== null) return String(stored);
  const defaults = __risuPairs(character.defaultVariables)
    .concat(__risuPairs(__risuGetDatabase().templateDefaultVariables));
  return defaults.find(([name]) => name === key)?.[1] ?? 'null';
};
globalThis.__RISU_LOADER_HOOK__ = Object.freeze({
  source: 'instrumented',
  version: 'sourcemap-auto',
  getCurrentCharacter: () => structuredClone(__risuGetCharacter({ snapshot: true })),
  setCurrentCharacter: (character) => {
    const target = __risuGetCharacter();
    if (!target) throw new Error('No current character is selected.');
    const next = structuredClone(character);
    for (const key of Object.keys(target)) if (!(key in next)) delete target[key];
    Object.assign(target, next);
  },
  getDatabaseSnapshot: () => __risuClone(__risuGetDatabase({ snapshot: true })),
  updateDatabase: (database) => __risuSetDatabase(structuredClone(database)),
  parseCBS: (text, options = {}) => __risuChatParser(String(text), { ...options }),
  getChatVariable: (key) => __risuGetChatVariable(String(key)),
  setChatVariable: (key, value) => {
    const chat = __risuCurrentChat();
    if (!chat) throw new Error('No current chat is selected.');
    chat.scriptstate ??= {};
    chat.scriptstate['$' + String(key)] = String(value);
  },
  getGlobalVariable: (key) => __risuGetDatabase().globalChatVariables?.[String(key)] ?? 'null',
  setGlobalVariable: (key, value) => {
    const database = __risuGetDatabase();
    database.globalChatVariables ??= {};
    database.globalChatVariables[String(key)] = String(value);
  },
  listEffectiveVariables: () => {
    const character = __risuGetCharacter();
    const chat = __risuCurrentChat();
    const output = {};
    for (const [key, value] of __risuPairs(__risuGetDatabase().templateDefaultVariables)) output[key] = value;
    for (const [key, value] of __risuPairs(character?.defaultVariables)) output[key] = value;
    for (const [key, value] of Object.entries(chat?.scriptstate ?? {})) {
      if (key.startsWith('$')) output[key.slice(1)] = String(value);
    }
    return output;
  },
  getActiveModules: () => __risuClone(__risuGetModules()),
  getCurrentCharacterIndex: () => {
    const character = __risuGetCharacter();
    return __risuGetDatabase().characters?.findIndex((item) => item?.chaId === character?.chaId) ?? -1;
  },
  getContextKey: (kind) => {
    const character = __risuGetCharacter();
    if (!character) return 'none';
    const characterKey = character.chaId ?? 'unknown-character';
    if (kind === 'character') return String(characterKey);
    const chatIndex = character.chatPage ?? -1;
    return characterKey + ':' + chatIndex + ':' + (character.chats?.[chatIndex]?.id ?? '');
  },
  getCurrentChat: () => __risuClone(__risuCurrentChat()),
  readAsset: async (path) => __risuClone(await __risuReadAsset(String(path))),
  saveAsset: async (data, customId = '', fileName = '') => __risuSaveAsset(new Uint8Array(data), customId, fileName),
  parseMarkdown: (text, options = {}) => __risuParseMarkdown(
    String(text), options.character ?? __risuGetCharacter(), options.mode ?? 'normal',
    options.chatID ?? -1, options.cbsConditions ?? {}
  ),
  parseMarkdownSafe: (text, forbidTags = []) => __risuParseMarkdownSafe(String(text), { forbidTags })
});
globalThis.dispatchEvent(new CustomEvent('risu-loader:hook-ready'));
`
  const bridgeUrl = URL.createObjectURL(new Blob([bridgeCode], { type: 'text/javascript' }))
  return { bridgeUrl, databaseUrl, getterExport }
}

function findDatabaseSpecifier(entrySource: string): string | null {
  // Ignore Vite's __mapDeps string table: only a real static ESM import can
  // be redirected through an import map.
  const match = /\bfrom\s*["']([^"']*database\.svelte-[^"']+\.js)["']/.exec(entrySource)
  return match?.[1] ?? null
}

function locateGeneratedBinding(
  generatedSource: string,
  rawMap: SourceMapJson,
  originalPath: string,
  originalSource: string,
  functionName: string,
): string {
  const originalIndex = originalSource.search(new RegExp(`(?:export\\s+)?function\\s+${functionName}\\s*\\(`))
  if (originalIndex < 0) throw new Error(`${functionName} was not found in original source.`)
  const originalLine = originalSource.slice(0, originalIndex).split('\n').length
  const originalNameIndex = originalSource.indexOf(functionName, originalIndex)
  const lineStart = originalSource.lastIndexOf('\n', originalNameIndex - 1) + 1
  const originalColumn = originalNameIndex - lineStart
  const position = generatedPositionFor(new TraceMap(rawMap as any), {
    source: originalPath,
    line: originalLine,
    column: originalColumn,
    bias: LEAST_UPPER_BOUND,
  })
  if (position.line == null || position.column == null) {
    throw new Error(`No generated mapping found for ${functionName}.`)
  }
  const offset = offsetAt(generatedSource, position.line, position.column)
  const tree: any = parse(generatedSource, { ecmaVersion: 'latest', sourceType: 'module' })
  const statement = tree.body.find((node: any) => node.start <= offset && node.end >= offset)
  if (statement?.type === 'FunctionDeclaration' && statement.id?.name) return statement.id.name
  if (statement?.type === 'VariableDeclaration') {
    const declarator = statement.declarations.find((node: any) => node.start <= offset && node.end >= offset)
    if (declarator?.id?.type === 'Identifier') return declarator.id.name
  }
  throw new Error(`Unable to resolve generated binding for ${functionName}.`)
}

function locateExportedFunction(
  generatedSource: string,
  rawMap: SourceMapJson,
  sourceSuffix: string,
  functionName: string,
): string {
  const sourceIndex = rawMap.sources.findIndex((source) => source.endsWith(sourceSuffix))
  const originalSource = rawMap.sourcesContent?.[sourceIndex]
  if (sourceIndex < 0 || !originalSource) {
    throw new Error(`${sourceSuffix} was not found in source map.`)
  }
  const localName = locateGeneratedBinding(
    generatedSource,
    rawMap,
    rawMap.sources[sourceIndex],
    originalSource,
    functionName,
  )
  const exportedName = findExportedName(generatedSource, localName)
  if (!exportedName) throw new Error(`${functionName} (${localName}) is not exported by its chunk.`)
  return exportedName
}

function findExportedName(source: string, localName: string): string | null {
  const tree: any = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  for (const statement of tree.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.local?.name === localName) return specifier.exported?.name ?? null
    }
  }
  return null
}

function offsetAt(source: string, line: number, column: number) {
  let offset = 0
  for (let current = 1; current < line; current++) {
    const next = source.indexOf('\n', offset)
    if (next < 0) throw new Error(`Generated line ${line} is out of range.`)
    offset = next + 1
  }
  return offset + column
}
