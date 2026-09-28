---
pyramid: leaf
id: star
title: 행운 칸
parent: ../tiles.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [칸 규칙](../tiles.md) 의 「자식 구성요소」 중 `행운 칸` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 행운 칸

## 정의
좋은 칸인 별 칸을 처리한다. 별 칸 Lv1 은 그 시대의 이벤트 표에서 하나를 뽑아 효과를 그대로, Lv2 는 좋은 효과만 2배로 준다. 어른 시절 이후의 별 Lv1·Lv2 칸에서는 25% 확률로 운세에 따른 보너스·불운이 따라온다. 별 칸 Lv3(빛나는 칸)은 호화 이벤트 표에서 뽑는다.

## 인터페이스
- 구현 위치: `src/engine/tiles/star/star.ts`, 테스트 `src/engine/tiles/star/star.test.ts`
- 공개 API:
  ```ts
  export function onStar(ctx: Ctx, p: Player, tile: Tile): void;   // star1, star2
  export function onStar3(ctx: Ctx, p: Player): void;
  ```

## 동작 규칙
1. `onStar`: 이벤트 표 = `EVENTS[시대 id]` (어른 전·후반은 `EVENTS.adult`). `e = choose(표)`. Lv2(`star2`)면 메시지 "★★ {문구}"(lucky), 효과 `doublePositive(e.e)`. Lv1 이면 메시지 "★ {문구}"(event), 효과 `e.e`. `applyEffects`.
2. 운세 보정: 시대 ≥ 어른 전반이고 `rnd() < 0.25` 이면: 운세 ≥ 5(대길 이상)면 메시지 "운세 「{운세}」 덕분에 특별 보너스!"(lucky) + `addMoney(1000, '운세 보너스')`; 운세 ≤ 1(흉 이하)면 메시지 "운세 「{운세}」... 불운이 덮쳤다."(bad) + `addMoney(−800, '불운')`. 그 외 아무것도 없음. 어른 전 시대에는 난수를 뽑지 않는다.
3. `onStar3`: 시대 묶음이 adult·final 이면 `STAR3.adult`, 아니면 `STAR3.kid` 에서 `choose`, 메시지 "★★★ {문구}"(lucky), `applyEffects`.

## 경계 조건
- 서브맵 안의 별 칸도 현재 시대 기준으로 처리한다 (서브맵은 어른 이후에만 있다).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 시대 0 | `onStar(star1)` | msg ★ 로 시작, 효과는 EVENTS.baby 중 하나, rnd 는 1번만 뽑힘 |
| 2 | 시대 0, 표에서 {int:5} 가 뽑히도록 rng 설정 | `onStar(star2)` | int +10, msg ★★ |
| 3 | 어른, 운세 5, 보정 난수 < 0.25 가 되는 rng | `onStar(star1)` | 운세 보너스 +1000 |
| 4 | 어른, 운세 3 | 보정 발동 | 추가 효과 없음 |
| 5 | 시대 2 | `onStar3` | STAR3.kid 문구 |

## 참조
- [core.md](../../core/core.md): `applyEffects`, `doublePositive`, `addMoney`
- [data.md](../../../data/data.md): `EVENTS`, `STAR3`, `ERAS`, `ERA_GROUP`, `FORTUNES`, `ADULT_ERA`, `Tile`
