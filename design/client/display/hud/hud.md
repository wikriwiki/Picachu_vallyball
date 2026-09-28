---
pyramid: leaf
id: hud
title: HUD
parent: ../display.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [표시](../display.md) 의 「자식 구성요소」 중 `HUD` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# HUD

## 정의
게임 화면에 늘 떠 있는 요약이다 (원작 화면 배치). 왼쪽 위에는 지금 초점인 플레이어(대기 주체, 없으면 나)의 얼굴·이름·직업 배지·능력치 등급과 운세·상대(또는 배우자)·돈을, 오른쪽 위에는 시대 이름·"턴 x/y"·"월급날까지 N칸"을, 그 아래에는 나머지 플레이어 카드 목록을 보여 준다.

## 인터페이스
- 구현 위치: `src/client/display/hud/hud.ts`, 테스트 `src/client/display/hud/hud.test.ts` (jsdom)
- 공개 API:
  ```ts
  export function jobLabel(p: Player, era: number): string;
  export function partnerLabel(s: PublicState, p: Player): string;
  export function payLine(s: PublicState, p: Player): string;
  export function turnLine(s: PublicState): string;
  export function drawFace(canvas: HTMLCanvasElement, avatar: Avatar): void;
  export function createHud(ctx: ClientCtx): { render(s: PublicState): void; renderPlayers(s: PublicState): void };
  ```

## 동작 규칙
1. `jobLabel(p, era)`: 직업이 있으면 "{icon} {현재 랭크 이름}". 없으면 시대별 `['👶 아기','🎒 초등학생','🏫 중학생','🎓 고등학생','🧑 구직 중','🧑 구직 중','👴 은퇴'][era]`.
2. `partnerLabel(s, p)`: 배우자가 있으면 "💍 {배우자}" + (자녀가 있으면 " 👶×{n}"). 상대가 있고 후보를 찾으면 "💗 {이름} {★×stars} {호감도}%". 그 외 ''.
3. `turnLine(s)`: 시대에 턴 수가 있으면 "턴 {min(round+1, turns)}/{turns}", 없으면 '골을 향해!'.
4. `payLine(s, p)`: p 의 칸이 서브맵이면 "✈️ {서브맵 이름} 여행 중". 아니면 `n = stepsToPayday(tile)` 이 null 이 아니면 "{라벨}까지 {n}칸" (라벨: 시대 < 4 '용돈날', 시대 6 '연금날', 그 외 '월급날'). 아니면 ''.
5. `render(s)`: 초점 플레이어 f = `store.focusPlayer(s)`. `#era-name` = 시대 이름, `#era-turn` = turnLine, `#pay-line` = payLine(f), `drawFace(#hud-portrait, f.avatar)`, `#hud-name` = 이름 + (나면 ' (나)'), `#hud-job` = jobLabel, `#hud-stats` = 지력·체력·센스 등급과 운세를 각각 `<span>{라벨}<b>{값}</b></span>`, `#hud-partner` = partnerLabel, `#hud-money` = formatMoney(돈) + (어음이 있으면 " 📄×{n}"). 그 뒤 `renderPlayers(s)`.
6. `renderPlayers(s)`: `#players` 에 플레이어마다 `div.pcard` (대기 주체면 `active`, 초점 플레이어면 `is-main` — 스타일로 숨김). 윗줄: 색 점, 이름, 나 표시 `span.me '나'`, 방 정보에서 끊긴 사람(CPU 아님)이면 `span.off '오프라인'`, CPU 면 `span.off 'CPU'`, 돈(음수면 `neg`). 둘째 줄 `div.job` = jobLabel. 셋째 줄 `div.extra` (있을 때만) = partnerLabel, 카드 수 🃏n, 보물 💎n, 집 🏠n, 어음 📄×n, GOAL 🏁, 여행 중 ✈️ 를 공백으로 이음. 모든 사용자 문자열은 이스케이프.
7. `drawFace(canvas, av)`: 2D 컨텍스트가 없으면 끝. 하늘색 배경, 상의 색 어깨 타원, 피부 원 얼굴, 머리색 반원 앞머리, 머리 모양 2 는 양옆 긴 머리, 3 은 위 똥머리, 눈(얼굴 1 은 가는 눈), 얼굴 2 는 안경 사각, 분홍 볼. 세부 좌표는 [참고: 기존 `public/js/main.js` 의 `drawFace`].

## 경계 조건
- 상태에 후보 목록이 없거나 상대 ID 가 목록에 없으면 상대 표시는 ''.
- 마지막 시대(턴 제한 없음)는 '골을 향해!'.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 직업 office rank 1 | `jobLabel` | '💼 과장' |
| 2 | 직업 없음 era 5 | `jobLabel` | '🧑 구직 중' |
| 3 | 배우자 '지우', 자녀 2 | `partnerLabel` | '💍 지우 👶×2' |
| 4 | 상대 ★2 하린 호감도 40 | `partnerLabel` | '💗 하린 ★★ 40%' |
| 5 | era 0 round 5 | `turnLine` | '턴 2/2' |
| 6 | era 1, START 칸 | `payLine` | '용돈날까지 7칸' |
| 7 | 서브맵 칸 | `payLine` | '✈️ 🌾 시골 마을 여행 중' |
| 8 | 2인 상태, 대기 p2 | `render` | `#hud-name` 이 p2 이름, p2 카드에 active, is-main |

## 참조
- [engine.md](../../../engine/engine.md): `PublicState`, `Player`
- [data.md](../../../data/data.md): `ERAS`, `jobById`, `gradeOf`, `FORTUNES`, `BOARD`, `stepsToPayday`, `SUBMAPS`, `formatMoney`
- [notice.md](../notice/notice.md): `esc`
