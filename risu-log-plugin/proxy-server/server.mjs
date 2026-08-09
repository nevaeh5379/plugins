import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '8787', 10);
const AUTH_TOKEN = process.env.ARCA_PROXY_TOKEN || '';
const ALLOWED_ORIGINS = new Set(
  (process.env.ARCA_PROXY_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const MAX_JSON_BYTES = Number.parseInt(
  process.env.ARCA_PROXY_MAX_JSON_BYTES || String(72 * 1024 * 1024),
  10,
);

const ARCA_ORIGIN = 'https://arca.live';
const ARCA_WRITE_URL = `${ARCA_ORIGIN}/b/logtest/write`;
const ARCA_UPLOAD_URL = `${ARCA_ORIGIN}/b/upload`;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ARCA_RESPONSE_BYTES = 10 * 1024 * 1024;
const CURL_STATUS_MARKER = '\n__RISU_HTTP_STATUS__';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const ALLOWED_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

if (!AUTH_TOKEN) {
  console.error('ARCA_PROXY_TOKEN is required.');
  process.exit(1);
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('PORT must be a valid TCP port.');
  process.exit(1);
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (!origin) return true;

  if (!ALLOWED_ORIGINS.has('*') && !ALLOWED_ORIGINS.has(origin)) {
    return false;
  }
  response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.has('*') ? '*' : origin);
  response.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('Vary', 'Origin');
  return true;
}

function hasValidAuthorization(request) {
  const expected = Buffer.from(`Bearer ${AUTH_TOKEN}`);
  const actual = Buffer.from(request.headers.authorization || '');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      throw new Error('REQUEST_TOO_LARGE');
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function extractUploadToken(html) {
  const input = html.match(/<input\b[^>]*\bname=["']token["'][^>]*>/i)?.[0];
  return input?.match(/\bvalue=["']([^"']+)["']/i)?.[1] || null;
}

function detectMediaMimeType(data) {
  if (data.length >= 8 &&
      data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
      data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) {
    return 'image/png';
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'image/jpeg';
  }
  if (data.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      data.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return 'image/gif';
  }
  if (data.subarray(0, 4).toString('ascii') === 'RIFF' &&
      data.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  if (data.length >= 4 &&
      data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    return 'video/webm';
  }
  if (data.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = data.subarray(8, 12).toString('ascii');
    if (brand === 'qt  ') return 'video/quicktime';
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'hevx') {
      return 'image/heic';
    }
    return 'video/mp4';
  }
  return null;
}

function decodeUploadPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('INVALID_PAYLOAD');

  const filename = typeof payload.filename === 'string'
    ? payload.filename.replace(/["\r\n/\\]/g, '_').slice(0, 200)
    : '';
  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType.toLowerCase() : '';
  const dataBase64 = typeof payload.dataBase64 === 'string' ? payload.dataBase64 : '';

  if (!filename) throw new Error('MISSING_FILENAME');
  if (!dataBase64) throw new Error('MISSING_DATA');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(dataBase64)) {
    throw new Error('INVALID_BASE64');
  }

  const data = Buffer.from(dataBase64, 'base64');
  if (data.length === 0) throw new Error('EMPTY_FILE');
  if (data.length > MAX_FILE_BYTES) throw new Error('FILE_TOO_LARGE');
  const detectedMimeType = detectMediaMimeType(data);
  const normalizedMimeType = detectedMimeType || mimeType;
  if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error(`UNSUPPORTED_MEDIA_TYPE_${mimeType || 'EMPTY'}`);
  }
  return { filename, mimeType: normalizedMimeType, data };
}

function runCurl(args, input = null) {
  return new Promise((resolve, reject) => {
    const child = spawn('curl', [
      '--silent',
      '--show-error',
      '--proto', '=https',
      '--proto-redir', '=https',
      '--location',
      '--max-redirs', '3',
      '--connect-timeout', '15',
      '--max-time', '120',
      '--write-out', `${CURL_STATUS_MARKER}%{http_code}`,
      ...args,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutSize = 0;

    child.stdout.on('data', (chunk) => {
      stdoutSize += chunk.length;
      if (stdoutSize > MAX_ARCA_RESPONSE_BYTES) {
        child.kill();
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (stderrChunks.reduce((total, part) => total + part.length, 0) < 8192) {
        stderrChunks.push(chunk);
      }
    });
    child.on('error', (error) => {
      reject(new Error(error.code === 'ENOENT' ? 'CURL_NOT_FOUND' : `CURL_START_FAILED_${error.code || 'UNKNOWN'}`));
    });
    child.on('close', (code, signal) => {
      if (stdoutSize > MAX_ARCA_RESPONSE_BYTES) {
        reject(new Error('ARCA_RESPONSE_TOO_LARGE'));
        return;
      }
      if (code !== 0) {
        const detail = Buffer.concat(stderrChunks).toString('utf8').trim().slice(0, 500);
        reject(new Error(`CURL_EXIT_${code ?? signal ?? 'UNKNOWN'}${detail ? `: ${detail}` : ''}`));
        return;
      }

      const output = Buffer.concat(stdoutChunks).toString('utf8');
      const markerIndex = output.lastIndexOf(CURL_STATUS_MARKER);
      if (markerIndex < 0) {
        reject(new Error('CURL_STATUS_NOT_FOUND'));
        return;
      }
      const status = Number.parseInt(output.slice(markerIndex + CURL_STATUS_MARKER.length), 10);
      if (!Number.isInteger(status)) {
        reject(new Error('CURL_STATUS_INVALID'));
        return;
      }
      resolve({
        status,
        body: output.slice(0, markerIndex),
      });
    });

    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

async function createArcaUploadToken() {
  const response = await runCurl([
    '--header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    '--header', 'Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    '--user-agent', USER_AGENT,
    ARCA_WRITE_URL,
  ]);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`ARCA_SESSION_HTTP_${response.status}`);
  }

  const token = extractUploadToken(response.body);
  if (!token) throw new Error('ARCA_TOKEN_NOT_FOUND');
  return token;
}

function createArcaMultipartBody(token, file, boundary) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="upload"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.mimeType}\r\n\r\n`,
      'utf8',
    ),
    file.data,
    Buffer.from(
      `\r\n--${boundary}\r\n` +
      'Content-Disposition: form-data; name="token"\r\n\r\n' +
      `${token}\r\n` +
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="saveExif"\r\n\r\n' +
      'false\r\n' +
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="saveFilename"\r\n\r\n' +
      'false\r\n' +
      `--${boundary}--\r\n`,
      'utf8',
    ),
  ]);
}

async function uploadToArca(file) {
  const token = await createArcaUploadToken();
  const boundary = `----RisuToLog${crypto.randomUUID().replaceAll('-', '')}`;
  const body = createArcaMultipartBody(token, file, boundary);
  const response = await runCurl([
    '--request', 'POST',
    '--header', 'Accept: application/json',
    '--header', 'Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    '--header', `Content-Type: multipart/form-data; boundary=${boundary}`,
    '--header', 'Expect:',
    '--header', `Origin: ${ARCA_ORIGIN}`,
    '--header', `Referer: ${ARCA_WRITE_URL}`,
    '--user-agent', USER_AGENT,
    '--data-binary', '@-',
    ARCA_UPLOAD_URL,
  ], body);

  let result;
  try {
    result = JSON.parse(response.body);
  } catch {
    throw new Error(`ARCA_UPLOAD_INVALID_RESPONSE_${response.status}`);
  }
  if (response.status < 200 || response.status >= 300 || !result.link) {
    throw new Error(result.message || `ARCA_UPLOAD_HTTP_${response.status}`);
  }

  const url = new URL(result.link, ARCA_ORIGIN);
  if (url.protocol !== 'https:') throw new Error('ARCA_UNSAFE_URL');
  return url.href;
}

function publicError(error) {
  const code = error instanceof Error ? error.message : String(error);
  switch (code) {
    case 'REQUEST_TOO_LARGE': return { status: 413, message: '요청 본문이 너무 큽니다.' };
    case 'FILE_TOO_LARGE': return { status: 413, message: '파일이 50MB 제한을 초과합니다.' };
    case 'INVALID_JSON':
    case 'INVALID_PAYLOAD':
    case 'INVALID_BASE64':
    case 'EMPTY_FILE':
      return { status: 400, message: '업로드 요청 형식이 올바르지 않습니다.' };
    case 'MISSING_FILENAME':
      return { status: 400, message: '업로드 파일 이름이 없습니다.' };
    case 'MISSING_DATA':
      return { status: 400, message: '업로드 이미지 데이터가 없습니다.' };
    case 'CURL_NOT_FOUND':
      return { status: 500, message: '서버에 curl 실행 파일이 없습니다.' };
    default:
      if (code.startsWith('UNSUPPORTED_MEDIA_TYPE_')) {
        return {
          status: 415,
          message: `지원하지 않는 미디어 형식입니다: ${code.slice('UNSUPPORTED_MEDIA_TYPE_'.length)}`,
        };
      }
      return { status: 502, message: `아카라이브 업로드 실패: ${code}` };
  }
}

const server = http.createServer(async (request, response) => {
  if (!setCorsHeaders(request, response)) {
    sendJson(response, 403, { ok: false, error: '허용되지 않은 Origin입니다.' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true, service: 'risu-log-arca-proxy' });
    return;
  }

  if (request.method !== 'POST' || url.pathname !== '/v1/arca/upload') {
    sendJson(response, 404, { ok: false, error: 'Not found' });
    return;
  }
  if (!hasValidAuthorization(request)) {
    sendJson(response, 401, { ok: false, error: '인증 토큰이 올바르지 않습니다.' });
    return;
  }
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    sendJson(response, 415, { ok: false, error: 'application/json 요청만 지원합니다.' });
    return;
  }

  try {
    const payload = await readJson(request);
    const file = decodeUploadPayload(payload);
    const uploadedUrl = await uploadToArca(file);
    sendJson(response, 200, { ok: true, url: uploadedUrl });
  } catch (error) {
    console.error('[Arca Proxy]', error);
    const result = publicError(error);
    sendJson(response, result.status, { ok: false, error: result.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Risu Log Arca Proxy listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
