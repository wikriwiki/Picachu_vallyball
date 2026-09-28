/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/lobby/room/room.md
 * @pyramid-parent    design/client/lobby/lobby.md
 * @pyramid-on-change 1) design/client/lobby/room/room.md 먼저 수정 2) 이 코드 수정 3) design/client/lobby/lobby.md 「통합 방식」 영향 검토
 */
import { describe, expect, it, vi } from 'vitest';
import { AVATAR_DEFAULT } from '../../../data/data';
import type { LobbyInfo } from '../../../server/protocol/protocol';
import { fakeCtx } from '../../testkit';
import { initRoom } from './room';

const mem = (id: string, name: string, cpu = false) => ({ id, name, avatar: { ...AVATAR_DEFAULT }, cpu, connected: true });
function setup(room: LobbyInfo, me: string) {
  const ctx = fakeCtx();
  const toast = vi.fn();
  (ctx as unknown as { display: unknown }).display = { toast, sound: { unlock: vi.fn() } };
  const writeText = vi.fn(async () => {});
  const r = initRoom(ctx, { clipboard: { writeText }, location: { origin: 'https://x', pathname: '/' }, history: { replaceState: vi.fn() } });
  ctx.store.set({ room, me });
  r.render();
  return { ctx, toast, writeText };
}
const room = (members: ReturnType<typeof mem>[], hostId = 'a'): LobbyInfo => ({ code: 'ABCD', hostId, mode: 'full', started: false, members });

describe('room', () => {
  it('1: 방장 화면', () => {
    const { ctx } = setup(room([mem('a', '나'), mem('c', 'CPU 하나', true)]), 'a');
    expect(ctx.shell.el('room-code').textContent).toBe('ABCD');
    const cards = ctx.shell.el('members').children;
    expect(cards.length).toBe(4);
    expect(cards[0].textContent).toContain('방장');
    expect(cards[0].textContent).toContain('나');
    expect(cards[1].querySelector('.kick')).not.toBeNull();
    expect(cards[2].classList.contains('empty')).toBe(true);
  });
  it('2: 방장 아님', () => {
    const { ctx } = setup(room([mem('a', '가'), mem('b', '나')]), 'b');
    expect(ctx.shell.el<HTMLSelectElement>('lobby-mode').disabled).toBe(true);
    expect(ctx.shell.el<HTMLButtonElement>('btn-cpu').disabled).toBe(true);
    expect(ctx.shell.el<HTMLButtonElement>('btn-start').disabled).toBe(true);
    expect(ctx.shell.el('lobby-hint').textContent).toContain('기다리는 중');
  });
  it('3: 가득 참', () => {
    const { ctx } = setup(room([mem('a', '1'), mem('b', '2'), mem('c', '3'), mem('d', '4')]), 'a');
    expect(ctx.shell.el<HTMLButtonElement>('btn-cpu').disabled).toBe(true);
  });
  it('4: 이름 이스케이프', () => {
    const { ctx } = setup(room([mem('a', '<b>x</b>')]), 'a');
    expect(ctx.shell.el('members').querySelector('.nm')!.textContent!.startsWith('<b>x</b>')).toBe(true);
  });
  it('5: 내보내기', () => {
    const { ctx } = setup(room([mem('a', '1'), mem('b', '2')]), 'a');
    (ctx.shell.el('members').querySelector('.kick') as HTMLElement).click();
    expect(ctx.sent).toEqual([{ type: 'removeMember', id: 'b' }]);
  });
  it('6: 나가기', () => {
    const { ctx } = setup(room([mem('a', '1')]), 'a');
    ctx.shell.show('lobby');
    ctx.shell.el('btn-leave').click();
    expect(ctx.sent).toEqual([{ type: 'leave' }]);
    expect(ctx.connection.clearSession).toHaveBeenCalled();
    expect(ctx.shell.current()).toBe('title');
  });
  it('7: 초대 링크', async () => {
    const { ctx, writeText, toast } = setup(room([mem('a', '1')]), 'a');
    ctx.shell.el('btn-copy').click();
    await Promise.resolve(); await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith('https://x/?room=ABCD');
    expect(toast).toHaveBeenCalled();
  });
});
