/**
 * @pyramid-spec      design/server/room/room.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/room/room.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../data/data';
import { RuleError } from '../../engine/engine';
import type { ServerMessage } from '../protocol/protocol';
import { Room } from './room';

function setup(delayScale = 1) {
  const sent: ServerMessage[] = [];
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  let hex = 0;
  const room = new Room('ABCD', { send: () => {}, broadcast: (m) => sent.push(m) }, { delayScale, turnTimeout: 90000, disconnectedDelay: 6000 }, {
    randomHex: (n) => (hex++).toString(16).padStart(n * 2, '0'),
    randomSeed: () => 777,
    setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearTimeout: (h) => { (h as { cleared: boolean }).cleared = true; },
  });
  const runNext = () => { const t = timers.find((x) => !x.cleared); if (!t) return false; t.cleared = true; t.fn(); return true; };
  return { room, sent, timers, runNext };
}
const av = { ...AVATAR_DEFAULT };

describe('room', () => {
  it('1: 사람 추가와 방장', () => {
    const { room } = setup();
    const m = room.addHuman('a', av);
    expect(m.id.startsWith('u')).toBe(true);
    expect(m.token!.length).toBe(24);
    expect(room.hostId).toBe(m.id);
  });
  it('2: 가득 참', () => {
    const { room } = setup();
    room.addHuman('a', av); room.addCpu(); room.addCpu(); room.addCpu();
    expect(() => room.addHuman('b', av)).toThrow('가득');
    expect(() => room.addCpu()).toThrow('가득');
  });
  it('3: CPU 이름·색', () => {
    const { room } = setup();
    room.addHuman('a', av);
    const c1 = room.addCpu(); const c2 = room.addCpu();
    expect([c1.name, c2.name, c1.avatar.shirt, c2.avatar.shirt]).toEqual(['CPU 하나', 'CPU 두리', '#ff6b6b', '#4dabf7']);
  });
  it('4: 로비 정보에 토큰 없음', () => {
    const { room } = setup();
    room.addHuman('a', av); room.addCpu();
    const info = room.lobbyInfo();
    expect(JSON.stringify(info)).not.toContain('token');
    expect(info.members[1].connected).toBe(true);
  });
  it('5: 시작', () => {
    const { room, sent, timers } = setup();
    room.addHuman('a', av); room.addCpu();
    room.start();
    expect(sent.map((m) => m.type)).toEqual(['lobby', 'state']);
    expect((sent[0] as { room: { started: boolean } }).room.started).toBe(true);
    expect(timers.filter((t) => !t.cleared).length).toBe(1);
  });
  it('6: CPU 만 있으면 끝까지 진행', () => {
    const { room, sent, runNext } = setup(0.01);
    room.addCpu(); room.addCpu();
    room.start();
    let n = 0;
    while (room.game!.phase === 'playing' && runNext()) if (++n > 50000) break;
    expect(room.game!.phase).toBe('ended');
    const last = sent.filter((m) => m.type === 'state').at(-1) as { state: { phase: string } };
    expect(last.state.phase).toBe('ended');
  });
  it('7: 사람 조작', () => {
    const { room, sent } = setup();
    const a = room.addHuman('a', av);
    room.start();
    const seq = room.game!.seq;
    room.act(a.id, { type: 'spin', power: 0.5 });
    expect(room.game!.seq).toBe(seq + 1);
    expect(sent.at(-1)!.type).toBe('state');
  });
  it('8: 남의 조작', () => {
    const { room, sent } = setup();
    room.addHuman('a', av);
    room.start();
    const n = sent.length;
    expect(() => room.act('남', { type: 'spin', power: 0 })).toThrow(RuleError);
    expect(sent.length).toBe(n);
  });
  it('9: 옛 타이머는 무시', () => {
    const { room, timers } = setup();
    const a = room.addHuman('a', av);
    room.start();
    const old = timers[0];
    room.act(a.id, { type: 'spin', power: 0.5 });
    const seq = room.game!.seq;
    old.fn();
    expect(room.game!.seq).toBe(seq);
  });
  it('10: 재대결', () => {
    const { room, sent } = setup();
    const a = room.addHuman('a', av);
    const b = room.addHuman('b', av);
    room.addCpu();
    room.start();
    room.game = { ...room.game!, phase: 'ended' };
    b.connected = false;
    room.rematch();
    expect(room.members.map((m) => m.id)).toEqual([a.id, room.members[1].id]);
    expect(room.members.length).toBe(2);
    expect(room.game).toBeNull();
    expect(sent.slice(-2).map((m) => m.type)).toEqual(['lobby', 'backToLobby']);
  });
  it('11: 게임 중 제한', () => {
    const { room } = setup();
    const a = room.addHuman('a', av);
    room.start();
    expect(() => room.addHuman('b', av)).toThrow();
    expect(() => room.removeMember(a.id)).toThrow();
    room.setMode('kids');
    expect(room.mode).toBe('full');
  });
});
