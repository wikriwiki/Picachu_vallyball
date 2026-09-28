---
pyramid: leaf
id: era
title: 시대 전환
parent: ../flow.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [진행](../flow.md) 의 「자식 구성요소」 중 `시대 전환` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 시대 전환

## 정의
시대를 바꾸고 시대가 시작될 때의 선택을 맡는다. 다음 시대로 넘기면서 모두를 그 시대 START 로 옮기고, 시대에 따라 동아리·관심 있는 사람·진로·직업 선택을 플레이어별로 큐에 넣으며, 동아리와 진로 선택을 판정한다. 어린이 모드는 고등학생 시절이 끝나면 결과 발표로 간다.

## 인터페이스
- 구현 위치: `src/engine/flow/era/era.ts`, 테스트 `src/engine/flow/era/era.test.ts`
- 공개 API:
  ```ts
  export function nextEra(ctx: Ctx): void;
  export function queueEraStart(ctx: Ctx): void;
  export function makeQueued(ctx: Ctx, item: QueuedChoice): Pending;
  export const resolveClub: ChoiceResolver;
  export const resolveCareer: ChoiceResolver;
  ```

## 동작 규칙
1. `nextEra`: 어린이 모드이고 현재 시대가 3(고등학생)이면 `finishGame` 후 끝. 아니면 `era += 1`, `round = 0`, `turn = 0`, 이벤트 `era {era, name}`, 기록 "━━ {시대 이름} ━━". 플레이어마다 `tile = eraStart[era]`, `doneEra = false`, `subReturn = null`, 이벤트 `warp {pid, tile}`. `queueEraStart`. 마지막 시대면 플레이어마다 메시지 "은퇴! 이제부터 연금 생활이다. (월급날에 월급의 30%)".
2. `queueEraStart`: 시대 id 에 따라 플레이어 순서대로 큐에 넣는다. `middle`·`high` → `club`. `high` 이고 상대가 없으면 → 이어서 `crush`. `adult1` → `career`, `job`.
3. `makeQueued(item)`:
   - `club`: `{ type:'choice', kind:'club', playerId, title: "{시대 이름} — 동아리를 고르세요", options: CLUBS 의 {label: name, desc} }`.
   - `career`: title "고등학교 졸업! 진로를 고르세요", options `CAREER_OPTIONS` 의 {label, desc}.
   - `job`: 직업 시스템의 `makeJobChoice(ctx, p)`.
   - `crush`: 연애 시스템의 `makeCrushChoice(ctx, p)`.
4. `resolveClub(p, idx)`: `p.club = CLUBS[idx].id`, 메시지 "「{이름}」에 들어갔다!"(event), `applyEffects(CLUBS[idx].eff)`.
5. `resolveCareer(p, idx)`: 0 이면 `college = true`, 메시지 "대학에 진학했다!"(event), `addMoney(−800, '학비')`, `applyEffects({int:12, sen:4})`. 1 이면 메시지 "바로 사회로 뛰어들었다!"(event), `applyEffects({money:300, phy:5})`.

## 경계 조건
- 어른 모드는 시작할 때 `queueEraStart` 가 불려 어른 전반의 진로·직업 선택부터 한다 (진행의 `startGame`).
- 이미 상대가 있는 플레이어(어른 모드 등)는 crush 를 건너뛴다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 2인, 시대 1 | `nextEra` | 시대 2, 두 플레이어 tile = eraStart[2], era 이벤트 1개, warp 2개, 큐 club×2 |
| 2 | 2인 시대 2, p2 상대 있음 | `nextEra` | 큐 순서 club(p1), crush(p1), club(p2) |
| 3 | 시대 3 kids 모드 | `nextEra` | phase ended |
| 4 | 시대 3 full | `nextEra` | 큐 career(p1), job(p1), … |
| 5 | 시대 5 | `nextEra` | 은퇴 메시지 인원수만큼 |
| 6 | 현금 0 | `resolveCareer(0)` | college, 어음 1장 현금 200, int +12, sen +4 |
| 7 | — | `resolveClub(3)` (귀가부) | club 'home', 능력치 각 +4, 돈 +100 |

## 참조
- [finish.md](../finish/finish.md): `finishGame`
- [systems.md](../../systems/systems.md): `makeJobChoice`, `makeCrushChoice`
- [core.md](../../core/core.md): 효과 연산
- [data.md](../../../data/data.md): `ERAS`, `BOARD`, `CLUBS`, `CAREER_OPTIONS`, `FINAL_ERA`
