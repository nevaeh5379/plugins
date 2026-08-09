# Risu Log Arca Proxy

RisuAI 웹판에서 CORS 제약 없이 아카라이브 이미지를 업로드하기 위한 전용 프록시입니다.
임의 URL을 전달받지 않고 `https://arca.live/b/logtest/write`와 `/b/upload`만 호출합니다.

## 실행

Node.js 20 이상과 `curl` 실행 파일이 필요합니다. Node 내장 `fetch`는
Cloudflare에서 403으로 판별되는 경우가 있어 아카라이브 요청에만 `curl`을 사용합니다.
토큰과 이미지 본문은 명령행 인자가 아닌 표준 입력으로 전달하며 디스크에 저장하지
않습니다.

```bash
cd proxy-server
openssl rand -hex 32

ARCA_PROXY_TOKEN='충분히-긴-임의-문자열' \
ARCA_PROXY_ALLOWED_ORIGINS='https://내-risu.example.com' \
npm start
```

기본 주소는 `http://127.0.0.1:8787/v1/arca/upload`입니다. HTTPS로 서비스되는
RisuAI에서 사용할 때는 이 프록시도 HTTPS로 공개해야 합니다. Nginx, Caddy 또는
Cloudflare Tunnel 같은 HTTPS 역방향 프록시를 사용할 수 있습니다.

여러 Origin은 쉼표로 구분합니다.

```bash
ARCA_PROXY_ALLOWED_ORIGINS='https://risu.example.com,http://localhost:5173'
```

`*`도 지원하지만 이미지와 인증 토큰을 보호하려면 실제 RisuAI Origin만 지정하는
것을 권장합니다.

서버를 실행한 뒤 Risu 로그 플러그인의 `설정 → 플러그인 → 아카라이브 사용자 프록시`에
다음을 저장합니다.

- 업로드 엔드포인트: `https://내-프록시.example.com/v1/arca/upload`
- 인증 토큰: 서버의 `ARCA_PROXY_TOKEN`과 같은 값

## Docker

```bash
docker build -t risu-log-arca-proxy .
docker run --rm -p 127.0.0.1:8787:8787 \
  -e ARCA_PROXY_TOKEN='충분히-긴-임의-문자열' \
  -e ARCA_PROXY_ALLOWED_ORIGINS='https://내-risu.example.com' \
  risu-log-arca-proxy
```

## API

```http
POST /v1/arca/upload
Authorization: Bearer <ARCA_PROXY_TOKEN>
Content-Type: application/json

{
  "filename": "001.png",
  "mimeType": "image/png",
  "dataBase64": "..."
}
```

성공 응답:

```json
{ "ok": true, "url": "https://ac.arca.live/..." }
```

서버는 파일별로 새로운 익명 글쓰기 토큰을 발급받지만 게시글을 작성하지 않습니다.
요청 본문과 이미지를 디스크에 저장하지 않으며, 로그에도 토큰이나 이미지 내용을
기록하지 않습니다.
