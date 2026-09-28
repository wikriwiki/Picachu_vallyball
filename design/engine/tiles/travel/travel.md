---
pyramid: leaf
id: travel
title: 여행 칸
parent: ../tiles.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [칸 규칙](../tiles.md) 의 「자식 구성요소」 중 `여행 칸` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 여행 칸

## 정의
여행 칸과 서브맵 칸을 처리한다. 여행 칸에 멈추면 떠날지 묻고, 떠나면 해당 서브맵의 첫 칸으로 날아가며 돌아올 본 맵 칸(여행 칸의 6칸 앞)을 기억한다. 서브맵 전용 칸(휴식·수확·베팅·보물 캐기·잭팟·기도·운세 뽑기)의 효과와, 마지막 귀환 칸에서 본 맵 지름길로 돌아오는 것을 맡는다.

## 인터페이스
- 구현 위치: `src/engine/tiles/travel/travel.ts`, 테스트 `src/engine/tiles/travel/travel.test.ts`
- 공개 API:
  ```ts
  export function onTravel(ctx: Ctx, p: Player, tile: Tile): void;
  export function onSubTile(ctx: Ctx, p: Player, tile: Tile): void;
  export const resolveTravel: ChoiceResolver;   // kind 'travel'
  export const resolveBetChoice: ChoiceResolver; // kind 'bet'
  export const resolveBet: SpinResolver;         // purpose 'bet'
  export const resolveJackpot: SpinResolver;     // purpose 'jackpot'
  export const resolvePray: SpinResolver;        // purpose 'pray'
  export const resolveOmikuji: SpinResolver;     // purpose 'omikuji'
  ```

## 동작 규칙
1. `onTravel`: `sm = SUBMAPS[tile.sub]`. 대기 `{ type:'choice', kind:'travel', playerId, sub, title: "여행 칸! {sm.name}(으)로 여행을 떠날까요?", options: [{label: "✈️ {sm.name}(으)로 떠난다", desc:'돌아올 때는 본 맵의 6칸 앞(지름길)으로 돌아온다'}, {label:'가지 않는다', desc:'그대로 진행'}] }`.
2. `resolveTravel(p, pend, idx)`: 0 이면 `subReturn = 현재 칸.ret`, `tile = BOARD.subStart[sub]`, 메시지 "✈️ {name}(으)로 여행을 떠났다!"(lucky), 이벤트 `warp {pid, tile, fly: true}`. 1 이면 메시지 "여행은 다음 기회에."(info).
3. `onSubTile` 종류별:
   - `substart`: 없음.
   - `rest`: 메시지 "🌾 시골에서 푹 쉬었다."(lucky), `applyEffects({phy:5, fortune:1})`.
   - `farm`: 메시지 "🥕 밭에서 수확했다!"(payday), `addMoney(500, '수확')`.
   - `bet`: 대기 `{ kind:'bet', title:'🎰 베팅! 룰렛 6 이상이면 건 돈의 3배', options:[{label:'1000만 건다', amount:1000}, {label:'3000만 건다', amount:3000}, {label:'그만둔다', amount:0}] }`.
   - `dig`: `rnd() < 0.5` 면 메시지 "⛏️ 보물을 캐냈다!"(lucky) + `gainTreasure`, 아니면 "⛏️ 허탕... 삽값만 들었다."(bad) + `addMoney(−200, '허탕')`.
   - `jackpot`: 대기 spin `jackpot`, title '💰 잭팟! 룰렛 값 × 1000만'.
   - `pray`: 메시지 "⛩️ 신에게 봉납하고 기도했다."(event), `addMoney(−300, '봉납')`, 대기 spin `pray`, title '🙏 기도 룰렛! 8 이상이면 큰 축복'.
   - `omikuji`: 대기 spin `omikuji`, title '🎴 운세 뽑기! 룰렛으로 운세가 새로 정해진다'.
   - `return`: `back = subReturn`, `subReturn = null`. back 이 있으면 메시지 "✈️ 여행을 마치고 돌아왔다! (지름길)"(lucky), `tile = back`, 이벤트 `warp {pid, tile: back, fly: true}` (그 칸 효과는 받지 않음).
   - 서브맵 안의 `star1`·`star2`·`star3`·`ghost` 는 칸 규칙 조립에서 각 칸 처리로 간다 (여기로 오지 않음).
4. `resolveBetChoice(p, pend, idx)`: amount 가 있으면 대기 spin `bet`, `amount`, title "{formatMoney(amount)} 베팅! 6 이상이면 3배". 없으면 메시지 "베팅은 그만두었다."(info).
5. `resolveBet(v)`: v ≥ 6 이면 "🎰 대박! 3배!"(lucky) + `addMoney(amount × 2, '베팅 수익')`, 아니면 "🎰 꽝..."(bad) + `addMoney(−amount, '베팅 손실')`.
6. `resolveJackpot(v)`: 메시지 "💰 잭팟 {v}배!"(lucky), `addMoney(v × 1000, '잭팟')`.
7. `resolvePray(v)`: v ≥ 8 이면 "✨ 신의 큰 축복!"(lucky), `addFortune(2)`, 직업이 룰렛 승진형이면 직업 시스템의 `promoteOne(p)` 후 메시지 "「{새 랭크 이름}」(으)로 랭크업!"(lucky) (승진했을 때만). 4~7 이면 "작은 축복을 받았다."(lucky) + `addFortune(1)`. 1~3 이면 "아무 일도 일어나지 않았다..."(info).
8. `resolveOmikuji(v)`: `f` = v ≤ 2 → 1(흉), ≤ 5 → 3(길), ≤ 8 → 4(중길), 9 → 5(대길), 10 → 6(초대길). 메시지 "🎴 운세 뽑기 결과: 「{FORTUNES[f]}」"(f ≥ 5 lucky, f ≤ 1 bad, 그 외 event), `addFortune(f − 현재 운세)`.

## 경계 조건
- 서브맵에 있는 동안 시대가 끝나면 시대 전환이 `subReturn` 을 지운다 (시대 전환의 몫).
- 귀환 칸은 지나칠 수 없다 (이동의 몫).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | countryside 여행 칸 | `onTravel` → `resolveTravel(0)` | tile = subStart.countryside, subReturn = 여행 칸 ret, warp fly |
| 2 | subReturn 100 | `onSubTile(return)` | tile 100, subReturn null, warp |
| 3 | — | `onSubTile(farm)` | +500 |
| 4 | — | `resolveBetChoice(1)` → `resolveBet(6)` | +6000 |
| 5 | 운세 3 | `resolveOmikuji(1)` / `(10)` | 운세 1 / 6 |
| 6 | 야구 선수 랭크 0 | `resolvePray(9)` | 운세 +2, 랭크 1 |
| 7 | 회사원 | `resolvePray(9)` | 운세 +2, 랭크 그대로 |
| 8 | — | `resolveJackpot(7)` | +7000 |

## 참조
- [systems.md](../../systems/systems.md): `promoteOne`
- [core.md](../../core/core.md): 효과 연산
- [data.md](../../../data/data.md): `BOARD`, `SUBMAPS`, `FORTUNES`, `jobById`, `formatMoney`, `Tile`
