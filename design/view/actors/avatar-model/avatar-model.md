---
pyramid: leaf
id: avatar-model
title: 아바타 모델
parent: ../actors.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [말과 연출](../actors.md) 의 「자식 구성요소」 중 `아바타 모델` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 아바타 모델

## 정의
플레이어의 3D 모습이다. 머리가 큰 치비 인형(다리·몸통·팔·머리·눈·볼, 얼굴 3종, 머리 모양 4종, 색은 아바타 설정), 나이에 따른 크기와 노년 흰머리, 어른이 되면 타는 자동차(핀 구멍 판 + 바퀴), 자동차에 꽂는 배우자·자녀 핀을 만든다.

## 인터페이스
- 구현 위치: `src/view/actors/avatar-model/avatar-model.ts`, 테스트 `src/view/actors/avatar-model/avatar-model.test.ts`
- 공개 API:
  ```ts
  export const AGE_SCALE: readonly number[];   // [0.55, 0.7, 0.82, 0.92, 1, 1, 1]
  export function buildAvatar(av: Partial<Avatar>): THREE.Group;   // userData: { head, hairMaterial, baseHair }
  export function setAvatarAge(fig: THREE.Group, era: number): void;
  export function buildCar(color: THREE.ColorRepresentation): THREE.Group;
  export function buildPeg(color: THREE.ColorRepresentation, small?: boolean): THREE.Group;
  ```

## 동작 규칙
1. `buildAvatar`: 재질 — 피부(rim 0.25), 상의, 하의, 머리(specular 0.5), 검정(눈), 분홍 볼. 다리 캡슐 2개(하의), 몸통 캡슐(상의, y 0.75), 팔 캡슐 2개(±0.38, 기울기 ±0.35), 머리 그룹 y 1.45 안에 구(반지름 0.46), 눈 2개(얼굴 1 이면 세로 0.45 가는 눈, 아니면 1.25), 볼 2개, 얼굴 2 면 안경 고리 2개, 머리 덮개 반구(반지름 0.49, 앞으로 기울임). 머리 모양: 1 뾰족 원뿔 5개, 2 뒤로 긴 머리 캡슐, 3 위 똥머리 구, 0 은 덮개만. 형상은 모듈 안에서 캐시해 재사용. 치수: [기준 구현: 기존 `public/js/avatar.js` 의 `buildAvatar`]. 빠진 색은 `AVATAR_DEFAULT`.
2. `setAvatarAge(fig, era)`: 크기 = `AGE_SCALE[era]` (범위 밖이면 1). 시대 ≥ 6 이면 머리 재질 색 0xdddddd, 아니면 원래 머리색.
3. `buildCar(color)`: 둥근 사각 몸체(반폭 0.7, 반길이 1.05, 모서리 0.3, 두께 0.35 베벨 0.08, y 0.22), 흰 판(1.1×0.06×1.5, y 0.66, 외곽선 없음), 바퀴 4개(반지름 0.22, (±0.72, 0.22, ±0.62)). 몸체 재질은 색(specular 0.6, rim 0.4).
4. `buildPeg(color, small)`: 캡슐 몸(0.12, 0.22, y 0.2, 색) + 머리 구(0.14, y 0.5, 피부색), 외곽선 두께 0.02. small 이면 0.72배.

## 경계 조건
- 아바타 필드가 비어 있어도 기본값으로 만든다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | `{}` | `buildAvatar` | Group, userData.head 있음 |
| 2 | 아바타 | `setAvatarAge(fig, 0)` / `(6)` | scale 0.55, 머리색 원래 / scale 1, 머리색 0xdddddd |
| 3 | 아바타 | `setAvatarAge(fig, 3)` → `(4)` | 0.92 → 1, 머리색 원래 |
| 4 | — | `buildPeg(0xff0000, true)` | scale 0.72 |
| 5 | — | `buildCar(0x00ff00)` | 자식 6개 (몸체, 판, 바퀴 4) |

## 참조
- [toolkit.md](../../toolkit/toolkit.md): `toonMaterial`, `outlined`
- [data.md](../../../data/data.md): `Avatar`, `AVATAR_DEFAULT`
