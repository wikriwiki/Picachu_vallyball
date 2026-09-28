/**
 * @pyramid-spec      design/data/tables/tables.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/tables/tables.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */

export type StatKey = 'int' | 'phy' | 'sen';
export type EraId = 'baby' | 'elem' | 'middle' | 'high' | 'adult1' | 'adult2' | 'final';
export type EraGroup = 'baby' | 'kid' | 'teen' | 'adult' | 'final';
export type RouteId = 'main' | 'love' | 'career' | 'study';
export type Grade = 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type PathPart =
  | { readonly main: number; readonly fixed?: Readonly<Record<number, string>> }
  | { readonly branch: number; readonly a: RouteId; readonly b: RouteId };
export interface Era {
  readonly id: EraId; readonly name: string; readonly turns: number | null; readonly allowance: number;
  readonly payEvery: number; readonly color: number; readonly ground: number; readonly path: readonly PathPart[];
}
export interface JobRank { readonly name: string; readonly salary: number; readonly req?: Readonly<Partial<Record<StatKey, Grade>>>; readonly fortune?: number; }
export interface Job { readonly id: string; readonly name: string; readonly icon: string; readonly type: 'stat' | 'spin' | 'free'; readonly key: StatKey; readonly ranks: readonly JobRank[]; }
export type CardId = 'fixed' | 'double' | 'insurance' | 'bonus' | 'study' | 'gym' | 'artclass' | 'charm' | 'steal' | 'rankup';
export interface CardInfo { readonly name: string; readonly desc: string; readonly timing: 'spin' | 'passive' | 'now'; readonly adultOnly?: boolean; }
export interface PartnerInfo { readonly id: string; readonly name: string; readonly job: string; readonly personality: StatKey; readonly color: string; }
export interface Avatar { skin: string; hair: string; shirt: string; pants: string; hairStyle: number; face: number; }

// ---------------- 시대 ----------------
export const ERAS: readonly Era[] = [
  { id: 'baby', name: '아기 시절', turns: 2, allowance: 0, payEvery: 0, color: 0xffc8dd, ground: 0xbde0a8, path: [{ main: 14 }] },
  { id: 'elem', name: '초등학생 시절', turns: 4, allowance: 20, payEvery: 7, color: 0xffe066, ground: 0x9ad07a, path: [{ main: 28 }] },
  { id: 'middle', name: '중학생 시절', turns: 4, allowance: 40, payEvery: 7, color: 0x74c0fc, ground: 0x86c46d, path: [{ main: 28 }] },
  { id: 'high', name: '고등학생 시절', turns: 4, allowance: 60, payEvery: 7, color: 0x9775fa, ground: 0x7ab862,
    path: [{ main: 8 }, { branch: 10, a: 'love', b: 'study' }, { main: 10 }] },
  { id: 'adult1', name: '어른 시절 전반', turns: 15, allowance: 0, payEvery: 18, color: 0xff8787, ground: 0x8cc06a,
    path: [{ main: 12 }, { branch: 14, a: 'love', b: 'career' }, { main: 18, fixed: { 2: 'stop:marriage', 9: 'travel:countryside' } }, { branch: 12, a: 'love', b: 'career' }, { main: 22 }] },
  { id: 'adult2', name: '어른 시절 후반', turns: 15, allowance: 0, payEvery: 18, color: 0xffa94d, ground: 0x9cc46e,
    path: [{ main: 14 }, { branch: 12, a: 'love', b: 'career' }, { main: 20, fixed: { 4: 'stop:house', 11: 'travel:casino' } }, { branch: 12, a: 'love', b: 'career' }, { main: 22 }] },
  { id: 'final', name: '마지막 시절', turns: null, allowance: 0, payEvery: 10, color: 0xc0a0ff, ground: 0xb5c98a,
    path: [{ main: 34, fixed: { 10: 'travel:shrine' } }] },
];
export const ADULT_ERA = 4;
export const FINAL_ERA = 6;
export const ERA_GROUP: Readonly<Record<EraId, EraGroup>> = {
  baby: 'baby', elem: 'kid', middle: 'teen', high: 'teen', adult1: 'adult', adult2: 'adult', final: 'final',
};
export const ROUTE_NAMES: Readonly<Record<RouteId, string>> = { main: '일반 길', love: '💗 연애 길', career: '💼 커리어 길', study: '📖 공부 길' };
export const ROUTE_DESC: Readonly<Partial<Record<RouteId, string>>> = {
  love: '하트 칸이 많아 인연을 만들기 좋다',
  career: '랭크업 찬스와 월급날이 많다',
  study: '별 칸과 카드 칸이 많아 능력치를 키우기 좋다',
};

// ---------------- 능력치·운세 ----------------
export const STAT_NAMES: Readonly<Record<StatKey, string>> = { int: '지력', phy: '체력', sen: '센스' };
export const STAT_MAX = 100;
export const STAT_START = 5;
export const GRADES: readonly Grade[] = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
export const GRADE_MIN: readonly number[] = [0, 10, 20, 30, 45, 60, 75, 90];
export const FORTUNES: readonly string[] = ['대흉', '흉', '말길', '길', '중길', '대길', '초대길'];
export const FORTUNE_START = 3;

export function gradeIndex(v: number): number {
  let g = 0;
  for (let i = 0; i < GRADE_MIN.length; i++) if (v >= GRADE_MIN[i]) g = i;
  return g;
}
export const gradeOf = (v: number): Grade => GRADES[gradeIndex(v)];
export const gradeValue = (g: Grade): number => GRADE_MIN[GRADES.indexOf(g)];

// ---------------- 직업 ----------------
const R = (name: string, salary: number, req?: JobRank['req'], fortune?: number): JobRank =>
  (fortune != null ? { name, salary, req, fortune } : req ? { name, salary, req } : { name, salary });
export const JOBS: readonly Job[] = [
  { id: 'office', name: '회사원', icon: '💼', type: 'stat', key: 'int', ranks: [
    R('일반 사원', 600, { int: 'E' }), R('과장', 1200, { int: 'D', sen: 'E' }), R('부장', 2400, { int: 'C', sen: 'D' }),
    R('사장', 6000, { int: 'B', sen: 'C' }), R('회장', 18000, { int: 'A', sen: 'B' }, 5)] },
  { id: 'doctor', name: '의사', icon: '🩺', type: 'stat', key: 'int', ranks: [
    R('연수의', 900, { int: 'C', phy: 'F' }), R('신인 의사', 1800, { int: 'B', phy: 'E' }), R('어엿한 의사', 4500, { int: 'B', phy: 'D' }),
    R('실력파 의사', 6300, { int: 'A', phy: 'C' }), R('신의 손 원장', 18000, { int: 'S', phy: 'C' })] },
  { id: 'teacher', name: '교사', icon: '📚', type: 'stat', key: 'int', ranks: [
    R('교생', 500, { int: 'D' }), R('담임 선생님', 1000, { int: 'C', sen: 'E' }), R('학년 주임', 2000, { int: 'C', sen: 'D' }),
    R('교감', 4000, { int: 'B', sen: 'D' }), R('교장', 9000, { int: 'A', sen: 'C' })] },
  { id: 'police', name: '경찰관', icon: '👮', type: 'stat', key: 'phy', ranks: [
    R('순경', 600, { phy: 'D' }), R('경사', 1200, { phy: 'C', int: 'E' }), R('경위', 2500, { phy: 'B', int: 'D' }),
    R('경정', 5000, { phy: 'A', int: 'C' }), R('경찰청장', 12000, { phy: 'S', int: 'B' })] },
  { id: 'scientist', name: '과학자', icon: '🔬', type: 'stat', key: 'int', ranks: [
    R('연구원', 800, { int: 'C' }), R('주임 연구원', 1600, { int: 'B' }), R('부교수', 3500, { int: 'B', sen: 'D' }),
    R('교수', 7000, { int: 'A', sen: 'C' }), R('노벨상 학자', 20000, { int: 'S', sen: 'B' })] },
  { id: 'chef', name: '요리사', icon: '🍳', type: 'stat', key: 'sen', ranks: [
    R('견습 요리사', 400, { sen: 'D' }), R('요리사', 900, { sen: 'C' }), R('셰프', 2000, { sen: 'B', phy: 'D' }),
    R('오너 셰프', 5000, { sen: 'A', phy: 'C' }), R('전설의 셰프', 15000, { sen: 'S', phy: 'B' })] },
  { id: 'politician', name: '정치인', icon: '🏛️', type: 'stat', key: 'int', ranks: [
    R('비서', 700, { int: 'D', sen: 'D' }), R('시의원', 1500, { int: 'C', sen: 'C' }), R('국회의원', 4000, { int: 'B', sen: 'C' }),
    R('장관', 8000, { int: 'A', sen: 'B' }), R('대통령', 20000, { int: 'S', sen: 'A' }, 5)] },
  { id: 'baseball', name: '야구 선수', icon: '⚾', type: 'spin', key: 'phy', ranks: [
    R('2군 선수', 500, { phy: 'D' }), R('1군 선수', 1500), R('주전 선수', 4000), R('스타 선수', 9000), R('메이저리거', 25000)] },
  { id: 'soccer', name: '축구 선수', icon: '⚽', type: 'spin', key: 'phy', ranks: [
    R('유스 선수', 500, { phy: 'D' }), R('프로 선수', 1500), R('국가대표', 5000), R('에이스', 10000), R('세계 최고 선수', 28000)] },
  { id: 'basketball', name: '농구 선수', icon: '🏀', type: 'spin', key: 'phy', ranks: [
    R('연습생', 500, { phy: 'D' }), R('벤치 멤버', 1400), R('주전 멤버', 4500), R('MVP', 10000), R('레전드', 28000)] },
  { id: 'fighter', name: '격투가', icon: '🥊', type: 'spin', key: 'phy', ranks: [
    R('수련생', 400, { phy: 'C' }), R('프로 파이터', 1200), R('챔피언', 4000), R('통합 챔피언', 9000), R('격투의 신', 22000)] },
  { id: 'actor', name: '배우', icon: '🎬', type: 'spin', key: 'sen', ranks: [
    R('엑스트라', 400, { sen: 'D' }), R('조연', 1200), R('주연', 4000), R('톱스타', 9000), R('월드 스타', 24000)] },
  { id: 'idol', name: '아이돌', icon: '🎤', type: 'spin', key: 'sen', ranks: [
    R('연습생', 300, { sen: 'D' }), R('신인 아이돌', 1000), R('인기 아이돌', 4000), R('톱 아이돌', 10000), R('레전드 아이돌', 25000)] },
  { id: 'creator', name: '크리에이터', icon: '📹', type: 'spin', key: 'sen', ranks: [
    R('새내기 크리에이터', 200, { sen: 'E' }), R('인기 크리에이터', 1000), R('실버 버튼', 3000), R('골드 버튼', 8000), R('다이아 버튼', 22000)] },
  { id: 'manga', name: '만화가', icon: '✏️', type: 'spin', key: 'sen', ranks: [
    R('어시스턴트', 300, { sen: 'D' }), R('신인 만화가', 800), R('연재 작가', 2500), R('히트 작가', 7000), R('만화의 신', 18000)] },
  { id: 'comedian', name: '개그맨', icon: '🎭', type: 'spin', key: 'sen', ranks: [
    R('신인 개그맨', 300, { sen: 'E' }), R('감초 개그맨', 900), R('고정 출연', 3000), R('MC', 9000), R('국민 MC', 28000)] },
  { id: 'freelancer', name: '프리랜서', icon: '🎒', type: 'free', key: 'sen', ranks: [R('프리랜서', 300)] },
];
export const jobById = (id: string | null | undefined): Job | undefined => JOBS.find((j) => j.id === id);

export function meetsReq(pl: { stats: Record<StatKey, number>; fortune: number }, rank: JobRank | undefined): boolean {
  if (!rank) return false;
  if (rank.req) {
    for (const k of Object.keys(rank.req) as StatKey[]) {
      if (pl.stats[k] < gradeValue(rank.req[k] as Grade)) return false;
    }
  }
  if (rank.fortune != null && pl.fortune < rank.fortune) return false;
  return true;
}

// ---------------- 성장 선택 ----------------
export interface Club { readonly id: string; readonly name: string; readonly desc: string; readonly eff: Readonly<{ int?: number; phy?: number; sen?: number; money?: number }>; }
export const CLUBS: readonly Club[] = [
  { id: 'study', name: '공부 동아리', desc: '지력 +12', eff: { int: 12 } },
  { id: 'sports', name: '운동부', desc: '체력 +12', eff: { phy: 12 } },
  { id: 'art', name: '미술·음악부', desc: '센스 +12', eff: { sen: 12 } },
  { id: 'home', name: '귀가부', desc: '능력치 +4씩, 용돈 +100만', eff: { int: 4, phy: 4, sen: 4, money: 100 } },
];
export const CAREER_OPTIONS: readonly { readonly label: string; readonly desc: string }[] = [
  { label: '대학 진학', desc: '학비 800만 / 지력 +12, 센스 +4' },
  { label: '바로 취직', desc: '취업 축하금 +300만 / 체력 +5' },
];

// ---------------- 연애 ----------------
export const PARTNERS: readonly PartnerInfo[] = [
  { id: 'jiwoo', name: '지우', job: '연구원', personality: 'int', color: '#74c0fc' },
  { id: 'sua', name: '수아', job: '변호사', personality: 'int', color: '#b197fc' },
  { id: 'junho', name: '준호', job: '의사', personality: 'int', color: '#63e6be' },
  { id: 'haeun', name: '하은', job: '교수', personality: 'int', color: '#91a7ff' },
  { id: 'minjun', name: '민준', job: '소방관', personality: 'phy', color: '#ff8787' },
  { id: 'siwoo', name: '시우', job: '축구 선수', personality: 'phy', color: '#ffa94d' },
  { id: 'daon', name: '다온', job: '요가 강사', personality: 'phy', color: '#8ce99a' },
  { id: 'taeo', name: '태오', job: '경찰관', personality: 'phy', color: '#4dabf7' },
  { id: 'seoyeon', name: '서연', job: '간호사', personality: 'sen', color: '#ffa8a8' },
  { id: 'harin', name: '하린', job: '가수', personality: 'sen', color: '#f783ac' },
  { id: 'yerin', name: '예린', job: '화가', personality: 'sen', color: '#e599f7' },
  { id: 'doyun', name: '도윤', job: '셰프', personality: 'sen', color: '#ffd43b' },
];
export const STAR_WEIGHTS: readonly number[] = [30, 30, 25, 10, 5];
export const STAR_GAIN: readonly number[] = [1.3, 1.1, 1.0, 0.8, 0.6];
export const DATE_BASE = 15;
export const PROPOSE_AT = 60;
export const DATE_COST = 200;
export const PERSONALITY_NAMES: Readonly<Record<StatKey, string>> = { int: '지력형', phy: '체력형', sen: '센스형' };
export const PERSONALITY_CARD: Readonly<Record<StatKey, CardId>> = { int: 'study', phy: 'gym', sen: 'artclass' };

// ---------------- 카드 ----------------
export const CARDS: Readonly<Record<CardId, CardInfo>> = {
  fixed: { name: '지정 룰렛 카드', desc: '원하는 숫자(1~10)만큼 전진', timing: 'spin' },
  double: { name: '더블 카드', desc: '룰렛 결과의 2배만큼 전진', timing: 'spin' },
  insurance: { name: '보험 카드', desc: '다음 유령 칸의 손해를 1번 막아줌 (자동)', timing: 'passive' },
  bonus: { name: '보너스 카드', desc: '즉시 월급(용돈) 1회분을 받음', timing: 'now' },
  study: { name: '학습 코스 카드', desc: '지력 +10', timing: 'now' },
  gym: { name: '헬스 회원권 카드', desc: '체력 +10', timing: 'now' },
  artclass: { name: '아트 교실 카드', desc: '센스 +10', timing: 'now' },
  charm: { name: '행운의 부적', desc: '운세 +1', timing: 'now' },
  steal: { name: '가로채기 카드', desc: '가장 부자인 상대에게서 500만 받기', timing: 'now' },
  rankup: { name: '승진 카드', desc: '직업 랭크 즉시 +1 (조건 무시)', timing: 'now', adultOnly: true },
};
export const CARD_POOL: readonly CardId[] = ['fixed', 'fixed', 'double', 'insurance', 'insurance', 'bonus', 'study', 'gym', 'artclass', 'charm', 'steal', 'rankup'];
export const HAND_MAX = 5;

// ---------------- 보물·집·경제 ----------------
export const TREASURES: readonly { readonly name: string; readonly base: number }[] = [
  { name: '네잎클로버 책갈피', base: 100 }, { name: '오래된 우표', base: 300 }, { name: '수상한 항아리', base: 800 },
  { name: '금빛 조개껍데기', base: 500 }, { name: '할아버지의 회중시계', base: 1200 }, { name: '운석 조각', base: 2000 },
  { name: '명화(?)', base: 3000 }, { name: '보석 반지', base: 4000 }, { name: '공룡 화석', base: 5000 },
];
export const TREASURE_MULT: readonly number[] = [0.1, 0.3, 0.5, 0.8, 1, 1.2, 1.5, 2, 3, 5];
export const HOUSES: readonly { readonly id: string; readonly name: string; readonly price: number }[] = [
  { id: 'apt', name: '아담한 아파트', price: 3000 },
  { id: 'house', name: '마당 있는 단독주택', price: 8000 },
  { id: 'mansion', name: '호화 저택', price: 20000 },
  { id: 'castle', name: '바닷가 성', price: 45000 },
];
export const NOTE_UNIT = 1000;
export const NOTE_REPAY = 1200;
export const KID_GIFT = 1000;
export const GOAL_BONUS: readonly number[] = [10000, 5000, 3000, 1000];
export const AWARD_BONUS = 3000;
export const WEDDING_GIFT = 300;
export const BIRTH_GIFT = 100;
export const ADULT_START_MONEY = 300;
export const PENSION_RATE = 0.3;
export const MIN_ALLOWANCE = 20;
export const MIN_SALARY_UNIT = 300;
export const LOG_MAX = 40;
export const KID_NAMES: readonly string[] = ['콩이', '별이', '봄이', '솔이', '달이', '해피', '토리', '루루', '도리', '보리'];

// ---------------- 아바타 ----------------
export const AVATAR_DEFAULT: Readonly<Avatar> = { skin: '#f5d0b0', hair: '#4a3020', shirt: '#ff6b6b', pants: '#364fc7', hairStyle: 0, face: 0 };
export const AVATAR_OPTIONS = {
  skin: ['#ffe0c7', '#f5d0b0', '#e0ac7e', '#b97a50', '#7a4b2e'],
  hair: ['#2b2b2b', '#4a3020', '#8a5a2b', '#e0b050', '#c0392b', '#7950f2', '#4dabf7'],
  shirt: ['#ff6b6b', '#ff922b', '#fcc419', '#51cf66', '#22b8cf', '#4c6ef5', '#cc5de8', '#f06595'],
  pants: ['#364fc7', '#495057', '#5c940d', '#862e9c', '#e8590c'],
  hairStyles: ['숏컷', '삐죽', '롱헤어', '똥머리'],
  faces: ['기본', '웃는 눈', '안경'],
} as const;
