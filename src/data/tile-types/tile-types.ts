/**
 * @pyramid-spec      design/data/tile-types/tile-types.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/tile-types/tile-types.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */

export type TileType = 'start' | 'star1' | 'star2' | 'star3' | 'payday' | 'love' | 'hiyari' | 'ghost' | 'destiny'
  | 'travel' | 'choice' | 'card' | 'challenge' | 'baby' | 'stop' | 'end' | 'goal'
  | 'substart' | 'rest' | 'farm' | 'bet' | 'dig' | 'jackpot' | 'pray' | 'omikuji' | 'return';

export const TILE_INFO: Readonly<Record<TileType, { readonly name: string; readonly color: number }>> = {
  start: { name: '출발', color: 0xffffff },
  star1: { name: '별 칸 Lv1', color: 0xfff1a8 },
  star2: { name: '별 칸 Lv2', color: 0xffa23a },
  star3: { name: '별 칸 Lv3', color: 0xffd23f },
  payday: { name: '월급날', color: 0x51cf66 },
  love: { name: '하트 칸', color: 0xff7eb6 },
  hiyari: { name: '물방울 칸 (아슬아슬)', color: 0x7cc7ff },
  ghost: { name: '유령 칸 (대위기)', color: 0x6c4fc4 },
  destiny: { name: '운명의 하트 칸', color: 0xff9ecf },
  travel: { name: '여행 칸', color: 0x4dd4f0 },
  choice: { name: '선택 칸', color: 0x8ce0c4 },
  card: { name: '카드 칸', color: 0x5c9dff },
  challenge: { name: '랭크업 찬스', color: 0x22b8cf },
  baby: { name: '아기 칸', color: 0xf7a8c8 },
  stop: { name: 'STOP', color: 0xe03131 },
  end: { name: '다음 시대로', color: 0xffffff },
  goal: { name: 'GOAL', color: 0xffd700 },
  substart: { name: '서브맵 출발', color: 0xffffff },
  rest: { name: '휴식 칸', color: 0xa9e34b },
  farm: { name: '수확 칸', color: 0xffc078 },
  bet: { name: '베팅 칸', color: 0xf03e3e },
  dig: { name: '보물 캐기 칸', color: 0xc0915e },
  jackpot: { name: '잭팟 칸', color: 0xfab005 },
  pray: { name: '기도 칸', color: 0xe8590c },
  omikuji: { name: '운세 뽑기 칸', color: 0xfff0f6 },
  return: { name: '귀환 칸', color: 0x4dd4f0 },
};
export const TILE_TYPES: readonly TileType[] = Object.keys(TILE_INFO) as TileType[];

export type SubmapId = 'countryside' | 'casino' | 'shrine';
export const SUBMAP_IDS: readonly SubmapId[] = ['countryside', 'casino', 'shrine'];
export const SUBMAPS: Readonly<Record<SubmapId, { readonly name: string; readonly tiles: readonly TileType[] }>> = {
  countryside: { name: '🌾 시골 마을', tiles: ['substart', 'rest', 'farm', 'star1', 'rest', 'farm', 'star2', 'rest', 'star3', 'return'] },
  casino: { name: '🎰 일확천금 섬', tiles: ['substart', 'bet', 'dig', 'bet', 'ghost', 'dig', 'bet', 'star3', 'jackpot', 'return'] },
  shrine: { name: '⛩️ 신들의 섬', tiles: ['substart', 'pray', 'star1', 'pray', 'omikuji', 'star2', 'pray', 'omikuji', 'star3', 'return'] },
};
export const SUB_TILE_TYPES: readonly TileType[] = ['substart', 'rest', 'farm', 'bet', 'dig', 'jackpot', 'pray', 'omikuji', 'return'];
export const TRAVEL_SHORTCUT = 6;
