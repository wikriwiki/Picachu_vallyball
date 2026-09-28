---
pyramid: node
id: board-view
title: 보드 표현
parent: ../view.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [3D 화면](../view.md) 의 「자식 구성요소」 중 `보드 표현` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 보드 표현

## 정의
보드를 3D 로 그린다. 칸 종류별 아이콘을 그린 아틀라스 텍스처를 만들고, 모든 칸을 인스턴싱 메시 하나로(칸 색·아이콘·발광 속성 포함) 그리며, 길별 색 띠, 시대 시작 아치와 이름표, STOP 이름표, GOAL 금색 아치, 분기점의 떠다니는 파란 화살표를 놓는다. 칸 위치·방향과 활성 칸 표시를 공개한다.

## 관계
- 분해 축: 구성(part-of)
- 관계 문장: "아이콘 아틀라스"가 칸 무늬를 그리면 "보드 메시"가 그 무늬로 칸과 길, 표지물을 장면에 놓는다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 아이콘 아틀라스 | 칸 종류 26가지의 아이콘을 6×6 격자 캔버스에 그린 텍스처 | [atlas.md](atlas/atlas.md) |
| 보드 메시 | 칸 위치·방향 계산, 길 색 띠, 칸 인스턴싱, 시대 아치·STOP·GOAL, 분기 화살표 | [board-mesh.md](board-mesh/board-mesh.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/view/board-view/board-view.ts`):
  ```ts
  export interface BoardView {
    readonly tilePos: THREE.Vector3[];   // 칸 윗면 중심 (y = TILE_Y 0.32)
    readonly tileHeading: number[];      // 칸이 향하는 방향 (라디안)
    setActiveTile(i: number): void;      // -1 이면 없음
  }
  export function buildBoardView(stage: Stage): BoardView;
  ```
- 자식에게 요구하는 것:
  - 아이콘 아틀라스: `makeIconAtlas(): { texture: THREE.Texture; grid: 6; index(type: TileType): number }`. 칸 순서는 `TILE_TYPES`.
  - 보드 메시: `buildBoardMesh(stage, atlas): BoardView`.
- 조립: `makeIconAtlas()` → `buildBoardMesh(stage, atlas)` 를 돌려준다.

## 수용 기준
- 브라우저에서 칸 428개가 모두 보이고, 별 Lv3 칸은 반짝이며, 운명의 하트 칸은 무지개색이 흐른다.
- `setActiveTile(i)` 하면 그 칸만 위아래로 움직이며 밝아진다.

## 참조
- [stage.md](../stage/stage.md), [toolkit.md](../toolkit/toolkit.md), [data.md](../../data/data.md): `BOARD`, `ERAS`, `TILE_INFO`, `TILE_TYPES`
