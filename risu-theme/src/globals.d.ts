import type { PublicLoaderApi, RisuModDefinition, RisuRuntimeHook } from './types'

declare global {
  const unsafeWindow: Window & {
    RisuMods?: PublicLoaderApi
    __RISU_LOADER_HOOK__?: RisuRuntimeHook
    __RISU_MOD_QUEUE__?: RisuModDefinition[]
  }
}

export {}