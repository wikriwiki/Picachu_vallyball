---
pyramid: leaf
id: notice
title: 알림
parent: ../display.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [표시](../display.md) 의 「자식 구성요소」 중 `알림` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 알림

## 정의
순간적으로 알려 주는 표시들이다. 화면 아래 메시지 상자(말한 사람 이름표와 종류별 배경색), 말 위로 떠올랐다 사라지는 글자, 화면을 가로지르는 시대 배너, 위쪽 토스트. 그리고 모든 표시가 쓰는 HTML 이스케이프 함수를 둔다.

## 인터페이스
- 구현 위치: `src/client/display/notice/notice.ts`, 테스트 `src/client/display/notice/notice.test.ts` (jsdom, 가짜 타이머)
- 공개 API:
  ```ts
  export function esc(s: unknown): string;
  export function createNotice(ctx: ClientCtx, deps?: { setTimeout?: typeof setTimeout }): {
    message(text: string, kind: MsgKind, pid?: string | null): void;
    floater(pid: string, text: string, kind: FloatKind): void;
    banner(html: string, ms: number): Promise<void>;
    toast(text: string, error?: boolean): void;
  };
  ```

## 동작 규칙
1. `esc(s)`: `String(s)` 의 `& < > " '` 를 `&amp; &lt; &gt; &quot; &#39;` 로.
2. `message(text, kind, pid)`: 이름 = `pid` 가 있으면 `store.shown`(없으면 `state`)에서 그 플레이어 이름, 없으면 ''. `#msg-name` 글자 = 이름, `#msg-text` 글자 = text, `#msgbox` 클래스 = `msgbox {kind}`.
3. `floater(pid, text, kind)`: `pos = ctx.getView()?.project(pid, 3.4)`, 없으면 끝. `div.floater.{kind}` 글자 text 를 `#floaters` 에 `left/top = pos` px 로 넣고 1900ms 뒤 지운다.
4. `banner(html, ms)`: `#banner-text` innerHTML = html, `#banner` 보이기, 애니메이션을 `slideIn {ms}ms ease-in-out forwards` 로 다시 시작(애니메이션 속성을 비웠다가 리플로 후 설정), ms 뒤 `#banner` 숨기고 resolve.
5. `toast(text, error)`: `div.toast`(오류면 `err` 추가) 글자 text 를 `#toasts` 에 넣고 2600ms 뒤 지운다.

## 경계 조건
- 메시지·토스트 글자는 textContent 로 넣어 HTML 로 해석되지 않는다.
- 배너 html 은 부르는 쪽이 이스케이프한 것이다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `esc('<a href="x">&\'')` | `&lt;a href=&quot;x&quot;&gt;&amp;&#39;` |
| 2 | shown 에 p1 '민수' | `message('안녕','lucky','p1')` | 이름표 '민수', 클래스 `msgbox lucky` |
| 3 | view.project 가 {x:10,y:20} | `floater` 후 1900ms | 추가됐다가 지워짐 |
| 4 | view 없음 | `floater` | 아무것도 추가 안 됨 |
| 5 | — | `banner('x', 900)` | 900ms 뒤 resolve, #banner hidden |
| 6 | — | `toast('오류', true)` | `.toast.err` 추가, 2600ms 뒤 제거 |

## 참조
- [engine.md](../../../engine/engine.md): `MsgKind`
