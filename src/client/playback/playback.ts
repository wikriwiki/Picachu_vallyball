/**
 * @pyramid-spec      design/client/playback/playback.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/playback/playback.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import { CARDS, FORTUNES, STAT_NAMES, formatMoney, jobById } from '../../data/data';
import type { GameEvent, PublicState } from '../../engine/engine';
import type { View } from '../../view/view';
import type { ClientCtx } from '../ctx';
import { esc } from '../display/display';

export interface Playback { enqueue(state: PublicState, events: GameEvent[]): void; reset(): void; }

export function createPlayback(ctx: ClientCtx, deps: { sleep?: (ms: number) => Promise<void> } = {}): Playback {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const { store, shell } = ctx;
  const queue: { state: PublicState; events: GameEvent[] }[] = [];
  const sync = () => store.set({ queued: queue.length });

  async function play(view: View, events: GameEvent[]) {
    const d = ctx.display;
    const shown = store.get('shown')!;
    const fast = () => queue.length > 3;
    const wait = (ms: number) => sleep(fast() ? ms * 0.3 : ms);
    const P = (pid: string) => shown.players.find((p) => p.id === pid);
    const idx = (pid: string) => shown.players.findIndex((p) => p.id === pid);
    const me = store.get('me');
    const sign = (n: number) => (n > 0 ? '+' : '');
    for (const e of events) {
      if ('pid' in e && e.pid && !P(e.pid)) continue;
      switch (e.t) {
        case 'turn': {
          view.focus(e.pid); view.zoomDefault();
          shown.pending = { type: 'spin', playerId: e.pid, purpose: 'move', title: '' };
          d.renderHud(shown);
          d.message(e.pid === me ? '당신의 차례! 룰렛을 돌리세요.' : `${P(e.pid)!.name}의 차례`, 'info', e.pid);
          d.sound.turn();
          break;
        }
        case 'spin':
          view.focus(e.pid);
          if (e.purpose === 'freelance') d.message('프리랜서 수입 룰렛!', 'payday', e.pid);
          await view.roulette.spinTo(e.value, fast() || !!e.auto);
          d.floater(e.pid, `🎯 ${e.value}`, 'info');
          await wait(350);
          break;
        case 'move':
          view.focus(e.pid);
          await view.hopPath(e.pid, e.path, idx(e.pid), (ti) => { d.sound.hop(); view.setActiveTile(ti); P(e.pid)!.tile = ti; });
          break;
        case 'land': view.setActiveTile(e.tile); break;
        case 'msg': {
          d.message(e.text, e.kind, e.pid);
          if (e.kind === 'lucky') d.sound.lucky();
          else if (e.kind === 'bad') d.sound.lose();
          else if (e.kind === 'love') d.sound.love();
          else if (e.kind === 'card') d.sound.card();
          d.addLog((e.pid ? `<b>${esc(P(e.pid)?.name ?? '')}</b>: ` : '') + esc(e.text));
          await wait(1150);
          break;
        }
        case 'money': {
          P(e.pid)!.money += e.delta;
          d.floater(e.pid, `${sign(e.delta)}${formatMoney(e.delta)}`, e.delta > 0 ? 'plus' : 'minus');
          if (e.delta > 0) d.sound.money();
          d.renderHud(shown);
          await wait(250);
          break;
        }
        case 'note': {
          const p = P(e.pid)!; p.notes = e.total; p.money += e.count * 1000;
          d.floater(e.pid, `📄 약속어음 +${e.count}장`, 'minus');
          d.renderHud(shown);
          await wait(500);
          break;
        }
        case 'stat':
          P(e.pid)!.stats[e.stat] = e.value;
          d.floater(e.pid, `${STAT_NAMES[e.stat]} ${sign(e.delta)}${e.delta}`, e.delta > 0 ? 'plus' : 'minus');
          d.renderHud(shown);
          await wait(220);
          break;
        case 'fortune':
          P(e.pid)!.fortune = e.value;
          d.floater(e.pid, `운세 ${FORTUNES[e.value]}`, e.delta > 0 ? 'plus' : 'minus');
          d.renderHud(shown);
          await wait(220);
          break;
        case 'partner':
          P(e.pid)!.partner = { id: e.partner, affinity: e.affinity };
          d.floater(e.pid, `💘 ${e.name} ${'★'.repeat(e.stars)}`, 'plus');
          d.renderHud(shown);
          await wait(500);
          break;
        case 'affinity': {
          const p = P(e.pid)!;
          if (p.partner) p.partner.affinity = e.value;
          d.floater(e.pid, `💗 호감도 ${sign(e.delta)}${e.delta}`, e.delta > 0 ? 'plus' : 'minus');
          d.renderHud(shown);
          await wait(300);
          break;
        }
        case 'junction':
          view.focus(e.pid);
          d.message(e.pid === me ? '갈림길이다! 어느 길로 갈지 고르세요.' : '갈림길에서 고민 중...', 'info', e.pid);
          await wait(300);
          break;
        case 'card': {
          const p = P(e.pid)!;
          if (e.gained) { p.cards.push(e.card); d.floater(e.pid, `🃏 ${CARDS[e.card].name}`, 'info'); d.sound.card(); }
          if (e.used) {
            const i = p.cards.indexOf(e.card);
            if (i >= 0) p.cards.splice(i, 1);
            d.message(`${CARDS[e.card].name} 사용!`, 'lucky', e.pid);
            d.sound.card();
            await wait(700);
          }
          d.renderHud(shown);
          break;
        }
        case 'treasure': d.floater(e.pid, `💎 ${e.name}`, 'info'); await wait(400); break;
        case 'house': view.confettiAt(e.pid); break;
        case 'job': {
          const p = P(e.pid)!; p.job = e.job; p.rank = e.rank;
          const j = jobById(e.job);
          if (e.promoted && j) {
            d.floater(e.pid, `⬆️ ${j.ranks[e.rank].name}`, 'plus');
            d.addLog(`<b>${esc(p.name)}</b>: ${j.icon} ${esc(j.ranks[e.rank].name)} 승진!`);
            view.confettiAt(e.pid);
            d.sound.lucky();
          }
          d.renderHud(shown);
          await wait(500);
          break;
        }
        case 'marry':
          P(e.pid)!.spouse = e.spouse;
          view.confettiAt(e.pid); view.flash(0.35); d.sound.love(); view.syncPieces(shown, true);
          await wait(600);
          break;
        case 'kid':
          P(e.pid)!.kids.push(e.name);
          view.confettiAt(e.pid); d.sound.love(); view.syncPieces(shown, true);
          await wait(500);
          break;
        case 'era':
          shown.era = e.era;
          view.flash(0.7); d.sound.era(); d.renderHud(shown);
          await d.banner(`${esc(e.name)}<small>새로운 시대가 시작됩니다!</small>`, fast() ? 900 : 2200);
          break;
        case 'warp':
          P(e.pid)!.tile = e.tile;
          view.focus(e.pid); view.syncPieces(shown, true);
          if (e.fly) d.sound.lucky();
          await view.warp(e.pid, e.tile, idx(e.pid), !!e.fly);
          break;
        case 'goal':
          P(e.pid)!.finished = true;
          view.focus(e.pid); view.confettiAt(e.pid); view.flash(0.5); d.sound.fanfare();
          await wait(900);
          break;
        case 'chose':
          if (e.pid !== me) d.message(`「${e.label}」 을(를) 골랐다.`, 'info', e.pid);
          await wait(e.pid !== me ? 900 : 100);
          break;
        case 'result': await wait(600); break;
        default: break;
      }
    }
  }

  async function pump() {
    if (store.get('busy')) return;
    store.set({ busy: true });
    try {
      const view = await ctx.ensureView();
      while (queue.length) {
        const item = queue.shift()!;
        sync();
        try {
          const { state, events } = item;
          if (!store.get('state')) {
            shell.show('game');
            store.set({ shown: structuredClone(state) });
            view.syncPieces(state, false);
            view.focus(state.pending?.playerId ?? state.players[0].id, true);
            ctx.display.renderHud(state);
            store.set({ state });
            if (events.length) await play(view, events);
          } else {
            const shown = structuredClone(store.get('state')!);
            store.set({ shown });
            view.syncPieces(shown, true);
            await play(view, events);
            store.set({ state });
          }
          view.syncPieces(state, false);
          ctx.display.renderHud(state);
          if (state.phase === 'ended' && !store.get('resultShown')) {
            store.set({ resultShown: true });
            await ctx.display.showResult(state);
          }
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      store.set({ busy: false });
      ctx.controls.updateControls();
    }
  }

  return {
    enqueue(state, events) { queue.push({ state, events }); sync(); void pump(); },
    reset() { queue.length = 0; sync(); },
  };
}
