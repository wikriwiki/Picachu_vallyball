---
pyramid: leaf
id: movement
title: 이동
parent: ../flow.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [진행](../flow.md) 의 「자식 구성요소」 중 `이동` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 이동

## 정의
이동 룰렛 값만큼 말을 보드 그래프를 따라 한 칸씩 옮긴다. 월급날은 지나가기만 해도 받고, STOP 칸과 서브맵 귀환 칸에서는 반드시 멈추며, 갈림길을 만나면 남은 칸 수를 들고 어느 길로 갈지 묻는다. 멈춘 칸의 효과는 칸 규칙에 넘긴다. 이동 룰렛과 길 선택의 판정 함수도 여기 있다.

## 인터페이스
- 구현 위치: `src/engine/flow/movement/movement.ts`, 테스트 `src/engine/flow/movement/movement.test.ts`
- 공개 API:
  ```ts
  export function doMove(ctx: Ctx, p: Player, steps: number, forcedNext?: number | null): void;
  export function payday(ctx: Ctx, p: Player): void;
  export const resolveMoveSpin: SpinResolver;   // purpose 'move'
  export const resolveRoute: ChoiceResolver;    // kind 'route'
  ```

## 동작 규칙
1. `resolveMoveSpin(p, pend, value)`: `steps = value`. `pend.double` 이면 `steps = value × 2` 와 메시지 "더블 카드! {steps}칸 전진"(card). `doMove(p, steps)`.
2. `doMove(p, steps, forced)`: 지나온 칸 목록 seg = [], pos = p.tile. k = 0..steps−1:
   - `cur = BOARD.tiles[pos]`. `cur.next` 가 없거나 `cur.type === 'return'` 이면 멈춤.
   - k === 0 이고 forced 가 있으면 다음 칸 = forced.
   - 아니면 `cur.next` 가 2개 이상이면(갈림길): seg 가 있으면 `move {pid, path: seg}` 이벤트, `p.tile = pos`. 그 칸이 분기점인 분기 `br` 를 찾아, 대기 `{ type:'choice', kind:'route', playerId, remaining: steps − k, title: "갈림길! 어느 길로 갈까요? (남은 {steps−k}칸)", options: cur.next 마다 {label: ROUTE_NAMES[route], desc: ROUTE_DESC[route] ?? '', next, route} }` (route = br 가 있으면 `br.routes[i]`, 없으면 그 칸의 route), 이벤트 `junction {pid, tile: pos, options: cur.next}` 후 **끝**(칸 효과 없음).
   - 아니면 다음 칸 = `cur.next[0]`.
   - pos = 다음 칸, seg 에 추가. 그 칸이 `payday` 면: `p.tile = pos`, `move {path: seg}` 이벤트 후 seg = [], 메시지 (시대 < 어른 "용돈날!", 마지막 시대 "연금날!", 그 외 "월급날!", kind payday), `payday(p)`.
   - 그 칸이 `stop` 이고 k < steps − 1 이면 멈춤. `return` 이면 멈춤.
3. 루프가 끝나면 `p.tile = pos`, seg 가 있으면 `move` 이벤트, `resolveTile(p)`.
4. `payday(p)`:
   - 어른 전 시대: 용돈 `ERAS[era].allowance` 가 있으면 `addMoney(용돈, '용돈')`.
   - 직업이 없으면 끝.
   - 마지막 시대: `addMoney(round(salaryOf × 0.3), '연금')`.
   - 능력치 승진형(`stat`)이면 직업 시스템의 `promoteByStats(p)` 먼저.
   - 프리랜서(`free`)면 `v = 1 + rint(10)`, 이벤트 `spin {pid, value: v, purpose:'freelance', auto: true}`, `addMoney(300 × v, '프리랜서 수입')` 후 끝.
   - 그 외 `addMoney(salaryOf(p), '월급')`.
5. `resolveRoute(p, pend, idx)`: 메시지 "{label}(으)로 간다!"(info), `doMove(p, pend.remaining, options[idx].next)`.

## 경계 조건
- 이동 중 월급날을 여러 번 지나면 매번 받는다.
- STOP 칸에 정확히 도착해도 멈추고, 지나가려 해도 거기서 멈춘다 (둘 다 칸 효과 적용).
- 갈림길 칸 자체에 정확히 멈추면(남은 칸 0) 선택 없이 그 칸 효과를 받는다.
- 시대 END 에서 next 가 없으면 남은 칸이 있어도 END 에 멈춘다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 시대 1 START, 7칸 이동 | `doMove(p, 7)` | 월급날(START+7) 에서 용돈 20, move 이벤트, 마지막 칸 land |
| 2 | START+5, 3칸 | `doMove` | 월급날 지나며 용돈 받고 START+8 에 멈춤 |
| 3 | 분기점 2칸 전, 5칸 | `doMove` | 분기점에서 route 선택 대기 remaining 3, junction 이벤트, land 없음 |
| 4 | 3 이후 | `resolveRoute(연애 길 번호)` | 연애 길로 3칸 진행 |
| 5 | 결혼 STOP 1칸 전, 6칸 | `doMove` | STOP 칸에서 멈춤, 결혼 STOP 효과 |
| 6 | END 2칸 전, 10칸 | `doMove` | END 에 멈춤, doneEra |
| 7 | 어른, 프리랜서, rng 고정 | `payday` | freelance spin 이벤트, 300 × 값 |
| 8 | 마지막 시대, 월급 1000 | `payday` | 연금 +300 |
| 9 | double 대기, 값 4 | `resolveMoveSpin` | 8칸 전진, 더블 메시지 |

## 참조
- [tiles.md](../../tiles/tiles.md): `resolveTile`
- [systems.md](../../systems/systems.md): `promoteByStats`
- [core.md](../../core/core.md): 효과 연산, `salaryOf`
- [data.md](../../../data/data.md): `BOARD`, `ERAS`, `ROUTE_NAMES`, `ROUTE_DESC`, `jobById`, `ADULT_ERA`, `FINAL_ERA`
