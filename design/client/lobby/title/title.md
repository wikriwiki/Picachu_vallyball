---
pyramid: leaf
id: title
title: 타이틀 화면
parent: ../lobby.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [로비](../lobby.md) 의 「자식 구성요소」 중 `타이틀 화면` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 타이틀 화면

## 정의
첫 화면이다. 닉네임과 아바타(피부·머리·상의·하의 색, 머리 모양, 얼굴)를 고르면 3D 미리보기가 바뀌고 브라우저에 저장된다. 모드를 골라 방을 만들거나, 4자리 코드로 참가한다. 서버 연결 상태를 보여 준다.

## 인터페이스
- 구현 위치: `src/client/lobby/title/title.ts`, 테스트 `src/client/lobby/title/title.test.ts` (jsdom)
- 공개 API:
  ```ts
  export const PROFILE_KEY = 'life.profile';
  export interface Profile { name: string; avatar: Avatar; }
  export function loadProfile(storage?: Pick<Storage, 'getItem'>): Profile;
  export function initTitle(ctx: ClientCtx, deps?: { storage?: Pick<Storage,'getItem'|'setItem'>; preview?: (canvas: HTMLCanvasElement, a: Avatar) => AvatarPreview }): {
    setConnStatus(status: ConnStatus): void;
    fillCodeFromUrl(search: string): void;
  };
  ```

## 동작 규칙
1. `loadProfile`: localStorage `PROFILE_KEY` 의 JSON `{name, avatar}` 를 읽어 `avatar` 는 `{...AVATAR_DEFAULT, ...저장값}`, `name` 은 저장값 또는 ''. 해석 실패·예외면 기본값.
2. 초기화: 이름 입력칸에 저장된 이름. `#avatar-opts` 에 줄을 그린다 — 색 4줄(피부·머리·상의·하의; 라벨 '피부','머리','상의','하의'), 각 줄은 `AVATAR_OPTIONS` 의 색마다 `button.sw`(배경색, 현재 값이면 `sel`), 그리고 '헤어'(`AVATAR_OPTIONS.hairStyles`)·'얼굴'(`faces`) 줄은 `button.chip`(선택된 번호면 `sel`). 버튼을 누르면 값을 바꾸고, 저장하고, 줄을 다시 그리고, 미리보기에 `setAvatar`.
3. 미리보기: `deps.preview ?? createAvatarPreview` 로 `#avatar-canvas` 에 만들고 `setActive(true)`. `shell.onShow(s => preview.setActive(s === 'title'))` 로 타이틀 화면일 때만 그리게 한다. 생성이 예외를 던지면(WebGL 없음) 미리보기 없이 계속한다.
4. 저장: 이름 입력(`input` 이벤트)과 아바타 변경 때 `{name: 입력값, avatar}` 를 저장. 저장 예외는 무시.
5. 방 만들기(`#btn-create` 클릭): `sound.unlock()`, `send({type:'create', name: 이름(비면 '플레이어'), avatar, mode: #sel-mode 값})`.
6. 참가(`#btn-join` 클릭, 또는 코드 입력칸에서 Enter): 코드 = 입력값 trim + 대문자. 4글자가 아니면 토스트 '4자리 방 코드를 입력하세요.'(오류) 후 끝. 아니면 `sound.unlock()`, `send({type:'join', code, name, avatar})`.
7. `setConnStatus(s)`: `#conn-status` 클래스 `conn ok`(open) / `conn err`(closed) / `conn`(connecting), 글자 '서버 연결됨 ✓' / '서버 연결 끊김 — 재연결 중...' / '서버 연결 중...'.
8. `fillCodeFromUrl(search)`: `?room=` 값이 있으면 대문자로 코드 입력칸에.

## 경계 조건
- 저장된 아바타의 일부 필드만 있어도 나머지는 기본값.
- 미리보기 생성이 실패(WebGL 없음)해도 타이틀은 동작한다 (예외를 잡아 무시).

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | 저장 `{"name":"민수","avatar":{"shirt":"#51cf66"}}` | `loadProfile` | name 민수, shirt #51cf66, skin 기본 |
| 2 | 저장값이 깨진 JSON | `loadProfile` | 기본값 |
| 3 | 가짜 ctx | 상의 색 버튼 클릭 | 저장소에 새 shirt, 미리보기 setAvatar 호출, 해당 버튼 sel |
| 4 | 이름 '민수', 모드 adult | 방 만들기 클릭 | send `{type:'create', name:'민수', mode:'adult', avatar}` |
| 5 | 코드 'ab1' | 참가 클릭 | 오류 토스트, send 없음 |
| 6 | 코드 'abcd' | Enter | send join code 'ABCD' |
| 7 | — | `setConnStatus('open')` | 클래스 `conn ok`, 글자 '서버 연결됨 ✓' |
| 8 | — | `fillCodeFromUrl('?room=wxyz')` | 입력칸 'WXYZ' |

## 참조
- [data.md](../../../data/data.md): `AVATAR_DEFAULT`, `AVATAR_OPTIONS`, `Avatar`
- [view.md](../../../view/view.md): `createAvatarPreview`, `AvatarPreview`
- [connection.md](../../connection/connection.md): `ConnStatus`
