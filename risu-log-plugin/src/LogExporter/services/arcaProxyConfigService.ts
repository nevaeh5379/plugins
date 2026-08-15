/**
 * ArcaLive proxy configuration service.
 * Manages persistence, retrieval, and validation of user-configured ArcaLive proxy settings.
 */

const STORAGE_KEY = 'risu-log-plugin:arca-proxy-config';

/**
 * Hostnames permitted to use unencrypted HTTP for local development and debugging.
 */
const ALLOWED_LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

export const PROXY_VALIDATION_ERRORS = {
  INVALID_URL: '사용자 프록시 URL이 올바르지 않습니다.',
  INSECURE_PROTOCOL: '프록시는 HTTPS URL을 사용해야 합니다. 로컬호스트만 HTTP를 허용합니다.',
  CREDENTIALS_NOT_ALLOWED: '프록시 URL에 인증정보를 포함하지 말고 별도 토큰을 사용해 주세요.',
} as const;

export interface ArcaProxyConfig {
  url: string;
  token: string;
}

export const EMPTY_ARCA_PROXY_CONFIG: Readonly<ArcaProxyConfig> = Object.freeze({
  url: '',
  token: '',
});

/**
 * Normalizes proxy configuration strings by trimming whitespace and ensuring fallback defaults.
 */
export function normalizeArcaProxyConfig(config?: Partial<ArcaProxyConfig> | null): ArcaProxyConfig {
  return {
    url: typeof config?.url === 'string' ? config.url.trim() : '',
    token: typeof config?.token === 'string' ? config.token.trim() : '',
  };
}

/**
 * Checks whether a given hostname points to a local machine address.
 */
function isLocalHostname(hostname: string): boolean {
  return ALLOWED_LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * Loads the stored ArcaLive proxy configuration from local plugin storage.
 * Returns default empty configuration if nothing is stored or if an error occurs.
 */
export async function loadArcaProxyConfig(): Promise<ArcaProxyConfig> {
  try {
    const storage = await Risuai.getLocalPluginStorage();
    const stored = await storage.getItem<Partial<ArcaProxyConfig>>(STORAGE_KEY);
    return normalizeArcaProxyConfig(stored);
  } catch (error) {
    console.error('[Arca Proxy] Failed to load local proxy config:', error);
    return { ...EMPTY_ARCA_PROXY_CONFIG };
  }
}

/**
 * Persists the ArcaLive proxy configuration into local plugin storage with trimmed values.
 */
export async function saveArcaProxyConfig(config: ArcaProxyConfig): Promise<void> {
  const storage = await Risuai.getLocalPluginStorage();
  const normalized = normalizeArcaProxyConfig(config);
  await storage.setItem(STORAGE_KEY, normalized);
}

/**
 * Determines whether the proxy configuration is complete and ready for use (both URL and token present).
 */
export function isArcaProxyConfigured(config?: Partial<ArcaProxyConfig> | null): boolean {
  if (!config) {
    return false;
  }
  return Boolean(config.url?.trim() && config.token?.trim());
}

/**
 * Validates a proxy URL string for syntax, protocol security, and absence of inline credentials.
 *
 * Requirements:
 * - Must be a valid parseable URL.
 * - Must use HTTPS protocol (or HTTP strictly for localhost / 127.0.0.1 / [::1]).
 * - Must not contain embedded basic-auth credentials (username or password).
 *
 * @throws {Error} If any validation requirement fails.
 * @returns The parsed and validated URL object.
 */
export function validateArcaProxyUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(PROXY_VALIDATION_ERRORS.INVALID_URL);
  }

  const isLocalHttp = url.protocol === 'http:' && isLocalHostname(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error(PROXY_VALIDATION_ERRORS.INSECURE_PROTOCOL);
  }

  if (url.username || url.password) {
    throw new Error(PROXY_VALIDATION_ERRORS.CREDENTIALS_NOT_ALLOWED);
  }

  return url;
}

