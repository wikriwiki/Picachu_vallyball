---
pyramid: leaf
id: stage
title: 무대
parent: ../view.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [3D 화면](../view.md) 의 「자식 구성요소」 중 `무대` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 무대

## 정의
3D 월드 캔버스의 무대다. WebGL 렌더러·장면·원근 카메라를 만들고, 매 프레임 트윈을 진행하고 카메라를 목표로 부드럽게 옮기며, 등록된 프레임 함수를 부른 뒤 후처리 합성기(블룸 → 틸트시프트·비네트·섬광)로 그린다. 마우스 드래그로 궤도 회전, 휠로 거리 조절을 받는다.

## 인터페이스
- 구현 위치: `src/view/stage/stage.ts`, 테스트 `src/view/stage/stage.test.ts` (카메라 계산 순수 함수만)
- 공개 API:
  ```ts
  export interface Orbit { az: number; pol: number; dist: number; distGoal: number; }
  export interface Stage {
    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;
    readonly target: THREE.Vector3;          // 카메라가 보는 점 (부드럽게 따라감)
    readonly orbit: Orbit;
    tween(ms: number, fn: (t: number) => void): Promise<void>; // t: 0→1
    onFrame(fn: (time: number, dt: number) => void): void;
    follow(getPos: (() => THREE.Vector3 | null) | null): void;
    lookAt(p: THREE.Vector3): void;          // follow 해제 후 목표점 지정
    setDistance(goal: number): void;
    project(p: THREE.Vector3): { x: number; y: number } | null;
    flash(amount: number): void;
    setBlur(v: number): void;
  }
  export function createStage(canvas: HTMLCanvasElement): Stage;
  export function orbitPosition(target: THREE.Vector3, o: Orbit, out: THREE.Vector3): THREE.Vector3;
  export function clampOrbit(pol: number, dist: number): { pol: number; dist: number };
  ```

## 동작 규칙
1. 렌더러: `antialias`, `powerPreference 'high-performance'`, 픽셀 비율 `min(devicePixelRatio, 2)`, 그림자 PCFSoft, 톤매핑 없음. 카메라 시야각 42°, near 0.5, far 900. 초기 궤도 `{ az: −0.35, pol: 0.95, dist: 30, distGoal: 30 }`.
2. 합성기: RenderPass → UnrealBloomPass(해상도 256×256, 강도 0.28, 반지름 0.45, 임계 0.93) → `FinalShader` ShaderPass → OutputPass.
3. `orbitPosition(t, o, out)` = `(t.x + sin(az)·sin(pol)·dist, t.y + cos(pol)·dist, t.z − cos(az)·sin(pol)·dist)`. 카메라는 `(t.x, t.y + 1, t.z)` 를 본다.
4. 조작: 캔버스 pointerdown 에서 드래그 시작(포인터 캡처), pointermove 동안 `az = 시작 az − dx·0.006`, `pol = 시작 pol − dy·0.005` 를 `clampOrbit` 으로 0.35~1.35 로 자름. pointerup 에서 끝. wheel 에서 `distGoal *= 1 + sign(deltaY)·0.12` 를 10~140 으로 자르고 기본 스크롤을 막는다.
5. 프레임(`setAnimationLoop`): `dt = min(0.05, clock.getDelta())`. ① 트윈마다 `t = min(1, (경과)/(길이))` 로 fn 호출, 1 이 되면 목록에서 빼고 resolve. ② follow 함수가 점을 주면 목표점 = 그 점(y 0). ③ `k = 1 − 0.02^dt` 로 target 을 목표점 쪽으로, `dist` 를 `distGoal` 쪽으로 보간. ④ 카메라 위치·시선 갱신. ⑤ `sharedMaterials` 의 `uTime` 갱신. ⑥ 등록된 `onFrame(time, dt)` 를 등록 순서대로 호출. ⑦ 섬광 값은 초당 1.5 씩 줄고 `uFlash` 에 넣는다. ⑧ 합성기로 그린다.
6. `resize`: 창 크기 변화 시 캔버스 크기(없으면 창 크기)로 렌더러·합성기·카메라 비율·`uResolution`(픽셀 비율 반영)을 맞춘다. 생성 시 한 번 부른다.
7. `project(p)`: p 를 카메라로 투영해 z > 1 이면 null, 아니면 `((x+1)/2·캔버스 폭, (1−y)/2·캔버스 높이)`.
8. `lookAt(p)` 는 follow 를 해제하고 목표점을 p 로. `setDistance(g)` 는 `distGoal = g`. `setBlur(v)` 는 `FinalShader` 의 `uBlur`.

## 경계 조건
- follow 함수가 null 을 돌려주면 목표점을 바꾸지 않는다.
- 같은 프레임에 여러 트윈이 끝나도 모두 resolve 된다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | target (0,0,0), `{az:0, pol:π/2, dist:10}` | `orbitPosition` | (0, ≈0, −10) |
| 2 | target (1,2,3), `{az:π/2, pol:π/2, dist:10}` | `orbitPosition` | (11, 2, 3) (오차 1e−6) |
| 3 | — | `clampOrbit(2, 5)`, `clampOrbit(0.1, 500)` | {1.35, 10}, {0.35, 140} |

## 참조
- [toolkit.md](../toolkit/toolkit.md): `FinalShader`, `sharedMaterials`
