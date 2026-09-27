// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 인생게임 for Nintendo Switch 스타일 — 게임 데이터
// 금액 단위: 만원
// ※ 출처(공략 사이트)에서 확인된 값: 회사원/의사 직급·월급, 능력치 등급(G~S), 운세(대길), 7개 시대 구성.
//   그 외 수치(다른 직업 월급, 이벤트 금액 등)는 추정치이며 이 파일에서 조정할 수 있습니다.

export const GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
export const GRADE_MIN = [0, 10, 20, 30, 45, 60, 75, 90];
export const STAT_MAX = 100;

export function gradeIndex(v) {
  let g = 0;
  for (let i = 0; i < GRADE_MIN.length; i++) if (v >= GRADE_MIN[i]) g = i;
  return g;
}
export const gradeOf = (v) => GRADES[gradeIndex(v)];
export const gradeValue = (letter) => GRADE_MIN[GRADES.indexOf(letter)];

export const FORTUNES = ['대흉', '흉', '말길', '길', '중길', '대길', '초대길'];
export const FORTUNE_START = 3;

export const STAT_NAMES = { int: '지력', phy: '체력', sen: '센스' };

// 시대(스테이지). turns=null 은 턴 제한 없음(골까지).
export const ERAS = [
  { id: 'baby', name: '아기 시절', turns: 2, len: 14, allowance: 0, color: 0xffc8dd, ground: 0xbde0a8 },
  { id: 'elem', name: '초등학생 시절', turns: 4, len: 28, allowance: 20, color: 0xffe066, ground: 0x9ad07a },
  { id: 'middle', name: '중학생 시절', turns: 4, len: 28, allowance: 40, color: 0x74c0fc, ground: 0x86c46d },
  { id: 'high', name: '고등학생 시절', turns: 4, len: 28, allowance: 60, color: 0x9775fa, ground: 0x7ab862 },
  { id: 'adult1', name: '어른 시절 전반', turns: 7, len: 46, allowance: 0, color: 0xff8787, ground: 0x8cc06a },
  { id: 'adult2', name: '어른 시절 후반', turns: 7, len: 46, allowance: 0, color: 0xffa94d, ground: 0x9cc46e },
  { id: 'final', name: '마지막 시절', turns: null, len: 32, allowance: 0, color: 0xc0a0ff, ground: 0xb5c98a },
];
export const ADULT_ERA = 4;
export const FINAL_ERA = 6;

export const TILE_INFO = {
  start: { name: '출발', color: 0xffffff },
  event: { name: '이벤트', color: 0x4dabf7 },
  lucky: { name: '럭키', color: 0xffd43b },
  payday: { name: '월급날', color: 0x51cf66 },
  love: { name: '연애', color: 0xff8fab },
  hiyari: { name: '아찔', color: 0xfa5252 },
  choice: { name: '선택', color: 0xb197fc },
  card: { name: '카드', color: 0xff922b },
  challenge: { name: '랭크업 찬스', color: 0x22b8cf },
  baby: { name: '아기', color: 0xf783ac },
  stop: { name: 'STOP', color: 0xe03131 },
  end: { name: '다음 시대로', color: 0xffffff },
  goal: { name: 'GOAL', color: 0xffd700 },
};

// 직업. type: 'stat'=능력치 충족 시 월급날 자동 승진, 'spin'=랭크업 찬스 칸에서 룰렛 성공 시 승진, 'free'=프리랜서
export const JOBS = [
  { id: 'office', name: '회사원', icon: '💼', type: 'stat', key: 'int', ranks: [
    { name: '일반 사원', salary: 600, req: { int: 'E' } },
    { name: '과장', salary: 1200, req: { int: 'D', sen: 'E' } },
    { name: '부장', salary: 2400, req: { int: 'C', sen: 'D' } },
    { name: '사장', salary: 6000, req: { int: 'B', sen: 'C' } },
    { name: '회장', salary: 18000, req: { int: 'A', sen: 'B' }, fortune: 5 },
  ] },
  { id: 'doctor', name: '의사', icon: '🩺', type: 'stat', key: 'int', ranks: [
    { name: '연수의', salary: 900, req: { int: 'C', phy: 'F' } },
    { name: '신인 의사', salary: 1800, req: { int: 'B', phy: 'E' } },
    { name: '어엿한 의사', salary: 4500, req: { int: 'B', phy: 'D' } },
    { name: '실력파 의사', salary: 6300, req: { int: 'A', phy: 'C' } },
    { name: '신의 손 원장', salary: 18000, req: { int: 'S', phy: 'C' } },
  ] },
  { id: 'teacher', name: '교사', icon: '📚', type: 'stat', key: 'int', ranks: [
    { name: '교생', salary: 500, req: { int: 'D' } },
    { name: '담임 선생님', salary: 1000, req: { int: 'C', sen: 'E' } },
    { name: '학년 주임', salary: 2000, req: { int: 'C', sen: 'D' } },
    { name: '교감', salary: 4000, req: { int: 'B', sen: 'D' } },
    { name: '교장', salary: 9000, req: { int: 'A', sen: 'C' } },
  ] },
  { id: 'police', name: '경찰관', icon: '👮', type: 'stat', key: 'phy', ranks: [
    { name: '순경', salary: 600, req: { phy: 'D' } },
    { name: '경사', salary: 1200, req: { phy: 'C', int: 'E' } },
    { name: '경위', salary: 2500, req: { phy: 'B', int: 'D' } },
    { name: '경정', salary: 5000, req: { phy: 'A', int: 'C' } },
    { name: '경찰청장', salary: 12000, req: { phy: 'S', int: 'B' } },
  ] },
  { id: 'scientist', name: '과학자', icon: '🔬', type: 'stat', key: 'int', ranks: [
    { name: '연구원', salary: 800, req: { int: 'C' } },
    { name: '주임 연구원', salary: 1600, req: { int: 'B' } },
    { name: '부교수', salary: 3500, req: { int: 'B', sen: 'D' } },
    { name: '교수', salary: 7000, req: { int: 'A', sen: 'C' } },
    { name: '노벨상 학자', salary: 20000, req: { int: 'S', sen: 'B' } },
  ] },
  { id: 'chef', name: '요리사', icon: '🍳', type: 'stat', key: 'sen', ranks: [
    { name: '견습 요리사', salary: 400, req: { sen: 'D' } },
    { name: '요리사', salary: 900, req: { sen: 'C' } },
    { name: '셰프', salary: 2000, req: { sen: 'B', phy: 'D' } },
    { name: '오너 셰프', salary: 5000, req: { sen: 'A', phy: 'C' } },
    { name: '전설의 셰프', salary: 15000, req: { sen: 'S', phy: 'B' } },
  ] },
  { id: 'politician', name: '정치인', icon: '🏛️', type: 'stat', key: 'int', ranks: [
    { name: '비서', salary: 700, req: { int: 'D', sen: 'D' } },
    { name: '시의원', salary: 1500, req: { int: 'C', sen: 'C' } },
    { name: '국회의원', salary: 4000, req: { int: 'B', sen: 'C' } },
    { name: '장관', salary: 8000, req: { int: 'A', sen: 'B' } },
    { name: '대통령', salary: 20000, req: { int: 'S', sen: 'A' }, fortune: 5 },
  ] },
  { id: 'baseball', name: '야구 선수', icon: '⚾', type: 'spin', key: 'phy', ranks: [
    { name: '2군 선수', salary: 500, req: { phy: 'D' } },
    { name: '1군 선수', salary: 1500 },
    { name: '주전 선수', salary: 4000 },
    { name: '스타 선수', salary: 9000 },
    { name: '메이저리거', salary: 25000 },
  ] },
  { id: 'soccer', name: '축구 선수', icon: '⚽', type: 'spin', key: 'phy', ranks: [
    { name: '유스 선수', salary: 500, req: { phy: 'D' } },
    { name: '프로 선수', salary: 1500 },
    { name: '국가대표', salary: 5000 },
    { name: '에이스', salary: 10000 },
    { name: '세계 최고 선수', salary: 28000 },
  ] },
  { id: 'basketball', name: '농구 선수', icon: '🏀', type: 'spin', key: 'phy', ranks: [
    { name: '연습생', salary: 500, req: { phy: 'D' } },
    { name: '벤치 멤버', salary: 1400 },
    { name: '주전 멤버', salary: 4500 },
    { name: 'MVP', salary: 10000 },
    { name: '레전드', salary: 28000 },
  ] },
  { id: 'fighter', name: '격투가', icon: '🥊', type: 'spin', key: 'phy', ranks: [
    { name: '수련생', salary: 400, req: { phy: 'C' } },
    { name: '프로 파이터', salary: 1200 },
    { name: '챔피언', salary: 4000 },
    { name: '통합 챔피언', salary: 9000 },
    { name: '격투의 신', salary: 22000 },
  ] },
  { id: 'actor', name: '배우', icon: '🎬', type: 'spin', key: 'sen', ranks: [
    { name: '엑스트라', salary: 400, req: { sen: 'D' } },
    { name: '조연', salary: 1200 },
    { name: '주연', salary: 4000 },
    { name: '톱스타', salary: 9000 },
    { name: '월드 스타', salary: 24000 },
  ] },
  { id: 'idol', name: '아이돌', icon: '🎤', type: 'spin', key: 'sen', ranks: [
    { name: '연습생', salary: 300, req: { sen: 'D' } },
    { name: '신인 아이돌', salary: 1000 },
    { name: '인기 아이돌', salary: 4000 },
    { name: '톱 아이돌', salary: 10000 },
    { name: '레전드 아이돌', salary: 25000 },
  ] },
  { id: 'creator', name: '크리에이터', icon: '📹', type: 'spin', key: 'sen', ranks: [
    { name: '새내기 크리에이터', salary: 200, req: { sen: 'E' } },
    { name: '인기 크리에이터', salary: 1000 },
    { name: '실버 버튼', salary: 3000 },
    { name: '골드 버튼', salary: 8000 },
    { name: '다이아 버튼', salary: 22000 },
  ] },
  { id: 'manga', name: '만화가', icon: '✏️', type: 'spin', key: 'sen', ranks: [
    { name: '어시스턴트', salary: 300, req: { sen: 'D' } },
    { name: '신인 만화가', salary: 800 },
    { name: '연재 작가', salary: 2500 },
    { name: '히트 작가', salary: 7000 },
    { name: '만화의 신', salary: 18000 },
  ] },
  { id: 'comedian', name: '개그맨', icon: '🎭', type: 'spin', key: 'sen', ranks: [
    { name: '신인 개그맨', salary: 300, req: { sen: 'E' } },
    { name: '감초 개그맨', salary: 900 },
    { name: '고정 출연', salary: 3000 },
    { name: 'MC', salary: 9000 },
    { name: '국민 MC', salary: 28000 },
  ] },
  { id: 'freelancer', name: '프리랜서', icon: '🎒', type: 'free', key: 'sen', ranks: [
    { name: '프리랜서', salary: 300 },
  ] },
];
export const jobById = (id) => JOBS.find((j) => j.id === id);

export function meetsReq(player, rank) {
  if (!rank) return false;
  if (rank.req) {
    for (const k of Object.keys(rank.req)) {
      if (player.stats[k] < gradeValue(rank.req[k])) return false;
    }
  }
  if (rank.fortune != null && player.fortune < rank.fortune) return false;
  return true;
}

// 부활동 (중·고등학생 시대 시작 시 선택)
export const CLUBS = [
  { id: 'study', name: '공부 동아리', desc: '지력 +12', eff: { int: 12 } },
  { id: 'sports', name: '운동부', desc: '체력 +12', eff: { phy: 12 } },
  { id: 'art', name: '미술·음악부', desc: '센스 +12', eff: { sen: 12 } },
  { id: 'home', name: '귀가부', desc: '능력치 +4씩, 용돈 +100만', eff: { int: 4, phy: 4, sen: 4, money: 100 } },
];

// 카드
export const CARDS = {
  fixed: { name: '지정 룰렛 카드', desc: '원하는 숫자(1~10)만큼 전진', timing: 'spin' },
  double: { name: '더블 카드', desc: '룰렛 결과의 2배만큼 전진', timing: 'spin' },
  insurance: { name: '보험 카드', desc: '다음 아찔 칸의 손해를 1번 막아줌 (자동)', timing: 'passive' },
  bonus: { name: '보너스 카드', desc: '즉시 월급(용돈) 1회분을 받음', timing: 'now' },
  study: { name: '학습 코스 카드', desc: '지력 +10', timing: 'now' },
  gym: { name: '헬스 회원권 카드', desc: '체력 +10', timing: 'now' },
  artclass: { name: '아트 교실 카드', desc: '센스 +10', timing: 'now' },
  charm: { name: '행운의 부적', desc: '운세 +1', timing: 'now' },
  steal: { name: '가로채기 카드', desc: '가장 부자인 상대에게서 500만 받기', timing: 'now' },
  rankup: { name: '승진 카드', desc: '직업 랭크 즉시 +1 (조건 무시)', timing: 'now', adultOnly: true },
};
export const CARD_POOL = ['fixed', 'fixed', 'double', 'insurance', 'insurance', 'bonus', 'study', 'gym', 'artclass', 'charm', 'steal', 'rankup'];
export const HAND_MAX = 5;

// 보물 (럭키 칸에서 획득, 결과 발표에서 감정)
export const TREASURES = [
  { name: '네잎클로버 책갈피', base: 100 }, { name: '오래된 우표', base: 300 }, { name: '수상한 항아리', base: 800 },
  { name: '금빛 조개껍데기', base: 500 }, { name: '할아버지의 회중시계', base: 1200 }, { name: '운석 조각', base: 2000 },
  { name: '명화(?)', base: 3000 }, { name: '보석 반지', base: 4000 }, { name: '공룡 화석', base: 5000 },
];

// 집 (어른 시절 후반 STOP 칸)
export const HOUSES = [
  { id: 'apt', name: '아담한 아파트', price: 3000 },
  { id: 'house', name: '마당 있는 단독주택', price: 8000 },
  { id: 'mansion', name: '호화 저택', price: 20000 },
  { id: 'castle', name: '바닷가 성', price: 45000 },
];

export const NOTE_UNIT = 1000; // 약속어음 1장 = 1000만
export const NOTE_REPAY = 1200; // 결과 발표 시 1장당 상환액
export const KID_GIFT = 1000; // 결과 발표 시 자녀 1명당 효도 선물
export const GOAL_BONUS = [10000, 5000, 3000, 1000];
export const AWARD_BONUS = 3000;
export const WEDDING_GIFT = 300;
export const BIRTH_GIFT = 100;

export const SPOUSE_NAMES = ['지우', '하늘', '서연', '민준', '유나', '도윤', '수아', '시우', '예린', '준호', '다온', '하린'];
export const KID_NAMES = ['콩이', '별이', '봄이', '솔이', '달이', '해피', '토리', '루루', '도리', '보리'];

// 이벤트. e: 효과 {money, int, phy, sen, fortune, love, card, treasure}
// money 가 문자열 'salary' 이면 월급 배수.
const K = 'kid';
export const EVENTS = {
  baby: [
    { t: '처음으로 "엄마"라고 말했다!', e: { int: 5 } },
    { t: '기어다니다가 거실을 탐험했다.', e: { phy: 5 } },
    { t: '크레파스로 벽에 대작을 그렸다.', e: { sen: 5 } },
    { t: '돌잡이에서 연필을 잡았다!', e: { int: 8 } },
    { t: '돌잡이에서 공을 잡았다!', e: { phy: 8 } },
    { t: '돌잡이에서 마이크를 잡았다!', e: { sen: 8 } },
    { t: '백일 사진이 너무 귀엽게 나왔다.', e: { fortune: 1 } },
    { t: '할머니가 세뱃돈을 주셨다.', e: { money: 30 } },
    { t: '밤새 울어서 가족 모두 잠을 못 잤다...', e: { fortune: -1, phy: 3 } },
  ],
  elem: [
    { t: '받아쓰기 100점!', e: { int: 6 } },
    { t: '운동회 달리기에서 1등!', e: { phy: 6 } },
    { t: '그림 대회에서 입상했다.', e: { sen: 6, money: 20 } },
    { t: '여름방학 숙제를 개학 전날 몰아서 했다.', e: { int: 2, fortune: -1 } },
    { t: '줄넘기 2단 뛰기 성공!', e: { phy: 4, sen: 2 } },
    { t: '도서관 책을 30권 읽었다.', e: { int: 8 } },
    { t: '리코더 연주회에서 박수를 받았다.', e: { sen: 5 } },
    { t: '친구와 딱지치기로 동네를 제패했다.', e: { phy: 3, fortune: 1 } },
    { t: '저금통을 깼다!', e: { money: 50 } },
  ],
  middle: [
    { t: '중간고사 전교 10등!', e: { int: 8 } },
    { t: '체육대회 반 대표로 뛰었다.', e: { phy: 7 } },
    { t: '축제 무대에서 춤을 췄다.', e: { sen: 7, love: 1 } },
    { t: '게임에 빠져 성적이 떨어졌다...', e: { int: -4, sen: 3 } },
    { t: '수학여행에서 추억을 만들었다.', e: { fortune: 1, sen: 3 } },
    { t: '학원 숙제에 치였다.', e: { int: 5, phy: -2 } },
    { t: '태권도 검은띠 획득!', e: { phy: 8 } },
    { t: '용돈을 모아 첫 적금!', e: { money: 80 } },
    { t: '사춘기가 왔다. 방문을 쾅!', e: { fortune: -1, sen: 4 } },
  ],
  high: [
    { t: '모의고사 전국 상위권!', e: { int: 10 } },
    { t: '전국 체전에 출전했다.', e: { phy: 10 } },
    { t: '밴드부 공연이 대박났다.', e: { sen: 10, love: 1 } },
    { t: '야간 자율학습 개근상!', e: { int: 6, phy: -2 } },
    { t: '편의점 아르바이트를 했다.', e: { money: 150, phy: 2 } },
    { t: '학생회장에 당선됐다!', e: { int: 4, sen: 4, fortune: 1 } },
    { t: '수능 D-100, 체력이 바닥났다.', e: { phy: -4, int: 5 } },
    { t: '졸업 앨범 사진이 레전드로 남았다.', e: { sen: 3, fortune: 1 } },
    { t: '길거리 캐스팅 제의를 받았다!', e: { sen: 8 } },
  ],
  adult: [
    { t: '자격증 시험에 합격했다.', e: { int: 6, money: 200 } },
    { t: '마라톤 풀코스 완주!', e: { phy: 6 } },
    { t: '주말 공방에서 도자기를 배웠다.', e: { sen: 6, money: -100 } },
    { t: '성과급이 나왔다!', e: { money: 'salary' } },
    { t: '주식이 올랐다!', e: { money: 1500 } },
    { t: '동창회에서 인맥을 넓혔다.', e: { sen: 4, fortune: 1 } },
    { t: '해외 출장으로 견문을 넓혔다.', e: { int: 4, sen: 4 } },
    { t: '사내 체육대회 MVP!', e: { phy: 5, money: 300 } },
    { t: '야근 연속 30일...', e: { phy: -5, money: 500 } },
    { t: '로또 3등 당첨!', e: { money: 1000 } },
    { t: '이사 비용이 들었다.', e: { money: -800 } },
    { t: '가족 여행을 다녀왔다.', e: { money: -500, fortune: 1 } },
  ],
  final: [
    { t: '손주가 놀러 왔다!', e: { fortune: 1 } },
    { t: '세계 일주 크루즈 여행!', e: { money: -3000, sen: 5 } },
    { t: '텃밭 채소가 풍년이다.', e: { money: 300, phy: 3 } },
    { t: '자서전을 출간했다.', e: { money: 2000, int: 3 } },
    { t: '마을 바둑 대회 우승!', e: { int: 5, money: 500 } },
    { t: '연금이 조금 올랐다.', e: { money: 800 } },
    { t: '건강검진 결과 모두 A!', e: { phy: 5, fortune: 1 } },
    { t: '골동품 가게에서 뭔가 샀다.', e: { treasure: 1, money: -300 } },
  ],
};

export const HIYARI = {
  baby: [
    { t: '감기에 걸렸다. 콜록콜록.', e: { phy: -3 } },
    { t: '장난감을 삼킬 뻔했다!', e: { fortune: -1 } },
  ],
  kid: [
    { t: '계단에서 넘어져 다리를 다쳤다.', e: { phy: -5 } },
    { t: '시험지를 잃어버렸다...', e: { int: -4 } },
    { t: '용돈을 잃어버렸다.', e: { money: -50 } },
    { t: '친구와 크게 싸웠다.', e: { sen: -3, fortune: -1 } },
    { t: '핸드폰 액정이 깨졌다.', e: { money: -80 } },
  ],
  adult: [
    { t: '교통사고! 수리비가 들었다.', e: { money: -1500 } },
    { t: '보이스피싱에 당했다...', e: { money: -2000 } },
    { t: '허리를 삐끗했다.', e: { phy: -6, money: -300 } },
    { t: '투자한 코인이 폭락했다.', e: { money: -3000 } },
    { t: '집에 물이 샜다.', e: { money: -1000 } },
    { t: '세금을 깜빡해서 가산세!', e: { money: -1200 } },
  ],
  final: [
    { t: '입원했다. 병원비가 들었다.', e: { money: -2500 } },
    { t: '사기꾼에게 속아 건강식품을 샀다.', e: { money: -1500 } },
    { t: '틀니를 잃어버렸다.', e: { money: -300 } },
  ],
};

export const LOVE = {
  kid: [
    { t: '짝꿍과 친해졌다.', e: { sen: 3 } },
    { t: '친구에게 생일 파티 초대를 받았다.', e: { fortune: 1 } },
  ],
  teen: [
    { t: '옆반 친구에게 편지를 받았다!', e: { love: 1 } },
    { t: '도서관에서 운명적인 만남이...!', e: { love: 1, int: 2 } },
    { t: '고백했지만 차였다...', e: { sen: 3 } },
    { t: '같이 하교하는 사이가 됐다.', e: { love: 1 } },
  ],
  adult: [
    { t: '소개팅이 대성공!', e: { love: 1 } },
    { t: '회사 동료와 좋은 분위기!', e: { love: 1 } },
    { t: '데이트 비용이 들었다.', e: { love: 1, money: -200 } },
    { t: '이별했다... 하지만 성장했다.', e: { love: -1, sen: 4 } },
  ],
  married: [
    { t: '결혼기념일 서프라이즈!', e: { money: -300, fortune: 1 } },
    { t: '배우자와 맛집 투어.', e: { money: -200, sen: 3 } },
    { t: '부부 싸움 후 화해했다.', e: { fortune: 1 } },
  ],
};

// 선택 칸: 두 가지 중 하나 선택
export const CHOICES = {
  kid: [
    { t: '방과 후에 무엇을 할까?', o: [{ l: '학원에 간다', e: { int: 6 } }, { l: '놀이터에서 논다', e: { phy: 6 } }, { l: '그림을 그린다', e: { sen: 6 } }] },
    { t: '세뱃돈을 어떻게 할까?', o: [{ l: '저금한다', e: { money: 60 } }, { l: '책을 산다', e: { int: 5, money: 10 } }, { l: '게임기를 산다', e: { sen: 4, fortune: 1 } }] },
  ],
  teen: [
    { t: '주말 계획은?', o: [{ l: '독서실', e: { int: 8 } }, { l: '헬스장', e: { phy: 8 } }, { l: '버스킹', e: { sen: 8 } }] },
    { t: '방학 때 무엇을 할까?', o: [{ l: '아르바이트', e: { money: 200 } }, { l: '어학연수', e: { int: 6, sen: 3, money: -100 } }, { l: '봉사활동', e: { fortune: 1, phy: 3 } }] },
  ],
  adult: [
    { t: '보너스를 어디에 쓸까?', o: [{ l: '투자한다 (룰렛 5 이상이면 3배)', e: { gamble: 1000 } }, { l: '자기계발', e: { int: 5, sen: 5, money: -300 } }, { l: '저축한다', e: { money: 500 } }] },
    { t: '휴가 계획은?', o: [{ l: '헬스 합숙', e: { phy: 8, money: -300 } }, { l: '대학원 강의', e: { int: 8, money: -400 } }, { l: '해외여행', e: { sen: 8, money: -500 } }] },
    { t: '친구가 창업을 제안했다!', o: [{ l: '투자한다 (룰렛 5 이상이면 3배)', e: { gamble: 2000 } }, { l: '거절한다', e: { fortune: 1 } }] },
  ],
  final: [
    { t: '노후를 어떻게 보낼까?', o: [{ l: '봉사활동', e: { fortune: 1 } }, { l: '투자 (룰렛 5 이상이면 3배)', e: { gamble: 3000 } }, { l: '취미 생활', e: { sen: 6, money: -200 } }] },
  ],
};

export const LUCKY = {
  kid: [
    { t: '길에서 반짝이는 것을 주웠다!', e: { treasure: 1 } },
    { t: '뽑기에서 1등 당첨!', e: { money: 100 } },
    { t: '행운이 찾아왔다!', e: { fortune: 1, card: 1 } },
  ],
  adult: [
    { t: '숨겨진 보물을 발견했다!', e: { treasure: 1 } },
    { t: '복권 1등 당첨!!', e: { money: 5000 } },
    { t: '먼 친척의 유산을 받았다.', e: { money: 3000, treasure: 1 } },
    { t: '행운의 여신이 미소지었다.', e: { fortune: 1, card: 1 } },
  ],
};

export const ERA_GROUP = { baby: 'baby', elem: 'kid', middle: 'teen', high: 'teen', adult1: 'adult', adult2: 'adult', final: 'final' };
