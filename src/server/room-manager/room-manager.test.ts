/**
 * @pyramid-spec      design/server/room-manager/room-manager.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/room-manager/room-manager.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_DEFAULT } from '../../data/data';
import type { ClientMessage } from '../protocol/protocol';
import { CODE_CHARS, EMPTY_ROOM_TTL, RoomManager, type Socket } from './room-manager';

class FakeSocket implements Socket {
  sent: Record<string, unknown>[] = [];
  closed = false;
  get isOpen() { return !this.closed; }
  send(text: string) { this.sent.push(JSON.parse(text)); }
  close() { this.closed = true; }
  types() { return this.sent.map((m) => m.type); }
  last(type: string) { return [...this.sent].reverse().find((m) => m.type === type) as Record<string, any>; }
}

function setup(codeLetters = 'ABCDWXYZ') {
  const seq = [...codeLetters].map((ch) => CODE_CHARS.indexOf(ch));
  let i = 0; let hex = 0; let now = 1000;
  const mgr = new RoomManager({ delayScale: 1, turnTimeout: 90000, disconnectedDelay: 6000 }, {
    randomInt: () => seq[i++ % seq.length],
    randomHex: (n) => (hex++).toString(16).padStart(n * 2, '0'),
    randomSeed: () => 5,
    now: () => now,
    setInterval: () => 0, clearInterval: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
  });
  return { mgr, advance: (ms: number) => { now += ms; } };
}
const av = { ...AVATAR_DEFAULT };
const create = (): ClientMessage => ({ type: 'create', name: 'a', avatar: av, mode: 'full' });
const join = (code: string, token?: string): ClientMessage => ({ type: 'join', code, name: 'b', avatar: av, ...(token ? { token } : {}) });

describe('room-manager', () => {
  it('1: 방 만들기', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket();
    mgr.handle(s1, create());
    expect(mgr.rooms.has('ABCD')).toBe(true);
    expect(s1.types()).toEqual(['joined', 'lobby']);
  });
  it('2: 코드 중복이면 다시 뽑기', () => {
    const { mgr } = setup('ABCDABCDWXYZ');
    mgr.handle(new FakeSocket(), create());
    mgr.handle(new FakeSocket(), create());
    expect([...mgr.rooms.keys()]).toEqual(['ABCD', 'WXYZ']);
  });
  it('3: 참가', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket(); const s2 = new FakeSocket();
    mgr.handle(s1, create()); mgr.handle(s2, join('ABCD'));
    expect(s1.last('lobby').room.members.length).toBe(2);
    expect(s2.last('lobby').room.members.length).toBe(2);
  });
  it('4: 없는 방', () => { expect(() => setup().mgr.handle(new FakeSocket(), join('QQQQ'))).toThrow('존재하지 않는 방 코드입니다.'); });
  it('5: 방장 권한', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket(); const s2 = new FakeSocket();
    mgr.handle(s1, create()); mgr.handle(s2, join('ABCD'));
    expect(() => mgr.handle(s2, { type: 'addCpu' })).toThrow('방장만');
    expect(() => mgr.handle(s2, { type: 'start' })).toThrow('방장만 시작');
  });
  it('6·7·8: 끊김·재입장·중복 탭', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket(); const s2 = new FakeSocket();
    mgr.handle(s1, create()); mgr.handle(s2, join('ABCD'));
    const { token, playerId } = s2.last('joined');
    mgr.handle(s1, { type: 'start' });
    mgr.disconnect(s2);
    const room = mgr.rooms.get('ABCD')!;
    expect(room.members.find((m) => m.id === playerId)!.connected).toBe(false);
    const s3 = new FakeSocket();
    mgr.handle(s3, join('ABCD', token));
    expect(s3.last('joined').playerId).toBe(playerId);
    expect(s3.types()).toContain('state');
    expect(room.members.find((m) => m.id === playerId)!.connected).toBe(true);
    const s4 = new FakeSocket();
    mgr.handle(s4, join('ABCD', token));
    expect(s3.closed).toBe(true);
  });
  it('9: 게임 전 방장 나가기', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket(); const s2 = new FakeSocket();
    mgr.handle(s1, create()); mgr.handle(s2, join('ABCD'));
    mgr.handle(s1, { type: 'leave' });
    expect(mgr.rooms.get('ABCD')!.hostId).toBe(s2.last('joined').playerId);
    expect(s2.last('lobby').room.hostId).toBe(s2.last('joined').playerId);
  });
  it('10: 빈 방 정리', () => {
    const { mgr, advance } = setup();
    const s1 = new FakeSocket();
    mgr.handle(s1, create());
    mgr.handle(s1, { type: 'start' });
    mgr.disconnect(s1);
    advance(EMPTY_ROOM_TTL + 1);
    mgr.collect();
    expect(mgr.rooms.size).toBe(0);
  });
  it('11: 내보내기', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket(); const s2 = new FakeSocket();
    mgr.handle(s1, create()); mgr.handle(s2, join('ABCD'));
    mgr.handle(s1, { type: 'removeMember', id: s2.last('joined').playerId });
    expect(s2.types()).toContain('kicked');
    expect(mgr.rooms.get('ABCD')!.members.length).toBe(1);
  });
  it('12: 묶이지 않은 소켓', () => { expect(() => setup().mgr.handle(new FakeSocket(), { type: 'start' })).toThrow('방에 들어가 있지 않습니다.'); });
  it('13: ping 과 빈 채팅', () => {
    const { mgr } = setup();
    const s1 = new FakeSocket();
    mgr.handle(s1, create());
    mgr.handle(s1, { type: 'ping', t: 5 });
    expect(s1.last('pong').t).toBe(5);
    const n = s1.sent.length;
    mgr.handle(s1, { type: 'chat', text: '' });
    expect(s1.sent.length).toBe(n);
  });
});
