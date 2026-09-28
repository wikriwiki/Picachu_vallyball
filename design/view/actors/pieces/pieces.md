---
pyramid: leaf
id: pieces
title: 말
parent: ../actors.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [말과 연출](../actors.md) 의 「자식 구성요소」 중 `말` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 말

## 정의
보드 위 플레이어 말을 관리한다. 말은 인형 + 자동차(어른부터) + 가족 핀(어른부터) + 얼굴이 들어간 지도 핀과 이름표 + 발밑 차례 고리로 이뤄진다. 상태에 맞춰 말을 만들고 칸의 네 자리 중 순번 자리에 세우며, 한 칸씩 뛰어 이동하거나 높이 날아 이동하는 애니메이션을 한다. 차례인 말의 지도 핀은 통통 튀고 고리가 돈다.

## 인터페이스
- 구현 위치: `src/view/actors/pieces/pieces.ts`, 테스트 `src/view/actors/pieces/pieces.test.ts`
- 공개 API:
  ```ts
  export const SLOT_OFFSETS: readonly [number, number][];   // [[-0.65,-0.55],[0.65,-0.55],[-0.65,0.6],[0.65,0.6]]
  export function slotPos(base: { x: number; z: number }, heading: number, index: number): { x: number; z: number };
  export function createPieces(stage: Stage, board: BoardView): {
    sync(state: PublicState, animating: boolean): void;
    hopPath(pid: string, path: number[], index: number, onStep?: (t: number) => void): Promise<void>;
    warp(pid: string, tile: number, index: number, fly: boolean): Promise<void>;
    pos(pid: string): THREE.Vector3 | null;
  };
  ```

## 동작 규칙
1. `slotPos(base, h, i)`: `(ox, oz) = SLOT_OFFSETS[i % 4]`, `x = base.x + ox·cos h + oz·sin h`, `z = base.z − ox·sin h + oz·cos h`. y 는 `TILE_Y + 0.12`.
2. 말 만들기(처음 보는 플레이어): 그룹에 `buildAvatar(아바타)`, `buildCar(상의 색)`(처음엔 숨김), 핀 그룹, 지도 핀 스프라이트(y 3.1), 고리(내경 0.8 외경 1.05, 상의 색, 불투명도 0.85, 바닥 y 0.55)를 넣고 칸 자리·방향에 둔다.
3. 지도 핀 스프라이트: 128×176 캔버스에 상의 색 물방울 핀(진한 테두리), 흰 원 안에 얼굴(피부·앞머리·눈), 크기 (1.3, 1.8), 아래 중심 기준. 이름표 `textSprite(이름, {bg 상의 색, size 40, scale 0.55})` 를 y −0.35 에 붙인다.
4. `sync(state, animating)`: 플레이어 순번 i 마다 말을 확보. animating 이 false 면 위치·방향을 칸 자리로 맞춘다. 시대가 바뀌었으면 `setAvatarAge`, 어른(시대 ≥ 4)이면 자동차 보이기, 인형 위치 (0, 0.45, −0.15), 핀 높이 3.3; 아니면 인형 (0,0,0), 핀 높이 `1.2 + 1.9 × 인형 크기`. 가족 키(자녀 수 + 배우자면 100)가 바뀌면 핀을 다시 만든다: 자리 `[(0.3,0.65,0.35), (−0.3,0.65,−0.45), (0.3,0.65,−0.45), (−0.3,0.65,0.35), (0,0.65,−0.1)]` 에 배우자 핀(상대 후보 색, 없으면 0xff8fab) 먼저, 자녀 핀(색 순환 [0x74c0fc, 0xffd43b, 0x8ce99a, 0xcc5de8], small) 자리가 남는 만큼. 핀은 어른부터 보인다. 고리는 대기 주체일 때만 보인다.
5. `hopPath`: 칸마다 260ms 트윈 — 위치를 칸 자리로 보간, 높이 `sin(πt)·1.1` 만큼 뜀, 방향은 가까운 쪽으로 돌며 앞 절반에 맞춤, 인형 세로 크기 `1 + 0.12·sin(πt)` 배. 끝나면 크기 복원, `onStep(칸)`.
6. `warp(fly)`: 길이 fly ? `min(2600, 900 + 거리·12)` : 900 ms, 높이 fly ? `max(12, 거리·0.25)` : 6. fly 면 카메라 거리 목표를 최소 45 로 올렸다가 끝나면 30. 위치는 `easeInOut` 보간 + `sin(πt)·높이`, fly 면 진행 방향을 보고 아니면 매 프레임 0.25 rad 회전. 끝나면 칸 방향.
7. 매 프레임: 지도 핀 y = 핀 높이 + (고리가 보이면 `|sin 4t|·0.4`), 보이는 고리는 초당 1.5 rad 회전하고 불투명도 `0.6 + 0.3·sin 5t`, 인형 머리는 `sin(2t + 순번)·0.05` 로 갸웃.
8. `pos(pid)`: 말 그룹 위치, 없으면 null.

## 경계 조건
- 없는 pid 로 hopPath·warp 를 부르면 바로 끝난다.
- 순번 4 이상은 자리를 순환한다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | base (0,0), heading 0 | `slotPos(…, 0)` / `(…, 3)` | (−0.65, −0.55) / (0.65, 0.6) |
| 2 | heading π/2 | `slotPos({0,0}, π/2, 0)` | (−0.55, 0.65) (오차 1e−9) |
| 3 | — | `slotPos(b, h, 5)` | `slotPos(b, h, 1)` 과 같음 |

## 참조
- [avatar-model.md](../avatar-model/avatar-model.md), [stage.md](../../stage/stage.md), [board-view.md](../../board-view/board-view.md)
- [toolkit.md](../../toolkit/toolkit.md): `textSprite`, `canvasTexture`, `easeInOut`
- [engine.md](../../../engine/engine.md): `PublicState`
