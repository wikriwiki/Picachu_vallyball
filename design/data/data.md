---
pyramid: node
id: data
title: 게임 데이터
parent: ../capstone.md
status: designed
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [인생게임 온라인](../capstone.md) 의 「자식 구성요소」 중 `게임 데이터` 항목을 전개한 node 다. 부모 「통합 방식」이 이 노드에 요구하는 계약을 벗어나지 않는다. (R3)
> - 이 파일에는 자기 정의와 바로 아래 자식만 쓴다. 자식은 분해 축 하나로 2~7개, `./<id>/<id>.md` 에 둔다. (references/design-phase.md §2)
> - 「통합 방식」은 자식보다 먼저 확정한다. 자식은 이 계약을 지켜야 한다.
> - 이 파일이 바뀌면: ↑ 부모 「통합 방식」 영향 검토, ↓ 모든 자식 재검토. (references/change-protocol.md)

# 게임 데이터

## 정의
규칙이 참조하는 모든 읽기 전용 데이터와, 그 데이터로 보드를 결정적으로 만드는 함수, 그리고 여러 자식이 함께 쓰는 공용 헬퍼(시드 난수, 금액 표기)의 모음이다. 다른 자식에 의존하지 않으며, 서버와 클라이언트가 같은 코드를 쓴다. 원작에서 확인된 값은 `[원작]`, 추정한 값은 `[추정]` 으로 표시한다. 금액 단위는 만원이다.

## 관계
- 분해 축: 종류(kind-of)
- 관계 문장: "규칙 수치표"와 "이벤트 문구표"와 "칸 종류"는 데이터이고, "보드"는 칸 종류와 규칙 수치표(시대 경로)로 칸 그래프를 만들며, "공용 헬퍼"는 보드 생성과 다른 자식이 함께 쓰는 난수·금액 표기 도구다.

## 자식 구성요소
| 구성요소 | 한 줄 설명 | 설계 파일 |
|---|---|---|
| 규칙 수치표 | 시대, 능력치·운세, 직업, 성장 선택, 연애 후보, 카드, 경제 상수, 아바타 선택지 | [tables.md](tables/tables.md) |
| 이벤트 문구표 | 별 칸·빛나는 칸·물방울·유령·하트·선택 칸의 문구와 효과 표 | [events.md](events/events.md) |
| 칸 종류 | 칸 종류 목록과 이름·색, 서브맵 3종의 칸 순서, 여행 지름길 칸 수 | [tile-types.md](tile-types/tile-types.md) |
| 보드 | 레인 좌표, 칸 종류 배분, 분기 그래프 생성, 월급날까지 거리 | [board.md](board/board.md) |
| 공용 헬퍼 | 시드 난수 생성기(mulberry32), 금액 표기(억·만원) | [helpers.md](helpers/helpers.md) |

## 통합 방식
- 제공 인터페이스: 구현 위치 `src/data/data.ts` 는 자식 모듈의 공개 이름을 그대로 다시 내보낸다(re-export). 다른 최상위 자식은 `src/data/data.ts` 에서만 import 한다.
- 자식에게 요구하는 것:
  - 규칙 수치표: 모든 표를 `readonly` 타입의 상수로 공개하고, 표에 딸린 순수 조회 함수(`gradeIndex`, `gradeOf`, `gradeValue`, `jobById`, `meetsReq`)를 함께 공개한다. 공개 타입 `StatKey = 'int' | 'phy' | 'sen'`, `EraId`, `Era`, `Job`, `JobRank`, `CardId`, `CardInfo` 등을 정의한다. 여러 최상위 자식이 함께 쓰는 `Avatar` 타입(피부·머리·상의·하의 색, 머리 모양, 얼굴)과 기본값·선택지도 여기서 정의한다.
  - 이벤트 문구표: 효과 타입 `Effect`(`money`, `int`, `phy`, `sen`, `fortune`, `love`, `card`, `treasure`, `gamble`)와 모든 표를 공개한다. 문구는 원문 그대로 옮긴다.
  - 칸 종류: `TileType` 유니온, `TILE_INFO`(이름·색), `SUBMAPS`, `SubmapId`, `TRAVEL_SHORTCUT` 를 공개한다.
  - 보드: 모듈을 불러올 때 한 번 만들어 둔 `BOARD: Board` 와 `LAYOUT`, `lanePoint`, `stepsToPayday` 를 공개한다. 같은 입력이면 항상 같은 보드가 된다 (고정 시드 `20231006`).
  - 공용 헬퍼: `rngNext(seed): { value, seed }`(상태 저장형 한 걸음), `createRng(seed): () => number`(클로저형), `formatMoney(man): string` 을 공개한다. 두 난수 함수는 같은 시드에서 같은 수열을 낸다.
- 조립: `src/data/data.ts` 는 `export * from` 만 담는다. 이름이 겹치면 컴파일 오류가 나므로 자식끼리 공개 이름이 겹치지 않아야 한다.
- 의존 방향: 보드 → 규칙 수치표(시대 경로), 칸 종류, 공용 헬퍼. 나머지 자식은 서로 의존하지 않는다.

## 수용 기준
- `src/data/data.ts` 를 import 해도 부수 효과는 보드 생성 한 번뿐이고, 두 번 import 해도 같은 `BOARD` 객체다.
- 생성된 보드는 본 맵 398칸 + 서브맵 30칸 = 428칸이고, 시대·길별 칸 수와 칸 종류 구성이 보드 문서의 생성 결과 표와 같다.
- 공개 상수 객체를 바꾸려 하면 타입 검사에서 오류가 난다 (`readonly`).

## 참조
- [docs/ADR.md](../../docs/ADR.md): 기존 규칙·수치 명세 (§2~§12). 자식 leaf 로 옮기는 원본.
