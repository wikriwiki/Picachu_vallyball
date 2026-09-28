/**
 * @pyramid-spec      design/view/board-view/board-view.md
 * @pyramid-parent    design/view/view.md
 * @pyramid-on-change 1) design/view/board-view/board-view.md 먼저 수정 2) 이 코드 수정 3) design/view/view.md 「통합 방식」 영향 검토
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BOARD } from '../../data/data';
import type { Stage } from '../stage/stage';
import { buildBoardView } from './board-view';

describe('board-view 통합', () => {
  it('칸 428개 위치·방향, 활성 칸 설정', () => {
    const scene = new THREE.Scene();
    const stage = { scene, onFrame: () => {} } as unknown as Stage;
    const bv = buildBoardView(stage);
    expect(bv.tilePos.length).toBe(BOARD.tiles.length);
    expect(bv.tileHeading.length).toBe(BOARD.tiles.length);
    const inst = scene.children.find((o) => o instanceof THREE.InstancedMesh && (o as THREE.InstancedMesh).count === BOARD.tiles.length) as THREE.InstancedMesh;
    expect(inst).toBeTruthy();
    bv.setActiveTile(5);
    expect((inst.material as THREE.ShaderMaterial).uniforms.uActive.value).toBe(5);
  });
});
