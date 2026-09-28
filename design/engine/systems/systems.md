---
pyramid: node
id: systems
title: 인생 시스템
parent: ../engine.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [룰 엔진](../engine.md) 의 「자식 구성요소」 중 `인생 시스템` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 인생 시스템

## 정의
여러 칸과 선택에 걸쳐 이어지는 인생 규칙이다. 연애(관심 있는 사람, 데이트와 호감도, 프러포즈와 결혼, 운명의 하트), 직업(직업 선택, 능력치·룰렛 승진, 랭크업 찬스), 카드(이동 룰렛 전 사용)를 맡는다. 진행과 칸 규칙이 이 시스템의 함수를 불러 쓴다.

## 관계
- 분해 축: 종류(kind-of)
- 관계 문장: "연애"는 상대와 호감도로 결혼까지, "직업"은 능력치와 룰렛으로 승진까지, "카드"는 손패로 룰렛과 능력치를 바꾼다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 연애 | 관심 있는 사람 선택, 하트 칸(만남·데이트·기혼 이벤트), 운명의 하트, 결혼 STOP, 프러포즈, 결혼 보상 | [romance.md](romance/romance.md) |
| 직업 | 직업 선택지와 판정, 능력치 승진 검사, 랭크업 필요값, 랭크업 찬스 칸, 랭크업 룰렛 판정, 즉시 승진 | [career.md](career/career.md) |
| 카드 | 이동 룰렛 전 카드 사용 검증과 카드별 효과 | [cards.md](cards/cards.md) |

## 통합 방식
- 제공 인터페이스 (구현 위치 `src/engine/systems/systems.ts`, 세 자식을 다시 내보냄):
  - 연애: `makeCrushChoice(ctx, p): Pending`, `onLoveTile(ctx, p)`, `onDestinyTile(ctx, p)`, `onMarriageStop(ctx, p)`, 판정 `crush`·`propose`·`destiny` 선택, `propose` 룰렛.
  - 직업: `makeJobChoice(ctx, p): Pending`, `promoteByStats(ctx, p)`, `rankupNeed(p): number`, `onChallengeTile(ctx, p)`, `promoteOne(ctx, p): boolean`, 판정 `job` 선택, `rankup` 룰렛.
  - 카드: `useCard(ctx, p, action)`.
- 자식에게 요구하는 것: 코어의 타입·컨텍스트·효과 연산 위에서 동작한다. 형제 사이 의존은 하나뿐이다: 카드의 승진 카드는 직업의 `promoteOne` 을 쓴다. 연애와 직업은 서로 부르지 않는다.
- 조립: `systems.ts` 는 `export * from` 만 담는다.

## 수용 기준
- 결혼한 플레이어는 `spouse` 가 있고, 그 상대 후보의 `takenBy` 가 그 플레이어다.
- 직업이 있는 플레이어의 `rank` 는 항상 0 이상, 그 직업 랭크 수 − 1 이하다.
- 카드를 쓰면 손패에서 정확히 한 장이 빠지고, 한 차례에 두 번 쓸 수 없다.

## 참조
- [core.md](../core/core.md): `Ctx`, 효과 연산, 타입
- [data.md](../../data/data.md): `PARTNERS` 관련 상수, `JOBS`, `CARDS`, `LOVE` 이벤트 표
