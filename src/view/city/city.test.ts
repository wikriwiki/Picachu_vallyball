/**
 * @pyramid-spec      design/view/city/city.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/city/city.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOARD } from '../../data/data';
import type { Stage } from '../stage/stage';
import { buildEnvironment } from '../environment/environment';
import { buildBoardView } from '../board-view/board-view';
import { buildCity, makeCityCtx } from './city';

describe('city 통합', () => {
  it('도시를 만들고 프레임 갱신이 동작하며, 랜드마크 영역은 보드 칸과 겹치지 않는다', () => {
    const frames: ((t: number, dt: number) => void)[] = [];
    const stage = {
      scene: new THREE.Scene(), onFrame: (f: (t: number, dt: number) => void) => frames.push(f),
      target: new THREE.Vector3(), orbit: { dist: 30 }, camera: new THREE.PerspectiveCamera(),
    } as unknown as Stage;
    const env = buildEnvironment(stage);
    const board = buildBoardView(stage);
    const before = stage.scene.children.length;
    expect(() => buildCity(stage, env, board)).not.toThrow();
    expect(stage.scene.children.length).toBeGreaterThan(before + 20);
    expect(() => frames.forEach((f) => f(1, 0.016))).not.toThrow();
    const ctx = makeCityCtx(stage, env, board);
    expect(ctx.roadZs[0]).toBe(-10.5);
    expect(ctx.side).toBe(38);
    expect(BOARD.tiles.length).toBe(428);
  }, 60000);
});
