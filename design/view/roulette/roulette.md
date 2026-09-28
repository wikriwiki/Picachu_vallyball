---
pyramid: leaf
id: roulette
title: 3D 룰렛
parent: ../view.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [3D 화면](../view.md) 의 「자식 구성요소」 중 `3D 룰렛` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 3D 룰렛

## 정의
화면 오른쪽 아래의 3D 룰렛이다. 원작 도안(흰 테두리와 핀 10개, 1 노랑 → 10 연두의 칸, 흰 숫자, 안쪽 흰 원판과 바큇살, 흰 팔각 허브, 아래쪽 포인터)의 원판을 자체 캔버스에 그린다. 평소에는 천천히 돌고, 차지 중에는 힘에 비례해 빨리 돌며, `spinTo(v)` 가 오면 여러 바퀴 감속해 값 v 칸에 멈춘다. 칸 경계를 지날 때 포인터가 튀고 틱 소리를 낸다.

## 인터페이스
- 구현 위치: `src/view/roulette/roulette.ts`, 테스트 `src/view/roulette/roulette.test.ts` (순수 함수만)
- 공개 API:
  ```ts
  export const POINTER: number;   // −π/2 (아래쪽)
  export function stopAngle(value: number, start: number, turns: number, jitter: number): number;
  export function segmentUnderPointer(angle: number): number;   // 0~9 (값 − 1)
  export function createRoulette(canvas: HTMLCanvasElement, sounds?: { tick(): void; ding(): void }): RouletteView;
  ```

## 동작 규칙
1. 값 k(1~10)의 칸은 원판 각도 `[(k−1)/10, k/10)·2π` 구간이다. 원판 회전각이 `angle` 이면 포인터 아래 칸 번호는 `segmentUnderPointer(angle) = floor(((POINTER − angle) / 2π) · 10)` 을 0~9 로 감싼 값.
2. `stopAngle(v, start, turns, jitter)`: `target = POINTER − (v − 0.5)·2π/10 + jitter`, `target` 이 `start − turns·2π` 보다 작아질 때까지 2π 씩 뺀 값.
3. 상태 `mode`: `idle`(초당 −0.25 rad), `charge`(`vel = 2 + power·22` 로 역회전), `free`(release 후 같은 속도), `decel`, `stopped`. 초기 각도 `POINTER − 0.05·2π`, 초기 모드 idle.
4. `charge(power)`: mode charge, vel 설정, 강조 해제. `release()`: charge·idle 이면 free.
5. `spinTo(v, quick)`: `turns = quick ? 1 : 3 + Math.random()`, `jitter = (Math.random() − 0.5)·0.6·2π/10`, 끝 각도 = `stopAngle`, 길이 `quick ? 0.9 : 2.4` 초, 이징 `1 − (1−u)³`. 끝나면 mode stopped, 강조 칸 = v−1, `sounds.ding()`, Promise resolve.
6. 프레임마다: 각도 갱신, 각속도 w 에 대해 `uBlur = min(0.9, w·0.018)`, `uAngle`, `uTime`, 원판 회전. 포인터 아래 칸 번호가 바뀌었고 mode 가 idle·stopped 가 아니면 `sounds.tick()`, 포인터 기울기 0.35. 포인터 기울기는 `dt·14` 비율로 0 으로 돌아온다.
7. 장면: 원근 카메라 30° `(0, −1.9, 6.6)` 에서 원점을 봄, 방향광 (1,2,4), 주변광 0.4, 원판 = 반지름 1.5 원(96분할) + `rouletteMaterial(숫자 텍스처)`. 숫자 텍스처는 1024² 캔버스에 k+1 을 각도 `(k+0.5)/10·2π`, 반지름 0.76 위치에 숫자 윗부분이 중심을 향하게(흰색 bold 170px) 그린다. 테두리·허브·뚜껑·핀 10개·포인터(막대 + 공) 치수는 [참고: 기존 `public/js/roulette.js` 생성자].
8. 렌더러는 alpha 투명 배경, 픽셀 비율 `min(dpr, 2)`, 캔버스 크기(없으면 200×200)에 맞춰 resize.

## 경계 조건
- `sounds` 가 없으면 소리를 내지 않는다.
- `spinTo` 가 끝나기 전에 또 불리면 새 목표로 다시 감속한다 (이전 Promise 는 끝나지 않을 수 있으므로 부르는 쪽이 기다린 뒤 부른다).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | v = 1..10, start 0, turns 3, jitter 0 | `segmentUnderPointer(stopAngle(v, 0, 3, 0))` | v − 1 |
| 2 | jitter ±0.3·2π/10 | 같은 검사 | v − 1 |
| 3 | start 0, turns 3 | `stopAngle` | ≤ −3·2π |

## 참조
- [toolkit.md](../toolkit/toolkit.md): `rouletteMaterial`, `toonMaterial`, `outlined`
