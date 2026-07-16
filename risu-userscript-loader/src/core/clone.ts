/**
 * Clone data across a userscript/page boundary. Svelte snapshots can still
 * contain a nested Proxy or host object that makes one-shot structuredClone
 * fail, so fall back to an enumerable, cycle-safe deproxy operation.
 */
export function cloneForTransport<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return deproxy(value, new WeakMap()) as T
  }
}

function deproxy(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'symbol' || typeof value === 'function' ? undefined : value
  }
  const object = value as object
  if (seen.has(object)) return seen.get(object)

  // Preserve cloneable platform values without inspecting their internals.
  try { return structuredClone(value) } catch { /* Continue with deproxying. */ }

  if (Array.isArray(value)) {
    const output: unknown[] = []
    seen.set(object, output)
    for (const item of value) output.push(deproxy(item, seen))
    return output
  }
  if (value instanceof Date) return new Date(value.getTime())
  if (value instanceof ArrayBuffer) return value.slice(0)
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    return new Uint8Array(bytes)
  }
  if (value instanceof Map) {
    const output = new Map<unknown, unknown>()
    seen.set(object, output)
    try {
      for (const [key, item] of value) output.set(deproxy(key, seen), deproxy(item, seen))
      return output
    } catch { /* A proxied Map is handled as a plain object below. */ }
  }
  if (value instanceof Set) {
    const output = new Set<unknown>()
    seen.set(object, output)
    try {
      for (const item of value) output.add(deproxy(item, seen))
      return output
    } catch { /* A proxied Set is handled as a plain object below. */ }
  }

  const output: Record<string, unknown> = {}
  seen.set(object, output)
  for (const key of Object.keys(value)) {
    try {
      const cloned = deproxy((value as Record<string, unknown>)[key], seen)
      if (cloned !== undefined) output[key] = cloned
    } catch {
      // A single inaccessible runtime field must not invalidate the database
      // fields that are valid persistent data.
    }
  }
  return output
}
