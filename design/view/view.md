---
pyramid: node
id: view
title: 3D 화면
parent: ../capstone.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생게임 온라인](../capstone.md) 의 「자식 구성요소」 중 `3D 화면` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 3D 화면

## 정의
Three.js 로 게임 세계를 그리는 부분이다. 섬과 바다, 보드 칸, 도시 장식, 플레이어 말을 툰 셰이딩으로 그리고, 클라이언트가 부르는 대로 말 이동·카메라·색종이·섬광·3D 룰렛을 연출한다. 게임 상태는 읽기만 하고 규칙 판정은 하지 않는다. 연출에 쓰는 난수는 판정과 무관하다.

## 관계
- 분해 축: 역할(role-of)
- 관계 문장: "무대"가 렌더 루프와 카메라를 돌리고, 그 위에 "자연 환경"·"보드 표현"·"도시 장식"·"말과 연출"이 장면을 채우며, 모두 "렌더 도구"의 재질과 도구로 그려진다. "3D 룰렛"은 별도 캔버스에서 같은 렌더 도구로 돈다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 렌더 도구 | GLSL 셰이더 재질(툰·외곽선·도로·건물·칸·물·하늘·룰렛·입자·후처리)과 공용 3D 도구 | [toolkit.md](toolkit/toolkit.md) |
| 무대 | 렌더러·장면·프레임 루프·트윈, 궤도 카메라와 조작, 후처리 합성 | [stage.md](stage/stage.md) |
| 자연 환경 | 하늘과 해, 본섬 지형, 바다, 서브맵 섬 | [environment.md](environment/environment.md) |
| 보드 표현 | 칸 아이콘 아틀라스, 칸·길 띠 인스턴싱, 시대 아치·STOP·GOAL·분기 화살표 | [board-view.md](board-view/board-view.md) |
| 도시 장식 | 도로·인도·횡단보도·가로등, 시대별 랜드마크, 건물·나무 채우기, 차량, 마리나, 서브맵 장식 | [city.md](city/city.md) |
| 말과 연출 | 아바타·자동차·가족 핀·지도 핀, 말 배치와 이동 애니메이션, 색종이·섬광, 아바타 미리보기 | [actors.md](actors/actors.md) |
| 3D 룰렛 | 원작 도안의 룰렛 원판, 파워 차지 흔들림, 목표 값으로 감속 정지 | [roulette.md](roulette/roulette.md) |

## 통합 방식
- 제공 인터페이스 (클라이언트가 쓰는 공개 API, 구현 위치 `src/view/view.ts`):
  ```ts
  export interface ScreenPoint { x: number; y: number; }
  export interface RouletteView {
    charge(power: number): void;              // 0~1, 차지 중 흔들림
    release(): void;                           // 차지 끝, 회전 시작 대기
    spinTo(value: number, quick?: boolean): Promise<void>; // 1~10 에 멈추면 resolve
  }
  export interface View {
    syncPieces(state: PublicState, animating: boolean): void; // animating=false 면 위치까지 맞춤
    hopPath(pid: string, path: number[], index: number, onStep?: (tile: number) => void): Promise<void>;
    warp(pid: string, tile: number, index: number, fly: boolean): Promise<void>;
    focus(pid: string, instant?: boolean): void;
    focusTile(tile: number): void;
    overview(): void;
    zoomDefault(): void;
    setActiveTile(tile: number): void;
    confettiAt(pid: string): void;
    flash(amount?: number): void;              // 0~1, 기본 0.6
    project(pid: string, yOffset?: number): ScreenPoint | null; // 말 위치의 화면 좌표 (캔버스 기준 px)
    readonly roulette: RouletteView;
  }
  export interface ViewSounds { tick(): void; ding(): void; }   // 룰렛 칸 통과·정지 소리 (클라이언트가 넘김)
  export function createView(worldCanvas: HTMLCanvasElement, rouletteCanvas: HTMLCanvasElement, sounds?: ViewSounds): View;

  export interface AvatarPreview { setAvatar(avatar: Avatar): void; setActive(active: boolean): void; }
  export function createAvatarPreview(canvas: HTMLCanvasElement, avatar: Avatar): AvatarPreview;
  ```
- 자식에게 요구하는 것:
  - 렌더 도구: 재질 생성 함수들과 `sharedMaterials`(uTime 을 갱신할 재질 집합), `FinalShader`, 공용 도구(`textSprite`, `outlined`, `sdRoundBox`, `easeInOut`)를 공개한다. 장면에 직접 넣지 않는다.
  - 무대: `createStage(canvas): Stage`. `Stage` 는 `scene`, `camera`, `clock`, `tween(ms, fn): Promise<void>`, `onFrame(fn: (time, dt) => void)`, 카메라 제어(`follow(getPos)`, `lookAt(point)`, `setDistance(goal)`, `project(worldPos)`), `flash(amount)`, `setBlur(value)` 를 가진다. 창 크기 변경에 맞춰 렌더러·합성기·카메라를 맞춘다.
  - 자연 환경: `buildEnvironment(stage): Environment`. 하늘·해·지형·바다·서브맵 섬을 장면에 넣고, 도시 장식이 쓰는 `terrainHeight(x, z)`, `boardOut(x, z)`, `nearestTile(x, z)`, `island`, `subIslands` 를 공개한다.
  - 보드 표현: `buildBoardView(stage): BoardView`. 칸 위치 `tilePos[i]`, 칸 방향 `tileHeading[i]`, `setActiveTile(i)` 를 공개한다.
  - 도시 장식: `buildCity(stage, env, board): City`. 매 프레임 `update(time, dt)` 로 차량을 움직인다 (무대의 `onFrame` 에 등록).
  - 말과 연출: `createActors(stage, board): Actors`. `View` 의 말 관련 메서드(`syncPieces`, `hopPath`, `warp`, 초점 대상 위치, `confettiAt`)와 `createAvatarPreview` 를 공개한다.
  - 3D 룰렛: `createRoulette(canvas, sounds?): RouletteView`. 자체 렌더러와 루프를 가진다. 소리는 받은 훅으로만 낸다 (3D 화면은 클라이언트에 의존하지 않는다).
- 조립: 구현 위치 `src/view/view.ts`.
  1. `createStage(worldCanvas)` → `buildEnvironment` → `buildBoardView` → `buildCity` → `createActors` → `createRoulette(rouletteCanvas, sounds)` 순서로 만든다.
  2. `View` 의 각 메서드는 해당 자식에게 그대로 넘긴다. `focus(pid)` 는 무대의 `follow` 에 그 말의 위치 함수를 넘기고, `focusTile` 은 `lookAt(tilePos)`, `overview` 는 섬 중심(`env.island`)을 보고 거리 210, `zoomDefault` 는 거리 30.
  3. `project(pid, y)` 는 말 위치에 y 를 더해 무대의 `project` 로 바꾼다. 말이 없거나 카메라 뒤면 `null`.
  4. 카메라 거리에 따라 무대의 `setBlur(min(2.2, 0.6 + 거리/40))` 를 매 프레임 준다.
  5. `createAvatarPreview` 는 말과 연출의 것을 다시 내보낸다.

## 수용 기준
- 브라우저에서 `createView` 후 첫 프레임이 오류 없이 그려지고, 콘솔에 셰이더 컴파일 오류가 없다.
- `syncPieces` 로 4명의 상태를 넣으면 말 4개가 각자 칸의 서로 다른 자리(슬롯)에 선다.
- `hopPath` 는 경로의 칸마다 `onStep` 을 한 번씩 부르고, 끝나면 말이 마지막 칸에 있다.
- `roulette.spinTo(v)` 가 끝났을 때 포인터가 가리키는 칸의 값이 v 다.
- 창 크기를 바꾸면 화면 비율이 맞게 다시 그려진다.

## 참조
- [data.md](../data/data.md): `BOARD`, `LAYOUT`, `ERAS`(시대색·땅색), `TILE_INFO`, `SUBMAPS`, `createRng`, `Avatar` 타입
- [engine.md](../engine/engine.md): `PublicState`, `Player`(아바타·시대·배우자·자녀)
