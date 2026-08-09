const STORAGE_KEY = 'risu-log-plugin:arca-proxy-config';

export interface ArcaProxyConfig {
  url: string;
  token: string;
}

const EMPTY_CONFIG: ArcaProxyConfig = {
  url: '',
  token: '',
};

export async function loadArcaProxyConfig(): Promise<ArcaProxyConfig> {
  try {
    const storage = await Risuai.getLocalPluginStorage();
    const stored = await storage.getItem<Partial<ArcaProxyConfig>>(STORAGE_KEY);
    return {
      url: typeof stored?.url === 'string' ? stored.url : '',
      token: typeof stored?.token === 'string' ? stored.token : '',
    };
  } catch (error) {
    console.error('[Arca Proxy] Failed to load local proxy config:', error);
    return { ...EMPTY_CONFIG };
  }
}

export async function saveArcaProxyConfig(config: ArcaProxyConfig): Promise<void> {
  const storage = await Risuai.getLocalPluginStorage();
  await storage.setItem(STORAGE_KEY, {
    url: config.url.trim(),
    token: config.token.trim(),
  });
}

export function isArcaProxyConfigured(config: ArcaProxyConfig): boolean {
  return Boolean(config.url.trim() && config.token.trim());
}

export function validateArcaProxyUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('사용자 프록시 URL이 올바르지 않습니다.');
  }

  const isLocalHttp = url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('프록시는 HTTPS URL을 사용해야 합니다. 로컬호스트만 HTTP를 허용합니다.');
  }
  if (url.username || url.password) {
    throw new Error('프록시 URL에 인증정보를 포함하지 말고 별도 토큰을 사용해 주세요.');
  }
  return url;
}
