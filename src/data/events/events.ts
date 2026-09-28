/**
 * @pyramid-spec      design/data/events/events.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/events/events.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */

export interface Effect {
  money?: number | 'salary' | 'salary2';
  int?: number; phy?: number; sen?: number; fortune?: number;
  love?: number; card?: number; treasure?: number; gamble?: number;
}
export interface EventEntry { readonly t: string; readonly e: Effect; }
export interface TextEntry { readonly t: string; }
export interface ChoiceEntry { readonly t: string; readonly o: readonly { readonly l: string; readonly e: Effect }[]; }

const E = (t: string, e: Effect): EventEntry => ({ t, e });

export const EVENTS: Readonly<Record<'baby' | 'elem' | 'middle' | 'high' | 'adult' | 'final', readonly EventEntry[]>> = {
  baby: [
    E('처음으로 "엄마"라고 말했다!', { int: 5 }), E('기어다니다가 거실을 탐험했다.', { phy: 5 }), E('크레파스로 벽에 대작을 그렸다.', { sen: 5 }),
    E('돌잡이에서 연필을 잡았다!', { int: 8 }), E('돌잡이에서 공을 잡았다!', { phy: 8 }), E('돌잡이에서 마이크를 잡았다!', { sen: 8 }),
    E('백일 사진이 너무 귀엽게 나왔다.', { fortune: 1 }), E('할머니가 세뱃돈을 주셨다.', { money: 30 }),
    E('밤새 울어서 가족 모두 잠을 못 잤다...', { fortune: -1, phy: 3 }),
  ],
  elem: [
    E('받아쓰기 100점!', { int: 6 }), E('운동회 달리기에서 1등!', { phy: 6 }), E('그림 대회에서 입상했다.', { sen: 6, money: 20 }),
    E('여름방학 숙제를 개학 전날 몰아서 했다.', { int: 2, fortune: -1 }), E('줄넘기 2단 뛰기 성공!', { phy: 4, sen: 2 }),
    E('도서관 책을 30권 읽었다.', { int: 8 }), E('리코더 연주회에서 박수를 받았다.', { sen: 5 }),
    E('친구와 딱지치기로 동네를 제패했다.', { phy: 3, fortune: 1 }), E('저금통을 깼다!', { money: 50 }),
  ],
  middle: [
    E('중간고사 전교 10등!', { int: 8 }), E('체육대회 반 대표로 뛰었다.', { phy: 7 }), E('축제 무대에서 춤을 췄다.', { sen: 7, love: 1 }),
    E('게임에 빠져 성적이 떨어졌다...', { int: -4, sen: 3 }), E('수학여행에서 추억을 만들었다.', { fortune: 1, sen: 3 }),
    E('학원 숙제에 치였다.', { int: 5, phy: -2 }), E('태권도 검은띠 획득!', { phy: 8 }), E('용돈을 모아 첫 적금!', { money: 80 }),
    E('사춘기가 왔다. 방문을 쾅!', { fortune: -1, sen: 4 }),
  ],
  high: [
    E('모의고사 전국 상위권!', { int: 10 }), E('전국 체전에 출전했다.', { phy: 10 }), E('밴드부 공연이 대박났다.', { sen: 10, love: 1 }),
    E('야간 자율학습 개근상!', { int: 6, phy: -2 }), E('편의점 아르바이트를 했다.', { money: 150, phy: 2 }),
    E('학생회장에 당선됐다!', { int: 4, sen: 4, fortune: 1 }), E('수능 D-100, 체력이 바닥났다.', { phy: -4, int: 5 }),
    E('졸업 앨범 사진이 레전드로 남았다.', { sen: 3, fortune: 1 }), E('길거리 캐스팅 제의를 받았다!', { sen: 8 }),
  ],
  adult: [
    E('자격증 시험에 합격했다.', { int: 6, money: 200 }), E('마라톤 풀코스 완주!', { phy: 6 }),
    E('주말 공방에서 도자기를 배웠다.', { sen: 6, money: -100 }), E('성과급이 나왔다!', { money: 'salary' }),
    E('주식이 올랐다!', { money: 1500 }), E('동창회에서 인맥을 넓혔다.', { sen: 4, fortune: 1 }),
    E('해외 출장으로 견문을 넓혔다.', { int: 4, sen: 4 }), E('사내 체육대회 MVP!', { phy: 5, money: 300 }),
    E('야근 연속 30일...', { phy: -5, money: 500 }), E('로또 3등 당첨!', { money: 1000 }), E('이사 비용이 들었다.', { money: -800 }),
    E('가족 여행을 다녀왔다.', { money: -500, fortune: 1 }),
  ],
  final: [
    E('손주가 놀러 왔다!', { fortune: 1 }), E('세계 일주 크루즈 여행!', { money: -3000, sen: 5 }), E('텃밭 채소가 풍년이다.', { money: 300, phy: 3 }),
    E('자서전을 출간했다.', { money: 2000, int: 3 }), E('마을 바둑 대회 우승!', { int: 5, money: 500 }), E('연금이 조금 올랐다.', { money: 800 }),
    E('건강검진 결과 모두 A!', { phy: 5, fortune: 1 }), E('골동품 가게에서 뭔가 샀다.', { treasure: 1, money: -300 }),
  ],
};

export const STAR3: Readonly<Record<'kid' | 'adult', readonly EventEntry[]>> = {
  kid: [
    E('신동으로 신문에 소개됐다!', { int: 10, sen: 5, fortune: 1 }), E('길에서 반짝이는 보물을 주웠다!', { treasure: 1, money: 100 }),
    E('네잎클로버 들판을 발견했다!', { fortune: 2, card: 1 }), E('전국 대회에서 우승했다!', { phy: 10, sen: 5, money: 100 }),
  ],
  adult: [
    E('숨겨진 보물을 발견했다!', { treasure: 1, money: 1000 }), E('복권 1등 당첨!!', { money: 5000 }),
    E('먼 친척의 유산을 받았다.', { money: 3000, treasure: 1 }), E('행운의 여신이 미소지었다.', { fortune: 2, card: 1 }),
    E('특별 보너스가 나왔다!', { money: 'salary2' }),
  ],
};

export const HIYARI: Readonly<Record<'baby' | 'kid' | 'adult' | 'final', readonly TextEntry[]>> = {
  baby: [{ t: '아슬아슬! 소파에서 떨어질 뻔했다.' }, { t: '아슬아슬! 장난감을 삼킬 뻔했다!' }],
  kid: [{ t: '아슬아슬! 계단에서 미끄러질 뻔했다.' }, { t: '아슬아슬! 숙제를 두고 올 뻔했다.' }, { t: '아슬아슬! 지각할 뻔했다.' }, { t: '아슬아슬! 자전거와 부딪힐 뻔했다.' }],
  adult: [{ t: '아슬아슬! 중요한 회의를 잊을 뻔했다.' }, { t: '아슬아슬! 차 사고가 날 뻔했다.' }, { t: '아슬아슬! 마감 직전에 서류를 냈다.' }, { t: '아슬아슬! 지갑을 잃어버릴 뻔했다.' }],
  final: [{ t: '아슬아슬! 빙판길에서 넘어질 뻔했다.' }, { t: '아슬아슬! 약 먹는 걸 잊을 뻔했다.' }],
};
export const HIYARI_SPIN: readonly number[] = [-12, -10, -8, -6, -5, -4, -3, -2, 3, 6];

export const GHOST: Readonly<Record<'baby' | 'kid' | 'adult' | 'final', readonly EventEntry[]>> = {
  baby: [E('으앙! 심한 감기에 걸렸다.', { phy: -6 }), E('무서운 꿈을 꾸고 밤새 울었다.', { sen: -4, int: -2 })],
  kid: [
    E('계단에서 굴러 다리가 부러졌다.', { phy: -10 }), E('시험지를 통째로 잃어버렸다...', { int: -8 }),
    E('모아둔 용돈을 몽땅 잃어버렸다.', { money: -150 }), E('친구와 크게 싸워 절교했다.', { sen: -6 }),
    E('엄마 스마트폰을 떨어뜨려 박살냈다.', { money: -200 }),
  ],
  adult: [
    E('대형 교통사고! 수리비와 병원비가...', { money: -3000 }), E('보이스피싱에 당했다...', { money: -4000 }),
    E('허리 디스크로 입원했다.', { phy: -10, money: -800 }), E('투자한 코인이 대폭락했다.', { money: -6000 }),
    E('집이 물에 잠겼다.', { money: -2000 }), E('세금 폭탄을 맞았다!', { money: -2500 }),
  ],
  final: [E('큰 병으로 입원했다.', { money: -5000 }), E('사기꾼에게 노후 자금을 뜯겼다.', { money: -3000 }), E('틀니를 잃어버렸다.', { money: -800 })],
};

export const LOVE: Readonly<Record<'married', readonly EventEntry[]>> = {
  married: [E('결혼기념일 서프라이즈!', { money: -300, fortune: 1 }), E('배우자와 맛집 투어.', { money: -200, sen: 3 }), E('부부 싸움 후 화해했다.', { fortune: 1 })],
};

export const CHOICES: Readonly<Record<'kid' | 'teen' | 'adult' | 'final', readonly ChoiceEntry[]>> = {
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
