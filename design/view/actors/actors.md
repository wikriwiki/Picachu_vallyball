---
pyramid: node
id: actors
title: 말과 연출
parent: ../view.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [3D 화면](../view.md) 의 「자식 구성요소」 중 `말과 연출` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 말과 연출

## 정의
보드 위의 플레이어 말과 순간 연출이다. 아바타 인형·자동차·가족 핀을 만들고, 플레이어마다 말(인형 + 자동차 + 가족 핀 + 얼굴 지도 핀 + 차례 고리)을 두어 칸의 네 자리 중 하나에 세우며, 한 칸씩 뛰어 이동하거나 날아서 이동하는 애니메이션, 색종이, 타이틀 화면의 아바타 미리보기를 맡는다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "아바타 모델"이 인형·자동차·핀의 모양을 만들면 "말"이 그것을 플레이어 상태대로 보드에 세우고 움직이며, "색종이"는 축하 순간을, "미리보기"는 타이틀에서 내 아바타를 보여 준다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 아바타 모델 | 치비 인형(피부·머리 모양·얼굴·옷), 나이별 크기·흰머리, 자동차, 가족 핀 | [avatar-model.md](avatar-model/avatar-model.md) |
| 말 | 말 구성·자리 계산·상태 동기화, 한 칸씩 이동·날아가기, 지도 핀·차례 고리 애니메이션 | [pieces.md](pieces/pieces.md) |
| 색종이 | GPU 입자 260개로 터지는 색종이 | [confetti.md](confetti/confetti.md) |
| 미리보기 | 타이틀 화면 캔버스에서 좌우로 흔들리는 아바타 | [preview.md](preview/preview.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/view/actors/actors.ts`):
  ```ts
  export interface Actors {
    syncPieces(state: PublicState, animating: boolean): void;
    hopPath(pid: string, path: number[], index: number, onStep?: (tile: number) => void): Promise<void>;
    warp(pid: string, tile: number, index: number, fly: boolean): Promise<void>;
    piecePos(pid: string): THREE.Vector3 | null;
    confettiAt(pid: string): void;
  }
  export function createActors(stage: Stage, board: BoardView): Actors;
  export { createAvatarPreview } from './preview/preview';
  ```
- 자식에게 요구하는 것:
  - 아바타 모델: `buildAvatar(avatar)`, `setAvatarAge(fig, era)`, `buildCar(color)`, `buildPeg(color, small?)`.
  - 말: `createPieces(stage, board): { sync, hopPath, warp, pos(pid) }`.
  - 색종이: `createConfetti(stage): { burst(pos: THREE.Vector3): void }`.
  - 미리보기: `createAvatarPreview(canvas, avatar): AvatarPreview`.
- 조립: 말과 색종이를 만들고, `confettiAt(pid)` 는 그 말 위치가 있으면 `burst(pos)`.

## 수용 기준
- 4명 상태로 `syncPieces(s, false)` 하면 말 4개가 각 칸의 서로 다른 자리에 선다.
- 어른 시대가 되면 말이 자동차를 타고, 결혼·출산하면 자동차에 핀이 늘어난다.

## 참조
- [stage.md](../stage/stage.md), [board-view.md](../board-view/board-view.md), [toolkit.md](../toolkit/toolkit.md)
- [engine.md](../../engine/engine.md): `PublicState`
- [data.md](../../data/data.md): `Avatar`
