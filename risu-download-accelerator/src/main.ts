import { compress, decompress, zip } from 'fflate'
import { Packr } from 'msgpackr'

const MOD_ID = 'risu.download-accelerator'
const CONCURRENCY = 4
const encoder = new TextEncoder()
const packr = new Packr({ useRecords: false })
const RISU_COMPRESSED_HEADER = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 8])
const SIDECAR_URL_KEY = `${MOD_ID}:sidecar-url`
const SIDECAR_TOKEN_KEY = `${MOD_ID}:sidecar-token`

type Profile = { operation: string; totalMs: number; outputBytes: number; phases: Record<string, number> }
let lastProfile: Profile | null = null

function profiler(operation: string) {
  const started = performance.now()
  let checkpoint = started
  const phases: Record<string, number> = {}
  return {
    add(name: string, ms: number) {
      phases[name] = ms
    },
    phase(name: string) {
      const now = performance.now()
      phases[name] = now - checkpoint
      checkpoint = now
    },
    finish(outputBytes: number) {
      const profile = { operation, totalMs: performance.now() - started, outputBytes, phases }
      lastProfile = profile
      console.group(`[Risu Download Accelerator] ${operation} profile`)
      console.table(Object.entries(phases).map(([phase, ms]) => ({ phase, ms: ms.toFixed(1) })))
      console.info('total ms', profile.totalMs.toFixed(1), 'output MiB', (outputBytes / 1024 / 1024).toFixed(1))
      console.groupEnd()
      return profile
    },
  }
}

function pageWindow() {
  try { return unsafeWindow } catch { return window as Window & typeof globalThis }
}

function sanitize(value: string) {
  return value.replace(/[<>:"/\\|?*.,]/g, '').trim() || 'RisuAI'
}

function download(name: string, parts: BlobPart[]) {
  const url = URL.createObjectURL(new Blob(parts, { type: 'application/octet-stream' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

async function mapLimit<T, R>(values: T[], limit: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = cursor++
      if (index >= values.length) return
      output[index] = await mapper(values[index], index)
    }
  })
  await Promise.all(workers)
  return output
}

function collectAssetPaths(value: unknown): string[] {
  const paths = new Set<string>()
  const seen = new WeakSet<object>()
  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      if (item.startsWith('assets/')) paths.add(item)
      return
    }
    if (!item || typeof item !== 'object' || seen.has(item)) return
    seen.add(item)
    if (Array.isArray(item)) for (const child of item) visit(child)
    else for (const child of Object.values(item as Record<string, unknown>)) visit(child)
  }
  visit(value)
  return [...paths]
}

function collectColdKeys(database: any): string[] {
  const keys = new Set<string>()
  const header = '\uEF01COLDSTORAGE\uEF01'
  for (const character of database.characters ?? []) {
    if (character?.coldstorage) keys.add(character.coldstorage)
    for (const key of character?.coldStoragedChats ?? []) keys.add(key)
    for (const chat of character?.chats ?? []) {
      const marker = chat?.message?.[0]?.data
      if (typeof marker === 'string' && marker.startsWith(header)) keys.add(marker.slice(header.length))
    }
  }
  return [...keys]
}

function decompressAsync(data: Uint8Array) {
  return new Promise<Uint8Array>((resolve, reject) => {
    decompress(data, (error, output) => error ? reject(error) : resolve(output))
  })
}

async function encodeDatabaseBackup(database: any) {
  const dbWithoutAccount = { ...database, account: undefined }
  const packed = packr.encode(dbWithoutAccount)
  const compressed = await new Promise<Uint8Array>((resolve, reject) => {
    compress(packed, (error, data) => error ? reject(error) : resolve(data))
  })
  const output = new Uint8Array(RISU_COMPRESSED_HEADER.length + compressed.length)
  output.set(RISU_COMPRESSED_HEADER)
  output.set(compressed, RISU_COMPRESSED_HEADER.length)
  return output
}

function gmRequest<T>(options: Omit<Parameters<typeof GM.xmlHttpRequest>[0], 'onload' | 'onerror' | 'ontimeout'>) {
  return new Promise<T>((resolve, reject) => {
    GM.xmlHttpRequest({
      ...options,
      onload(response) {
        if (response.status >= 200 && response.status < 300) resolve(response.response as T)
        else reject(new Error(`Sidecar HTTP ${response.status}: ${response.responseText || 'request failed'}`))
      },
      onerror: reject,
      ontimeout: () => reject(new Error('Sidecar request timed out.')),
    })
  })
}

function decodeBulkEntries(buffer: ArrayBuffer) {
  const data = new Uint8Array(buffer)
  const output = new Map<string, Uint8Array>()
  const view = new DataView(buffer)
  let offset = 0
  while (offset < data.byteLength) {
    if (offset + 4 > data.byteLength) throw new Error('잘린 bulk-read 이름 헤더입니다.')
    const nameLength = view.getUint32(offset, true); offset += 4
    if (offset + nameLength + 4 > data.byteLength) throw new Error('잘린 bulk-read 이름입니다.')
    const name = new TextDecoder().decode(data.subarray(offset, offset + nameLength)); offset += nameLength
    const bodyLength = view.getUint32(offset, true); offset += 4
    if (offset + bodyLength > data.byteLength) throw new Error('잘린 bulk-read 데이터입니다.')
    output.set(name, data.slice(offset, offset + bodyLength)); offset += bodyLength
  }
  return output
}

async function readAssetBatch(api: ModApi, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))]
  const endpoint = await GM.getValue(SIDECAR_URL_KEY, '')
  const token = await GM.getValue(SIDECAR_TOKEN_KEY, '')
  if (!endpoint || !token || unique.length === 0) {
    const values = await mapLimit(unique, CONCURRENCY, async (path) => api.assets.read(path))
    return new Map(unique.map((path, index) => [path, values[index] ? new Uint8Array(values[index]!) : new Uint8Array()]))
  }
  const response = await gmRequest<ArrayBuffer>({
    method: 'POST',
    url: `${endpoint.replace(/\/+$/, '')}/bulk-read`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: encoder.encode(JSON.stringify({ paths: unique })),
    responseType: 'arraybuffer',
    timeout: 30 * 60 * 1000,
  })
  const output = decodeBulkEntries(response)
  const missing = unique.filter((path) => !output.has(path))
  if (missing.length > 0) {
    console.warn(`[Risu Download Accelerator] sidecar missed ${missing.length} assets; using regular reads for them.`)
    const values = await mapLimit(missing, CONCURRENCY, async (path) => api.assets.read(path))
    for (let index = 0; index < missing.length; index += 1) {
      output.set(missing[index], values[index] ? new Uint8Array(values[index]!) : new Uint8Array())
    }
  }
  return output
}

async function configureSidecar(api: ModApi) {
  const currentUrl = await GM.getValue(SIDECAR_URL_KEY, 'http://127.0.0.1:6199')
  const url = pageWindow().prompt('Sidecar 주소를 입력하세요. 원격 서버라면 reverse proxy로 노출한 HTTPS 주소를 사용하세요.', currentUrl)
  if (!url) return
  const currentToken = await GM.getValue(SIDECAR_TOKEN_KEY, '')
  const token = pageWindow().prompt('RISU_FAST_EXPORT_TOKEN 값을 입력하세요.', currentToken)
  if (!token) return
  await GM.setValue(SIDECAR_URL_KEY, url.replace(/\/+$/, ''))
  await GM.setValue(SIDECAR_TOKEN_KEY, token)
  api.ui.toast('Sidecar 설정 저장됨', { type: 'success' })
}

async function sidecarBackup(api: ModApi) {
  const endpoint = await GM.getValue(SIDECAR_URL_KEY, '')
  const token = await GM.getValue(SIDECAR_TOKEN_KEY, '')
  if (!endpoint || !token) throw new Error('먼저 다운로드 가속기 메뉴에서 Sidecar를 설정하세요.')
  const database = api.database.snapshot<any>()
  if (database.account?.useSync) throw new Error('계정 동기화 저장소는 Sidecar 백업 대상이 아닙니다.')
  api.ui.toast('DB 스냅샷을 Sidecar에 전달하는 중…', { duration: 3000 })
  const databaseData = await encodeDatabaseBackup(database)
  const base = endpoint.replace(/\/+$/, '')
  const filename = `RisuAI-sidecar-backup-${Date.now()}.bin`
  const prepared = await gmRequest<{ download: string }>({
    method: 'POST',
    url: `${base}/prepare`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Risu-Filename': filename,
    },
    data: databaseData,
    responseType: 'json',
    timeout: 120_000,
  })
  const anchor = document.createElement('a')
  // Sidecars before 0.5.1 returned `/download/...`. Strip the leading slash
  // so reverse-proxy prefixes such as `/risu-fast-export/` are preserved.
  anchor.href = new URL(prepared.download.replace(/^\/+/, ''), `${base}/`).href
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  api.ui.toast('Sidecar 단일 스트림 다운로드 시작', { type: 'success', duration: 5000 })
}

function u32le(value: number) {
  const data = new Uint8Array(4)
  new DataView(data.buffer).setUint32(0, value, true)
  return data
}

function backupEntry(name: string, data: Uint8Array): BlobPart[] {
  const encodedName = encoder.encode(name.split(/[\\/]/).pop() || name)
  return [u32le(encodedName.byteLength), encodedName, u32le(data.byteLength), data as BlobPart]
}

function createCardV3(char: any) {
  const assets = structuredClone(char.ccAssets ?? [])
  for (const asset of char.additionalAssets ?? []) {
    assets.push({ type: 'x-risu-asset', uri: asset[1], name: asset[0], ext: asset[2] || 'png' })
  }
  for (const asset of char.emotionImages ?? []) {
    assets.push({ type: 'emotion', uri: asset[1], name: asset[0], ext: 'png' })
  }
  if ((char.emotionImages ?? []).length > 0) {
    assets.push({ type: 'icon', uri: 'ccdefault:', name: 'main', ext: 'png' })
  }

  const entries = (char.globalLore ?? []).map((lore: any) => ({
    keys: String(lore.key ?? '').split(',').map((key) => key.trim()),
    secondary_keys: lore.selective ? String(lore.secondkey ?? '').split(',').map((key) => key.trim()) : undefined,
    content: lore.content,
    extensions: { ...(lore.extentions ?? {}), risu_activationPercent: lore.activationPercent, risu_loreCache: lore.loreCache },
    enabled: true,
    insertion_order: lore.insertorder,
    constant: lore.alwaysActive,
    selective: lore.selective,
    name: lore.comment,
    comment: lore.comment,
    case_sensitive: lore.extentions?.risu_case_sensitive ?? false,
    use_regex: lore.useRegex ?? false,
    mode: lore.mode ?? 'normal',
    folder: lore.folder,
  }))

  const extensions: Record<string, unknown> = {
    risuai: {
      bias: char.bias, viewScreen: char.viewScreen, customScripts: char.customscript,
      utilityBot: char.utilityBot, sdData: char.sdData, backgroundHTML: char.backgroundHTML,
      license: char.license, triggerscript: char.triggerscript, additionalText: char.additionalText,
      virtualscript: '', largePortrait: char.largePortrait, lorePlus: char.lorePlus,
      inlayViewScreen: char.inlayViewScreen, newGenData: char.newGenData, vits: {},
      lowLevelAccess: char.lowLevelAccess ?? false, defaultVariables: char.defaultVariables ?? '',
      prebuiltAssetCommand: char.prebuiltAssetCommand ?? '',
      prebuiltAssetExclude: char.prebuiltAssetExclude ?? [],
      prebuiltAssetStyle: char.prebuiltAssetStyle ?? '', toggles: char.customModuleToggle ?? '',
    },
    depth_prompt: char.depth_prompt,
  }
  for (const [key, value] of Object.entries(char.extentions ?? {})) {
    if (key !== 'risuai' && key !== 'depth_prompt') extensions[key] = value
  }

  return {
    spec: 'chara_card_v3', spec_version: '3.0',
    data: {
      name: char.name, description: char.desc ?? '', personality: char.personality ?? '',
      scenario: char.scenario ?? '', first_mes: char.firstMessage ?? '',
      mes_example: char.exampleMessage ?? '', creator_notes: char.creatorNotes ?? '',
      system_prompt: char.systemPrompt ?? '', post_history_instructions: char.replaceGlobalNote ?? '',
      alternate_greetings: char.alternateGreetings ?? [],
      character_book: {
        scan_depth: char.loreSettings?.scanDepth, token_budget: char.loreSettings?.tokenBudget,
        recursive_scanning: char.loreSettings?.recursiveScanning,
        extensions: { ...(char.loreExt ?? {}), risu_fullWordMatching: char.loreSettings?.fullWordMatching ?? false },
        entries,
      },
      tags: char.tags ?? [], creator: char.additionalData?.creator ?? '',
      character_version: `${char.additionalData?.character_version ?? ''}`,
      extensions, group_only_greetings: char.group_only_greetings ?? [], nickname: char.nickname ?? '',
      source: char.source ?? [], creation_date: char.creation_date ?? 0,
      modification_date: Math.floor(Date.now() / 1000), assets,
    },
  }
}

function moduleToCharacter(module: any) {
  return {
    name: module.name, creatorNotes: module.description ?? '', desc: '', personality: '', scenario: '',
    firstMessage: '', exampleMessage: '', systemPrompt: '', replaceGlobalNote: '', alternateGreetings: [],
    globalLore: structuredClone(module.lorebook ?? []), loreSettings: {}, loreExt: {}, tags: [],
    additionalData: {}, extentions: {}, ccAssets: [], emotionImages: [],
    additionalAssets: structuredClone(module.assets ?? []), customscript: structuredClone(module.regex ?? []),
    triggerscript: structuredClone(module.trigger ?? []), lowLevelAccess: module.lowLevelAccess ?? false,
    backgroundHTML: module.backgroundEmbedding ?? '', customModuleToggle: module.customModuleToggle ?? '',
    image: module.icon ?? '',
  }
}

function knownUri(uri: string) {
  return /^(?:https?:|data:|embeded:|ccdefault:|ccasset:|file:|blob:)/i.test(uri)
}

async function makeCharX(api: ModApi, char: any, onProgress: (message: string) => void) {
  const timings: Record<string, number> = {}
  let checkpoint = performance.now()
  const card: any = createCardV3(char)
  const embeddable = card.data.assets
    .map((asset: any, index: number) => ({ asset, index }))
    .filter(({ asset }: any) => asset.uri === 'ccdefault:' || !knownUri(String(asset.uri ?? '')))
  const sources = embeddable.map(({ asset }: any) => asset.uri === 'ccdefault:' ? String(char.image ?? '') : String(asset.uri ?? ''))
  timings['카드/에셋 목록 구성'] = performance.now() - checkpoint
  checkpoint = performance.now()
  onProgress(`에셋 ${sources.length}개 일괄 로드`)
  const loaded = await readAssetBatch(api, sources)
  timings['Sidecar 일괄 에셋 읽기'] = performance.now() - checkpoint
  checkpoint = performance.now()

  const files: Record<string, Uint8Array> = {}
  const taken = new Set<string>()
  for (let index = 0; index < embeddable.length; index += 1) {
    const { asset } = embeddable[index]
    const category = ['emotion', 'background', 'user_icon', 'icon'].includes(asset.type) ? asset.type : 'other'
    const rawName = sanitize(String(asset.name || `asset_${index + 1}`)).slice(0, 100)
    const ext = asset.ext === 'unknown' ? 'png' : sanitize(String(asset.ext || 'png'))
    let name = rawName
    let suffix = 0
    while (taken.has(`assets/${category}/${name}.${ext}`)) name = `${rawName}_${++suffix}`
    const path = `assets/${category}/${name}.${ext}`
    taken.add(path)
    files[path] = loaded.get(sources[index]) ?? new Uint8Array()
    asset.uri = `embeded://${path}`
  }
  files['card.json'] = encoder.encode(JSON.stringify(card, null, 2))
  timings['카드/파일 구성'] = performance.now() - checkpoint
  checkpoint = performance.now()

  onProgress('CharX 생성 중')
  const output = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 0 }, (error, data) => error ? reject(error) : resolve(data))
  })
  timings['ZIP 생성'] = performance.now() - checkpoint
  return { output, timings }
}

async function fastBackup(api: ModApi) {
  const profile = profiler('빠른 로컬 백업')
  const database = api.database.snapshot<any>()
  if (database.account?.useSync) {
    throw new Error('계정 동기화 저장소의 암호화 백업은 아직 빠른 백업에서 지원하지 않습니다.')
  }
  const coldKeys = collectColdKeys(database)
  const coldItems = await mapLimit(coldKeys, CONCURRENCY, async (key) => {
    const stored = await api.assets.read(`coldstorage/${key}`)
    return { key, data: stored ? await decompressAsync(new Uint8Array(stored)) : null }
  })
  profile.phase('DB 스냅샷/콜드 데이터 읽기')
  const pathSet = new Set(collectAssetPaths(database))
  for (const item of coldItems) {
    if (!item.data) continue
    try {
      for (const path of collectAssetPaths(JSON.parse(new TextDecoder().decode(item.data)))) pathSet.add(path)
    } catch (error) {
      console.warn(`[Risu Download Accelerator] invalid cold data: ${item.key}`, error)
    }
  }
  const paths = [...pathSet]
  api.ui.toast(`빠른 백업: 에셋 ${paths.length}개, 콜드 데이터 ${coldKeys.length}개를 병렬로 읽습니다.`, { duration: 4000 })
  const assets = await mapLimit(paths, CONCURRENCY, async (path, index) => {
    if (index % 10 === 0) console.info(`[Risu Download Accelerator] backup assets ${index}/${paths.length}`)
    return { path, data: await api.assets.read(path) }
  })
  profile.phase('에셋 병렬 읽기')
  const databaseData = await encodeDatabaseBackup(database)
  profile.phase('DB MessagePack/압축')
  const parts: BlobPart[] = []
  for (const asset of assets) if (asset.data) parts.push(...backupEntry(asset.path, new Uint8Array(asset.data)))
  for (const item of coldItems) if (item.data) parts.push(...backupEntry(`coldstorage_${item.key}.json`, item.data))
  parts.push(...backupEntry('database.risudat', databaseData))
  const outputBytes = parts.reduce((sum, part) => sum + (typeof part === 'string' ? new Blob([part]).size : part instanceof Blob ? part.size : part.byteLength), 0)
  download(`RisuAI-fast-backup-${Date.now()}.bin`, parts)
  profile.phase('Blob 구성/다운로드 전달')
  const result = profile.finish(outputBytes)
  api.ui.toast(`빠른 백업 생성 완료: ${(result.totalMs / 1000).toFixed(1)}초`, { type: 'success', duration: 6000 })
}

async function fastCharacter(api: ModApi) {
  const profile = profiler('빠른 캐릭터 내보내기')
  const character = api.character.getCurrent<any>()
  if (!character || character.type === 'group') throw new Error('내보낼 캐릭터가 선택되지 않았습니다.')
  const { output, timings } = await makeCharX(api, character, (message) => api.ui.toast(message, { duration: 1000 }))
  for (const [name, ms] of Object.entries(timings)) profile.add(name, ms)
  const downloadStarted = performance.now()
  download(`${sanitize(character.name)}_fast_export.charx`, [output as BlobPart])
  profile.add('다운로드 전달 호출', performance.now() - downloadStarted)
  const result = profile.finish(output.byteLength)
  api.ui.toast(`빠른 캐릭터 내보내기 완료: ${(result.totalMs / 1000).toFixed(1)}초`, { type: 'success', duration: 6000 })
}

async function fastModule(api: ModApi) {
  const profile = profiler('빠른 모듈 내보내기')
  const database = api.database.snapshot<any>()
  const modules = database.modules ?? []
  if (modules.length === 0) throw new Error('내보낼 모듈이 없습니다.')
  const listing = modules.map((module: any, index: number) => `${index + 1}. ${module.name}`).join('\n')
  const selected = Number(pageWindow().prompt(`내보낼 모듈 번호를 입력하세요.\n\n${listing}`, '1')) - 1
  if (!Number.isInteger(selected) || !modules[selected]) return
  const module = modules[selected]
  const { output, timings } = await makeCharX(api, moduleToCharacter(module), (message) => api.ui.toast(message, { duration: 1000 }))
  for (const [name, ms] of Object.entries(timings)) profile.add(name, ms)
  const downloadStarted = performance.now()
  download(`${sanitize(module.name)}.module.charx`, [output as BlobPart])
  profile.add('다운로드 전달 호출', performance.now() - downloadStarted)
  const result = profile.finish(output.byteLength)
  api.ui.toast(`빠른 모듈 내보내기 완료: ${(result.totalMs / 1000).toFixed(1)}초`, { type: 'success', duration: 6000 })
}

function activate(api: ModApi) {
  const run = (operation: () => Promise<void>) => () => {
    void operation().catch((error) => {
      console.error('[Risu Download Accelerator]', error)
      api.ui.toast(String(error), { type: 'error', duration: 6000 })
    })
  }
  const disposers = [
    api.ui.addMenuItem({ id: 'sidecar-backup', label: '서버 직접 고속 백업', title: '18,800개 GET 없이 Sidecar가 단일 스트림 생성', onClick: run(() => sidecarBackup(api)) }),
    api.ui.addMenuItem({ id: 'sidecar-config', label: '고속 백업 Sidecar 설정', title: 'Sidecar 주소와 토큰 설정', onClick: run(() => configureSidecar(api)) }),
    api.ui.addMenuItem({ id: 'fast-backup', label: '빠른 로컬 백업', title: '에셋을 병렬로 읽어 백업', onClick: run(() => fastBackup(api)) }),
    api.ui.addMenuItem({ id: 'fast-character', label: '빠른 캐릭터 내보내기', title: '현재 캐릭터를 CharX로 병렬 내보내기', onClick: run(() => fastCharacter(api)) }),
    api.ui.addMenuItem({ id: 'fast-module', label: '빠른 모듈 내보내기', title: '모듈을 CharX로 병렬 내보내기', onClick: run(() => fastModule(api)) }),
    api.ui.addMenuItem({
      id: 'profile', label: '다운로드 병목 측정 결과', title: '마지막 빠른 내보내기의 단계별 시간',
      onClick: () => {
        if (!lastProfile) {
          api.ui.toast('아직 측정 결과가 없습니다.', { type: 'warning' })
          return
        }
        const rows = Object.entries(lastProfile.phases).map(([name, ms]) =>
          `<tr><td style="padding:4px 12px 4px 0">${name}</td><td style="text-align:right">${ms.toFixed(1)} ms</td></tr>`).join('')
        api.ui.openModal(`<div style="font:13px/1.5 system-ui"><table>${rows}</table><hr style="opacity:.2"><b>총 ${(lastProfile.totalMs / 1000).toFixed(2)}초 · ${(lastProfile.outputBytes / 1024 / 1024).toFixed(1)} MiB</b><p style="opacity:.7">이 시간은 브라우저 다운로드로 전달하기 직전까지입니다. 토스트 이후에도 다운로드가 느리면 Firefox의 Blob→파일 저장 단계가 병목입니다.</p></div>`, { title: lastProfile.operation })
      },
    }),
  ]
  console.info(`[Risu Download Accelerator] parallel exporter active (concurrency=${CONCURRENCY})`)
  return () => { for (const dispose of disposers) dispose() }
}

const definition: ModDefinition = {
  id: MOD_ID, name: 'Risu Download Accelerator', version: '0.5.1',
  permissions: ['character.read', 'database.read', 'assets.read', 'ui.inject'], activate,
}

const page = pageWindow()
if (page.RisuMods) page.RisuMods.register(definition).catch((error) => console.error('[Risu Download Accelerator]', error))
else (page.__RISU_MOD_QUEUE__ ??= []).push(definition)
