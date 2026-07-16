# Risu Textarea Editor

RisuAI의 기존 캐릭터 메뉴와 VSCode 탐색기형 캐릭터 메뉴를 전환할 수 있고, 기본 UI의 각 textarea에도 VSCode 편집 버튼을 추가하는 Tampermonkey 모드입니다.

버튼을 누르면 해당 입력란의 내용을 Monaco 기반 VSCode 스타일 창에서 편집할 수 있습니다. 저장 버튼이나 `Ctrl+S`를 누르면 원래 RisuAI 입력란에 반영됩니다.

## 기능

- 기본 모드에서는 RisuAI 캐릭터 메뉴를 그대로 유지
- `Character UI` 옵션에서 기본 UI와 VSCode 탐색기 UI 전환
- VSCode UI에서는 캐릭터 메뉴 자리에 가상 파일 탐색기 표시
- 탐색기 파일을 누르면 독립 VSCode 창으로 열고 캐릭터에 직접 저장
- textarea와 하이라이트 입력란에 `</>` 편집 버튼 추가
- Monaco 기반 VSCode 스타일 편집 창
- 여러 파일과 textarea를 독립 창으로 동시에 열기
- 클릭한 창을 앞으로 가져오는 창 포커스 관리
- 창 이동, 크기 조절, 최대화
- CSS, HTML, JSON, Lua, JavaScript 제목 자동 감지
- `Ctrl+S` 저장, `Esc` 닫기
- 작은 화면에서는 편집 창을 화면 크기에 맞춰 자동 최대화

## 요구 사항과 설치

`Risu Userscript Loader` 0.3.0 이상이 먼저 설치되어 있어야 합니다. 레거시 `__pluginApis__`와 Plugin v3 API는 사용하지 않습니다.

```bash
npm install
npm run build
```

Tampermonkey에 다음 순서로 설치합니다.

1. `risu-userscript-loader/dist/risu-loader.user.js`
2. `risu-editor-plugin/dist/risu-editor.user.js`
