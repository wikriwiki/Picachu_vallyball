---
pyramid: leaf
id: confetti
title: 색종이
parent: ../actors.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [말과 연출](../actors.md) 의 「자식 구성요소」 중 `색종이` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 색종이

## 정의
축하 순간의 색종이다. 입자 260개의 속도·색·씨앗을 미리 정해 두고, 터뜨릴 때 원점과 시작 시각만 바꿔 GPU 셰이더가 궤적을 계산하게 한다.

## 인터페이스
- 구현 위치: `src/view/actors/confetti/confetti.ts`, 테스트 `src/view/actors/confetti/confetti.test.ts`
- 공개 API:
  ```ts
  export const CONFETTI_COUNT = 260;
  export const CONFETTI_COLORS: readonly number[];   // [0xff6b6b, 0xffd43b, 0x51cf66, 0x4dabf7, 0xcc5de8, 0xff922b]
  export function confettiAttributes(rand: () => number): { vel: Float32Array; color: Float32Array; seed: Float32Array };
  export function createConfetti(stage: Stage, rand?: () => number): { burst(pos: THREE.Vector3): void };
  ```

## 동작 규칙
1. `confettiAttributes`: 입자 i 마다 각도 `a = rand·2π`, 수평 속력 `sp = 2 + rand·6`, 속도 `(cos a·sp, 7 + rand·8, sin a·sp)`, 색 `CONFETTI_COLORS[i % 6]`(RGB 0~1), 씨앗 `rand()`. 난수는 입자마다 a, sp, 수직, 씨앗 순서.
2. `createConfetti`: 위 속성과 빈 position 을 가진 Points(`particleMaterial`, 컬링 끔)를 장면에 넣고, 매 프레임 `uTime` 을 무대 시계로.
3. `burst(pos)`: `uOrigin = pos + (0, 2, 0)`, `uStart = 현재 시각`.

## 경계 조건
- 여러 번 터뜨리면 마지막 것만 보인다 (한 벌을 재사용).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | rand 항상 0.5 | `confettiAttributes` | vel 길이 780, 첫 입자 속도 (cos π·5, 11, sin π·5) |
| 2 | — | color 배열 | 입자 6 의 색 = 입자 0 의 색 |
| 3 | 가짜 무대(시계 5초) | `burst((1,0,1))` | uOrigin (1,2,1), uStart 5 |

## 참조
- [toolkit.md](../../toolkit/toolkit.md): `particleMaterial`
- [stage.md](../../stage/stage.md)
