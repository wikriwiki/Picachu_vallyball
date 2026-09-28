---
pyramid: leaf
id: career
title: 직업
parent: ../systems.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생 시스템](../systems.md) 의 「자식 구성요소」 중 `직업` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 직업

## 정의
직업 규칙이다. 어른 시절 전반 시작에 17개 직업 중 1랭크 조건을 만족한 것만 고를 수 있게 하고, 능력치 승진형은 조건을 만족하면 여러 단계 자동 승진, 룰렛 승진형은 랭크업 찬스 칸에서 룰렛으로 1단계 승진, 프리랜서는 찬스 칸에서 의뢰 수입을 받는다.

## 인터페이스
- 구현 위치: `src/engine/systems/career/career.ts`, 테스트 `src/engine/systems/career/career.test.ts`
- 공개 API:
  ```ts
  export function makeJobChoice(ctx: Ctx, p: Player): ChoicePending;
  export function promoteByStats(ctx: Ctx, p: Player): void;
  export function promoteOne(ctx: Ctx, p: Player): boolean;
  export function rankupNeed(p: Player): number;
  export function onChallengeTile(ctx: Ctx, p: Player): void;
  export const resolveJob: ChoiceResolver;      // 'job'
  export const resolveRankup: SpinResolver;     // 'rankup'
  ```

## 동작 규칙
1. `makeJobChoice(p)`: title '직업을 고르세요 (능력치 조건을 만족한 직업만 가능)'. `JOBS` 순서로 선택지 `{ label: "{icon} {name}", desc: "{1랭크 이름} {formatMoney(1랭크 월급)} → 최고 {formatMoney(최고 월급)} | {승진형} | {조건}", disabled: !meetsReq(p, 1랭크), jobId }`. 승진형: stat '능력치 승진형', spin '룰렛 승진형', free '월급 룰렛형'. 조건: req 가 있으면 "{STAT_NAMES[k]} {등급}" 을 ' · ' 로 이음, 없으면 '조건 없음'.
2. `resolveJob(idx)`: `job = jobId`, `rank = 0`, 이벤트 `job {pid, job, rank:0, promoted:false}`, 메시지 "{icon} {name} 「{1랭크 이름}」(으)로 취직!"(lucky).
3. `promoteByStats(p)`: 직업이 있고 최고 랭크가 아닌 동안, 다음 랭크의 `meetsReq` 가 true 면 `rank += 1`, 이벤트 `job {promoted:true}`, 기록 "{이름}: {랭크 이름}(으)로 승진!". (승진형과 무관하게 조건만 본다 — 부르는 쪽이 stat 형에만 부른다.)
4. `promoteOne(p)`: 직업이 있고 최고 랭크가 아니면 `rank += 1`, 이벤트 `job {promoted:true}`, true. 아니면 false.
5. `rankupNeed(p) = clamp(9 − floor(gradeIndex(stats[job.key]) × 0.8) + rank, 3, 9)`.
6. `onChallengeTile(p)`: 직업이 없으면 끝.
   - spin 형이고 최고 랭크가 아니면: 대기 spin `{purpose:'rankup', need, title: "랭크업 찬스! {need} 이상이면 「{다음 랭크 이름}」(으)로!"}`.
   - stat 형이면 메시지 '승진 심사! 능력치를 갈고닦았다.'(event), `addStat(job.key, 4)`, `promoteByStats`.
   - 그 외(프리랜서, 또는 최고 랭크 spin 형)는 메시지 '큰 의뢰가 들어왔다!'(event), `addMoney(1500, '의뢰 수입')`.
7. `resolveRankup(v)`: v ≥ need 면 `promoteOne`, 메시지 "성공! 「{랭크 이름}」(으)로 랭크업! 월급 {formatMoney(월급)}"(lucky). 아니면 메시지 '아쉽게도 랭크업 실패...'(bad), `addStat(job.key, 2)`.

## 경계 조건
- 프리랜서는 조건이 없어 항상 고를 수 있다.
- 회사원 회장·정치인 대통령은 운세 대길(5) 이상이 필요하다.
- 최고 랭크 spin 형 직업의 찬스 칸은 의뢰 수입(1500)을 받는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 능력치 모두 5 | `makeJobChoice` | 17개 선택지 중 프리랜서만 활성 |
| 2 | int 30 | `makeJobChoice` | 회사원·교사 활성, 의사 비활성 |
| 3 | 회사원 rank 0, int 75 sen 60 fortune 3 | `promoteByStats` | rank 3 (회장은 운세 부족), job 이벤트 3개 |
| 4 | 야구 선수 rank 0, phy 30(D) | `rankupNeed` | 9 − floor(3×0.8)=9−2 = 7 |
| 5 | 야구 선수 rank 1, phy 90(S) | `rankupNeed` | clamp(9−5+1)=5 |
| 6 | 야구 rank 0 | `onChallengeTile` → `resolveRankup(9)` | rank 1 |
| 7 | 야구 rank 0, need 7 | `resolveRankup(3)` | rank 0, phy +2 |
| 8 | 프리랜서 | `onChallengeTile` | +1500 |
| 9 | 교사 int 30 | `onChallengeTile` | int 34, 승진 검사 |

## 참조
- [core.md](../../core/core.md): 효과 연산, `salaryOf`
- [data.md](../../../data/data.md): `JOBS`, `jobById`, `meetsReq`, `gradeIndex`, `STAT_NAMES`, `formatMoney`
