---
pyramid: node
id: core
title: 엔진 코어
parent: ../engine.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [룰 엔진](../engine.md) 의 「자식 구성요소」 중 `엔진 코어` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 엔진 코어

## 정의
룰 엔진의 바닥이다. 게임 상태·조작·이벤트의 타입을 정의하고, 판정 중에 쓰는 컨텍스트(상태에 저장된 시드 난수, 이벤트 목록, 메시지·기록)와 플레이어에게 돈·능력치·운세·호감도·카드·보물을 주고받는 기본 연산, 그리고 새 게임의 초기 상태를 만든다. 엔진의 다른 자식은 모두 이 위에서 동작하며, 코어는 다른 엔진 자식에 의존하지 않는다.

## 관계
- 분해 축: 구성(part-of)
- 관계 문장: "타입"이 상태의 모양을 정하면, "초기 상태"가 그 모양의 새 게임을 만들고, "컨텍스트"가 한 번의 판정 동안 상태·난수·이벤트를 묶어 주며, "효과 연산"이 컨텍스트 위에서 플레이어 값을 바꾼다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 타입 | `GameState`, `Player`, `Pending`, `Action`, `GameEvent`, `GameResult` 등 모든 엔진 타입과 `RuleError` | [types.md](types/types.md) |
| 초기 상태 | 플레이어 1~4명과 모드·시드로 새 `GameState` 를 만든다 (연애 후보 ★, 어른 모드 능력치) | [setup.md](setup/setup.md) |
| 컨텍스트 | 한 번의 판정 동안 쓰는 `Ctx`: 시드 난수 뽑기, 이벤트 기록, 메시지·기록, 플레이어 찾기 | [context.md](context/context.md) |
| 효과 연산 | 돈(약속어음 자동 발행)·능력치·운세·호감도 변경, 효과 묶음 적용, 카드·보물 획득, 월급 단위, 축하금 걷기 | [effects.md](effects/effects.md) |

## 통합 방식
- 제공 인터페이스 (엔진의 다른 자식과 `engine.ts` 가 쓰는 API, 구현 위치 `src/engine/core/core.ts` 는 자식 모듈을 다시 내보낸다):
  - 타입 전부와 `RuleError`
  - `newGameState(opts: { players: PlayerSeed[]; mode?: Mode; seed: number }): GameState`
  - `createContext(state: GameState): Ctx`
  - 효과 연산: `addMoney`, `addStat`, `addFortune`, `addAffinity`, `applyEffects`, `gainCard`, `gainTreasure`, `incomeUnit`, `salaryOf`, `collectFromOthers`
- 자식에게 요구하는 것:
  - 타입: 런타임 코드는 `RuleError` 클래스뿐. 나머지는 타입만. 모든 상태는 JSON 으로 직렬화할 수 있어야 한다 (함수·Map·Set·undefined 금지, 없음은 `null`).
  - 초기 상태: 난수는 `rngNext` 로 상태의 `rng` 를 한 걸음씩 옮기며 뽑는다 (컨텍스트와 같은 방식).
  - 컨텍스트: 모든 판정 난수는 `ctx.rnd()` 로만 뽑는다. `ctx.state.rng` 가 매번 다음 시드로 바뀐다.
  - 효과 연산: 모든 값 변경은 해당 이벤트를 `ctx.events` 에 남긴다. 값이 실제로 바뀌지 않으면 이벤트를 남기지 않는다 (돈 0, 상한에 막힌 능력치 등).
- 조립: `src/engine/core/core.ts` 는 `export * from` 으로 네 자식을 다시 내보낸다.

## 수용 기준
- 같은 시드로 `newGameState` 를 두 번 만들면 `JSON.stringify` 결과가 같다.
- 새 상태를 `JSON.parse(JSON.stringify(s))` 해도 값이 그대로다.
- 한 컨텍스트에서 `rnd()` 를 여러 번 뽑은 뒤의 `state.rng` 로 새 컨텍스트를 만들어 이어 뽑으면, 한 컨텍스트에서 계속 뽑은 수열과 같다.

## 참조
- [data.md](../../data/data.md): `rngNext`, 규칙 수치표, `BOARD.eraStart`
