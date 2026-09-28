---
pyramid: node
id: display
title: 표시
parent: ../client.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `표시` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 표시

## 정의
게임 화면에서 정보를 보여 주고 들려주는 부분이다. 원작 배치의 HUD(현재 차례 플레이어, 시대·턴·월급날, 다른 플레이어 목록), 전원 상태창, 기록·채팅 창, 메시지 상자·떠오르는 글자·배너·토스트, 효과음, 결과 발표 창을 맡는다. 무엇을 보여 줄지는 부르는 쪽(재생·입력·클라이언트 통합)이 정하고, 표시는 받은 값으로 그리기만 한다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "HUD"는 늘 떠 있는 요약을, "상태창"은 요청 시 전원의 상세를, "기록"은 지나간 메시지와 채팅을, "알림"은 순간적인 메시지를, "효과음"은 소리를, "결과 발표"는 게임 끝의 순위를 보여 준다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| HUD | 현재 차례 플레이어 패널(얼굴·이름·직업·등급·운세·상대·돈), 시대·턴·월급날 상자, 플레이어 목록 | [hud.md](hud/hud.md) |
| 상태창 | 전원의 능력치 수치·직업·월급·상대·호감도 막대·자녀·집·보물·카드 | [status.md](status/status.md) |
| 기록 | 기록 목록(최대 150줄)과 채팅 입력 | [log.md](log/log.md) |
| 알림 | 메시지 상자, 말 위로 떠오르는 글자, 시대 배너, 토스트 | [notice.md](notice/notice.md) |
| 효과음 | Web Audio 로 합성하는 짧은 효과음과 음소거 | [sound.md](sound/sound.md) |
| 결과 발표 | 항목별 금액을 한 줄씩 공개하고 순위를 보여 주는 창, 재대결·나가기 | [result.md](result/result.md) |

## 통합 방식
- 제공 인터페이스 (재생·입력·클라이언트 통합이 쓰는 API, 구현 위치 `src/client/display/display.ts`):
  ```ts
  export type MsgKind = 'info' | 'event' | 'lucky' | 'bad' | 'love' | 'card' | 'payday';
  export type FloatKind = 'plus' | 'minus' | 'info';
  export interface Display {
    renderHud(s: PublicState): void;              // HUD 패널 + 시대 상자 + 플레이어 목록
    renderPlayers(s?: PublicState): void;         // 플레이어 목록만 (인자 없으면 store.shown)
    message(text: string, kind: MsgKind, pid?: string | null): void;
    floater(pid: string, text: string, kind: FloatKind): void;
    banner(html: string, ms: number): Promise<void>;
    toast(text: string, error?: boolean): void;
    addLog(html: string): void;
    isLogOpen(): boolean;
    toggleLog(): void;
    openStatus(): void;
    showResult(s: PublicState): Promise<void>;
    hideResult(): void;
    readonly sound: Sound;
  }
  export function createDisplay(ctx: ClientCtx): Display;
  ```
- 자식에게 요구하는 것:
  - HUD: `createHud(ctx): { render(s), renderPlayers(s) }`. 초상화 그리기 `drawFace(canvas, avatar)` 도 공개한다.
  - 상태창: `createStatus(ctx): { open() }`. 닫기 버튼을 연결한다. 내용은 `store.state` 로 그린다.
  - 기록: `createLog(ctx): { add(html), toggle(), isOpen() }`. 채팅 폼 제출 시 `{ type: 'chat', text }` 를 보낸다.
  - 알림: `createNotice(ctx): { message, floater, banner, toast }`. 떠오르는 글자 위치는 `ctx.getView()?.project(pid, 3.4)` 로 얻는다.
  - 효과음: `createSound(deps?): Sound`. `Sound` 는 `muted`, `toggle(): boolean`, `unlock()`, `tick`, `hop`, `ding`, `money`, `lose`, `lucky`, `love`, `card`, `era`, `fanfare`, `turn` 을 가진다.
  - 결과 발표: `createResult(ctx, sound): { show(s): Promise<void>, hide() }` (효과음은 먼저 만든 것을 넘긴다). 재대결·나가기 버튼을 연결한다.
- 조립: 구현 위치 `src/client/display/display.ts`. 효과음 → 알림 → 기록 → HUD → 상태창 → 결과 발표 순서로 만들고, `Display` 의 각 메서드를 해당 자식 함수에 그대로 넘긴다. `renderPlayers()` 인자가 없으면 `store.get('shown')` 을 쓰고, 그것도 없으면 아무것도 하지 않는다.
- 문자열 안전: 사용자 이름·채팅처럼 밖에서 온 문자열을 HTML 로 넣을 때는 모든 자식이 같은 이스케이프 함수 `esc`(`& < > " '` 를 엔티티로)를 쓴다. `esc` 는 알림 leaf 가 공개한다.

## 수용 기준
- 게임 중 `renderHud` 를 부르면 왼쪽 위 패널에 현재 차례 플레이어의 이름·직업·등급·운세·돈이, 오른쪽 위에 시대 이름·"턴 x/y"·"월급날까지 N칸"이 보인다.
- 이름이 `<b>x</b>` 인 플레이어도 목록·기록·결과 발표에서 태그가 아니라 글자 그대로 보인다.
- 음소거하면 이후 효과음이 나지 않는다.
- 결과 발표 창은 항목을 한 줄씩 공개한 뒤 순위를 보여 주고, 방장에게만 "로비로 돌아가기"가 보인다.

## 참조
- [engine.md](../../engine/engine.md): `PublicState`, `Player`, `salaryOf`
- [data.md](../../data/data.md): 표시용 데이터(`ERAS`, `jobById`, `gradeOf`, `FORTUNES`, `CARDS`, `STAT_NAMES`, `SUBMAPS`, `PERSONALITY_NAMES`), `BOARD`, `stepsToPayday`, `formatMoney`
