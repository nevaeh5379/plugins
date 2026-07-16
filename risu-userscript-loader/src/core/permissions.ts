import type { ModPermission } from '../types'

export class PermissionError extends Error {
  constructor(modId: string, permission: ModPermission) {
    super(`Mod "${modId}" requires permission "${permission}".`)
    this.name = 'PermissionError'
  }
}

export function requirePermission(
  modId: string,
  permissions: ReadonlySet<ModPermission>,
  permission: ModPermission,
): void {
  if (!permissions.has(permission)) throw new PermissionError(modId, permission)
}
