// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 인생게임 룰 엔진 (서버 권위, 순수 JS / JSON 직렬화 가능한 상태)
import {
  ERAS, ADULT_ERA, FINAL_ERA, JOBS, jobById, meetsReq, gradeIndex, CLUBS, CARDS, CARD_POOL, HAND_MAX,
  TREASURES, HOUSES, NOTE_UNIT, NOTE_REPAY, KID_GIFT, GOAL_BONUS, AWARD_BONUS, WEDDING_GIFT, BIRTH_GIFT,
  KID_NAMES, PARTNERS, STAR_WEIGHTS, STAR_GAIN, DATE_BASE, PROPOSE_AT, PERSONALITY_NAMES, PERSONALITY_CARD,
  SUBMAPS, ROUTE_NAMES, ROUTE_DESC, EVENTS, HIYARI, HIYARI_SPIN, GHOST, LOVE, CHOICES, STAR3, FORTUNES, FORTUNE_START, STAT_NAMES, STAT_MAX,
} from './data.js';
import { BOARD } from './board.js';

// ---------- RNG (상태에 저장되는 결정적 난수) ----------
function rnd(s) {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rint = (s, n) => Math.floor(rnd(s) * n);
const choose = (s, arr) => arr[rint(s, arr.length)];

export function formatMoney(man) {
  const neg = man < 0;
  let v = Math.abs(Math.round(man));
  const eok = Math.floor(v / 10000);
  const rest = v % 10000;
  let str = '';
  if (eok) str += `${eok}억`;
  if (rest || !eok) str += `${eok ? ' ' : ''}${rest.toLocaleString('ko-KR')}만`;
  return (neg ? '-' : '') + str + '원';
}

const eraKey = (era) => ERAS[era].id;
const group = (era) => {
  const id = eraKey(era);
  if (id === 'baby') return 'baby';
  if (id === 'elem') return 'kid';
  if (id === 'middle' || id === 'high') return 'teen';
  if (id === 'final') return 'final';
  return 'adult';
};

// ---------- 생성 ----------
export function createGame({ players, mode = 'full', seed = Date.now() }) {
  if (!players || players.length < 1 || players.length > 4) throw new Error('플레이어는 1~4명이어야 합니다.');
  const startEra = mode === 'adult' ? ADULT_ERA : 0;
  const s = {
    v: 1,
    rng: seed >>> 0,
    mode,
    phase: 'playing',
    era: startEra,
    round: 0,
    turn: 0,
    turnActive: false,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar || {},
      cpu: !!p.cpu,
      tile: BOARD.eraStart[startEra],
      money: 0,
      notes: 0,
      stats: { int: 5, phy: 5, sen: 5 },
      fortune: FORTUNE_START,
      job: null,
      rank: 0,
      partner: null, // { id, affinity } (docs/ADR.md §6.4)
      spouse: null,
      subReturn: null, // 서브맵 여행 중이면 돌아올 본 맵 칸
      kids: [],
      cards: [],
      treasures: [],
      houses: [],
      club: null,
      college: false,
      insurance: 0,
      cardUsed: false,
      doneEra: false,
      finished: false,
      finishOrder: null,
    })),
    partners: [],
    pending: null,
    queue: [],
    log: [],
    finishCount: 0,
    result: null,
    seq: 0,
  };
  // 연애 상대 후보: ★ 등급은 게임마다 무작위 (docs/ADR.md §6.4)
  s.partners = PARTNERS.map((c) => {
    let r = rnd(s) * STAR_WEIGHTS.reduce((a, b) => a + b, 0);
    let stars = 1;
    for (let k = 0; k < STAR_WEIGHTS.length; k++) { r -= STAR_WEIGHTS[k]; if (r < 0) { stars = k + 1; break; } }
    return { id: c.id, name: c.name, job: c.job, personality: c.personality, color: c.color, stars, takenBy: null };
  });
  const ev = [];
  if (mode === 'adult') {
    for (const p of s.players) {
      p.stats = { int: 15 + rint(s, 45), phy: 15 + rint(s, 45), sen: 15 + rint(s, 45) };
      p.money = 300;
    }
    queueEraStart(s);
  }
  advance(s, ev);
  s.lastEvents = ev;
  return s;
}

// ---------- 공통 헬퍼 ----------
function P(s, id) { return s.players.find((p) => p.id === id); }
function log(s, text) {
  s.log.push(text);
  if (s.log.length > 40) s.log.shift();
}
function msg(s, ev, p, text, kind = 'info') {
  ev.push({ t: 'msg', pid: p ? p.id : null, text, kind });
  log(s, p ? `${p.name}: ${text}` : text);
}

function addMoney(s, p, delta, reason, ev) {
  if (!delta) return;
  p.money += delta;
  ev.push({ t: 'money', pid: p.id, delta, reason });
  let borrowed = 0;
  while (p.money < 0) {
    p.money += NOTE_UNIT;
    p.notes += 1;
    borrowed++;
  }
  if (borrowed) ev.push({ t: 'note', pid: p.id, count: borrowed, total: p.notes });
}
function addStat(s, p, k, d, ev) {
  if (!d) return;
  const before = p.stats[k];
  p.stats[k] = Math.max(0, Math.min(STAT_MAX, p.stats[k] + d));
  const real = p.stats[k] - before;
  if (real) ev.push({ t: 'stat', pid: p.id, stat: k, delta: real, value: p.stats[k] });
}
function addFortune(s, p, d, ev) {
  const before = p.fortune;
  p.fortune = Math.max(0, Math.min(FORTUNES.length - 1, p.fortune + d));
  if (p.fortune !== before) ev.push({ t: 'fortune', pid: p.id, delta: p.fortune - before, value: p.fortune });
}

export function salaryOf(p) {
  if (!p.job) return 0;
  const job = jobById(p.job);
  return job.ranks[p.rank].salary;
}
function incomeUnit(s, p) {
  if (s.era >= ADULT_ERA) return Math.max(salaryOf(p), 300);
  return Math.max(ERAS[s.era].allowance, 20);
}

function gainCard(s, p, ev) {
  if (p.cards.length >= HAND_MAX) {
    msg(s, ev, p, '카드가 가득 차서 받을 수 없었다.');
    return;
  }
  let id;
  do { id = choose(s, CARD_POOL); } while (CARDS[id].adultOnly && s.era < ADULT_ERA);
  if (id === 'insurance') {
    p.insurance += 1;
  }
  p.cards.push(id);
  ev.push({ t: 'card', pid: p.id, card: id, gained: true });
  log(s, `${p.name}: ${CARDS[id].name} 획득`);
}
function gainTreasure(s, p, ev) {
  const tr = choose(s, TREASURES);
  p.treasures.push({ name: tr.name, base: tr.base });
  ev.push({ t: 'treasure', pid: p.id, name: tr.name });
  log(s, `${p.name}: 보물 「${tr.name}」 획득`);
}

function applyEffects(s, p, e, ev) {
  if (!e) return;
  if (e.money != null) {
    const amt = e.money === 'salary' ? incomeUnit(s, p) : e.money === 'salary2' ? incomeUnit(s, p) * 2 : e.money;
    addMoney(s, p, amt, amt >= 0 ? '수입' : '지출', ev);
  }
  for (const k of ['int', 'phy', 'sen']) if (e[k]) addStat(s, p, k, e[k], ev);
  if (e.fortune) addFortune(s, p, e.fortune, ev);
  if (e.love && p.partner && !p.spouse) addAffinity(s, p, e.love * 10, ev);
  if (e.card) for (let i = 0; i < e.card; i++) gainCard(s, p, ev);
  if (e.treasure) for (let i = 0; i < e.treasure; i++) gainTreasure(s, p, ev);
  if (e.gamble) {
    s.pending = { type: 'spin', playerId: p.id, purpose: 'gamble', amount: e.gamble, title: `투자 ${formatMoney(e.gamble)} — 5 이상이면 성공!` };
  }
}

// ---------- 턴 진행 ----------
function current(s) { return s.players[s.turn]; }

function advance(s, ev) {
  let guard = 0;
  while (!s.pending && s.phase === 'playing') {
    if (++guard > 500) throw new Error('advance loop');
    if (s.queue.length) {
      s.pending = makeQueued(s, s.queue.shift());
      continue;
    }
    if (s.turnActive) {
      endTurn(s, ev);
      continue;
    }
    beginTurn(s, ev);
  }
}

function beginTurn(s, ev) {
  const p = current(s);
  s.turnActive = true;
  p.cardUsed = false;
  const skip = s.era === FINAL_ERA ? p.finished : p.doneEra;
  if (skip) return; // 턴 소비 없이 다음으로
  ev.push({ t: 'turn', pid: p.id, era: s.era, round: s.round });
  s.pending = { type: 'spin', playerId: p.id, purpose: 'move', title: '룰렛을 돌리세요!' };
}

function endTurn(s, ev) {
  s.turnActive = false;
  const n = s.players.length;
  s.turn = (s.turn + 1) % n;
  if (s.turn === 0) s.round += 1;
  if (s.era === FINAL_ERA) {
    if (s.players.every((p) => p.finished)) finishGame(s, ev);
    return;
  }
  const era = ERAS[s.era];
  if (s.turn === 0 && (s.round >= era.turns || s.players.every((p) => p.doneEra))) {
    nextEra(s, ev);
  } else if (s.players.every((p) => p.doneEra)) {
    // 라운드 도중이라도 모두 도착했으면 즉시 다음 시대로
    s.turn = 0;
    nextEra(s, ev);
  }
}

function nextEra(s, ev) {
  if (s.mode === 'kids' && s.era === 3) { finishGame(s, ev); return; }
  s.era += 1;
  s.round = 0;
  s.turn = 0;
  const start = BOARD.eraStart[s.era];
  ev.push({ t: 'era', era: s.era, name: ERAS[s.era].name });
  log(s, `━━ ${ERAS[s.era].name} ━━`);
  for (const p of s.players) {
    p.tile = start;
    p.doneEra = false;
    p.subReturn = null;
    ev.push({ t: 'warp', pid: p.id, tile: start });
  }
  queueEraStart(s);
  if (s.era === FINAL_ERA) {
    for (const p of s.players) msg(s, ev, p, '은퇴! 이제부터 연금 생활이다. (월급날에 월급의 30%)');
  }
}

function queueEraStart(s) {
  const id = eraKey(s.era);
  for (const p of s.players) {
    if (id === 'middle' || id === 'high') s.queue.push({ kind: 'club', playerId: p.id });
    if (id === 'high' && !p.partner) s.queue.push({ kind: 'crush', playerId: p.id });
    if (id === 'adult1') {
      s.queue.push({ kind: 'career', playerId: p.id });
      s.queue.push({ kind: 'job', playerId: p.id });
    }
  }
}

function makeQueued(s, q) {
  const p = P(s, q.playerId);
  if (q.kind === 'club') {
    return {
      type: 'choice', kind: 'club', playerId: p.id,
      title: `${ERAS[s.era].name} — 동아리를 고르세요`,
      options: CLUBS.map((c) => ({ label: c.name, desc: c.desc })),
    };
  }
  if (q.kind === 'career') {
    return {
      type: 'choice', kind: 'career', playerId: p.id,
      title: '고등학교 졸업! 진로를 고르세요',
      options: [
        { label: '대학 진학', desc: '학비 800만 / 지력 +12, 센스 +4' },
        { label: '바로 취직', desc: '취업 축하금 +300만 / 체력 +5' },
      ],
    };
  }
  if (q.kind === 'job') {
    return {
      type: 'choice', kind: 'job', playerId: p.id,
      title: '직업을 고르세요 (능력치 조건을 만족한 직업만 가능)',
      options: JOBS.map((j) => {
        const r = j.ranks[0];
        const req = r.req ? Object.entries(r.req).map(([k, g]) => `${STAT_NAMES[k]} ${g}`).join(' · ') : '조건 없음';
        const kind = j.type === 'stat' ? '능력치 승진형' : j.type === 'spin' ? '룰렛 승진형' : '월급 룰렛형';
        return {
          label: `${j.icon} ${j.name}`,
          desc: `${r.name} ${formatMoney(r.salary)} → 최고 ${formatMoney(j.ranks[j.ranks.length - 1].salary)} | ${kind} | ${req}`,
          disabled: !meetsReq(p, r),
          jobId: j.id,
        };
      }),
    };
  }
  if (q.kind === 'crush') {
    const pool = freePartners(s, (c) => c.stars <= 3);
    const picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(rint(s, pool.length), 1)[0]);
    return {
      type: 'choice', kind: 'crush', playerId: p.id,
      title: '고등학생이 되었다! 관심 있는 사람을 고르세요',
      options: picks.map((c) => ({ label: `${'★'.repeat(c.stars)} ${c.name} (${c.job})`, desc: `${PERSONALITY_NAMES[c.personality]} — ${partnerHint(p, c)}`, partnerId: c.id }))
        .concat([{ label: '지금은 관심 없음', desc: '하트 칸에서 새로운 만남이 생길 수 있다' }]),
    };
  }
  throw new Error('unknown queue kind ' + q.kind);
}

// ---------- 이동 ----------
function payday(s, p, ev) {
  if (s.era < ADULT_ERA) {
    const a = ERAS[s.era].allowance;
    if (a) addMoney(s, p, a, '용돈', ev);
    return;
  }
  if (!p.job) return;
  const job = jobById(p.job);
  if (s.era === FINAL_ERA) {
    addMoney(s, p, Math.round(salaryOf(p) * 0.3), '연금', ev);
    return;
  }
  if (job.type === 'stat') {
    while (p.rank < job.ranks.length - 1 && meetsReq(p, job.ranks[p.rank + 1])) {
      p.rank += 1;
      ev.push({ t: 'job', pid: p.id, job: p.job, rank: p.rank, promoted: true });
      log(s, `${p.name}: ${job.ranks[p.rank].name}(으)로 승진!`);
    }
  }
  if (job.type === 'free') {
    const v = 1 + rint(s, 10);
    ev.push({ t: 'spin', pid: p.id, value: v, purpose: 'freelance', auto: true });
    addMoney(s, p, job.ranks[0].salary * v, '프리랜서 수입', ev);
    return;
  }
  addMoney(s, p, salaryOf(p), '월급', ev);
}

// 그래프 이동 (docs/ADR.md §6.11): 분기점에서는 길 선택 후 남은 칸을 이어서 이동
function doMove(s, p, steps, ev, forced = null) {
  let seg = [];
  let pos = p.tile;
  for (let k = 0; k < steps; k++) {
    const cur = BOARD.tiles[pos];
    if (!cur.next.length || cur.type === 'return') break;
    let nx;
    if (k === 0 && forced != null) nx = forced;
    else if (cur.next.length > 1) {
      if (seg.length) ev.push({ t: 'move', pid: p.id, path: seg });
      p.tile = pos;
      const br = BOARD.branches.find((b) => b.junction === pos);
      s.pending = {
        type: 'choice', kind: 'route', playerId: p.id, remaining: steps - k,
        title: `갈림길! 어느 길로 갈까요? (남은 ${steps - k}칸)`,
        options: cur.next.map((n, idx) => {
          const route = br ? br.routes[idx] : BOARD.tiles[n].route;
          return { label: ROUTE_NAMES[route] || route, desc: ROUTE_DESC[route] || '', next: n, route };
        }),
      };
      ev.push({ t: 'junction', pid: p.id, tile: pos, options: cur.next });
      return;
    } else nx = cur.next[0];
    pos = nx;
    seg.push(pos);
    const t = BOARD.tiles[pos];
    if (t.type === 'payday') {
      p.tile = pos;
      ev.push({ t: 'move', pid: p.id, path: seg });
      seg = [];
      msg(s, ev, p, s.era < ADULT_ERA ? '용돈날!' : s.era === FINAL_ERA ? '연금날!' : '월급날!', 'payday');
      payday(s, p, ev);
    }
    if (t.type === 'stop' && k < steps - 1) break; // STOP 칸은 반드시 멈춤
    if (t.type === 'return') break; // 귀환 칸은 지나칠 수 없음
  }
  p.tile = pos;
  if (seg.length) ev.push({ t: 'move', pid: p.id, path: seg });
  resolveTile(s, p, ev);
}

function resolveTile(s, p, ev) {
  const t = BOARD.tiles[p.tile];
  const g = group(s.era);
  const ek = eraKey(s.era);
  ev.push({ t: 'land', pid: p.id, tile: t.i, type: t.type });
  switch (t.type) {
    case 'star1':
    case 'star2': {
      // 별 칸 Lv1: 시대 이벤트 그대로 / Lv2: 좋은 효과(양수) 2배 (docs/ADR.md §6.1)
      const list = EVENTS[ek] || EVENTS[g] || EVENTS.adult;
      const e = choose(s, list);
      const lv2 = t.type === 'star2';
      msg(s, ev, p, (lv2 ? '★★ ' : '★ ') + e.t, lv2 ? 'lucky' : 'event');
      applyEffects(s, p, lv2 ? doublePositive(e.e) : e.e, ev);
      fortuneBonus(s, p, ev);
      break;
    }
    case 'star3': {
      // 별 칸 Lv3 (빛나는 칸): 호화 이벤트 (docs/ADR.md §6.2)
      const e = choose(s, g === 'adult' || g === 'final' ? STAR3.adult : STAR3.kid);
      msg(s, ev, p, '★★★ ' + e.t, 'lucky');
      applyEffects(s, p, e.e, ev);
      break;
    }
    case 'payday':
      break; // doMove 에서 처리
    case 'love': {
      // 하트 칸 (docs/ADR.md §6.4)
      if (p.spouse) {
        const e = choose(s, LOVE.married);
        msg(s, ev, p, e.t, 'love');
        applyEffects(s, p, e.e, ev);
      } else if (!p.partner) {
        const pool = freePartners(s, (c) => c.stars <= 3);
        if (pool.length) {
          const c = choose(s, pool);
          setPartner(s, p, c, 10, ev);
          msg(s, ev, p, `💘 새로운 만남! ${'★'.repeat(c.stars)} ${c.name}(${c.job})와(과) 알게 되었다.`, 'love');
        }
      } else {
        const c = partnerOf(s, p);
        const gain = Math.round(DATE_BASE * (c.personality === topStat(p) ? 1.5 : 1) * STAR_GAIN[c.stars - 1]);
        msg(s, ev, p, `💗 ${c.name}와(과) 데이트! 호감도 +${gain}`, 'love');
        if (s.era >= ADULT_ERA) addMoney(s, p, -200, '데이트 비용', ev);
        addAffinity(s, p, gain, ev);
        if (s.era >= ADULT_ERA && p.partner.affinity >= PROPOSE_AT) {
          s.pending = {
            type: 'choice', kind: 'propose', playerId: p.id,
            title: `${c.name}에게 프러포즈할까요? (호감도 ${p.partner.affinity} → ${proposeNeed(p)} 이상이면 성공)`,
            options: [{ label: '💍 프러포즈한다', desc: '실패하면 호감도 −20' }, { label: '아직 기다린다', desc: '호감도를 더 올린다' }],
          };
        }
      }
      break;
    }
    case 'destiny': {
      // 운명의 하트 칸 (docs/ADR.md §6.5.1)
      if (p.spouse) { msg(s, ev, p, '🌈 무지개 하트! 부부의 사랑이 더 깊어졌다.', 'love'); addFortune(s, p, 1, ev); break; }
      let pool = freePartners(s, (c) => c.stars >= 4 && (!p.partner || c.id !== p.partner.id));
      if (!pool.length) pool = freePartners(s, (c) => c.stars === 3 && (!p.partner || c.id !== p.partner.id));
      if (!pool.length) break;
      const c = choose(s, pool);
      msg(s, ev, p, `🌈 운명의 만남! ${'★'.repeat(c.stars)} ${c.name}(${c.job})`, 'love');
      if (!p.partner) { setPartner(s, p, c, 20, ev); break; }
      const cur = partnerOf(s, p);
      s.pending = {
        type: 'choice', kind: 'destiny', playerId: p.id, candidate: c.id,
        title: `${c.name}에게 마음이 흔들린다... 상대를 바꿀까요?`,
        options: [
          { label: `${c.name}(${'★'.repeat(c.stars)})로 바꾼다`, desc: '호감도 20부터 새로 시작' },
          { label: `${cur.name}(${'★'.repeat(cur.stars)})를 지킨다`, desc: '현재 상대 호감도 +10' },
        ],
      };
      break;
    }
    case 'travel': {
      // 여행 칸 (docs/ADR.md §6.12)
      const sm = SUBMAPS[t.sub];
      s.pending = {
        type: 'choice', kind: 'travel', playerId: p.id, sub: t.sub,
        title: `여행 칸! ${sm.name}(으)로 여행을 떠날까요?`,
        options: [{ label: `✈️ ${sm.name}(으)로 떠난다`, desc: `돌아올 때는 ${TRAVEL_SHORTCUT_TEXT}` }, { label: '가지 않는다', desc: '그대로 진행' }],
      };
      break;
    }
    case 'substart':
      break;
    case 'rest':
      msg(s, ev, p, '🌾 시골에서 푹 쉬었다.', 'lucky');
      applyEffects(s, p, { phy: 5, fortune: 1 }, ev);
      break;
    case 'farm':
      msg(s, ev, p, '🥕 밭에서 수확했다!', 'payday');
      addMoney(s, p, 500, '수확', ev);
      break;
    case 'bet':
      s.pending = {
        type: 'choice', kind: 'bet', playerId: p.id, title: '🎰 베팅! 룰렛 6 이상이면 건 돈의 3배',
        options: [{ label: '1000만 건다', amount: 1000 }, { label: '3000만 건다', amount: 3000 }, { label: '그만둔다', amount: 0 }],
      };
      break;
    case 'dig':
      if (rnd(s) < 0.5) { msg(s, ev, p, '⛏️ 보물을 캐냈다!', 'lucky'); gainTreasure(s, p, ev); }
      else { msg(s, ev, p, '⛏️ 허탕... 삽값만 들었다.', 'bad'); addMoney(s, p, -200, '허탕', ev); }
      break;
    case 'jackpot':
      s.pending = { type: 'spin', playerId: p.id, purpose: 'jackpot', title: '💰 잭팟! 룰렛 값 × 1000만' };
      break;
    case 'pray':
      msg(s, ev, p, '⛩️ 신에게 봉납하고 기도했다.', 'event');
      addMoney(s, p, -300, '봉납', ev);
      s.pending = { type: 'spin', playerId: p.id, purpose: 'pray', title: '🙏 기도 룰렛! 8 이상이면 큰 축복' };
      break;
    case 'omikuji':
      s.pending = { type: 'spin', playerId: p.id, purpose: 'omikuji', title: '🎴 운세 뽑기! 룰렛으로 운세가 새로 정해진다' };
      break;
    case 'return': {
      const back = p.subReturn;
      p.subReturn = null;
      if (back != null) {
        msg(s, ev, p, '✈️ 여행을 마치고 돌아왔다! (지름길)', 'lucky');
        p.tile = back;
        ev.push({ t: 'warp', pid: p.id, tile: back, fly: true });
      }
      break;
    }
    case 'hiyari': {
      // 물방울 칸 (아슬아슬): 문구 후 능력치 변동 룰렛 (docs/ADR.md §6.6)
      const list = g === 'baby' ? HIYARI.baby : g === 'kid' || g === 'teen' ? HIYARI.kid : g === 'final' ? HIYARI.final : HIYARI.adult;
      const e = choose(s, list);
      msg(s, ev, p, e.t, 'bad');
      const stat = choose(s, ['int', 'phy', 'sen']);
      s.pending = { type: 'spin', playerId: p.id, purpose: 'hiyari', stat, title: `아슬아슬 룰렛! ${STAT_NAMES[stat]}이(가) 변동합니다` };
      break;
    }
    case 'ghost': {
      // 유령 칸 (대위기): 큰 손해 + 운세 -1, 보험 카드로 1회 무효 (docs/ADR.md §6.7)
      if (p.insurance > 0) {
        p.insurance -= 1;
        const idx = p.cards.indexOf('insurance');
        if (idx >= 0) p.cards.splice(idx, 1);
        ev.push({ t: 'card', pid: p.id, card: 'insurance', used: true });
        msg(s, ev, p, '유령이 나타났다! ...하지만 보험 카드로 막아냈다!', 'lucky');
        break;
      }
      const list = g === 'baby' ? GHOST.baby : g === 'kid' || g === 'teen' ? GHOST.kid : g === 'final' ? GHOST.final : GHOST.adult;
      const e = choose(s, list);
      msg(s, ev, p, '👻 ' + e.t, 'bad');
      applyEffects(s, p, e.e, ev);
      addFortune(s, p, -1, ev);
      break;
    }
    case 'choice': {
      const list = g === 'baby' || g === 'kid' ? CHOICES.kid : g === 'teen' ? CHOICES.teen : g === 'final' ? CHOICES.final : CHOICES.adult;
      const c = choose(s, list);
      s.pending = {
        type: 'choice', kind: 'event', playerId: p.id, title: c.t,
        options: c.o.map((o) => ({ label: o.l, e: o.e })),
      };
      break;
    }
    case 'card':
      msg(s, ev, p, '카드 칸! 카드를 1장 받았다.', 'card');
      gainCard(s, p, ev);
      break;
    case 'challenge': {
      if (!p.job) break;
      const job = jobById(p.job);
      if (job.type === 'spin' && p.rank < job.ranks.length - 1) {
        const need = rankupNeed(p);
        s.pending = {
          type: 'spin', playerId: p.id, purpose: 'rankup', need,
          title: `랭크업 찬스! ${need} 이상이면 「${job.ranks[p.rank + 1].name}」(으)로!`,
        };
      } else if (job.type === 'stat') {
        msg(s, ev, p, '승진 심사! 능력치를 갈고닦았다.', 'event');
        addStat(s, p, job.key, 4, ev);
        payPromotionCheck(s, p, ev);
      } else {
        msg(s, ev, p, '큰 의뢰가 들어왔다!', 'event');
        addMoney(s, p, 1500, '의뢰 수입', ev);
      }
      break;
    }
    case 'baby': {
      if (p.spouse) {
        const name = choose(s, KID_NAMES);
        p.kids.push(name);
        ev.push({ t: 'kid', pid: p.id, name, count: p.kids.length });
        msg(s, ev, p, `아기 「${name}」(이)가 태어났다! 모두에게서 축하금을 받는다.`, 'love');
        collectFromOthers(s, p, BIRTH_GIFT, '출산 축하금', ev);
      } else {
        msg(s, ev, p, '조카가 태어났다! 선물을 샀다.', 'event');
        addMoney(s, p, -100, '선물', ev);
        addFortune(s, p, 1, ev);
      }
      break;
    }
    case 'stop':
      if (t.stop === 'marriage') {
        // 결혼 STOP (docs/ADR.md §7)
        if (p.spouse) {
          msg(s, ev, p, '결혼식장 앞. 이미 행복한 가정이 있다!', 'love');
          addFortune(s, p, 1, ev);
        } else {
          if (!p.partner) {
            const pool = freePartners(s, (c) => c.stars <= 2);
            if (pool.length) {
              const c = choose(s, pool);
              setPartner(s, p, c, 30, ev);
              msg(s, ev, p, `💐 즉석 소개팅! ${'★'.repeat(c.stars)} ${c.name}(${c.job})와(과) 만났다.`, 'love');
            }
          }
          if (p.partner) {
            const c = partnerOf(s, p);
            s.pending = { type: 'spin', playerId: p.id, purpose: 'propose', need: proposeNeed(p), title: `💍 ${c.name}에게 프러포즈! ${proposeNeed(p)} 이상이면 결혼` };
          }
        }
      } else if (t.stop === 'house') {
        s.pending = {
          type: 'choice', kind: 'house', playerId: p.id, title: '내 집 마련 STOP! 집을 살까요? (결과 발표에서 감정)',
          options: HOUSES.map((h) => ({ label: h.name, desc: formatMoney(h.price), houseId: h.id }))
            .concat([{ label: '사지 않는다', desc: '현금을 지킨다' }]),
        };
      }
      break;
    case 'end':
      p.doneEra = true;
      msg(s, ev, p, `${ERAS[s.era].name} 도착! 다른 사람을 기다린다.`, 'info');
      break;
    case 'goal': {
      p.finished = true;
      p.finishOrder = s.finishCount++;
      ev.push({ t: 'goal', pid: p.id, order: p.finishOrder });
      msg(s, ev, p, `${p.finishOrder + 1}등으로 GOAL!`, 'lucky');
      break;
    }
    default:
      break;
  }
}

function doublePositive(e) {
  const out = { ...e };
  for (const k of ['int', 'phy', 'sen', 'love']) if (out[k] > 0) out[k] *= 2;
  if (typeof out.money === 'number' && out.money > 0) out.money *= 2;
  if (out.money === 'salary') out.money = 'salary2';
  return out;
}

function fortuneBonus(s, p, ev) {
  if (s.era >= ADULT_ERA && rnd(s) < 0.25) {
    if (p.fortune >= 5) { msg(s, ev, p, `운세 「${FORTUNES[p.fortune]}」 덕분에 특별 보너스!`, 'lucky'); addMoney(s, p, 1000, '운세 보너스', ev); }
    else if (p.fortune <= 1) { msg(s, ev, p, `운세 「${FORTUNES[p.fortune]}」... 불운이 덮쳤다.`, 'bad'); addMoney(s, p, -800, '불운', ev); }
  }
}

function rankupNeed(p) {
  const job = jobById(p.job);
  const gi = gradeIndex(p.stats[job.key]);
  return Math.max(3, Math.min(9, 9 - Math.floor(gi * 0.8) + p.rank));
}

function payPromotionCheck(s, p, ev) {
  const job = jobById(p.job);
  while (p.rank < job.ranks.length - 1 && meetsReq(p, job.ranks[p.rank + 1])) {
    p.rank += 1;
    ev.push({ t: 'job', pid: p.id, job: p.job, rank: p.rank, promoted: true });
    log(s, `${p.name}: ${job.ranks[p.rank].name}(으)로 승진!`);
  }
}

function collectFromOthers(s, p, amount, reason, ev) {
  let total = 0;
  for (const o of s.players) {
    if (o === p) continue;
    addMoney(s, o, -amount, reason, ev);
    total += amount;
  }
  if (total) addMoney(s, p, total, reason, ev);
}

// ---------- 연애 (docs/ADR.md §6.4~6.5) ----------
function freePartners(s, pred = () => true) { return s.partners.filter((c) => !c.takenBy && pred(c)); }
function partnerOf(s, p) { return p.partner ? s.partners.find((c) => c.id === p.partner.id) : null; }
function topStat(p) { return ['int', 'phy', 'sen'].reduce((a, b) => (p.stats[b] > p.stats[a] ? b : a), 'int'); }
function partnerHint(p, c) { return c.personality === topStat(p) ? '나와 성격이 잘 맞는다!' : '호감도가 보통으로 오른다'; }
function proposeNeed(p) { return Math.max(2, Math.min(10, 11 - Math.floor(p.partner.affinity / 10))); }
function setPartner(s, p, c, affinity, ev) {
  if (p.partner) { const old = partnerOf(s, p); if (old) old.takenBy = null; }
  c.takenBy = p.id;
  p.partner = { id: c.id, affinity };
  ev.push({ t: 'partner', pid: p.id, partner: c.id, name: c.name, stars: c.stars, affinity });
}
function addAffinity(s, p, d, ev) {
  if (!p.partner) return;
  const before = p.partner.affinity;
  p.partner.affinity = Math.max(0, Math.min(100, before + d));
  ev.push({ t: 'affinity', pid: p.id, delta: p.partner.affinity - before, value: p.partner.affinity });
}

function marry(s, p, ev) {
  const c = partnerOf(s, p);
  p.spouse = c.name;
  ev.push({ t: 'marry', pid: p.id, spouse: p.spouse, partner: c.id });
  msg(s, ev, p, `💒 ${c.name}와(과) 결혼했다! 모두에게서 축의금을 받는다.`, 'love');
  collectFromOthers(s, p, WEDDING_GIFT, '축의금', ev);
  addMoney(s, p, c.stars * 1000, `${c.name}의 지참금`, ev);
  const card = c.stars >= 4 ? 'rankup' : PERSONALITY_CARD[c.personality];
  if (p.cards.length < HAND_MAX) {
    p.cards.push(card);
    ev.push({ t: 'card', pid: p.id, card, gained: true });
  }
}

const TRAVEL_SHORTCUT_TEXT = '본 맵의 6칸 앞(지름길)으로 돌아온다';

// ---------- 룰렛 ----------
export function spinValue(s, power) {
  const pw = Math.max(0, Math.min(1, Number(power) || 0));
  return (Math.floor(pw * 23 + rnd(s) * 7) % 10) + 1;
}

// ---------- 액션 ----------
export function applyAction(s, playerId, action) {
  if (s.phase !== 'playing') throw new Error('게임이 진행 중이 아닙니다.');
  const pend = s.pending;
  if (!pend || pend.playerId !== playerId) throw new Error('지금은 당신의 차례가 아닙니다.');
  const p = P(s, playerId);
  const ev = [];
  if (action.type === 'card') {
    useCard(s, p, action, ev);
  } else if (action.type === 'spin') {
    if (pend.type !== 'spin') throw new Error('지금은 룰렛을 돌릴 수 없습니다.');
    s.pending = null;
    let value = pend.fixed != null ? pend.fixed : spinValue(s, action.power);
    ev.push({ t: 'spin', pid: p.id, value, purpose: pend.purpose, fixed: pend.fixed != null });
    if (pend.purpose === 'move') {
      let steps = value;
      if (pend.double) { steps = value * 2; msg(s, ev, p, `더블 카드! ${steps}칸 전진`, 'card'); }
      doMove(s, p, steps, ev);
    } else if (pend.purpose === 'rankup') {
      const job = jobById(p.job);
      if (value >= pend.need) {
        p.rank += 1;
        ev.push({ t: 'job', pid: p.id, job: p.job, rank: p.rank, promoted: true });
        msg(s, ev, p, `성공! 「${job.ranks[p.rank].name}」(으)로 랭크업! 월급 ${formatMoney(job.ranks[p.rank].salary)}`, 'lucky');
      } else {
        msg(s, ev, p, '아쉽게도 랭크업 실패...', 'bad');
        addStat(s, p, job.key, 2, ev);
      }
    } else if (pend.purpose === 'gamble') {
      if (value >= 5) { msg(s, ev, p, '투자 대성공! 3배가 되었다!', 'lucky'); addMoney(s, p, pend.amount * 2, '투자 수익', ev); }
      else { msg(s, ev, p, '투자 실패... 돈을 잃었다.', 'bad'); addMoney(s, p, -pend.amount, '투자 손실', ev); }
    } else if (pend.purpose === 'hiyari') {
      const d = HIYARI_SPIN[value - 1];
      msg(s, ev, p, d >= 0 ? `위기를 기회로! ${STAT_NAMES[pend.stat]} +${d}` : `${STAT_NAMES[pend.stat]} ${d}...`, d >= 0 ? 'lucky' : 'bad');
      addStat(s, p, pend.stat, d, ev);
    } else if (pend.purpose === 'propose') {
      if (value >= pend.need) marry(s, p, ev);
      else { msg(s, ev, p, '프러포즈 실패... 조금 더 가까워져야 할 것 같다.', 'bad'); addAffinity(s, p, -20, ev); }
    } else if (pend.purpose === 'bet') {
      if (value >= 6) { msg(s, ev, p, '🎰 대박! 3배!', 'lucky'); addMoney(s, p, pend.amount * 2, '베팅 수익', ev); }
      else { msg(s, ev, p, '🎰 꽝...', 'bad'); addMoney(s, p, -pend.amount, '베팅 손실', ev); }
    } else if (pend.purpose === 'jackpot') {
      msg(s, ev, p, `💰 잭팟 ${value}배!`, 'lucky');
      addMoney(s, p, value * 1000, '잭팟', ev);
    } else if (pend.purpose === 'pray') {
      if (value >= 8) {
        msg(s, ev, p, '✨ 신의 큰 축복!', 'lucky');
        addFortune(s, p, 2, ev);
        const job = p.job ? jobById(p.job) : null;
        if (job && job.type === 'spin' && p.rank < job.ranks.length - 1) {
          p.rank += 1;
          ev.push({ t: 'job', pid: p.id, job: p.job, rank: p.rank, promoted: true });
          msg(s, ev, p, `「${job.ranks[p.rank].name}」(으)로 랭크업!`, 'lucky');
        }
      } else if (value >= 4) { msg(s, ev, p, '작은 축복을 받았다.', 'lucky'); addFortune(s, p, 1, ev); }
      else msg(s, ev, p, '아무 일도 일어나지 않았다...', 'info');
    } else if (pend.purpose === 'omikuji') {
      const f = value <= 2 ? 1 : value <= 5 ? 3 : value <= 8 ? 4 : value === 9 ? 5 : 6;
      msg(s, ev, p, `🎴 운세 뽑기 결과: 「${FORTUNES[f]}」`, f >= 5 ? 'lucky' : f <= 1 ? 'bad' : 'event');
      addFortune(s, p, f - p.fortune, ev);
    }
  } else if (action.type === 'choose') {
    if (pend.type !== 'choice') throw new Error('선택할 것이 없습니다.');
    const idx = action.index | 0;
    const opt = pend.options[idx];
    if (!opt) throw new Error('잘못된 선택입니다.');
    if (opt.disabled) throw new Error('조건을 만족하지 않습니다.');
    s.pending = null;
    ev.push({ t: 'chose', pid: p.id, kind: pend.kind, index: idx, label: opt.label });
    resolveChoice(s, p, pend, idx, opt, ev);
  } else {
    throw new Error('알 수 없는 액션');
  }
  advance(s, ev);
  s.seq += 1;
  s.lastEvents = ev;
  return ev;
}

function resolveChoice(s, p, pend, idx, opt, ev) {
  switch (pend.kind) {
    case 'club': {
      const c = CLUBS[idx];
      p.club = c.id;
      msg(s, ev, p, `「${c.name}」에 들어갔다!`, 'event');
      applyEffects(s, p, c.eff, ev);
      break;
    }
    case 'career':
      if (idx === 0) {
        p.college = true;
        msg(s, ev, p, '대학에 진학했다!', 'event');
        addMoney(s, p, -800, '학비', ev);
        applyEffects(s, p, { int: 12, sen: 4 }, ev);
      } else {
        msg(s, ev, p, '바로 사회로 뛰어들었다!', 'event');
        applyEffects(s, p, { money: 300, phy: 5 }, ev);
      }
      break;
    case 'job': {
      const job = jobById(opt.jobId);
      p.job = job.id;
      p.rank = 0;
      ev.push({ t: 'job', pid: p.id, job: job.id, rank: 0, promoted: false });
      msg(s, ev, p, `${job.icon} ${job.name} 「${job.ranks[0].name}」(으)로 취직!`, 'lucky');
      break;
    }
    case 'house': {
      if (opt.houseId) {
        const h = HOUSES.find((x) => x.id === opt.houseId);
        p.houses.push({ id: h.id, name: h.name, price: h.price });
        msg(s, ev, p, `「${h.name}」를 샀다!`, 'lucky');
        addMoney(s, p, -h.price, '주택 구입', ev);
        ev.push({ t: 'house', pid: p.id, house: h.id });
      } else {
        msg(s, ev, p, '집은 사지 않기로 했다.', 'info');
      }
      break;
    }
    case 'event':
      msg(s, ev, p, `「${opt.label}」`, 'event');
      applyEffects(s, p, opt.e, ev);
      break;
    case 'route':
      msg(s, ev, p, `${opt.label}(으)로 간다!`, 'info');
      doMove(s, p, pend.remaining, ev, opt.next);
      break;
    case 'crush': {
      if (opt.partnerId) {
        const c = s.partners.find((x) => x.id === opt.partnerId);
        if (c.takenBy) { msg(s, ev, p, `${c.name}에게는 이미 다른 인연이...`, 'bad'); break; }
        setPartner(s, p, c, 0, ev);
        msg(s, ev, p, `💘 ${c.name}이(가) 신경 쓰이기 시작했다.`, 'love');
      } else msg(s, ev, p, '지금은 공부와 동아리에 집중!', 'info');
      break;
    }
    case 'propose': {
      if (idx === 0) {
        const c = partnerOf(s, p);
        s.pending = { type: 'spin', playerId: p.id, purpose: 'propose', need: proposeNeed(p), title: `💍 ${c.name}에게 프러포즈! ${proposeNeed(p)} 이상이면 결혼` };
      } else msg(s, ev, p, '조금 더 사이를 다지기로 했다.', 'info');
      break;
    }
    case 'destiny': {
      const c = s.partners.find((x) => x.id === pend.candidate);
      if (idx === 0 && !c.takenBy) { setPartner(s, p, c, 20, ev); msg(s, ev, p, `💘 ${c.name}와(과) 새로운 사랑을 시작했다!`, 'love'); }
      else { msg(s, ev, p, '지금의 사람을 소중히 하기로 했다.', 'love'); addAffinity(s, p, 10, ev); }
      break;
    }
    case 'travel': {
      if (idx === 0) {
        const here = BOARD.tiles[p.tile];
        p.subReturn = here.ret;
        p.tile = BOARD.subStart[pend.sub];
        msg(s, ev, p, `✈️ ${SUBMAPS[pend.sub].name}(으)로 여행을 떠났다!`, 'lucky');
        ev.push({ t: 'warp', pid: p.id, tile: p.tile, fly: true });
      } else msg(s, ev, p, '여행은 다음 기회에.', 'info');
      break;
    }
    case 'bet':
      if (opt.amount) s.pending = { type: 'spin', playerId: p.id, purpose: 'bet', amount: opt.amount, title: `${formatMoney(opt.amount)} 베팅! 6 이상이면 3배` };
      else msg(s, ev, p, '베팅은 그만두었다.', 'info');
      break;
    default:
      break;
  }
}

function useCard(s, p, action, ev) {
  const pend = s.pending;
  if (pend.type !== 'spin' || pend.purpose !== 'move') throw new Error('카드는 이동 룰렛 전에만 사용할 수 있습니다.');
  if (p.cardUsed) throw new Error('카드는 한 턴에 1장만 사용할 수 있습니다.');
  const idx = action.index | 0;
  const id = p.cards[idx];
  if (!id) throw new Error('카드가 없습니다.');
  const c = CARDS[id];
  if (c.timing === 'passive') throw new Error('보험 카드는 자동으로 발동합니다.');
  if (c.adultOnly && !p.job) throw new Error('직업이 있어야 사용할 수 있습니다.');
  if (id === 'fixed') {
    const n = action.number | 0;
    if (n < 1 || n > 10) throw new Error('1~10 사이 숫자를 고르세요.');
    pend.fixed = n;
    pend.title = `지정 룰렛: ${n}`;
  }
  p.cards.splice(idx, 1);
  p.cardUsed = true;
  ev.push({ t: 'card', pid: p.id, card: id, used: true });
  log(s, `${p.name}: ${c.name} 사용`);
  switch (id) {
    case 'double': pend.double = true; pend.title = '더블 카드: 결과 ×2'; break;
    case 'bonus': addMoney(s, p, incomeUnit(s, p), '보너스', ev); break;
    case 'study': addStat(s, p, 'int', 10, ev); break;
    case 'gym': addStat(s, p, 'phy', 10, ev); break;
    case 'artclass': addStat(s, p, 'sen', 10, ev); break;
    case 'charm': addFortune(s, p, 1, ev); break;
    case 'steal': {
      const others = s.players.filter((o) => o !== p).sort((a, b) => b.money - a.money);
      if (others.length) {
        const o = others[0];
        const amt = Math.min(500, o.money);
        if (amt > 0) { addMoney(s, o, -amt, '가로채기 당함', ev); addMoney(s, p, amt, '가로채기', ev); }
        msg(s, ev, p, `${o.name}에게서 ${formatMoney(amt)}을 가로챘다!`, 'card');
      }
      break;
    }
    case 'rankup': {
      const job = jobById(p.job);
      if (p.rank < job.ranks.length - 1) {
        p.rank += 1;
        ev.push({ t: 'job', pid: p.id, job: p.job, rank: p.rank, promoted: true });
        msg(s, ev, p, `승진 카드! 「${job.ranks[p.rank].name}」(으)로!`, 'lucky');
      }
      break;
    }
    default: break;
  }
}

// ---------- 결과 발표 ----------
function finishGame(s, ev) {
  s.phase = 'ended';
  s.pending = null;
  const rows = s.players.map((p) => {
    const items = [];
    items.push({ label: '현금', amount: p.money });
    for (const t of p.treasures) {
      const v = 1 + rint(s, 10);
      const mult = [0.1, 0.3, 0.5, 0.8, 1, 1.2, 1.5, 2, 3, 5][v - 1];
      items.push({ label: `보물 감정 「${t.name}」 (룰렛 ${v} → ×${mult})`, amount: Math.round(t.base * mult) });
    }
    for (const h of p.houses) {
      const v = 1 + rint(s, 10);
      const mult = 0.7 + v * 0.1;
      items.push({ label: `집 감정 「${h.name}」 (룰렛 ${v} → ×${mult.toFixed(1)})`, amount: Math.round(h.price * mult) });
    }
    if (p.kids.length) items.push({ label: `자녀 ${p.kids.length}명의 효도 선물`, amount: p.kids.length * KID_GIFT });
    if (p.finishOrder != null && GOAL_BONUS[p.finishOrder]) items.push({ label: `GOAL ${p.finishOrder + 1}등 보너스`, amount: GOAL_BONUS[p.finishOrder] });
    if (p.notes) items.push({ label: `약속어음 ${p.notes}장 상환`, amount: -p.notes * NOTE_REPAY });
    return { pid: p.id, items };
  });
  // 특별상
  const awards = [
    { name: '최고 연봉상', val: (p) => salaryOf(p) },
    { name: '대가족상', val: (p) => p.kids.length },
    { name: '박사상 (지력 최고)', val: (p) => p.stats.int },
    { name: '철인상 (체력 최고)', val: (p) => p.stats.phy },
    { name: '아티스트상 (센스 최고)', val: (p) => p.stats.sen },
    { name: '행운상 (운세 최고)', val: (p) => p.fortune },
  ];
  for (const a of awards) {
    const max = Math.max(...s.players.map(a.val));
    if (max <= 0) continue;
    const winners = s.players.filter((p) => a.val(p) === max);
    if (winners.length === s.players.length && s.players.length > 1) continue;
    for (const w of winners) rows.find((r) => r.pid === w.id).items.push({ label: `특별상: ${a.name}`, amount: AWARD_BONUS });
  }
  for (const r of rows) r.total = r.items.reduce((sum, it) => sum + it.amount, 0);
  const ranking = [...rows].sort((a, b) => b.total - a.total).map((r) => r.pid);
  s.result = { rows, ranking };
  ev.push({ t: 'result', result: s.result });
  log(s, '━━ 결과 발표 ━━');
}

// ---------- CPU ----------
export function cpuAction(s, rand = Math.random) {
  const pend = s.pending;
  if (!pend) return null;
  const p = P(s, pend.playerId);
  if (pend.type === 'spin') {
    if (pend.purpose === 'move' && !p.cardUsed && p.cards.length) {
      const idx = p.cards.findIndex((c) => CARDS[c].timing === 'now' && !(CARDS[c].adultOnly && !p.job));
      if (idx >= 0 && rand() < 0.6) return { type: 'card', index: idx };
      const dIdx = p.cards.indexOf('double');
      if (dIdx >= 0 && rand() < 0.4) return { type: 'card', index: dIdx };
    }
    return { type: 'spin', power: rand() };
  }
  if (pend.type === 'choice') {
    const enabled = pend.options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (pend.kind === 'job') {
      let best = enabled[0];
      let bestScore = -1;
      for (const i of enabled) {
        const j = jobById(pend.options[i].jobId);
        const score = j.ranks[Math.min(2, j.ranks.length - 1)].salary * (0.7 + rand() * 0.6);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      return { type: 'choose', index: best };
    }
    if (pend.kind === 'career') return { type: 'choose', index: p.stats.int >= 25 ? 0 : 1 };
    // docs/ADR.md §13.1
    if (pend.kind === 'route') {
      const loveIdx = pend.options.findIndex((o) => o.route === 'love');
      const wantLove = !p.spouse && rand() < (p.partner ? 0.7 : 0.5);
      if (loveIdx >= 0) return { type: 'choose', index: wantLove ? loveIdx : 1 - loveIdx };
      return { type: 'choose', index: Math.floor(rand() * pend.options.length) };
    }
    if (pend.kind === 'crush') {
      const top = ['int', 'phy', 'sen'].reduce((a, b) => (p.stats[b] > p.stats[a] ? b : a), 'int');
      const i = pend.options.findIndex((o) => o.partnerId && s.partners.find((c) => c.id === o.partnerId).personality === top);
      return { type: 'choose', index: i >= 0 ? i : 0 };
    }
    if (pend.kind === 'propose') return { type: 'choose', index: 0 };
    if (pend.kind === 'destiny') {
      const cand = s.partners.find((c) => c.id === pend.candidate);
      const cur = p.partner ? s.partners.find((c) => c.id === p.partner.id) : null;
      return { type: 'choose', index: cur && cand.stars > cur.stars && p.partner.affinity < 50 ? 0 : 1 };
    }
    if (pend.kind === 'travel') return { type: 'choose', index: rand() < 0.7 ? 0 : 1 };
    if (pend.kind === 'bet') return { type: 'choose', index: p.money >= 3000 && rand() < 0.3 ? 1 : p.money >= 1000 ? 0 : 2 };
    if (pend.kind === 'house') {
      let best = pend.options.length - 1;
      pend.options.forEach((o, i) => {
        if (o.houseId) {
          const h = HOUSES.find((x) => x.id === o.houseId);
          if (h.price <= p.money) best = i;
        }
      });
      return { type: 'choose', index: best };
    }
    return { type: 'choose', index: enabled[Math.floor(rand() * enabled.length)] };
  }
  return null;
}

// 클라이언트 전송용 공개 상태
export function publicState(s) {
  const { rng, lastEvents, ...rest } = s;
  return rest;
}
