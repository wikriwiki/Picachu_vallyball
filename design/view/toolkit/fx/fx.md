---
pyramid: leaf
id: fx
title: 환경·효과 재질
parent: ../toolkit.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [렌더 도구](../toolkit.md) 의 「자식 구성요소」 중 `환경·효과 재질` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 환경·효과 재질

## 정의
환경과 효과용 재질이다. 물(파도 정점 변위, 얕은 물·깊은 물 색, 코스틱, 프레넬, 해 하이라이트, 해안 거품), 하늘(그라데이션, 해, fbm 구름), 룰렛 원판(극좌표 칸 색, 숫자 텍스처, 모션 블러, 강조 칸), 색종이 입자(GPU 궤적, 회전하는 종이), 후처리 셰이더(틸트시프트 블러, 채도, 비네트, 섬광).

## 인터페이스
- 구현 위치: `src/view/toolkit/fx/fx.ts`, 테스트 `src/view/toolkit/fx/fx.test.ts`
- 공개 API:
  ```ts
  export function waterMaterial(): THREE.ShaderMaterial;
  export function skyMaterial(): THREE.ShaderMaterial;
  export function rouletteMaterial(numbers: THREE.Texture): THREE.ShaderMaterial;
  export function particleMaterial(): THREE.ShaderMaterial;
  export const FinalShader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string };
  export const ROULETTE_COLORS: readonly [number, number, number][];  // 값 1~10 의 RGB (0~1)
  ```

## 동작 규칙
1. `waterMaterial`: 유니폼 `uTime`, `uDeep` 0x1c6fb8, `uShallow` 0x4fd6e0, `uSky` 0xcfeaff, `uIsl` Vector4 4개(섬 중심 x·z, 반폭 x·z), `uIslR` 4개, `uSunDir`, `uFogColor` 0xcfe8ff, `uFogNear` 90, `uFogFar` 260. 세 방향 사인 파도(방향 (1,0.3)·(−0.4,1)·(0.7,−0.8), 주파수 0.12·0.19·0.31, 진폭 0.45·0.25·0.12, 속도 1.1·1.6·2.3), 섬 가까이는 잔잔하게. 해안에서 22 이내는 얕은 물 색.
2. `skyMaterial`: 뒷면, 깊이 쓰기 없음, `uTop` 0x4aa3ff, `uHorizon` 0xd8f0ff, `uSunDir`, `uTime`. 높이에 따른 그라데이션 + 해 원판 + fbm 5겹 구름(시간에 따라 흐름).
3. `rouletteMaterial(numbers)`: 유니폼 `uNumbers`, `uAngle`, `uBlur`, `uHighlight`(−1), `uTime`. 반지름 > 0.97 흰 테두리, < 0.2 흰 허브, 0.55 초과는 칸 색 + 숫자, 그 안쪽은 흰 원판에 칸 가운데 어두운 바큇살. 강조 칸은 흰색으로 깜박임. 원주 방향 12샘플 모션 블러(폭 `uBlur`).
4. `ROULETTE_COLORS` (1→10): 노랑 (0.97,0.78,0), 주황 (0.95,0.57,0), 빨강 (0.91,0.2,0.17), 핑크 (0.91,0.2,0.48), 자주 (0.7,0.12,0.39), 남색 (0.17,0.18,0.49), 파랑 (0.12,0.37,0.75), 하늘 (0.25,0.71,0.92), 초록 (0.12,0.65,0.35), 연두 (0.55,0.78,0.25). GLSL 에 같은 값을 넣는다.
5. `particleMaterial`: 투명, 깊이 쓰기 없음, 유니폼 `uTime`, `uStart`(−100), `uOrigin`, `uScale` 300. 속성 `aVel`, `aColor`, `aSeed`. 위치 = 원점 + 속도·t + 중력(−9)·t²/2 + 흔들림, 수명 2.6초, 크기 `uScale·(0.22+0.1·seed)/깊이`, 납작한 종이가 회전.
6. `FinalShader`: 유니폼 `tDiffuse`, `uResolution` (1,1), `uFocus` 0.55, `uBlur` 1.6, `uVignette` 0.35, `uSaturation` 1.12, `uFlash` 0. 초점선에서 먼 위아래를 5×5 커널로 흐림(0.18~0.55 smoothstep × uBlur), 채도 조정, 감마 0.97, 비네트, 흰색 섬광 섞기.
- GLSL 세부 식: [기준 구현: 기존 `public/js/shaders.js` 의 같은 이름 함수들].

## 경계 조건
- 룰렛 숫자 텍스처는 분기 밖에서 구한 미분값으로 `textureGrad` 샘플링한다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `waterMaterial()` | uIsl 길이 4, uIslR 길이 4 |
| 2 | — | `rouletteMaterial(빈 텍스처)` | uHighlight −1 |
| 3 | — | `ROULETTE_COLORS.length` | 10 |
| 4 | — | `FinalShader.uniforms.uFlash.value` | 0 |
| 5 | — | `particleMaterial()` | transparent true, depthWrite false |

## 참조
- [toon.md](../toon/toon.md)
