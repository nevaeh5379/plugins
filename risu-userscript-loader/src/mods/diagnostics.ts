import type { RisuModDefinition } from '../types'
import { setSystemStatus } from '../core/ui'

export const diagnosticsMod: RisuModDefinition = {
  id: 'loader.diagnostics',
  name: 'Loader Diagnostics',
  version: '0.1.0',
  permissions: [],
  activate(api) {
    setSystemStatus(api.runtime.source, api.runtime.version)
  },
}
