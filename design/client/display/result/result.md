---
pyramid: leaf
id: result
title: 결과 발표
parent: ../display.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [표시](../display.md) 의 「자식 구성요소」 중 `결과 발표` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 결과 발표

## 정의
게임이 끝나면 뜨는 결과 발표 창이다. 플레이어별 열에 항목(현금·보물 감정·집 감정·자녀·GOAL 보너스·특별상·약속어음)을 한 줄씩 차례로 공개하며 합계를 올리고, 모두 공개되면 팡파르와 함께 1위에게 카메라와 색종이를 보내고 순위를 보여 준다. 방장은 로비로 돌아가기, 누구나 나가기를 할 수 있다.

## 인터페이스
- 구현 위치: `src/client/display/result/result.ts`, 테스트 `src/client/display/result/result.test.ts` (jsdom, 가짜 sleep)
- 공개 API:
  ```ts
  export function createResult(ctx: ClientCtx, deps?: { sleep?: (ms: number) => Promise<void>; location?: { pathname: string; assign(url: string): void } }): {
    show(s: PublicState): Promise<void>;
    hide(): void;
  };
  ```

## 동작 규칙
1. `show(s)`: `res = s.result`, 없으면 끝. `#modal-result` 보이기, `#result-cols`·`#ranking` 비우기, `#btn-rematch` 는 방장이면 보이고 아니면 숨김.
2. 행마다 `div.rcol` 을 만든다: `h3`(상의 색 점 + 이름), `div.items`, `div.tot`(처음 '0원').
3. i = 0..(최대 항목 수 − 1): 각 행의 i 번째 항목이 있으면 `div.it` (`<span>{라벨}</span><span class="a{음수면 ' neg'}">{양수면 '+'}{formatMoney}</span>`)를 추가하고 그 행의 합계를 갱신. i === 0 이면 소리 money, 아니면 tick. 700ms 대기.
4. 모두 공개하면 소리 fanfare, view 가 있으면 `flash(0.6)`, 1위에게 `focus`, `confettiAt`. `#ranking` 에 순위마다 `div.rank`(1위는 `first` 와 '👑 ') "{i+1}위 {이름}<br>{formatMoney(total)}".
5. `hide()`: `#modal-result` 숨김.
6. 버튼(초기화 때 연결): `#btn-rematch` → `send({type:'rematch'})`. `#btn-exit` → `send({type:'leave'})`, `clearSession()`, `location.assign(pathname)`.

## 경계 조건
- 항목 수가 다른 행들도 짧은 행은 먼저 끝나고 나머지만 이어서 공개된다.
- 라벨·이름은 이스케이프.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 2행 (항목 2개, 3개) | `show` | sleep 3번, 첫 열 항목 2 둘째 열 3, 합계 표시 = total |
| 2 | 방장 아님 | `show` | `#btn-rematch` hidden |
| 3 | 음수 항목 −2400 | `show` | `.a.neg` 에 '-2,400만원' |
| 4 | ranking [b, a] | `show` | 첫 `.rank.first` 가 b 이름과 👑 |
| 5 | — | 나가기 클릭 | leave 전송, clearSession, assign(pathname) |

## 참조
- [notice.md](../notice/notice.md): `esc`
- [data.md](../../../data/data.md): `formatMoney`
- [engine.md](../../../engine/engine.md): `PublicState`, `GameResult`
