---
pyramid: leaf
id: romance
title: 연애
parent: ../systems.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생 시스템](../systems.md) 의 「자식 구성요소」 중 `연애` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 연애

## 정의
연애 규칙이다 [원작 구조 / 수치 추정]. 고등학생이 되면 관심 있는 사람을 고르고, 하트 칸에서 새로 만나거나 데이트로 호감도를 올리며(★이 높을수록 덜 오르고, 상대 성격이 내 최고 능력치와 맞으면 더 오름), 어른이 되어 호감도 60 이상이면 프러포즈를 제안받는다. 결혼 STOP 에서는 프러포즈(상대가 없으면 즉석 소개팅), 운명의 하트 칸에서는 ★4~5 후보를 만나 상대를 바꿀 수 있다. 결혼하면 축의금·지참금·카드를 받는다.

## 인터페이스
- 구현 위치: `src/engine/systems/romance/romance.ts`, 테스트 `src/engine/systems/romance/romance.test.ts`
- 공개 API:
  ```ts
  export function freePartners(ctx: Ctx, pred?: (c: PartnerState) => boolean): PartnerState[];
  export function partnerOf(ctx: Ctx, p: Player): PartnerState | null;
  export function topStat(p: Player): StatKey;
  export function proposeNeed(p: Player): number;
  export function setPartner(ctx: Ctx, p: Player, c: PartnerState, affinity: number): void;
  export function makeCrushChoice(ctx: Ctx, p: Player): ChoicePending;
  export function onLoveTile(ctx: Ctx, p: Player): void;
  export function onDestinyTile(ctx: Ctx, p: Player): void;
  export function onMarriageStop(ctx: Ctx, p: Player): void;
  export function marry(ctx: Ctx, p: Player): void;
  export const resolveCrush: ChoiceResolver;     // 'crush'
  export const resolveProposeChoice: ChoiceResolver; // 'propose'
  export const resolveDestiny: ChoiceResolver;   // 'destiny'
  export const resolvePropose: SpinResolver;     // 'propose'
  ```

## 동작 규칙
1. `freePartners(pred)`: `takenBy` 가 없고 pred 를 만족하는 후보 (상태 순서).
2. `topStat(p)`: int → phy → sen 순서로 보며 더 큰 값이 나오면 바꾼다 (동점이면 앞선 것).
3. `proposeNeed(p) = clamp(11 − floor(affinity/10), 2, 10)`.
4. `setPartner(p, c, aff)`: 이전 상대가 있으면 그 후보의 `takenBy = null`. `c.takenBy = p.id`, `p.partner = {id, affinity: aff}`, 이벤트 `partner {pid, partner: c.id, name, stars, affinity: aff}`.
5. `makeCrushChoice(p)`: 풀 = ★ ≤ 3 인 빈 후보. 3명이 될 때까지(풀이 빌 때까지) 풀에서 `rint(풀 크기)` 번째를 꺼낸다. 선택지 = 뽑힌 순서대로 `{label: "{★×stars} {name} ({job})", desc: "{PERSONALITY_NAMES[성격]} — {성격이 topStat 이면 '나와 성격이 잘 맞는다!' 아니면 '호감도가 보통으로 오른다'}", partnerId}` + `{label:'지금은 관심 없음', desc:'하트 칸에서 새로운 만남이 생길 수 있다'}`. title '고등학생이 되었다! 관심 있는 사람을 고르세요'.
6. `resolveCrush(idx)`: partnerId 가 있으면: 이미 `takenBy` 면 메시지 "{name}에게는 이미 다른 인연이..."(bad), 아니면 `setPartner(c, 0)` + 메시지 "💘 {name}이(가) 신경 쓰이기 시작했다."(love). 없으면 메시지 "지금은 공부와 동아리에 집중!"(info).
7. `onLoveTile(p)`:
   - 기혼: `e = choose(LOVE.married)`, 메시지(love), `applyEffects`.
   - 상대 없음: 풀 = ★ ≤ 3 빈 후보. 있으면 `c = choose(풀)`, `setPartner(c, 10)`, 메시지 "💘 새로운 만남! {★×stars} {name}({job})와(과) 알게 되었다."(love).
   - 상대 있음: `gain = round(DATE_BASE 15 × (성격 = topStat ? 1.5 : 1) × STAR_GAIN[stars−1])`, 메시지 "💗 {name}와(과) 데이트! 호감도 +{gain}"(love). 어른 이상이면 `addMoney(−200, '데이트 비용')`. `addAffinity(gain)`. 어른 이상이고 호감도 ≥ 60 이면 대기 `{ kind:'propose', title: "{name}에게 프러포즈할까요? (호감도 {aff} → {proposeNeed} 이상이면 성공)", options: [{label:'💍 프러포즈한다', desc:'실패하면 호감도 −20'}, {label:'아직 기다린다', desc:'호감도를 더 올린다'}] }`.
8. `resolveProposeChoice(idx)`: 0 이면 대기 spin `{purpose:'propose', need: proposeNeed, title: "💍 {name}에게 프러포즈! {need} 이상이면 결혼"}`. 1 이면 메시지 "조금 더 사이를 다지기로 했다."(info).
9. `resolvePropose(v)`: v ≥ need 면 `marry`. 아니면 메시지 "프러포즈 실패... 조금 더 가까워져야 할 것 같다."(bad), `addAffinity(−20)`.
10. `onDestinyTile(p)`:
    - 기혼: 메시지 "🌈 무지개 하트! 부부의 사랑이 더 깊어졌다."(love), `addFortune(1)`.
    - 풀 = ★ ≥ 4 이고 현재 상대가 아닌 빈 후보. 없으면 ★ = 3 인 같은 조건. 그래도 없으면 끝.
    - `c = choose(풀)`, 메시지 "🌈 운명의 만남! {★} {name}({job})"(love).
    - 상대가 없으면 `setPartner(c, 20)` 후 끝.
    - 있으면 대기 `{ kind:'destiny', candidate: c.id, title: "{c.name}에게 마음이 흔들린다... 상대를 바꿀까요?", options: [{label: "{c.name}({★})로 바꾼다", desc:'호감도 20부터 새로 시작'}, {label: "{현재 name}({★})를 지킨다", desc:'현재 상대 호감도 +10'}] }`.
11. `resolveDestiny(idx)`: 0 이고 후보가 아직 비어 있으면 `setPartner(c, 20)` + 메시지 "💘 {name}와(과) 새로운 사랑을 시작했다!"(love). 아니면 메시지 "지금의 사람을 소중히 하기로 했다."(love) + `addAffinity(10)`.
12. `onMarriageStop(p)`: 기혼이면 메시지 "결혼식장 앞. 이미 행복한 가정이 있다!"(love), `addFortune(1)`. 아니면: 상대가 없으면 풀 ★ ≤ 2 빈 후보에서 `choose` 해 `setPartner(c, 30)`, 메시지 "💐 즉석 소개팅! {★} {name}({job})와(과) 만났다."(love). 그 뒤 상대가 있으면 대기 spin propose (8번과 같은 형식).
13. `marry(p)`: `c = partnerOf`, `p.spouse = c.name`, 이벤트 `marry {pid, spouse, partner: c.id}`, 메시지 "💒 {name}와(과) 결혼했다! 모두에게서 축의금을 받는다."(love), `collectFromOthers(300, '축의금')`, `addMoney(stars × 1000, "{name}의 지참금")`. 카드 = ★ ≥ 4 면 `rankup`, 아니면 `PERSONALITY_CARD[성격]`. 손패가 5장 미만이면 추가하고 이벤트 `card {gained: true}`.

## 경계 조건
- 결혼 후에도 `partner` 는 남는다 (호감도 표시용). 하트 칸은 기혼 분기로 간다.
- 빈 후보가 없으면 새 만남·소개팅·운명의 만남은 조용히 넘어간다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | int 30 phy 30 sen 10 | `topStat` | int |
| 2 | 호감도 60 / 80 / 100 / 0 | `proposeNeed` | 5 / 3 / 2 / 10 |
| 3 | ★1~3 후보 5명 이상 | `makeCrushChoice` | 선택지 4개 (후보 3 + 관심 없음) |
| 4 | 상대 없음, 고등 | `onLoveTile` | 상대 생김 호감도 10 |
| 5 | 상대 ★1 성격 = topStat, 어른, 호감도 50 | `onLoveTile` | gain round(15×1.5×1.3)=29, −200, 호감도 79, propose 선택 대기 |
| 6 | 상대 ★5 성격 불일치, 고등 | `onLoveTile` | gain 9, 돈 변화 없음 |
| 7 | need 5 | `resolvePropose(4)` / `(5)` | 호감도 −20 / 결혼 |
| 8 | 2인, 상대 ★2 성격 phy | `marry` | 상대방 −300, 본인 +300 +2000, 손패에 gym |
| 9 | 미혼 상대 없음, ★≤2 빈 후보 있음 | `onMarriageStop` | 상대 호감도 30, propose 룰렛 대기 need 8 |
| 10 | 상대 있음, ★4 빈 후보 있음 | `onDestinyTile` → `resolveDestiny(0)` | 새 상대 호감도 20, 이전 후보 takenBy null |

## 참조
- [core.md](../../core/core.md): 효과 연산, 타입
- [data.md](../../../data/data.md): `LOVE`, `DATE_BASE`, `STAR_GAIN`, `PROPOSE_AT`, `DATE_COST`, `PERSONALITY_NAMES`, `PERSONALITY_CARD`, `WEDDING_GIFT`, `HAND_MAX`, `ADULT_ERA`
