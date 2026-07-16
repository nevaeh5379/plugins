# Risu Userscript Loader

RisuAI의 런타임을 계측하고 Tampermonkey 모드에 안정적인 공통 API를 제공하는 비공식 모드 로더입니다.

## 현재 범위

- `document-start`에서 RisuAI 모듈 엔트리 탐지(원본 실행은 방해하지 않음)
- Vite 개발 서버의 `/src/main.ts` 자동 계측
- 공개 source map에서 원본 `getCurrentCharacter/setCurrentCharacter`와 축약된 번들 바인딩 자동 연결
- 동일 database URL을 import하는 작은 bridge로 실행 중인 ES 모듈 인스턴스 공유
- source map이 없을 때 프로덕션 번들의 최상위 함수를 AST로 분석하는 fallback
- 후보가 없거나 점수가 동률이면 원본 엔트리를 복구하는 fail-closed 계측
- 캐릭터·DB·컨텍스트·채팅·변수·모듈·에셋·파서·UI 권한을 구분한 모드 API
- 모드 등록, 교체, unload 수명주기
- Shadow DOM 기반 UI 격리
- 별도 userscript 모드의 사전 등록 큐
- 런타임 연결 진단 모드

프로덕션에서는 source map으로 원본 함수의 위치를 생성 코드 위치로 역매핑하고 export alias를 찾습니다. bridge는 RisuAI와 동일한 database URL을 import하므로 브라우저 ES 모듈 캐시를 통해 같은 상태 인스턴스를 사용합니다. 원본 엔트리와 UI는 다시 실행하거나 수정하지 않습니다.

## 빌드

```bash
npm install
npm run typecheck
npm run build
```

Tampermonkey에 `dist/risu-loader.user.js`를 설치합니다.

## 모드 등록

```js
const mod = {
  id: 'my.mod',
  name: 'My Mod',
  version: '0.1.0',
  permissions: ['character.read', 'ui.inject'],
  activate(api) {
    console.log(api.character.getCurrent())
    return () => console.log('unloaded')
  },
}

if (unsafeWindow.RisuMods) unsafeWindow.RisuMods.register(mod)
else (unsafeWindow.__RISU_MOD_QUEUE__ ??= []).push(mod)
```

전체 예시는 `examples/hello-mod.user.js`에 있습니다.

## 진단용 테스트 모드

로더를 설치한 다음 빌드 결과인 `dist/risu-loader-test.user.js`를 별도 Tampermonkey 스크립트로 설치합니다. 오른쪽 아래 진단 패널에서 다음을 확인할 수 있습니다.

- 사용 중인 hook source와 버전
- 현재 캐릭터 읽기
- DB 스냅샷 지원 여부
- 실제 RisuAI CBS 파싱
- 현재 채팅·캐릭터 기본·템플릿 기본 변수 조회
- 현재 컨텍스트의 활성 모듈 조회
- 현재 캐릭터/채팅 인덱스 및 전환 이벤트
- 채팅 메시지 조회와 명시적인 no-op 수정
- Risu Markdown 및 safe Markdown 파싱
- 에셋 읽기와 사용자가 확인한 테스트 에셋 저장
- 로더 전용 툴바/채팅 버튼, Mods 메뉴, 모달, 토스트
- 현재 캐릭터 내용을 바꾸지 않는 명시적 no-op 쓰기
- 캐릭터 및 채팅 전환 감지

먼저 읽기 테스트를 확인하고, 쓰기 테스트는 테스트용 캐릭터에서 실행하는 것을 권장합니다.

## 제공 API

모드의 `activate(api)`에는 다음 네임스페이스가 전달됩니다.

- `character`: 현재 캐릭터 복제본 조회/교체와 변경 구독
- `database`: 전체 DB 스냅샷 조회/교체
- `context`: 현재 캐릭터·채팅·인덱스 조회와 변경 이벤트
- `chat`: 메시지 목록/마지막 메시지 조회, 추가/수정/삭제, 새로고침
- `parser`: CBS, Markdown, safe Markdown, CBS 예약문자 escape/unescape
- `variables`: 채팅/글로벌/유효 변수 조회와 수정
- `modules`: 활성 모듈, namespace, lorebook, assets 조회
- `assets`: Risu 저장소의 바이트 읽기/저장 및 Blob URL 생성/해제
- `ui`: 격리 UI mount, 툴바·채팅 버튼, Mods 메뉴, 모달, 토스트
- `lifecycle`: 모드 unload 정리 함수 등록

```js
permissions: ['context.read', 'chat.read', 'parser.cbs', 'ui.inject'],
async activate(api) {
  console.log(api.context.getCurrentChatIndex())
  console.log(api.chat.getLastMessage())
  console.log(await api.parser.markdown('**hello**'))

  api.context.onChatChange((chat) => console.log('chat changed', chat))
  api.ui.addChatButton({
    id: 'hello',
    label: 'Hello',
    onClick: () => api.ui.toast('Hello from a userscript mod'),
  })
}
```

UI 슬롯은 Risu의 내부 Svelte 컴포넌트나 Plugin v3 API가 아니라 로더가 소유하는 Shadow DOM 레이어입니다. 따라서 Risu UI 구조가 바뀌어도 모드 UI가 직접 깨질 가능성을 줄입니다.

## 권한

읽기와 쓰기는 별도 권한입니다. 필요한 권한만 모드 정의에 선언해야 합니다.

- `character.read`, `character.write`
- `database.read`, `database.write`
- `context.read`
- `chat.read`, `chat.write`
- `parser.cbs`, `parser.cbs.mutate`
- `variables.read`, `variables.write`
- `modules.read`
- `assets.read`, `assets.write`
- `ui.inject`, `runtime.inspect`

## 안전 원칙

- 분석 실패 시 원본 RisuAI 엔트리를 복구합니다.
- 모드는 선언한 권한을 통해서만 런타임 데이터에 접근합니다.
- 데이터는 모드 경계에서 `structuredClone`으로 복사합니다.
- 모드 UI는 기본적으로 Shadow DOM에 격리됩니다.
