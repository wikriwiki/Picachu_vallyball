/**
 * @pyramid-spec      design/server/protocol/protocol.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/protocol/protocol.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import { ProtocolError, parseClientMessage, sanitizeAvatar, sanitizeName } from './protocol';

const P = (o: unknown) => parseClientMessage(JSON.stringify(o));

describe('protocol', () => {
  it('1: 해석 불가 → null', () => {
    expect(parseClientMessage('{bad')).toBeNull();
    expect(parseClientMessage('3')).toBeNull();
    expect(parseClientMessage('{"x":1}')).toBeNull();
  });
  it('2: 알 수 없는 요청', () => { expect(() => P({ type: 'fly' })).toThrow(ProtocolError); });
  it('3: create 정리', () => {
    const m = P({ type: 'create', name: '<민수>', mode: 'zzz', avatar: { skin: 'red' }, x: 1 });
    expect(m).toMatchObject({ type: 'create', name: '민수', mode: 'full' });
    expect((m as { avatar: { skin: string } }).avatar.skin).toBe('#f5d0b0');
    expect('x' in (m as object)).toBe(false);
  });
  it('4: join 정리', () => {
    const m = P({ type: 'join', code: ' abcd ', token: '' }) as Record<string, unknown>;
    expect(m.code).toBe('ABCD');
    expect('token' in m).toBe(false);
    expect(m.name).toBe('플레이어');
  });
  it('5: chat 120자', () => { expect((P({ type: 'chat', text: '가'.repeat(200) }) as { text: string }).text.length).toBe(120); });
  it('6: 모드 오류', () => { expect(() => P({ type: 'setMode', mode: 'hard' })).toThrow('알 수 없는 모드입니다.'); });
  it('7: 카드 조작', () => {
    expect(P({ type: 'action', action: { type: 'card', index: 1.7, number: '7' } })).toEqual({ type: 'action', action: { type: 'card', index: 1 } });
  });
  it('8: 힘 기본값', () => {
    expect(P({ type: 'action', action: { type: 'spin', power: 'x' } })).toEqual({ type: 'action', action: { type: 'spin', power: 0 } });
  });
  it('9: 알 수 없는 조작', () => { expect(() => P({ type: 'action', action: { type: 'jump' } })).toThrow('알 수 없는 조작입니다.'); });
  it('10: 이름 자르기', () => { expect(sanitizeName('  가나다라마바사아자차카  ')).toBe('가나다라마바사아자차'); });
  it('11: 아바타 정리', () => {
    expect(sanitizeAvatar({ hairStyle: 9, face: -1, shirt: '#ABCDEF' })).toEqual({
      skin: '#f5d0b0', hair: '#4a3020', shirt: '#ABCDEF', pants: '#364fc7', hairStyle: 3, face: 0,
    });
  });
});
