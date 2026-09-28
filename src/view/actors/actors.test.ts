/**
 * @pyramid-spec      design/view/actors/actors.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/actors/actors.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AVATAR_DEFAULT } from '../../data/data';
import { createGame, publicState } from '../../engine/engine';
import type { Stage } from '../stage/stage';
import { buildBoardView } from '../board-view/board-view';
import { createActors } from './actors';

function fakeStage() {
  const tweens: ((t: number) => void)[] = [];
  return {
    scene: new THREE.Scene(), onFrame: () => {}, orbit: { distGoal: 30 }, setDistance: () => {},
    tween: (_ms: number, fn: (t: number) => void) => { tweens.push(fn); fn(0.5); fn(1); return Promise.resolve(); },
  } as unknown as Stage;
}

describe('actors 통합', () => {
  it('4명 말이 서로 다른 자리에 서고, 어른이 되면 자동차를 탄다', async () => {
    const stage = fakeStage();
    const board = buildBoardView(stage);
    const actors = createActors(stage, board);
    const seeds = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, avatar: { ...AVATAR_DEFAULT }, cpu: true }));
    const s = publicState(createGame({ players: seeds, seed: 1 }).state);
    actors.syncPieces(s, false);
    const ps = seeds.map((p) => actors.piecePos(p.id)!.clone());
    expect(new Set(ps.map((v) => `${v.x.toFixed(3)},${v.z.toFixed(3)}`)).size).toBe(4);
    const steps: number[] = [];
    await actors.hopPath('p0', [1, 2, 3], 0, (t) => steps.push(t));
    expect(steps).toEqual([1, 2, 3]);
    const adult = { ...s, era: 4 };
    adult.players[0].spouse = '지우';
    adult.players[0].kids = ['콩이'];
    expect(() => actors.syncPieces(adult, false)).not.toThrow();
  });
});
