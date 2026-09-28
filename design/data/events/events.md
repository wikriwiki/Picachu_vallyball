---
pyramid: leaf
id: events
title: 이벤트 문구표
parent: ../data.md
status: implemented
---

> **작성 규칙 — 이 파일을 읽거나 고치기 전에 확인**
> - 작업 전 pyramid-design 스킬의 「행동수칙」을 다시 읽는다.
> - 부모: [게임 데이터](../data.md) 의 「자식 구성요소」 중 `이벤트 문구표` 항목을 전개한 leaf 다. 부모 「통합 방식」이 요구하는 인터페이스를 그대로 구체화한다. (R3)
> - leaf 판정 기준 L1~L8 을 모두 만족해야 `designed` 가 된다. 하나라도 어려우면 node 로 바꿔 쪼갠다. (R6)
> - 구현은 이 파일의 「인터페이스」·「동작 규칙」·「경계 조건」·「테스트 케이스」만을 근거로 한다. 여기 없는 결정은 코드보다 이 파일에 먼저 적는다. (R1)
> - 이 파일이 바뀌면: 연결된 코드를 `reopen` 후 재구현하고, ↑ 부모 「통합 방식」 영향을 검토한다. (references/change-protocol.md)

# 이벤트 문구표

## 정의
칸 효과가 뽑는 문구와 효과의 표다. 별 칸 Lv1·Lv2(시대별 이벤트), 별 칸 Lv3, 물방울 칸 문구와 능력치 변동표, 유령 칸, 하트 칸, 선택 칸을 담는다. 모든 수치는 [추정], 금액 만원.

## 인터페이스
- 구현 위치: `src/data/events/events.ts`, 테스트 `src/data/events/events.test.ts`
- 형태: `readonly` 상수. 아래 표를 순서 그대로 옮긴다 (뽑기는 표 순서의 번호로 하므로 순서가 결과에 영향).
- 공개 타입:
  ```ts
  export interface Effect {
    money?: number | 'salary' | 'salary2';   // 'salary' 월급 1회분, 'salary2' 2회분
    int?: number; phy?: number; sen?: number; fortune?: number;
    love?: number;       // 상대가 있으면 호감도 +10×love
    card?: number;       // 카드 n장 획득
    treasure?: number;   // 보물 n개 획득
    gamble?: number;     // 투자 룰렛 (이 금액)
  }
  export interface EventEntry { t: string; e: Effect; }
  export interface TextEntry { t: string; }
  export interface ChoiceEntry { t: string; o: readonly { l: string; e: Effect }[]; }
  export const EVENTS: Readonly<Record<'baby' | 'elem' | 'middle' | 'high' | 'adult' | 'final', readonly EventEntry[]>>;
  export const STAR3: Readonly<Record<'kid' | 'adult', readonly EventEntry[]>>;
  export const HIYARI: Readonly<Record<'baby' | 'kid' | 'adult' | 'final', readonly TextEntry[]>>;
  export const HIYARI_SPIN: readonly number[];   // 룰렛 1~10 → 능력치 변동
  export const GHOST: Readonly<Record<'baby' | 'kid' | 'adult' | 'final', readonly EventEntry[]>>;
  export const LOVE: Readonly<Record<'married', readonly EventEntry[]>>;
  export const CHOICES: Readonly<Record<'kid' | 'teen' | 'adult' | 'final', readonly ChoiceEntry[]>>;
  ```

### EVENTS (별 칸 Lv1·Lv2)
- **baby**: 처음으로 "엄마"라고 말했다! {int:5} / 기어다니다가 거실을 탐험했다. {phy:5} / 크레파스로 벽에 대작을 그렸다. {sen:5} / 돌잡이에서 연필을 잡았다! {int:8} / 돌잡이에서 공을 잡았다! {phy:8} / 돌잡이에서 마이크를 잡았다! {sen:8} / 백일 사진이 너무 귀엽게 나왔다. {fortune:1} / 할머니가 세뱃돈을 주셨다. {money:30} / 밤새 울어서 가족 모두 잠을 못 잤다... {fortune:-1,phy:3}
- **elem**: 받아쓰기 100점! {int:6} / 운동회 달리기에서 1등! {phy:6} / 그림 대회에서 입상했다. {sen:6,money:20} / 여름방학 숙제를 개학 전날 몰아서 했다. {int:2,fortune:-1} / 줄넘기 2단 뛰기 성공! {phy:4,sen:2} / 도서관 책을 30권 읽었다. {int:8} / 리코더 연주회에서 박수를 받았다. {sen:5} / 친구와 딱지치기로 동네를 제패했다. {phy:3,fortune:1} / 저금통을 깼다! {money:50}
- **middle**: 중간고사 전교 10등! {int:8} / 체육대회 반 대표로 뛰었다. {phy:7} / 축제 무대에서 춤을 췄다. {sen:7,love:1} / 게임에 빠져 성적이 떨어졌다... {int:-4,sen:3} / 수학여행에서 추억을 만들었다. {fortune:1,sen:3} / 학원 숙제에 치였다. {int:5,phy:-2} / 태권도 검은띠 획득! {phy:8} / 용돈을 모아 첫 적금! {money:80} / 사춘기가 왔다. 방문을 쾅! {fortune:-1,sen:4}
- **high**: 모의고사 전국 상위권! {int:10} / 전국 체전에 출전했다. {phy:10} / 밴드부 공연이 대박났다. {sen:10,love:1} / 야간 자율학습 개근상! {int:6,phy:-2} / 편의점 아르바이트를 했다. {money:150,phy:2} / 학생회장에 당선됐다! {int:4,sen:4,fortune:1} / 수능 D-100, 체력이 바닥났다. {phy:-4,int:5} / 졸업 앨범 사진이 레전드로 남았다. {sen:3,fortune:1} / 길거리 캐스팅 제의를 받았다! {sen:8}
- **adult**: 자격증 시험에 합격했다. {int:6,money:200} / 마라톤 풀코스 완주! {phy:6} / 주말 공방에서 도자기를 배웠다. {sen:6,money:-100} / 성과급이 나왔다! {money:'salary'} / 주식이 올랐다! {money:1500} / 동창회에서 인맥을 넓혔다. {sen:4,fortune:1} / 해외 출장으로 견문을 넓혔다. {int:4,sen:4} / 사내 체육대회 MVP! {phy:5,money:300} / 야근 연속 30일... {phy:-5,money:500} / 로또 3등 당첨! {money:1000} / 이사 비용이 들었다. {money:-800} / 가족 여행을 다녀왔다. {money:-500,fortune:1}
- **final**: 손주가 놀러 왔다! {fortune:1} / 세계 일주 크루즈 여행! {money:-3000,sen:5} / 텃밭 채소가 풍년이다. {money:300,phy:3} / 자서전을 출간했다. {money:2000,int:3} / 마을 바둑 대회 우승! {int:5,money:500} / 연금이 조금 올랐다. {money:800} / 건강검진 결과 모두 A! {phy:5,fortune:1} / 골동품 가게에서 뭔가 샀다. {treasure:1,money:-300}

### STAR3 (별 칸 Lv3)
- **kid**: 신동으로 신문에 소개됐다! {int:10,sen:5,fortune:1} / 길에서 반짝이는 보물을 주웠다! {treasure:1,money:100} / 네잎클로버 들판을 발견했다! {fortune:2,card:1} / 전국 대회에서 우승했다! {phy:10,sen:5,money:100}
- **adult**: 숨겨진 보물을 발견했다! {treasure:1,money:1000} / 복권 1등 당첨!! {money:5000} / 먼 친척의 유산을 받았다. {money:3000,treasure:1} / 행운의 여신이 미소지었다. {fortune:2,card:1} / 특별 보너스가 나왔다! {money:'salary2'}

### HIYARI (물방울 칸 문구, 효과 없음)
- **baby**: 아슬아슬! 소파에서 떨어질 뻔했다. / 아슬아슬! 장난감을 삼킬 뻔했다!
- **kid**: 아슬아슬! 계단에서 미끄러질 뻔했다. / 아슬아슬! 숙제를 두고 올 뻔했다. / 아슬아슬! 지각할 뻔했다. / 아슬아슬! 자전거와 부딪힐 뻔했다.
- **adult**: 아슬아슬! 중요한 회의를 잊을 뻔했다. / 아슬아슬! 차 사고가 날 뻔했다. / 아슬아슬! 마감 직전에 서류를 냈다. / 아슬아슬! 지갑을 잃어버릴 뻔했다.
- **final**: 아슬아슬! 빙판길에서 넘어질 뻔했다. / 아슬아슬! 약 먹는 걸 잊을 뻔했다.
- `HIYARI_SPIN = [-12,-10,-8,-6,-5,-4,-3,-2,3,6]`

### GHOST (유령 칸)
- **baby**: 으앙! 심한 감기에 걸렸다. {phy:-6} / 무서운 꿈을 꾸고 밤새 울었다. {sen:-4,int:-2}
- **kid**: 계단에서 굴러 다리가 부러졌다. {phy:-10} / 시험지를 통째로 잃어버렸다... {int:-8} / 모아둔 용돈을 몽땅 잃어버렸다. {money:-150} / 친구와 크게 싸워 절교했다. {sen:-6} / 엄마 스마트폰을 떨어뜨려 박살냈다. {money:-200}
- **adult**: 대형 교통사고! 수리비와 병원비가... {money:-3000} / 보이스피싱에 당했다... {money:-4000} / 허리 디스크로 입원했다. {phy:-10,money:-800} / 투자한 코인이 대폭락했다. {money:-6000} / 집이 물에 잠겼다. {money:-2000} / 세금 폭탄을 맞았다! {money:-2500}
- **final**: 큰 병으로 입원했다. {money:-5000} / 사기꾼에게 노후 자금을 뜯겼다. {money:-3000} / 틀니를 잃어버렸다. {money:-800}

### LOVE (기혼자의 하트 칸)
- **married**: 결혼기념일 서프라이즈! {money:-300,fortune:1} / 배우자와 맛집 투어. {money:-200,sen:3} / 부부 싸움 후 화해했다. {fortune:1}

### CHOICES (선택 칸)
- **kid**: 방과 후에 무엇을 할까? [학원에 간다 {int:6} · 놀이터에서 논다 {phy:6} · 그림을 그린다 {sen:6}] / 세뱃돈을 어떻게 할까? [저금한다 {money:60} · 책을 산다 {int:5,money:10} · 게임기를 산다 {sen:4,fortune:1}]
- **teen**: 주말 계획은? [독서실 {int:8} · 헬스장 {phy:8} · 버스킹 {sen:8}] / 방학 때 무엇을 할까? [아르바이트 {money:200} · 어학연수 {int:6,sen:3,money:-100} · 봉사활동 {fortune:1,phy:3}]
- **adult**: 보너스를 어디에 쓸까? [투자한다 (룰렛 5 이상이면 3배) {gamble:1000} · 자기계발 {int:5,sen:5,money:-300} · 저축한다 {money:500}] / 휴가 계획은? [헬스 합숙 {phy:8,money:-300} · 대학원 강의 {int:8,money:-400} · 해외여행 {sen:8,money:-500}] / 친구가 창업을 제안했다! [투자한다 (룰렛 5 이상이면 3배) {gamble:2000} · 거절한다 {fortune:1}]
- **final**: 노후를 어떻게 보낼까? [봉사활동 {fortune:1} · 투자 (룰렛 5 이상이면 3배) {gamble:3000} · 취미 생활 {sen:6,money:-200}]

## 동작 규칙
1. 표의 항목 순서와 문구·효과를 그대로 옮긴다.
2. `HIYARI_SPIN[v - 1]` 이 룰렛 값 v 의 능력치 변동이다.

## 경계 조건
- 문구의 따옴표·말줄임표·느낌표를 바꾸지 않는다.

## 테스트 케이스
| # | Given | When | Then |
|---|---|---|---|
| 1 | — | 표별 항목 수 | EVENTS baby 9, elem 9, middle 9, high 9, adult 12, final 8; STAR3 kid 4, adult 5; HIYARI 2/4/4/2; GHOST 2/5/6/3; LOVE.married 3; CHOICES kid 2, teen 2, adult 3, final 1 |
| 2 | — | `HIYARI_SPIN` | 길이 10, 합 −41 |
| 3 | — | `EVENTS.adult[3].e.money` | 'salary' |
| 4 | — | `CHOICES.adult[2].o[0].e.gamble` | 2000 |

## 참조
없음.
