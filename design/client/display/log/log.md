---
pyramid: leaf
id: log
title: 기록
parent: ../display.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [표시](../display.md) 의 「자식 구성요소」 중 `기록` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 기록

## 정의
게임 중 지나간 메시지와 채팅을 모아 보여 주는 창이다. 최대 150줄을 유지하며 새 줄이 오면 맨 아래로 스크롤하고, 아래 입력칸으로 채팅을 보낸다.

## 인터페이스
- 구현 위치: `src/client/display/log/log.ts`, 테스트 `src/client/display/log/log.test.ts` (jsdom)
- 공개 API:
  ```ts
  export const LOG_LINES = 150;
  export function createLog(ctx: ClientCtx): { add(html: string): void; toggle(): void; isOpen(): boolean };
  ```

## 동작 규칙
1. `add(html)`: `#log-list` 에 `div`(innerHTML = html)를 붙이고, 자식이 150개를 넘으면 앞에서부터 지운다. 스크롤을 맨 아래로. html 은 부르는 쪽이 이미 이스케이프한 것이다.
2. `toggle()`: `#log-panel` 의 hidden 을 뒤집는다. `isOpen()` 은 hidden 이 아닌지.
3. `#chat-form` 제출: 기본 동작을 막고, 입력값 trim 이 비어 있지 않으면 `send({type:'chat', text})`, 입력칸을 비운다.

## 경계 조건
- 공백만 입력하면 보내지 않고 입력칸만 비운다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `add` 151번 | 줄 150개, 첫 줄은 두 번째로 넣은 것 |
| 2 | 닫힘 | `toggle` | `isOpen()` true |
| 3 | 입력 '안녕 ' | 제출 | send `{type:'chat', text:'안녕'}`, 입력칸 '' |
| 4 | 입력 '  ' | 제출 | send 없음 |

## 참조
없음.
