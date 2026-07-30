# Risu CharX Editor MCP

`module.charx`의 `card.json`과 Risu 전용 `module.risum`을 읽고 JSON Patch로
편집하는 로컬 stdio MCP 서버입니다. ZIP 안의 이미지와 기타 자산은 수정하지
않고 보존합니다.

## 실행

저장소 루트에서:

```bash
pnpm install
pnpm mcp:charx -- --file /absolute/path/to/module.charx
```

`--file`을 생략하면 `RISU_CHARX_FILE`, 그것도 없으면 현재 폴더의
`module.charx`를 사용합니다. 서버는 시작할 때 파일을 열지 않으므로 MCP
클라이언트 연결 후 파일을 생성하거나 교체해도 됩니다.

Risuai 모듈 설정에 넣을 stdio URL 예시:

```text
stdio:{"command":"node","args":["/absolute/path/to/Risuai/tools/charx-mcp/server.mjs","--file","/absolute/path/to/module.charx"]}
```

Codex/Claude Desktop 등 다른 MCP 클라이언트에서도 command를 `node`, args를
위와 동일하게 등록하면 됩니다.

## 도구

- `charx_inspect`: 파일 해시, ZIP 엔트리, 카드/모듈 요약 확인
- `charx_read`: `card` 또는 `module` 전체/일부를 JSON Pointer로 읽기
- `charx_patch`: `add`, `replace`, `remove`, `test` 연산으로 안전하게 수정

수정 전 `charx_inspect` 또는 `charx_read`가 반환한 `sha256`을
`expectedSha256`으로 전달하면 다른 프로세스가 먼저 바꾼 파일을 덮어쓰지
않습니다. `backup`의 기본값은 `true`이며 원본 옆에
`module.charx.bak.<timestamp>`가 생깁니다.

예를 들어 모듈 이름을 바꾸는 호출 인자는 다음과 같습니다.

```json
{
  "section": "module",
  "expectedSha256": "<inspect에서 받은 값>",
  "operations": [
    {
      "op": "replace",
      "path": "/name",
      "value": "새 모듈 이름"
    }
  ]
}
```

## 검증

```bash
pnpm test:charx-mcp
```
