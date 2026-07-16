# RisuAI Plugin API v3.0 `SafeElement.addEventListener` 버그 리포트

## 1. 개요
RisuAI Plugin API v3.0에서 `SafeElement.addEventListener`를 사용하여 엘리먼트에 이벤트를 등록할 때, 대상 엘리먼트가 아닌 전역 `document`에 이벤트 리스너가 등록되는 버그가 있습니다.

## 2. 상세 원인
RisuAI 코어 소스코드 중 플러그인 DOM API를 래핑하는 다음 파일의 구현 오류입니다.
- **파일명**: `src/ts/plugins/apiV3/v3.svelte.ts`
- **구현 내용**:
  ```typescript
  // v3.svelte.ts (RisuAI 소스코드 내)
  if(allowedDocumentEventListeners.includes(type)){
      const modifiedListener = (event: any) => {
          listener(trimEvent(event))
      }
      this.#eventIdMap.set(id, modifiedListener)
      document.addEventListener(type, modifiedListener, realOptions) // <-- 엘리먼트(this.#element)가 아닌 document에 등록됨
      return id;
  }
  ```
  `removeEventListener` 역시 `document.removeEventListener`를 호출하도록 구현되어 있습니다.

## 3. 발생하는 증상
- 플러그인 내에서 특정 버튼이나 엘리먼트에 클릭(`click`) 등 허용된 이벤트 리스너를 추가하면, **리스 화면 상의 어디든(아무 버튼이나 빈 공간) 클릭해도 해당 이벤트 핸들러가 모두 실행**됩니다.
- 이로 인해 특정 메시지 버튼 기능이 전역 클릭에 반응하여 로그 UI를 띄우거나, 의도치 않게 메시지 선택 하이라이트가 적용되는 등의 오작동이 일어납니다.

## 4. 우회 방법 (Workaround)
이벤트 핸들러 내에서 이벤트 객체의 클릭 좌표(`clientX`, `clientY`)가 실제 해당 엘리먼트의 영역(`getBoundingClientRect`) 내부에 포함되는지 검사하여 필터링합니다.

```typescript
// 클릭 위치가 실제 엘리먼트 바운더리 내부인지 검사하는 헬퍼 함수
async function isClickInside(element: SafeElement, e: any): Promise<boolean> {
  if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number') {
    return false;
  }
  try {
    const rect = await element.getBoundingClientRect();
    return (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
  } catch (err) {
    console.error('isClickInside check failed:', err);
    return false;
  }
}

// 사용 예시
await button.addEventListener('click', async (e: any) => {
  if (!(await isClickInside(button, e))) return; // 버튼 밖에서 발생한 클릭(전역 버블링 등)은 무시
  
  // 실제 실행 로직
});
```
