---
pyramid: leaf
id: sound
title: 효과음
parent: ../display.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [표시](../display.md) 의 「자식 구성요소」 중 `효과음` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 효과음

## 정의
Web Audio 로 짧은 효과음을 합성한다 (음원 파일 없음). 첫 사용자 입력 때 오디오를 깨우고, 음소거 상태를 브라우저에 기억한다.

## 인터페이스
- 구현 위치: `src/client/display/sound/sound.ts`, 테스트 `src/client/display/sound/sound.test.ts`
- 공개 API:
  ```ts
  export const MUTE_KEY = 'life.mute';
  export interface Sound {
    readonly muted: boolean;
    toggle(): boolean;          // 바뀐 muted 반환
    unlock(): void;
    tick(): void; hop(): void; ding(): void; money(): void; lose(): void; lucky(): void;
    love(): void; card(): void; era(): void; fanfare(): void; turn(): void;
  }
  export function createSound(deps?: { AudioContext?: new () => AudioContextLike; storage?: Pick<Storage,'getItem'|'setItem'> }): Sound;
  ```

## 동작 규칙
1. `muted` 초기값 = 저장소 `MUTE_KEY` 가 `'1'` 인지. `toggle()` 은 뒤집고 `'1'`/`'0'` 저장.
2. 오디오 컨텍스트는 처음 소리를 낼 때(또는 `unlock`) 만들고, 중단 상태면 `resume()`. 만들 수 없으면 소리 없이 넘어간다.
3. `tone(freq, dur, {type, vol, delay, slide})`: 음소거면 무시. 오실레이터(type) 주파수 freq, slide 가 있으면 dur 동안 `freq × slide` 로 지수 변화, 게인은 vol 에서 dur 동안 0.0001 로 지수 감소, `delay` 뒤 시작.
4. `seq(freqs, step, opts)`: i 번째 음을 `delay = i × step` 으로, freq 0 은 쉼표.
5. 소리 표: tick `tone(1400, 0.03, square, 0.04)`, hop `tone(520, 0.08, triangle, 0.06, slide 1.6)`, ding `seq([988,1319], 0.08, triangle, 0.12)`, money `seq([1047,1319,1568], 0.06, square, 0.05)`, lose `seq([392,330,262], 0.12, sawtooth, 0.05)`, lucky `seq([784,988,1175,1568,1976], 0.07, triangle, 0.1)`, love `seq([659,784,1047,988], 0.12, sine, 0.12)`, card `seq([880,1320], 0.07, square, 0.05)`, era `seq([523,659,784,1047,0,784,1047], 0.13, triangle, 0.12)`, fanfare `seq([523,523,523,698,0,880,784,1047], 0.14, square, 0.07)`, turn `tone(660, 0.12, sine, 0.08)`.

## 경계 조건
- 저장소나 오디오가 예외를 던져도 조용히 넘어간다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 가짜 AudioContext(생성한 오실레이터 기록) | `lucky()` | 오실레이터 5개, 주파수 784…1976 |
| 2 | 가짜 저장소 비어 있음 | `toggle()` | true, 저장 '1', 이후 `tick()` 에서 오실레이터 없음 |
| 3 | AudioContext 없음 | `ding()` | 예외 없음 |
| 4 | — | `era()` | 오실레이터 6개 (쉼표 제외) |

## 참조
없음.
