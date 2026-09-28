---
pyramid: leaf
id: effects
title: 효과 연산
parent: ../core.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [엔진 코어](../core.md) 의 「자식 구성요소」 중 `효과 연산` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 효과 연산

## 정의
플레이어 값을 바꾸는 기본 연산이다. 돈이 모자라면 약속어음을 자동 발행해 현금을 0 이상으로 유지하고, 능력치·운세·호감도는 범위 안으로 자르며, 모든 변경을 연출 이벤트로 남긴다. 이벤트 표의 효과 묶음을 한 번에 적용하고, 카드·보물 획득, 월급 단위 계산, 다른 플레이어에게서 축하금 걷기를 제공한다.

## 인터페이스
- 구현 위치: `src/engine/core/effects/effects.ts`, 테스트 `src/engine/core/effects/effects.test.ts`
- 공개 API:
  ```ts
  export function salaryOf(p: Player): number;
  export function incomeUnit(ctx: Ctx, p: Player): number;
  export function addMoney(ctx: Ctx, p: Player, delta: number, reason: string): void;
  export function addStat(ctx: Ctx, p: Player, k: StatKey, d: number): void;
  export function addFortune(ctx: Ctx, p: Player, d: number): void;
  export function addAffinity(ctx: Ctx, p: Player, d: number): void;
  export function gainCard(ctx: Ctx, p: Player): void;
  export function gainTreasure(ctx: Ctx, p: Player): void;
  export function collectFromOthers(ctx: Ctx, p: Player, amount: number, reason: string): void;
  export function applyEffects(ctx: Ctx, p: Player, e: Effect | undefined): void;
  export function doublePositive(e: Effect): Effect;
  ```

## 동작 규칙
1. `salaryOf(p)`: 직업이 없으면 0, 있으면 `jobById(p.job).ranks[p.rank].salary`.
2. `incomeUnit(ctx, p)`: 어른 시대 이상(`era ≥ ADULT_ERA`)이면 `max(salaryOf(p), 300)`, 아니면 `max(ERAS[era].allowance, 20)`.
3. `addMoney(p, delta, reason)`: delta 가 0 이면 아무것도 안 함. `p.money += delta`, 이벤트 `money {pid, delta, reason}`. 그 뒤 `p.money < 0` 인 동안 `money += 1000`, `notes += 1` 을 반복하고, 발행했으면 이벤트 `note {pid, count, total: p.notes}`.
4. `addStat(p, k, d)`: d 가 0 이면 무시. `stats[k] = clamp(stats[k] + d, 0, 100)`. 실제 변화량이 0 이 아니면 이벤트 `stat {pid, stat:k, delta: 실제 변화량, value}`.
5. `addFortune(p, d)`: `fortune = clamp(fortune + d, 0, 6)`. 바뀌었으면 이벤트 `fortune {pid, delta: 실제, value}`.
6. `addAffinity(p, d)`: 상대가 없으면 무시. `affinity = clamp(affinity + d, 0, 100)`, 이벤트 `affinity {pid, delta: 실제, value}` (실제 변화 0 이어도 남긴다).
7. `gainCard(p)`: 손패가 `HAND_MAX(5)` 장이면 메시지 "카드가 가득 차서 받을 수 없었다." 후 끝. 아니면 `CARD_POOL` 에서 `choose` 를 반복하되, 어른 시대 전이면 `adultOnly` 카드(승진)는 다시 뽑는다. 손패에 추가, 이벤트 `card {pid, card, gained: true}`, 기록 "{이름}: {카드 이름} 획득".
8. `gainTreasure(p)`: `TREASURES` 에서 `choose`, `{name, base}` 추가, 이벤트 `treasure {pid, name}`, 기록 "{이름}: 보물 「{name}」 획득".
9. `collectFromOthers(p, amount, reason)`: 다른 플레이어마다 `addMoney(o, −amount, reason)` 하고 합계를 더해, 합계가 있으면 `addMoney(p, 합계, reason)`.
10. `applyEffects(p, e)`: e 가 없으면 무시. 순서: ① `money` — `'salary'` 면 `incomeUnit`, `'salary2'` 면 2배, 수면 그대로. 금액 ≥ 0 이면 사유 '수입', 아니면 '지출' 로 `addMoney`. ② `int`, `phy`, `sen` 순서로 `addStat`. ③ `fortune` 이면 `addFortune`. ④ `love` 이고 상대가 있고 미혼이면 `addAffinity(love × 10)`. ⑤ `card` 장수만큼 `gainCard`. ⑥ `treasure` 개수만큼 `gainTreasure`. ⑦ `gamble` 이면 대기 `{ type:'spin', playerId, purpose:'gamble', amount: gamble, title: "투자 {formatMoney(gamble)} — 5 이상이면 성공!" }`.
11. `doublePositive(e)`: 복사본에서 `int`, `phy`, `sen`, `love` 가 양수면 2배, `money` 가 양수인 수면 2배, `'salary'` 면 `'salary2'`. 음수와 `fortune` 등은 그대로.

## 경계 조건
- 현금 100 에서 −2500 이면 money 이벤트 −2500, 어음 3장 발행(현금 500), note 이벤트 count 3.
- 능력치 98 에 +5 면 100, stat 이벤트 delta 2. 100 에 +5 면 이벤트 없음.
- 어른 전 시대에 카드 주머니가 승진 카드만 연속으로 나와도 다른 카드가 나올 때까지 뽑는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 현금 100 | `addMoney(−2500)` | 현금 500, notes 3, 이벤트 money·note(count 3, total 3) |
| 2 | 현금 0 | `addMoney(0)` | 이벤트 없음 |
| 3 | int 98 | `addStat(int, 5)` / 다시 | delta 2 value 100 / 이벤트 없음 |
| 4 | fortune 6 | `addFortune(1)` | 이벤트 없음 |
| 5 | 손패 5장 | `gainCard` | 손패 5장, msg 이벤트 |
| 6 | era 0, 상태 rng 임의 | `gainCard` 200번(손패 비우며) | 승진 카드 0번 |
| 7 | 다른 2명(현금 0, 500) | `collectFromOthers(p, 300)` | 첫째 어음 1장·현금 700, 둘째 200, p +600 |
| 8 | 어른, 직업 없음 | `applyEffects({money:'salary'})` | +300 |
| 9 | 상대 호감도 50 | `applyEffects({love:1})` | 호감도 60 |
| 10 | — | `doublePositive({int:5, phy:-2, money:'salary', fortune:1})` | `{int:10, phy:-2, money:'salary2', fortune:1}` |
| 11 | — | `applyEffects({gamble:1000})` | pending spin gamble amount 1000 |

## 참조
- [types.md](../types/types.md), [context.md](../context/context.md)
- [data.md](../../../data/data.md): `jobById`, `ERAS`, `ADULT_ERA`, `CARDS`, `CARD_POOL`, `HAND_MAX`, `TREASURES`, `NOTE_UNIT`, `formatMoney`
