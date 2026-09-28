---
pyramid: leaf
id: tables
title: 규칙 수치표
parent: ../data.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [게임 데이터](../data.md) 의 「자식 구성요소」 중 `규칙 수치표` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 규칙 수치표

## 정의
규칙이 참조하는 수치표 전부다: 시대, 능력치 등급과 운세, 직업 17종, 동아리, 연애 후보와 연애 상수, 카드, 보물·집, 경제 상수, 이름 목록, 길 이름, 아바타 선택지. 원작 확인 값은 `[원작]`, 추정 값은 `[추정]`. 금액 단위 만원.

## 인터페이스
- 구현 위치: `src/data/tables/tables.ts`, 테스트 `src/data/tables/tables.test.ts`
- 형태: `readonly` 상수 + 순수 조회 함수. 표의 값을 아래 그대로 옮긴다.
- 공개 타입:
  ```ts
  export type StatKey = 'int' | 'phy' | 'sen';
  export type EraId = 'baby' | 'elem' | 'middle' | 'high' | 'adult1' | 'adult2' | 'final';
  export type EraGroup = 'baby' | 'kid' | 'teen' | 'adult' | 'final';
  export type RouteId = 'main' | 'love' | 'career' | 'study';
  export type PathPart =
    | { main: number; fixed?: Readonly<Record<number, string>> }   // 'stop:marriage' | 'stop:house' | 'travel:<submap>'
    | { branch: number; a: RouteId; b: RouteId };
  export interface Era { id: EraId; name: string; turns: number | null; allowance: number; payEvery: number; color: number; ground: number; path: readonly PathPart[]; }
  export interface JobRank { name: string; salary: number; req?: Partial<Record<StatKey, Grade>>; fortune?: number; }
  export interface Job { id: string; name: string; icon: string; type: 'stat' | 'spin' | 'free'; key: StatKey; ranks: readonly JobRank[]; }
  export type Grade = 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  export type CardId = 'fixed' | 'double' | 'insurance' | 'bonus' | 'study' | 'gym' | 'artclass' | 'charm' | 'steal' | 'rankup';
  export interface CardInfo { name: string; desc: string; timing: 'spin' | 'passive' | 'now'; adultOnly?: boolean; }
  export interface PartnerInfo { id: string; name: string; job: string; personality: StatKey; color: string; }
  export interface Avatar { skin: string; hair: string; shirt: string; pants: string; hairStyle: number; face: number; }
  ```
- 조회 함수:
  ```ts
  export function gradeIndex(v: number): number;         // GRADE_MIN 기준 최고 등급 번호
  export function gradeOf(v: number): Grade;
  export function gradeValue(g: Grade): number;          // 등급의 최소값
  export function jobById(id: string): Job | undefined;
  export function meetsReq(pl: { stats: Record<StatKey, number>; fortune: number }, rank: JobRank | undefined): boolean;
  ```

### 시대 `ERAS` (turns null = 제한 없음)
| # | id | 이름 | turns | allowance | payEvery | color | ground | path |
|---|---|---|---|---|---|---|---|---|
| 0 | baby | 아기 시절 | 2 | 0 | 0 | 0xffc8dd | 0xbde0a8 | `[{main:14}]` |
| 1 | elem | 초등학생 시절 | 4 | 20 | 7 | 0xffe066 | 0x9ad07a | `[{main:28}]` |
| 2 | middle | 중학생 시절 | 4 | 40 | 7 | 0x74c0fc | 0x86c46d | `[{main:28}]` |
| 3 | high | 고등학생 시절 | 4 | 60 | 7 | 0x9775fa | 0x7ab862 | `[{main:8},{branch:10,a:'love',b:'study'},{main:10}]` |
| 4 | adult1 | 어른 시절 전반 | 15 | 0 | 18 | 0xff8787 | 0x8cc06a | `[{main:12},{branch:14,a:'love',b:'career'},{main:18,fixed:{2:'stop:marriage',9:'travel:countryside'}},{branch:12,a:'love',b:'career'},{main:22}]` |
| 5 | adult2 | 어른 시절 후반 | 15 | 0 | 18 | 0xffa94d | 0x9cc46e | `[{main:14},{branch:12,a:'love',b:'career'},{main:20,fixed:{4:'stop:house',11:'travel:casino'}},{branch:12,a:'love',b:'career'},{main:22}]` |
| 6 | final | 마지막 시절 | null | 0 | 10 | 0xc0a0ff | 0xb5c98a | `[{main:34,fixed:{10:'travel:shrine'}}]` |

- 7개 시대와 "마지막 시절 제외 턴 제한"은 [원작], 어른 15턴은 [원작 화면], 나머지 수치 [추정].
- `ADULT_ERA = 4`, `FINAL_ERA = 6`.
- `ERA_GROUP: Record<EraId, EraGroup>` = baby→baby, elem→kid, middle→teen, high→teen, adult1→adult, adult2→adult, final→final.
- `ROUTE_NAMES` = main '일반 길', love '💗 연애 길', career '💼 커리어 길', study '📖 공부 길'.
- `ROUTE_DESC` = love '하트 칸이 많아 인연을 만들기 좋다', career '랭크업 찬스와 월급날이 많다', study '별 칸과 카드 칸이 많아 능력치를 키우기 좋다'.

### 능력치·운세
- `STAT_NAMES` = int 지력, phy 체력, sen 센스. `STAT_MAX = 100`, 시작값 각 5 (`STAT_START = 5`).
- `GRADES = ['G','F','E','D','C','B','A','S']` [원작], `GRADE_MIN = [0,10,20,30,45,60,75,90]` [추정].
- `FORTUNES = ['대흉','흉','말길','길','중길','대길','초대길']`, `FORTUNE_START = 3`.

### 직업 `JOBS` (월급 만원, 조건은 등급)
| id | 이름 | 아이콘 | type | key | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|---|---|
| office | 회사원 [원작] | 💼 | stat | int | 일반 사원 600 {int:E} | 과장 1200 {int:D,sen:E} | 부장 2400 {int:C,sen:D} | 사장 6000 {int:B,sen:C} | 회장 18000 {int:A,sen:B} fortune 5 |
| doctor | 의사 [원작] | 🩺 | stat | int | 연수의 900 {int:C,phy:F} | 신인 의사 1800 {int:B,phy:E} | 어엿한 의사 4500 {int:B,phy:D} | 실력파 의사 6300 {int:A,phy:C} | 신의 손 원장 18000 {int:S,phy:C} |
| teacher | 교사 | 📚 | stat | int | 교생 500 {int:D} | 담임 선생님 1000 {int:C,sen:E} | 학년 주임 2000 {int:C,sen:D} | 교감 4000 {int:B,sen:D} | 교장 9000 {int:A,sen:C} |
| police | 경찰관 | 👮 | stat | phy | 순경 600 {phy:D} | 경사 1200 {phy:C,int:E} | 경위 2500 {phy:B,int:D} | 경정 5000 {phy:A,int:C} | 경찰청장 12000 {phy:S,int:B} |
| scientist | 과학자 | 🔬 | stat | int | 연구원 800 {int:C} | 주임 연구원 1600 {int:B} | 부교수 3500 {int:B,sen:D} | 교수 7000 {int:A,sen:C} | 노벨상 학자 20000 {int:S,sen:B} |
| chef | 요리사 | 🍳 | stat | sen | 견습 요리사 400 {sen:D} | 요리사 900 {sen:C} | 셰프 2000 {sen:B,phy:D} | 오너 셰프 5000 {sen:A,phy:C} | 전설의 셰프 15000 {sen:S,phy:B} |
| politician | 정치인 | 🏛️ | stat | int | 비서 700 {int:D,sen:D} | 시의원 1500 {int:C,sen:C} | 국회의원 4000 {int:B,sen:C} | 장관 8000 {int:A,sen:B} | 대통령 20000 {int:S,sen:A} fortune 5 |
| baseball | 야구 선수 | ⚾ | spin | phy | 2군 선수 500 {phy:D} | 1군 선수 1500 | 주전 선수 4000 | 스타 선수 9000 | 메이저리거 25000 |
| soccer | 축구 선수 | ⚽ | spin | phy | 유스 선수 500 {phy:D} | 프로 선수 1500 | 국가대표 5000 | 에이스 10000 | 세계 최고 선수 28000 |
| basketball | 농구 선수 | 🏀 | spin | phy | 연습생 500 {phy:D} | 벤치 멤버 1400 | 주전 멤버 4500 | MVP 10000 | 레전드 28000 |
| fighter | 격투가 | 🥊 | spin | phy | 수련생 400 {phy:C} | 프로 파이터 1200 | 챔피언 4000 | 통합 챔피언 9000 | 격투의 신 22000 |
| actor | 배우 | 🎬 | spin | sen | 엑스트라 400 {sen:D} | 조연 1200 | 주연 4000 | 톱스타 9000 | 월드 스타 24000 |
| idol | 아이돌 | 🎤 | spin | sen | 연습생 300 {sen:D} | 신인 아이돌 1000 | 인기 아이돌 4000 | 톱 아이돌 10000 | 레전드 아이돌 25000 |
| creator | 크리에이터 | 📹 | spin | sen | 새내기 크리에이터 200 {sen:E} | 인기 크리에이터 1000 | 실버 버튼 3000 | 골드 버튼 8000 | 다이아 버튼 22000 |
| manga | 만화가 | ✏️ | spin | sen | 어시스턴트 300 {sen:D} | 신인 만화가 800 | 연재 작가 2500 | 히트 작가 7000 | 만화의 신 18000 |
| comedian | 개그맨 | 🎭 | spin | sen | 신인 개그맨 300 {sen:E} | 감초 개그맨 900 | 고정 출연 3000 | MC 9000 | 국민 MC 28000 |
| freelancer | 프리랜서 | 🎒 | free | sen | 프리랜서 300 (조건 없음) | — | — | — | — |

- 17종 목록 [원작], 회사원·의사 수치 [원작], 나머지 [추정].

### 동아리 `CLUBS` [추정]
| id | name | desc | eff |
|---|---|---|---|
| study | 공부 동아리 | 지력 +12 | `{int:12}` |
| sports | 운동부 | 체력 +12 | `{phy:12}` |
| art | 미술·음악부 | 센스 +12 | `{sen:12}` |
| home | 귀가부 | 능력치 +4씩, 용돈 +100만 | `{int:4,phy:4,sen:4,money:100}` |

진로(`CAREER_OPTIONS`) [추정]: 0 `대학 진학` desc '학비 800만 / 지력 +12, 센스 +4'(돈 −800, int +12, sen +4, college true), 1 `바로 취직` desc '취업 축하금 +300만 / 체력 +5'(돈 +300, phy +5).

### 연애 `PARTNERS` (★는 게임마다 무작위)
| id | 이름 | 직업 | 성격 | 색 |
|---|---|---|---|---|
| jiwoo | 지우 | 연구원 | int | #74c0fc |
| sua | 수아 | 변호사 | int | #b197fc |
| junho | 준호 | 의사 | int | #63e6be |
| haeun | 하은 | 교수 | int | #91a7ff |
| minjun | 민준 | 소방관 | phy | #ff8787 |
| siwoo | 시우 | 축구 선수 | phy | #ffa94d |
| daon | 다온 | 요가 강사 | phy | #8ce99a |
| taeo | 태오 | 경찰관 | phy | #4dabf7 |
| seoyeon | 서연 | 간호사 | sen | #ffa8a8 |
| harin | 하린 | 가수 | sen | #f783ac |
| yerin | 예린 | 화가 | sen | #e599f7 |
| doyun | 도윤 | 셰프 | sen | #ffd43b |

- `STAR_WEIGHTS = [30,30,25,10,5]` (★1~★5), `STAR_GAIN = [1.3,1.1,1.0,0.8,0.6]`, `DATE_BASE = 15`, `PROPOSE_AT = 60`, `DATE_COST = 200`.
- `PERSONALITY_NAMES` = int 지력형, phy 체력형, sen 센스형. `PERSONALITY_CARD` = int→study, phy→gym, sen→artclass.

### 카드 `CARDS`
| id | name | desc | timing |
|---|---|---|---|
| fixed | 지정 룰렛 카드 | 원하는 숫자(1~10)만큼 전진 | spin |
| double | 더블 카드 | 룰렛 결과의 2배만큼 전진 | spin |
| insurance | 보험 카드 | 다음 유령 칸의 손해를 1번 막아줌 (자동) | passive |
| bonus | 보너스 카드 | 즉시 월급(용돈) 1회분을 받음 | now |
| study | 학습 코스 카드 | 지력 +10 | now |
| gym | 헬스 회원권 카드 | 체력 +10 | now |
| artclass | 아트 교실 카드 | 센스 +10 | now |
| charm | 행운의 부적 | 운세 +1 | now |
| steal | 가로채기 카드 | 가장 부자인 상대에게서 500만 받기 | now |
| rankup | 승진 카드 | 직업 랭크 즉시 +1 (조건 무시) | now, adultOnly |

`CARD_POOL = ['fixed','fixed','double','insurance','insurance','bonus','study','gym','artclass','charm','steal','rankup']`, `HAND_MAX = 5`.

### 보물·집·경제 [추정]
- `TREASURES` (이름, base): 네잎클로버 책갈피 100, 오래된 우표 300, 수상한 항아리 800, 금빛 조개껍데기 500, 할아버지의 회중시계 1200, 운석 조각 2000, 명화(?) 3000, 보석 반지 4000, 공룡 화석 5000.
- `TREASURE_MULT = [0.1,0.3,0.5,0.8,1,1.2,1.5,2,3,5]` (룰렛 1~10).
- `HOUSES` (id, 이름, 가격): apt 아담한 아파트 3000, house 마당 있는 단독주택 8000, mansion 호화 저택 20000, castle 바닷가 성 45000.
- `NOTE_UNIT = 1000`, `NOTE_REPAY = 1200`, `KID_GIFT = 1000`, `GOAL_BONUS = [10000,5000,3000,1000]`, `AWARD_BONUS = 3000`, `WEDDING_GIFT = 300`, `BIRTH_GIFT = 100`, `ADULT_START_MONEY = 300`, `PENSION_RATE = 0.3`, `MIN_ALLOWANCE = 20`, `MIN_SALARY_UNIT = 300`, `LOG_MAX = 40`.
- `KID_NAMES = ['콩이','별이','봄이','솔이','달이','해피','토리','루루','도리','보리']`.

### 아바타
- `AVATAR_DEFAULT = { skin:'#f5d0b0', hair:'#4a3020', shirt:'#ff6b6b', pants:'#364fc7', hairStyle:0, face:0 }`.
- `AVATAR_OPTIONS`: skin `['#ffe0c7','#f5d0b0','#e0ac7e','#b97a50','#7a4b2e']`, hair `['#2b2b2b','#4a3020','#8a5a2b','#e0b050','#c0392b','#7950f2','#4dabf7']`, shirt `['#ff6b6b','#ff922b','#fcc419','#51cf66','#22b8cf','#4c6ef5','#cc5de8','#f06595']`, pants `['#364fc7','#495057','#5c940d','#862e9c','#e8590c']`, hairStyles `['숏컷','삐죽','롱헤어','똥머리']`, faces `['기본','웃는 눈','안경']`.

## 동작 규칙
1. `gradeIndex(v)`: `GRADE_MIN[i] ≤ v` 인 가장 큰 i. `gradeOf(v) = GRADES[gradeIndex(v)]`. `gradeValue(g) = GRADE_MIN[GRADES.indexOf(g)]`.
2. `jobById(id)`: `JOBS` 에서 id 가 같은 직업.
3. `meetsReq(pl, rank)`: rank 가 없으면 false. `req` 의 모든 능력치가 `pl.stats[k] ≥ gradeValue(req[k])` 이고, `fortune` 이 있으면 `pl.fortune ≥ fortune` 일 때 true.

## 경계 조건
- `gradeIndex(0) = 0`, `gradeIndex(9) = 0`, `gradeIndex(10) = 1`, `gradeIndex(100) = 7`.
- 조건 없는 랭크(`req` 없음)는 항상 true.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | `gradeOf(44)`, `gradeOf(45)`, `gradeOf(90)` | 'D', 'C', 'S' |
| 2 | — | `JOBS.length`, 각 직업 랭크 수 | 17, 프리랜서 1 나머지 5 |
| 3 | stats int 75 sen 60 fortune 4 | `meetsReq(회사원 5랭크)` | false (운세 부족), fortune 5 면 true |
| 4 | stats int 20 | `meetsReq(회사원 1랭크)` | true, int 19 면 false |
| 5 | — | `CARD_POOL` 에서 fixed·insurance 개수 | 각 2, 전체 12 |
| 6 | — | `ERAS.map(e=>e.turns)` | [2,4,4,4,15,15,null] |
| 7 | — | `meetsReq(프리랜서 1랭크)` | true |

## 참조
없음.
