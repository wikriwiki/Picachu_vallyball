---
pyramid: leaf
id: status
title: 상태창
parent: ../display.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [표시](../display.md) 의 「자식 구성요소」 중 `상태창` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 상태창

## 정의
명령 메뉴의 "상태"를 누르면 뜨는 창이다. 모든 플레이어의 돈과 어음, 직업·랭크·월급, 능력치 등급과 수치, 운세, 상대(직업·★·성격과 호감도 막대) 또는 배우자, 자녀·집·보물·카드 목록을 카드로 보여 준다.

## 인터페이스
- 구현 위치: `src/client/display/status/status.ts`, 테스트 `src/client/display/status/status.test.ts` (jsdom)
- 공개 API:
  ```ts
  export function statusCardHtml(s: PublicState, p: Player): string;
  export function createStatus(ctx: ClientCtx): { open(): void };
  ```

## 동작 규칙
1. `open()`: `s = store.get('state')` 가 없으면 끝. `#status-body` 에 `div.status-grid` 안 플레이어별 `statusCardHtml` 을 넣고 `#modal-status` 를 보인다. `#status-close` 클릭은 창을 숨긴다 (초기화 때 연결).
2. `statusCardHtml(s, p)`: `div.status-card` 안에
   - `h3` 이름
   - "💰 {formatMoney(돈)}" + (어음이 있으면 " · 약속어음 {n}장")
   - 직업이 있으면 "{icon} {직업 이름} · {랭크 이름} (월급 {formatMoney(월급)})", 없으면 `jobLabel`
   - "지력 <b>{등급}</b> ({수치})" · 체력 · 센스
   - "운세 <b>{운세}</b>"
   - 배우자면 "💍 배우자: {이름}", 상대면 "💗 {이름} ({직업}, {★}, {성격 이름})" 과 `div.bar > i`(너비 = 호감도%), 없으면 "💭 관심 있는 사람 없음"
   - 자녀가 있으면 "👶 자녀: {이름들}", 집 "🏠 {이름들}", 보물 "💎 {이름들}", 카드 "🃏 {카드 이름들}" (쉼표로 이음)
   - 사용자 문자열(이름·배우자·자녀 이름)은 이스케이프.

## 경계 조건
- 상태가 없으면 창을 열지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 직업 teacher rank 0, int 30 | `statusCardHtml` | '📚 교사 · 교생 (월급 500만원)', '지력 <b>D</b> (30)' 포함 |
| 2 | 상대 호감도 45 | `statusCardHtml` | `width:45%` 막대 |
| 3 | 이름 `<i>` | `statusCardHtml` | `&lt;i&gt;` |
| 4 | state 있음 | `open` | `#modal-status` 보임, 카드 수 = 인원 |

## 참조
- [hud.md](../hud/hud.md): `jobLabel`
- [notice.md](../notice/notice.md): `esc`
- [data.md](../../../data/data.md): `jobById`, `gradeOf`, `FORTUNES`, `CARDS`, `STAT_NAMES`, `PERSONALITY_NAMES`, `formatMoney`
