/**
 * @pyramid-spec      design/server/scheduler/scheduler.md
 * @pyramid-parent    design/server/server.md
 * @pyramid-on-change 1) design/server/scheduler/scheduler.md 먼저 수정 2) 이 코드 수정 3) design/server/server.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../engine/engine';
import { delayFor, estimateMs } from './scheduler';

const E = (e: object) => e as GameEvent;
const opts = { delayScale: 1, turnTimeout: 90000, disconnectedDelay: 6000 };

describe('scheduler', () => {
  it('1: 빈 목록', () => { expect(estimateMs([])).toBe(400); });
  it('2: 룰렛·이동·메시지', () => {
    expect(estimateMs([E({ t: 'spin', auto: false }), E({ t: 'move', path: [1, 2, 3] }), E({ t: 'msg' })])).toBe(5540);
  });
  it('3: 자동 룰렛·날기·걷기·출산·기타', () => {
    expect(estimateMs([E({ t: 'spin', auto: true }), E({ t: 'warp', fly: true }), E({ t: 'warp', fly: false }), E({ t: 'kid' }), E({ t: 'stat' })])).toBe(6860);
  });
  it('4: 상한', () => { expect(estimateMs(Array(6).fill(E({ t: 'result' })))).toBe(20000); });
  it('5: 종류별 대기', () => {
    expect([delayFor('cpu', [], opts), delayFor('offline', [], opts), delayFor('human', [], opts)]).toEqual([1100, 6400, 90400]);
  });
  it('6: 배율', () => { expect(delayFor('cpu', [], { ...opts, delayScale: 0.01 })).toBeCloseTo(11); });
});
