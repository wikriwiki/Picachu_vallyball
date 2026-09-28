---
pyramid: leaf
id: toon
title: 툰 재질
parent: ../toolkit.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [렌더 도구](../toolkit.md) 의 「자식 구성요소」 중 `툰 재질` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 툰 재질

## 정의
모든 불투명 물체가 공유하는 툰 셰이딩이다. 방향광 1개와 그림자 맵을 3단 셀로 나누고, 반구광(하늘·땅 반사), 툰 스텝 하이라이트, 림라이트, 거리 안개를 더하는 GLSL 조명 함수와, 그것을 쓰는 기본 재질·외곽선 재질을 만든다.

## 인터페이스
- 구현 위치: `src/view/toolkit/toon/toon.ts`, 테스트 `src/view/toolkit/toon/toon.test.ts`
- 공개 API:
  ```ts
  export const TOON_LIGHT_FN: string;   // GLSL: toonShadow(), toonShade(base, N, V, extraShadow), applyFog(col, depth)
  export function toonUniforms(extra?: Record<string, THREE.IUniform>): Record<string, THREE.IUniform>;
  export const sharedMaterials: Set<THREE.ShaderMaterial>;
  export interface ToonOptions { vertexColors?: boolean; side?: THREE.Side; emissive?: THREE.ColorRepresentation; rim?: number; specular?: number; grass?: number; }
  export function toonMaterial(color?: THREE.ColorRepresentation, opts?: ToonOptions): THREE.ShaderMaterial;
  export function outlineMaterial(color?: THREE.ColorRepresentation, thickness?: number): THREE.ShaderMaterial;
  ```

## 동작 규칙
1. `toonUniforms(extra)`: `UniformsLib.lights` 와 다음을 합친다 — `uColor` 흰색, `uEmissive` 검정, `uSkyColor` 0xbfe3ff, `uGroundColor` 0x7a6a50, `uShadeTint` (0.62, 0.6, 0.82), `uRimPower` 2.5, `uRimStrength` 0.35, `uSpecular` 0.25, `uFogColor` 0xcfe8ff, `uFogNear` 90, `uFogFar` 260, `uTime` 0, `uGrassNoise` 0, 그리고 extra.
2. 조명식: `band = smoothstep(0.02,0.07,lit)·0.62 + smoothstep(0.55,0.6,lit)·0.38` (lit = 그림자 × max(N·L, 0)), 색 = `mix(base·shadeTint, base, band) · mix(0.85, lightColor, 0.35)` + 반구광 0.28 + 스텝 하이라이트(`pow(N·H, 48)` 을 0.45~0.5 smoothstep) × specular + 림(`pow(1 − N·V, rimPower)` 을 0.35~0.6 smoothstep) × rimStrength × (0.35 + 0.65·band). 안개는 깊이 near~far smoothstep. [기준 구현: 기존 `public/js/shaders.js` 의 `TOON_LIGHT_FN`, `TOON_VERT`, `TOON_FRAG`]
3. `toonMaterial(color = 흰색, opts)`: `lights: true`, `vertexColors` 옵션, `side` (기본 FrontSide). `uColor = color`, emissive·rim·specular·grass 옵션을 해당 유니폼에. 인스턴스 색·정점 색을 곱한다. grass > 0 이면 월드 xz 값 노이즈로 0.86~1.12 밝기 변화. 뒷면은 법선을 뒤집는다. 만든 재질을 `sharedMaterials` 에 넣는다.
4. `outlineMaterial(color = 0x2a2238, thickness = 0.035)`: 뒷면(BackSide)만 그리며, 정점을 시점 공간 법선 방향으로 `thickness × (0.6 + clamp(−mv.z, 2, 80)·0.03)` 만큼 밀어낸다. 인스턴싱 지원. 단색. `sharedMaterials` 에는 넣지 않는다.

## 경계 조건
- 그림자 맵이 없는 환경에서도 컴파일된다 (`USE_SHADOWMAP` 조건).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `toonMaterial(0xff0000, {rim: 0.1, specular: 0})` | uColor 빨강, uRimStrength 0.1, uSpecular 0, lights true, sharedMaterials 에 포함 |
| 2 | — | `toonUniforms({uX:{value:1}})` | uX 포함, uFogFar 260 |
| 3 | — | `outlineMaterial()` | side BackSide, uThickness 0.035, sharedMaterials 에 없음 |

## 참조
없음.
