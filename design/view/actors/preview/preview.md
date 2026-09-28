---
pyramid: leaf
id: preview
title: 미리보기
parent: ../actors.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [말과 연출](../actors.md) 의 「자식 구성요소」 중 `미리보기` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 미리보기

## 정의
타이틀 화면 캔버스에서 내 아바타를 보여 주는 작은 3D 미리보기다. 인형이 좌우로 천천히 흔들리며, 아바타를 바꾸면 인형을 다시 만든다. 활성일 때만 그린다.

## 인터페이스
- 구현 위치: `src/view/actors/preview/preview.ts`, 테스트 없음 대신 `src/view/actors/preview/preview.test.ts` 에서 `previewSway` 만 검사
- 공개 API:
  ```ts
  export function previewSway(ms: number): number;   // sin(ms / 900) · 0.6
  export function createAvatarPreview(canvas: HTMLCanvasElement, avatar: Avatar): AvatarPreview;
  ```

## 동작 규칙
1. 렌더러: antialias, 투명 배경, 픽셀 비율 `min(dpr, 2)`, 크기 = 캔버스 크기(없으면 150×190). 카메라 30°, 위치 (0, 1.4, 6), (0, 1.05, 0) 을 봄. 방향광 (2, 3, 4).
2. `setAvatar(av)`: 기존 인형을 빼고 `buildAvatar(av)` 를 넣는다.
3. `setActive(b)`: 활성 여부. 애니메이션 루프에서 활성일 때만 인형 `rotation.y = previewSway(시간)` 후 그린다.

## 경계 조건
- 비활성이면 그리지 않는다 (GPU 절약).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `previewSway(0)` | 0 |
| 2 | — | `previewSway(900·π/2)` | 0.6 |
| 3 | — | `previewSway(900·π)` | 0 (오차 1e−9) |

## 참조
- [avatar-model.md](../avatar-model/avatar-model.md): `buildAvatar`
- [view.md](../../../view/view.md): `AvatarPreview`
