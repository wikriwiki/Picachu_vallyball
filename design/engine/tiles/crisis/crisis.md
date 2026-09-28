---
pyramid: leaf
id: crisis
title: 위기 칸
parent: ../tiles.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [칸 규칙](../tiles.md) 의 「자식 구성요소」 중 `위기 칸` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 위기 칸

## 정의
나쁜 칸 두 단계를 처리한다. 물방울 칸(아슬아슬)은 시대별 문구를 보여 준 뒤 능력치 하나를 무작위로 골라 능력치 변동 룰렛을 돌리게 한다. 유령 칸(대위기)은 보험 카드가 있으면 한 장 써서 막고, 없으면 시대별 큰 손해와 운세 −1 을 준다.

## 인터페이스
- 구현 위치: `src/engine/tiles/crisis/crisis.ts`, 테스트 `src/engine/tiles/crisis/crisis.test.ts`
- 공개 API:
  ```ts
  export function onHiyari(ctx: Ctx, p: Player): void;
  export function onGhost(ctx: Ctx, p: Player): void;
  export const resolveHiyari: SpinResolver;   // purpose 'hiyari'
  ```

## 동작 규칙
1. 표 선택 (시대 묶음): baby → `baby`, kid·teen → `kid`, final → `final`, adult → `adult`.
2. `onHiyari`: `e = choose(HIYARI[묶음])`, 메시지 e.t (bad). `stat = choose(['int','phy','sen'])`. 대기 `{ type:'spin', playerId, purpose:'hiyari', stat, title: "아슬아슬 룰렛! {STAT_NAMES[stat]}이(가) 변동합니다" }`.
3. `resolveHiyari(p, pend, v)`: `d = HIYARI_SPIN[v−1]`. d ≥ 0 이면 메시지 "위기를 기회로! {능력치} +{d}"(lucky), 아니면 "{능력치} {d}..."(bad). `addStat(pend.stat, d)`.
4. `onGhost`: 손패에 `insurance` 가 있으면 처음 나오는 한 장을 빼고 이벤트 `card {pid, card:'insurance', used:true}`, 메시지 "유령이 나타났다! ...하지만 보험 카드로 막아냈다!"(lucky) 후 끝 (난수 없음). 없으면 `e = choose(GHOST[묶음])`, 메시지 "👻 {문구}"(bad), `applyEffects(e.e)`, `addFortune(−1)`.

## 경계 조건
- 보험 카드는 물방울 칸에서는 발동하지 않는다.
- 보험 카드가 두 장이면 한 장만 쓴다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 시대 2 | `onHiyari` | HIYARI.kid 문구, hiyari 룰렛 대기 (stat 은 세 능력치 중 하나) |
| 2 | 대기 stat phy, phy 20 | `resolveHiyari(v=1)` / `(v=10)` | phy 8 / phy 26 |
| 3 | 손패 [insurance, double] | `onGhost` | 손패 [double], used 이벤트, 운세 그대로 |
| 4 | 손패 없음, 어른 | `onGhost` | GHOST.adult 효과, 운세 −1 |
| 5 | 시대 0, 손패 [insurance, insurance] | `onGhost` | insurance 1장 남음 |

## 참조
- [core.md](../../core/core.md): `addStat`, `addFortune`, `applyEffects`
- [data.md](../../../data/data.md): `HIYARI`, `HIYARI_SPIN`, `GHOST`, `STAT_NAMES`, `ERA_GROUP`
