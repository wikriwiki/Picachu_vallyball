/**
 * @pyramid-spec      design/client/controls/spin/spin.md
 * @pyramid-parent    design/client/controls/controls.md
 * @pyramid-on-change 1) design/client/controls/spin/spin.md 먼저 수정 2) 이 코드 수정 3) design/client/controls/controls.md 「통합 방식」 영향 검토
 */
import type { Action, Pending } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';

export function powerAt(seconds: number): number { return 0.5 - 0.5 * Math.cos(seconds * 3.2); }

export function initSpin(ctx: ClientCtx, send: (a: Action) => void, deps: { now?: () => number; raf?: (fn: () => void) => void } = {}) {
  const now = deps.now ?? (() => performance.now());
  const raf = deps.raf ?? ((fn: () => void) => { requestAnimationFrame(() => fn()); });
  const { shell, store, doc } = ctx;
  const btn = shell.el<HTMLButtonElement>('btn-spin');
  let charging: { t0: number; power: number } | null = null;

  const typing = () => { const a = doc.activeElement as HTMLElement | null; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); };
  const start = (e?: Event) => {
    e?.preventDefault();
    const p = store.myPending();
    if (!p || p.type !== 'spin' || charging) return;
    ctx.display.sound.unlock();
    btn.classList.add('charging');
    charging = { t0: now(), power: 0 };
    const loop = () => {
      if (!charging) return;
      const power = powerAt((now() - charging.t0) / 1000);
      charging.power = power;
      shell.el('power-fill').style.width = `${Math.round(power * 100)}%`;
      ctx.getView()?.roulette.charge(power);
      raf(loop);
    };
    loop();
  };
  const end = (e?: Event) => {
    e?.preventDefault();
    if (!charging) return;
    const power = powerAt((now() - charging.t0) / 1000);
    charging = null;
    btn.classList.remove('charging');
    ctx.getView()?.roulette.release();
    setTimeout(() => { shell.el('power-fill').style.width = '0'; }, 400);
    send({ type: 'spin', power });
  };
  for (const id of ['btn-spin', 'cmd-roulette'] as const) {
    const el = shell.el(id);
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
  }
  doc.defaultView?.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && !typing()) start(e); });
  doc.defaultView?.addEventListener('keyup', (e) => { if (e.code === 'Space' && !typing()) end(e); });
  return { update(p: Pending | null) { btn.disabled = !(p && p.type === 'spin'); } };
}
