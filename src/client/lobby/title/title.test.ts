/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/lobby/title/title.md
 * @pyramid-parent    design/client/lobby/lobby.md
 * @pyramid-on-change 1) design/client/lobby/title/title.md 먼저 수정 2) 이 코드 수정 3) design/client/lobby/lobby.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { fakeCtx } from '../../testkit';
import { PROFILE_KEY, initTitle, loadProfile } from './title';

const mem = (init?: string) => { const m = new Map<string, string>(init ? [[PROFILE_KEY, init]] : []); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, m }; };
function setup(init?: string) {
  const ctx = fakeCtx();
  const toast = vi.fn();
  (ctx as unknown as { display: unknown }).display = { toast, sound: { unlock: vi.fn() } };
  const storage = mem(init);
  const preview = { setAvatar: vi.fn(), setActive: vi.fn() };
  const t = initTitle(ctx, { storage, preview: () => preview });
  return { ctx, storage, preview, toast, t };
}

describe('title', () => {
  it('1: 프로필 읽기', () => {
    const p = loadProfile(mem('{"name":"민수","avatar":{"shirt":"#51cf66"}}'));
    expect(p.name).toBe('민수'); expect(p.avatar.shirt).toBe('#51cf66'); expect(p.avatar.skin).toBe('#f5d0b0');
  });
  it('2: 깨진 값', () => { expect(loadProfile(mem('{bad')).avatar.skin).toBe('#f5d0b0'); });
  it('3: 색 버튼', () => {
    const { ctx, storage, preview } = setup();
    const btn = ctx.shell.el('avatar-opts').querySelector('button.sw[data-value="#51cf66"]') as HTMLButtonElement;
    btn.click();
    expect(JSON.parse(storage.m.get(PROFILE_KEY)!).avatar.shirt).toBe('#51cf66');
    expect(preview.setAvatar).toHaveBeenCalled();
    expect((ctx.shell.el('avatar-opts').querySelector('button.sw[data-value="#51cf66"]') as HTMLElement).classList.contains('sel')).toBe(true);
  });
  it('4: 방 만들기', () => {
    const { ctx } = setup();
    ctx.shell.el<HTMLInputElement>('inp-name').value = '민수';
    ctx.shell.el<HTMLSelectElement>('sel-mode').value = 'adult';
    ctx.shell.el('btn-create').click();
    expect(ctx.sent[0]).toMatchObject({ type: 'create', name: '민수', mode: 'adult' });
  });
  it('5: 짧은 코드', () => {
    const { ctx, toast } = setup();
    ctx.shell.el<HTMLInputElement>('inp-code').value = 'ab1';
    ctx.shell.el('btn-join').click();
    expect(toast).toHaveBeenCalled();
    expect(ctx.sent).toEqual([]);
  });
  it('6: Enter 참가', () => {
    const { ctx } = setup();
    ctx.shell.el<HTMLInputElement>('inp-code').value = 'abcd';
    ctx.shell.el('inp-code').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(ctx.sent[0]).toMatchObject({ type: 'join', code: 'ABCD' });
  });
  it('7: 연결 상태', () => {
    const { ctx, t } = setup();
    t.setConnStatus('open');
    expect(ctx.shell.el('conn-status').className).toBe('conn ok');
    expect(ctx.shell.el('conn-status').textContent).toBe('서버 연결됨 ✓');
  });
  it('8: 주소의 방 코드', () => {
    const { ctx, t } = setup();
    t.fillCodeFromUrl('?room=wxyz');
    expect(ctx.shell.el<HTMLInputElement>('inp-code').value).toBe('WXYZ');
  });
});
