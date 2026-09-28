/**
 * @pyramid-spec      design/engine/systems/career/career.md
 * @pyramid-parent    design/engine/systems/systems.md
 * @pyramid-on-change 1) design/engine/systems/career/career.md 먼저 수정 2) 이 코드 수정 3) design/engine/systems/systems.md 「통합 방식」 영향 검토
 */
import { JOBS, STAT_NAMES, formatMoney, gradeIndex, jobById, meetsReq, type StatKey } from '../../../data/data';
import { addMoney, addStat, type ChoicePending, type ChoiceResolver, type Ctx, type Player, type SpinResolver } from '../../core/core';

const KIND_LABEL = { stat: '능력치 승진형', spin: '룰렛 승진형', free: '월급 룰렛형' } as const;

export function makeJobChoice(_ctx: Ctx, p: Player): ChoicePending {
  return {
    type: 'choice', kind: 'job', playerId: p.id,
    title: '직업을 고르세요 (능력치 조건을 만족한 직업만 가능)',
    options: JOBS.map((j) => {
      const r = j.ranks[0];
      const req = r.req ? (Object.entries(r.req) as [StatKey, string][]).map(([k, g]) => `${STAT_NAMES[k]} ${g}`).join(' · ') : '조건 없음';
      return {
        label: `${j.icon} ${j.name}`,
        desc: `${r.name} ${formatMoney(r.salary)} → 최고 ${formatMoney(j.ranks[j.ranks.length - 1].salary)} | ${KIND_LABEL[j.type]} | ${req}`,
        disabled: !meetsReq(p, r),
        jobId: j.id,
      };
    }),
  };
}

export const resolveJob: ChoiceResolver = (ctx, p, pend, idx) => {
  const job = jobById(pend.options[idx].jobId);
  if (!job) return;
  p.job = job.id;
  p.rank = 0;
  ctx.events.push({ t: 'job', pid: p.id, job: job.id, rank: 0, promoted: false });
  ctx.msg(p, `${job.icon} ${job.name} 「${job.ranks[0].name}」(으)로 취직!`, 'lucky');
};

export function promoteByStats(ctx: Ctx, p: Player): void {
  const job = jobById(p.job);
  if (!job) return;
  while (p.rank < job.ranks.length - 1 && meetsReq(p, job.ranks[p.rank + 1])) {
    p.rank += 1;
    ctx.events.push({ t: 'job', pid: p.id, job: job.id, rank: p.rank, promoted: true });
    ctx.log(`${p.name}: ${job.ranks[p.rank].name}(으)로 승진!`);
  }
}

export function promoteOne(ctx: Ctx, p: Player): boolean {
  const job = jobById(p.job);
  if (!job || p.rank >= job.ranks.length - 1) return false;
  p.rank += 1;
  ctx.events.push({ t: 'job', pid: p.id, job: job.id, rank: p.rank, promoted: true });
  return true;
}

export function rankupNeed(p: Player): number {
  const job = jobById(p.job);
  if (!job) return 9;
  const gi = gradeIndex(p.stats[job.key]);
  return Math.max(3, Math.min(9, 9 - Math.floor(gi * 0.8) + p.rank));
}

export function onChallengeTile(ctx: Ctx, p: Player): void {
  const job = jobById(p.job);
  if (!job) return;
  if (job.type === 'spin' && p.rank < job.ranks.length - 1) {
    const need = rankupNeed(p);
    ctx.state.pending = {
      type: 'spin', playerId: p.id, purpose: 'rankup', need,
      title: `랭크업 찬스! ${need} 이상이면 「${job.ranks[p.rank + 1].name}」(으)로!`,
    };
  } else if (job.type === 'stat') {
    ctx.msg(p, '승진 심사! 능력치를 갈고닦았다.', 'event');
    addStat(ctx, p, job.key, 4);
    promoteByStats(ctx, p);
  } else {
    ctx.msg(p, '큰 의뢰가 들어왔다!', 'event');
    addMoney(ctx, p, 1500, '의뢰 수입');
  }
}

export const resolveRankup: SpinResolver = (ctx, p, pend, value) => {
  const job = jobById(p.job);
  if (!job) return;
  if (value >= (pend.need ?? 10)) {
    promoteOne(ctx, p);
    const r = job.ranks[p.rank];
    ctx.msg(p, `성공! 「${r.name}」(으)로 랭크업! 월급 ${formatMoney(r.salary)}`, 'lucky');
  } else {
    ctx.msg(p, '아쉽게도 랭크업 실패...', 'bad');
    addStat(ctx, p, job.key, 2);
  }
};
