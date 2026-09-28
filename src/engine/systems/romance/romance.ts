/**
 * @pyramid-spec      design/engine/systems/romance/romance.md
 * @pyramid-parent    design/engine/systems/systems.md
 * @pyramid-on-change 1) design/engine/systems/romance/romance.md 먼저 수정 2) 이 코드 수정 3) design/engine/systems/systems.md 「통합 방식」 영향 검토
 */
import {
  ADULT_ERA, DATE_BASE, DATE_COST, HAND_MAX, LOVE, PERSONALITY_CARD, PERSONALITY_NAMES, PROPOSE_AT, STAR_GAIN, WEDDING_GIFT, type StatKey,
} from '../../../data/data';
import {
  addAffinity, addFortune, addMoney, applyEffects, collectFromOthers,
  type ChoicePending, type ChoiceResolver, type Ctx, type PartnerState, type Player, type SpinResolver,
} from '../../core/core';

const stars = (n: number) => '★'.repeat(n);

export function freePartners(ctx: Ctx, pred: (c: PartnerState) => boolean = () => true): PartnerState[] {
  return ctx.state.partners.filter((c) => !c.takenBy && pred(c));
}
export function partnerOf(ctx: Ctx, p: Player): PartnerState | null {
  return p.partner ? ctx.state.partners.find((c) => c.id === p.partner!.id) ?? null : null;
}
export function topStat(p: Player): StatKey {
  return (['int', 'phy', 'sen'] as StatKey[]).reduce((a, b) => (p.stats[b] > p.stats[a] ? b : a), 'int');
}
export function proposeNeed(p: Player): number {
  return Math.max(2, Math.min(10, 11 - Math.floor((p.partner?.affinity ?? 0) / 10)));
}
export function setPartner(ctx: Ctx, p: Player, c: PartnerState, affinity: number): void {
  const old = partnerOf(ctx, p);
  if (old) old.takenBy = null;
  c.takenBy = p.id;
  p.partner = { id: c.id, affinity };
  ctx.events.push({ t: 'partner', pid: p.id, partner: c.id, name: c.name, stars: c.stars, affinity });
}

export function makeCrushChoice(ctx: Ctx, p: Player): ChoicePending {
  const pool = freePartners(ctx, (c) => c.stars <= 3);
  const picks: PartnerState[] = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(ctx.rint(pool.length), 1)[0]);
  const top = topStat(p);
  return {
    type: 'choice', kind: 'crush', playerId: p.id,
    title: '고등학생이 되었다! 관심 있는 사람을 고르세요',
    options: picks
      .map((c) => ({
        label: `${stars(c.stars)} ${c.name} (${c.job})`,
        desc: `${PERSONALITY_NAMES[c.personality]} — ${c.personality === top ? '나와 성격이 잘 맞는다!' : '호감도가 보통으로 오른다'}`,
        partnerId: c.id,
      }))
      .concat([{ label: '지금은 관심 없음', desc: '하트 칸에서 새로운 만남이 생길 수 있다' } as never]),
  };
}

export const resolveCrush: ChoiceResolver = (ctx, p, pend, idx) => {
  const pid = pend.options[idx].partnerId;
  if (!pid) { ctx.msg(p, '지금은 공부와 동아리에 집중!', 'info'); return; }
  const c = ctx.state.partners.find((x) => x.id === pid);
  if (!c) return;
  if (c.takenBy) { ctx.msg(p, `${c.name}에게는 이미 다른 인연이...`, 'bad'); return; }
  setPartner(ctx, p, c, 0);
  ctx.msg(p, `💘 ${c.name}이(가) 신경 쓰이기 시작했다.`, 'love');
};

function proposeSpin(ctx: Ctx, p: Player, c: PartnerState): void {
  const need = proposeNeed(p);
  ctx.state.pending = { type: 'spin', playerId: p.id, purpose: 'propose', need, title: `💍 ${c.name}에게 프러포즈! ${need} 이상이면 결혼` };
}

export function onLoveTile(ctx: Ctx, p: Player): void {
  if (p.spouse) {
    const e = ctx.choose(LOVE.married);
    ctx.msg(p, e.t, 'love');
    applyEffects(ctx, p, e.e);
    return;
  }
  if (!p.partner) {
    const pool = freePartners(ctx, (c) => c.stars <= 3);
    if (pool.length) {
      const c = ctx.choose(pool);
      setPartner(ctx, p, c, 10);
      ctx.msg(p, `💘 새로운 만남! ${stars(c.stars)} ${c.name}(${c.job})와(과) 알게 되었다.`, 'love');
    }
    return;
  }
  const c = partnerOf(ctx, p);
  if (!c) return;
  const gain = Math.round(DATE_BASE * (c.personality === topStat(p) ? 1.5 : 1) * STAR_GAIN[c.stars - 1]);
  ctx.msg(p, `💗 ${c.name}와(과) 데이트! 호감도 +${gain}`, 'love');
  if (ctx.state.era >= ADULT_ERA) addMoney(ctx, p, -DATE_COST, '데이트 비용');
  addAffinity(ctx, p, gain);
  if (ctx.state.era >= ADULT_ERA && p.partner.affinity >= PROPOSE_AT) {
    ctx.state.pending = {
      type: 'choice', kind: 'propose', playerId: p.id,
      title: `${c.name}에게 프러포즈할까요? (호감도 ${p.partner.affinity} → ${proposeNeed(p)} 이상이면 성공)`,
      options: [{ label: '💍 프러포즈한다', desc: '실패하면 호감도 −20' }, { label: '아직 기다린다', desc: '호감도를 더 올린다' }],
    };
  }
}

export const resolveProposeChoice: ChoiceResolver = (ctx, p, _pend, idx) => {
  const c = partnerOf(ctx, p);
  if (idx === 0 && c) proposeSpin(ctx, p, c);
  else ctx.msg(p, '조금 더 사이를 다지기로 했다.', 'info');
};

export const resolvePropose: SpinResolver = (ctx, p, pend, value) => {
  if (value >= (pend.need ?? 11)) marry(ctx, p);
  else { ctx.msg(p, '프러포즈 실패... 조금 더 가까워져야 할 것 같다.', 'bad'); addAffinity(ctx, p, -20); }
};

export function onDestinyTile(ctx: Ctx, p: Player): void {
  if (p.spouse) { ctx.msg(p, '🌈 무지개 하트! 부부의 사랑이 더 깊어졌다.', 'love'); addFortune(ctx, p, 1); return; }
  const notMine = (c: PartnerState) => !p.partner || c.id !== p.partner.id;
  let pool = freePartners(ctx, (c) => c.stars >= 4 && notMine(c));
  if (!pool.length) pool = freePartners(ctx, (c) => c.stars === 3 && notMine(c));
  if (!pool.length) return;
  const c = ctx.choose(pool);
  ctx.msg(p, `🌈 운명의 만남! ${stars(c.stars)} ${c.name}(${c.job})`, 'love');
  const cur = partnerOf(ctx, p);
  if (!cur) { setPartner(ctx, p, c, 20); return; }
  ctx.state.pending = {
    type: 'choice', kind: 'destiny', playerId: p.id, candidate: c.id,
    title: `${c.name}에게 마음이 흔들린다... 상대를 바꿀까요?`,
    options: [
      { label: `${c.name}(${stars(c.stars)})로 바꾼다`, desc: '호감도 20부터 새로 시작' },
      { label: `${cur.name}(${stars(cur.stars)})를 지킨다`, desc: '현재 상대 호감도 +10' },
    ],
  };
}

export const resolveDestiny: ChoiceResolver = (ctx, p, pend, idx) => {
  const c = ctx.state.partners.find((x) => x.id === pend.candidate);
  if (idx === 0 && c && !c.takenBy) {
    setPartner(ctx, p, c, 20);
    ctx.msg(p, `💘 ${c.name}와(과) 새로운 사랑을 시작했다!`, 'love');
  } else {
    ctx.msg(p, '지금의 사람을 소중히 하기로 했다.', 'love');
    addAffinity(ctx, p, 10);
  }
};

export function onMarriageStop(ctx: Ctx, p: Player): void {
  if (p.spouse) { ctx.msg(p, '결혼식장 앞. 이미 행복한 가정이 있다!', 'love'); addFortune(ctx, p, 1); return; }
  if (!p.partner) {
    const pool = freePartners(ctx, (c) => c.stars <= 2);
    if (pool.length) {
      const c = ctx.choose(pool);
      setPartner(ctx, p, c, 30);
      ctx.msg(p, `💐 즉석 소개팅! ${stars(c.stars)} ${c.name}(${c.job})와(과) 만났다.`, 'love');
    }
  }
  const c = partnerOf(ctx, p);
  if (c) proposeSpin(ctx, p, c);
}

export function marry(ctx: Ctx, p: Player): void {
  const c = partnerOf(ctx, p);
  if (!c) return;
  p.spouse = c.name;
  ctx.events.push({ t: 'marry', pid: p.id, spouse: c.name, partner: c.id });
  ctx.msg(p, `💒 ${c.name}와(과) 결혼했다! 모두에게서 축의금을 받는다.`, 'love');
  collectFromOthers(ctx, p, WEDDING_GIFT, '축의금');
  addMoney(ctx, p, c.stars * 1000, `${c.name}의 지참금`);
  const card = c.stars >= 4 ? 'rankup' : PERSONALITY_CARD[c.personality];
  if (p.cards.length < HAND_MAX) {
    p.cards.push(card);
    ctx.events.push({ t: 'card', pid: p.id, card, gained: true });
  }
}
