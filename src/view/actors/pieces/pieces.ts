/**
 * @pyramid-spec      design/view/actors/pieces/pieces.md
 * @pyramid-parent    design/view/actors/actors.md
 * @pyramid-on-change 1) design/view/actors/pieces/pieces.md 먼저 수정 2) 이 코드 수정 3) design/view/actors/actors.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import type { PublicState, Player } from '../../../engine/engine';
import { canvasTexture, easeInOut, textSprite } from '../../toolkit/toolkit';
import type { Stage } from '../../stage/stage';
import { TILE_Y, type BoardView } from '../../board-view/board-view';
import { buildAvatar, buildCar, buildPeg, setAvatarAge } from '../avatar-model/avatar-model';

export const SLOT_OFFSETS: readonly [number, number][] = [[-0.65, -0.55], [0.65, -0.55], [-0.65, 0.6], [0.65, 0.6]];

export function slotPos(base: { x: number; z: number }, heading: number, index: number): { x: number; z: number } {
  const [ox, oz] = SLOT_OFFSETS[index % 4];
  const c = Math.cos(heading); const s = Math.sin(heading);
  return { x: base.x + ox * c + oz * s, z: base.z - ox * s + oz * c };
}

interface Piece {
  root: THREE.Group; fig: THREE.Group; car: THREE.Group; pegs: THREE.Group; pin: THREE.Sprite; ring: THREE.Mesh;
  index: number; era: number; family: number; pinY: number;
}

function pinSprite(p: Player): THREE.Sprite {
  const av = p.avatar;
  const tex = canvasTexture(128, 176, (g) => {
    g.fillStyle = av.shirt; g.strokeStyle = '#2a2238'; g.lineWidth = 6;
    g.beginPath(); g.arc(64, 62, 54, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(64, 168); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 62, 42, 0, 7); g.fill();
    g.fillStyle = av.skin; g.beginPath(); g.arc(64, 70, 30, 0, 7); g.fill();
    g.fillStyle = av.hair; g.beginPath(); g.arc(64, 62, 32, Math.PI, 0); g.fill();
    g.fillStyle = '#2a2238'; g.beginPath(); g.arc(53, 72, 4, 0, 7); g.arc(75, 72, 4, 0, 7); g.fill();
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sp.scale.set(1.3, 1.8, 1);
  sp.center.set(0.5, 0);
  const label = textSprite(p.name, { bg: av.shirt, size: 40, scale: 0.55 });
  label.position.y = -0.35;
  sp.add(label);
  return sp;
}

export function createPieces(stage: Stage, board: BoardView) {
  const pieces = new Map<string, Piece>();
  const posAt = (tile: number, index: number) => {
    const p = slotPos(board.tilePos[tile], board.tileHeading[tile], index);
    return new THREE.Vector3(p.x, TILE_Y + 0.12, p.z);
  };
  const ensure = (p: Player, index: number): Piece => {
    let pc = pieces.get(p.id);
    if (pc) return pc;
    const root = new THREE.Group();
    const fig = buildAvatar(p.avatar);
    const car = buildCar(p.avatar.shirt);
    car.visible = false;
    const pegs = new THREE.Group();
    const pin = pinSprite(p);
    pin.position.y = 3.1;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 32), new THREE.MeshBasicMaterial({ color: p.avatar.shirt, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.55;
    root.add(fig, car, pegs, pin, ring);
    stage.scene.add(root);
    root.position.copy(posAt(p.tile, index));
    root.rotation.y = board.tileHeading[p.tile];
    pc = { root, fig, car, pegs, pin, ring, index, era: -1, family: -1, pinY: 3.1 };
    pieces.set(p.id, pc);
    return pc;
  };

  stage.onFrame((time, dt) => {
    for (const pc of pieces.values()) {
      pc.pin.position.y = pc.pinY + (pc.ring.visible ? Math.abs(Math.sin(time * 4)) * 0.4 : 0);
      if (pc.ring.visible) {
        pc.ring.rotation.z += dt * 1.5;
        (pc.ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.3 * Math.sin(time * 5);
      }
      (pc.fig.userData.head as THREE.Object3D).rotation.z = Math.sin(time * 2 + pc.index) * 0.05;
    }
  });

  return {
    sync(state: PublicState, animating: boolean) {
      state.players.forEach((p, i) => {
        const pc = ensure(p, i);
        if (!animating) { pc.root.position.copy(posAt(p.tile, i)); pc.root.rotation.y = board.tileHeading[p.tile]; }
        const adult = state.era >= 4;
        if (pc.era !== state.era) {
          pc.era = state.era;
          setAvatarAge(pc.fig, state.era);
          pc.car.visible = adult;
          pc.fig.position.set(0, adult ? 0.45 : 0, adult ? -0.15 : 0);
          pc.pinY = adult ? 3.3 : 1.2 + 1.9 * pc.fig.scale.x;
        }
        const family = p.kids.length + (p.spouse ? 100 : 0);
        if (pc.family !== family) {
          pc.family = family;
          pc.pegs.clear();
          const spots: [number, number, number][] = [[0.3, 0.65, 0.35], [-0.3, 0.65, -0.45], [0.3, 0.65, -0.45], [-0.3, 0.65, 0.35], [0, 0.65, -0.1]];
          let k = 0;
          if (p.spouse) {
            const c = p.partner ? state.partners.find((x) => x.id === p.partner!.id) : null;
            const sp = buildPeg(c ? c.color : 0xff8fab);
            sp.position.set(...spots[k++]);
            pc.pegs.add(sp);
          }
          p.kids.forEach((_, j) => {
            if (k >= spots.length) return;
            const kp = buildPeg([0x74c0fc, 0xffd43b, 0x8ce99a, 0xcc5de8][j % 4], true);
            kp.position.set(...spots[k++]);
            pc.pegs.add(kp);
          });
        }
        pc.pegs.visible = adult;
        pc.ring.visible = !!state.pending && state.pending.playerId === p.id;
      });
    },
    async hopPath(pid: string, path: number[], index: number, onStep?: (tile: number) => void) {
      const pc = pieces.get(pid);
      if (!pc) return;
      for (const ti of path) {
        const from = pc.root.position.clone();
        const to = posAt(ti, index);
        const h0 = pc.root.rotation.y;
        let h1 = board.tileHeading[ti];
        while (h1 - h0 > Math.PI) h1 -= Math.PI * 2;
        while (h1 - h0 < -Math.PI) h1 += Math.PI * 2;
        await stage.tween(260, (t) => {
          pc.root.position.lerpVectors(from, to, t);
          pc.root.position.y = to.y + Math.sin(t * Math.PI) * 1.1;
          pc.root.rotation.y = h0 + (h1 - h0) * Math.min(1, t * 2);
          pc.fig.scale.y = pc.fig.scale.x * (1 + Math.sin(t * Math.PI) * 0.12);
        });
        pc.fig.scale.y = pc.fig.scale.x;
        onStep?.(ti);
      }
    },
    async warp(pid: string, tile: number, index: number, fly: boolean) {
      const pc = pieces.get(pid);
      if (!pc) return;
      const from = pc.root.position.clone();
      const to = posAt(tile, index);
      const dist = from.distanceTo(to);
      const dur = fly ? Math.min(2600, 900 + dist * 12) : 900;
      const h = fly ? Math.max(12, dist * 0.25) : 6;
      if (fly) stage.setDistance(Math.max(stage.orbit.distGoal, 45));
      await stage.tween(dur, (t) => {
        pc.root.position.lerpVectors(from, to, easeInOut(t));
        pc.root.position.y = to.y + Math.sin(t * Math.PI) * h;
        if (fly) pc.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
        else pc.root.rotation.y += 0.25;
      });
      if (fly) stage.setDistance(30);
      pc.root.rotation.y = board.tileHeading[tile];
    },
    pos(pid: string): THREE.Vector3 | null {
      const pc = pieces.get(pid);
      return pc ? pc.root.position : null;
    },
  };
}
