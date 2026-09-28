---
pyramid: leaf
id: shell
title: 화면 골격
parent: ../client.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [클라이언트](../client.md) 의 「자식 구성요소」 중 `화면 골격` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 화면 골격

## 정의
클라이언트 화면의 뼈대다. 진입 HTML(`index.html`)의 DOM 구조와 모든 요소 ID, 전체 스타일시트, 그리고 세 화면(타이틀·로비·게임) 사이를 전환하는 함수를 정의한다. 다른 자식은 DOM 요소를 직접 찾지 않고 화면 골격의 `el(id)` 로 얻는다.

## 인터페이스
- 구현 위치: `index.html`(프로젝트 루트, capstone 전역 제약의 예외), `src/client/shell/shell.ts`, `src/client/shell/style.css`, 테스트 `src/client/shell/shell.test.ts` (jsdom 환경)
- 형태: 상수 목록 + 팩토리 함수
- 공개 API:
  ```ts
  export type ScreenId = 'title' | 'lobby' | 'game';
  export const DOM_IDS: readonly [/* 아래 「DOM 구조」 표의 id 전부 */];
  export type DomId = (typeof DOM_IDS)[number];
  export interface Shell {
    show(screen: ScreenId): void;
    current(): ScreenId;
    el<T extends HTMLElement = HTMLElement>(id: DomId): T;
    setHidden(id: DomId, hidden: boolean): void;   // 'hidden' 클래스 토글
    isHidden(id: DomId): boolean;
    onShow(fn: (screen: ScreenId) => void): void;   // show 가 불릴 때마다 알림
  }
  export function initShell(doc: Document): Shell;
  ```
- `shell.ts` 는 `import './style.css'` 로 스타일을 불러온다.

### DOM 구조 (index.html)
`<html lang="ko">`, viewport `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`, 제목 `인생게임 온라인`, Google Fonts `Jua` 링크, `<script type="module" src="/src/client/main.ts">`.

| 위치 | 요소 (id) | 비고 |
|---|---|---|
| body 맨 앞 | `canvas#world` | 3D 월드, 화면 전체 |
| `section#screen-title.screen.active` | 로고(the Game of / 인생**게임** / ONLINE), `canvas#avatar-canvas`, `div#avatar-opts`, `input#inp-name`(maxlength 10), `select#sel-mode`, `button#btn-create`, `input#inp-code`(maxlength 4), `button#btn-join`, `div#conn-status` | 모드 option: `full` 인생 모드 (아기 ~ 노년), `adult` 어른 모드 (어른 ~ 노년, 짧게), `kids` 어린이 모드 (아기 ~ 고등학생) |
| `section#screen-lobby.screen` | `div#room-code`, `button#btn-copy`, `div#members`, `select#lobby-mode`(위와 같은 option), `button#btn-cpu`, `button#btn-start`, `button#btn-leave`, `div#lobby-hint` | |
| `section#screen-game.screen` | `div#hud-main`(`canvas#hud-portrait` 96×96, `#hud-name`, `#hud-job`, `#hud-stats`, `#hud-partner`, `#hud-money`), `div#players`, `div#turn-box`(`#era-name`, `#era-turn`, `#pay-line`), `div#cmd-menu`(`#cmd-roulette` 🎡 룰렛, `#cmd-card` 🃏 카드, `#cmd-status` 📋 상태, `#cmd-other` ⋯ 기타, `div#other-menu.hidden`(`#btn-view` 🗺️ 전체 지도, `#btn-log` 💬 기록·채팅, `#btn-rules` ❓ 규칙, `#btn-mute` 🔊 소리)), `div#msgbox`(`#msg-name`, `#msg-text`), `div#prompt`, `div#hand`, 룰렛 묶음(`canvas#roulette`, `div#power-fill`, `button#btn-spin`(disabled, 글자 SPIN)), `div#floaters`, `div#log-panel.hidden`(`#log-list`, `form#chat-form` 안 `input#chat-input` maxlength 120) | |
| body (모달) | `#modal-choice`(`#choice-title`, `#choice-list`), `#modal-number`(제목 "지정 룰렛 — 숫자를 고르세요", `#num-grid`, `#num-cancel`), `#modal-status`(`#status-body`, `#status-close`), `#banner`(`#banner-text`), `#modal-result`(`#result-cols`, `#ranking`, `#btn-rematch.hidden` "로비로 돌아가기", `#btn-exit` "나가기"), `#modal-rules`(규칙 목록, `#rules-close`), `div#toasts` | 모달은 처음에 모두 `hidden` |

- 규칙 모달의 목록은 capstone 「주요 기능」과 게임 규칙 요약(룰렛, 7개 시대, 능력치·직업·승진, 별·물방울·유령 칸, 월급날·STOP, 갈림길, 연애·프러포즈·운명의 하트, 여행, 결혼·출산, 약속어음, 카드, 결과 발표)을 한 항목씩 설명한다. [참고: 기존 `public/index.html` 의 규칙 목록 문구]

### 스타일 (style.css)
| 항목 | 값 |
|---|---|
| 색 토큰 | `--ink #2a2238`, `--paper #fffdf6`, `--accent #ff4d6d`, `--accent2 #6741d9`, `--gold #ffc53d`, `--good #2fb344`, `--bad #e03131` |
| 글꼴 | `'Jua', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif` |
| 바탕 | `html, body` 전체 높이, 스크롤 없음, 배경 `#7cc8ff`, 텍스트 선택 금지 |
| 화면 | `.screen` 은 `position: fixed; inset: 0` 이고 `.active` 일 때만 보임. 타이틀·로비는 가운데 정렬 패널 |
| `.hidden` | `display: none !important` |
| HUD 배치 | 왼쪽 위 `#hud-main`, 그 아래 `#players`(top 96px, 폭 230px, `.pcard.is-main` 숨김), 오른쪽 위 `#turn-box`, 왼쪽 세로 가운데 `#cmd-menu`, 아래 가운데 `#msgbox`(폭 `min(620px, 100vw − 420px)`), 그 위 `#prompt`(bottom 130px), 그 위 `#hand`(bottom 176px), 오른쪽 아래 룰렛 묶음(폭 260px, `#roulette` 260×260), 오른쪽 `#log-panel`(top 118px, 폭 300px) |
| 메시지 종류 색 | `.msgbox.lucky #fff7d1`, `.bad #ffe3e3`, `.love #ffe8f0`, `.payday #e6fcf5` |
| 떠오르는 글자 | `.floater` 1.8초 동안 위로 70px 떠오르며 사라짐. `.plus #8cff9e`, `.minus #ff8a8a`, `.info #fff` |
| 배너 | `.banner-inner` 가 왼쪽에서 들어와 멈췄다가 오른쪽으로 나가는 `slideIn` 애니메이션 (기본 2.2초) |
| SPIN 버튼 | 켜져 있으면 1초 주기로 맥박(`pulse`), 꺼지면 회색, `.charging` 이면 눌린 모양 |
| 모바일 (`max-width: 820px`) | HUD 0.82배 축소, 목록 폭 170px, 명령 메뉴는 아래쪽(bottom 150px), 메시지 상자는 좌우 8px 여백 전체 폭(bottom 150px), 룰렛 140×140, SPIN 140×48, 프롬프트는 오른쪽 위(top 64px), 손패는 왼쪽 아래, 카드 68×90, 배너 글자 34px |
- 표에 없는 세부 값(테두리 두께, 그림자, 모서리 반지름, 글자 크기)은 [참고: 기존 `public/css/style.css`] 의 값을 따른다.

## 동작 규칙
1. `initShell(doc)` 는 `DOM_IDS` 의 모든 id 가 문서에 있는지 확인하고, 하나라도 없으면 `Error('missing #<id>')` 를 던진다.
2. `show(screen)` 은 `.screen` 요소 중 id 가 `screen-${screen}` 인 것에만 `active` 클래스를 주고 나머지에서는 뺀다. `current()` 는 마지막으로 보인 화면(처음은 `'title'`)을 돌려준다. 그 뒤 `onShow` 로 등록된 함수를 등록 순서대로 새 화면 id 로 부른다.
3. `el(id)` 는 그 id 의 요소를 돌려준다 (처음 확인할 때 저장해 둔 참조).
4. `setHidden(id, true|false)` 는 `hidden` 클래스를 넣거나 뺀다. `isHidden(id)` 는 `hidden` 클래스가 있는지.

## 경계 조건
- `DOM_IDS` 는 위 표의 id 를 빠짐없이 담는다. 표에 없는 id 를 다른 자식이 쓰면 타입 오류가 난다.
- `show` 를 같은 화면으로 여러 번 불러도 결과가 같다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 루트 `index.html` 을 jsdom 문서로 읽음 | `initShell(doc)` | 예외 없음 |
| 2 | 1 의 문서에서 `#btn-spin` 제거 | `initShell(doc)` | `Error('missing #btn-spin')` |
| 3 | 초기화된 shell | `show('lobby')` | `#screen-lobby` 만 `active`, `current()` 는 `'lobby'` |
| 4 | 초기화 직후 | `current()` | `'title'`, `#screen-title` 이 `active` |
| 5 | 초기화된 shell | `setHidden('modal-choice', false)` 후 `isHidden('modal-choice')` | `false`, 다시 `true` 로 두면 `true` |
| 7 | `onShow` 등록 | `show('game')` | 등록 함수가 'game' 으로 1회 불림 |
| 6 | 루트 `index.html` | 모든 `DOM_IDS` 를 `getElementById` | 전부 존재하고, 모달 5개와 `#other-menu`, `#log-panel` 은 `hidden` 클래스 |

## 참조
없음.
