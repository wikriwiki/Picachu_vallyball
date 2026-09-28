/**
 * @pyramid-spec      design/view/toolkit/surfaces/surfaces.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/surfaces/surfaces.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';
import { TOON_LIGHT_FN, sharedMaterials, toonUniforms } from '../toon/toon';

const PARS_V = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
`;
const PARS_F = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
`;
const BEGIN_V = /* glsl */ `
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
`;
const END_V = /* glsl */ `
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
`;
const OUT_F = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

export function roadMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: toonUniforms({ uColor: { value: new THREE.Color(0x6b6f7a) } }),
    lights: true,
    vertexShader: `${PARS_V}
      varying vec3 vNormalV; varying vec3 vViewPos; varying vec2 vUv;
      void main() {${BEGIN_V}${END_V}
        vNormalV = normalize(transformedNormal); vViewPos = -mvPosition.xyz; vUv = uv;
      }`,
    fragmentShader: `${PARS_F}
      uniform vec3 uColor;
      varying vec3 vNormalV; varying vec3 vViewPos; varying vec2 vUv;
      ${TOON_LIGHT_FN}
      void main() {
        vec3 base = uColor;
        float y = abs(vUv.y - 0.5) * 2.0;
        float dash = step(0.5, fract(vUv.x / 3.0)) * (1.0 - step(0.022, abs(vUv.y - 0.5)));
        float edge = step(0.7, y) * (1.0 - step(0.74, y));
        base = mix(base, vec3(0.97), max(dash, edge));
        if (y > 0.8) {
          vec2 tile = fract(vec2(vUv.x / 0.8, (y - 0.8) / 0.2));
          base = vec3(0.86, 0.84, 0.8) * (0.94 + 0.06 * step(0.08, tile.x));
          base *= 1.0 - 0.25 * (1.0 - step(0.83, y));
        }
        vec3 col = toonShade(base, normalize(vNormalV), normalize(vViewPos), 1.0);
        col = applyFog(col, length(vViewPos));
        gl_FragColor = vec4(col, 1.0);${OUT_F}
      }`,
  });
  m.uniforms.uRimStrength.value = 0.05;
  m.uniforms.uSpecular.value = 0;
  sharedMaterials.add(m);
  return m;
}

export interface BuildingOptions { win?: [number, number]; glass?: THREE.ColorRepresentation; brick?: boolean; floor0?: number; specular?: number; rim?: number; vertexColors?: boolean; }

export function buildingMaterial(color: THREE.ColorRepresentation = 0xffffff, opts: BuildingOptions = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: toonUniforms({
      uWin: { value: new THREE.Vector2(...(opts.win ?? [0, 0])) },
      uGlass: { value: new THREE.Color(opts.glass ?? 0x5aa9e6) },
      uBrick: { value: opts.brick ? 1 : 0 },
      uFloor0: { value: opts.floor0 ?? 0.5 },
    }),
    lights: true,
    vertexColors: !!opts.vertexColors,
    vertexShader: `${PARS_V}
      varying vec3 vNormalV; varying vec3 vViewPos; varying vec3 vWorldPos; varying vec3 vWorldN; varying vec3 vCol;
      void main() {${BEGIN_V}${END_V}
        vNormalV = normalize(transformedNormal);
        vViewPos = -mvPosition.xyz;
        vec4 wp = vec4(transformed, 1.0);
        vec3 n = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          n = mat3(instanceMatrix) * n;
        #endif
        vWorldPos = (modelMatrix * wp).xyz;
        vWorldN = normalize(mat3(modelMatrix) * n);
        vCol = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vCol *= instanceColor;
        #endif
      }`,
    fragmentShader: `${PARS_F}
      uniform vec3 uColor; uniform vec2 uWin; uniform vec3 uGlass; uniform float uBrick; uniform float uFloor0;
      varying vec3 vNormalV; varying vec3 vViewPos; varying vec3 vWorldPos; varying vec3 vWorldN; varying vec3 vCol;
      ${TOON_LIGHT_FN}
      float bh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 base = uColor * vCol;
        vec3 wn = normalize(vWorldN);
        float emis = 0.0;
        if (abs(wn.y) < 0.5) {
          vec2 t = normalize(vec2(-wn.z, wn.x));
          float u = dot(vWorldPos.xz, t);
          float v = vWorldPos.y;
          if (uBrick > 0.5) {
            float row = floor(v * 4.0);
            vec2 b = fract(vec2(u * 2.0 + 0.5 * mod(row, 2.0), v * 4.0));
            float mortar = step(b.x, 0.06) + step(b.y, 0.1);
            base *= mix(0.92 + 0.12 * bh(vec2(floor(u * 2.0 + 0.5 * mod(row, 2.0)), row)), 0.75, clamp(mortar, 0.0, 1.0));
          }
          if (uWin.x > 0.0 && v > uFloor0) {
            vec2 c = vec2(u / uWin.x, (v - uFloor0) / uWin.y);
            vec2 f = fract(c);
            float w = step(0.22, f.x) * step(f.x, 0.78) * step(0.2, f.y) * step(f.y, 0.75);
            if (w > 0.5) {
              float fres = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewPos))), 2.0);
              vec3 glass = mix(uGlass * 0.8, uSkyColor, 0.35 + 0.5 * fres);
              glass += (1.0 - smoothstep(0.0, 0.25, abs(f.x - f.y * 0.8 - 0.1))) * 0.25;
              float lit = step(0.86, bh(floor(c) + floor(vWorldPos.xz * 0.1)));
              base = mix(glass, vec3(1.0, 0.86, 0.55), lit * 0.8);
              emis = lit * 0.25;
            } else {
              float sill = step(0.12, f.y) * step(f.y, 0.2) * step(0.18, f.x) * step(f.x, 0.82);
              base = mix(base, vec3(1.0), sill * 0.6);
            }
          }
        }
        vec3 col = toonShade(base, normalize(vNormalV), normalize(vViewPos), 1.0) + base * emis;
        col = applyFog(col, length(vViewPos));
        gl_FragColor = vec4(col, 1.0);${OUT_F}
      }`,
  });
  (m.uniforms.uColor.value as THREE.Color).set(color);
  m.uniforms.uSpecular.value = opts.specular ?? 0.2;
  m.uniforms.uRimStrength.value = opts.rim ?? 0.25;
  sharedMaterials.add(m);
  return m;
}

export function tileMaterial(atlas: THREE.Texture, grid: THREE.Vector2): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: toonUniforms({
      uAtlas: { value: atlas }, uGrid: { value: grid }, uActive: { value: -1 }, uTime: { value: 0 },
      uTileHalf: { value: new THREE.Vector2(1.3, 1.3) }, uTopY: { value: 0.5 },
    }),
    lights: true,
    vertexShader: `${PARS_V}
      attribute float aIcon; attribute float aIndex; attribute vec3 aColor; attribute float aGlow;
      varying float vGlow;
      uniform float uActive; uniform float uTime;
      varying vec3 vNormalV; varying vec3 vViewPos; varying vec3 vLocal; varying vec3 vObjN;
      varying float vIcon; varying float vActive; varying vec3 vTileColor; varying vec2 vIconP;
      void main() {${BEGIN_V}
        float act = 1.0 - step(0.5, abs(aIndex - uActive));
        transformed.y += act * (0.25 + 0.12 * sin(uTime * 5.0));
        ${END_V}
        vNormalV = normalize(transformedNormal);
        vViewPos = -mvPosition.xyz;
        vLocal = position; vObjN = normal; vIcon = aIcon; vActive = act;
        vec2 wOff = (mat3(instanceMatrix) * position).xz;
        vIconP = wOff / length(instanceMatrix[0].xyz);
        vTileColor = aColor; vGlow = aGlow;
      }`,
    fragmentShader: `${PARS_F}
      uniform sampler2D uAtlas; uniform vec2 uGrid; uniform vec2 uTileHalf; uniform float uTopY; uniform float uTime;
      varying vec3 vNormalV; varying vec3 vViewPos; varying vec3 vLocal; varying vec3 vObjN;
      varying float vIcon; varying float vActive; varying vec3 vTileColor; varying vec2 vIconP; varying float vGlow;
      ${TOON_LIGHT_FN}
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec3 base = vTileColor;
        vec3 N = normalize(vNormalV);
        vec3 V = normalize(vViewPos);
        float emis = 0.0;
        vec2 iuv = vec2(-vIconP.x, vIconP.y) / (uTileHalf * 1.55) * 0.5 + 0.5;
        float iconMask = step(0.0, iuv.x) * step(iuv.x, 1.0) * step(0.0, iuv.y) * step(iuv.y, 1.0);
        vec2 cuv = clamp(iuv, 0.01, 0.99);
        float idx = floor(vIcon + 0.5);
        float cy = floor((idx + 0.5) / uGrid.x);
        float cx = idx - cy * uGrid.x;
        vec2 auv = (vec2(cx, cy) + vec2(cuv.x, 1.0 - cuv.y)) / uGrid;
        auv.y = 1.0 - auv.y;
        vec4 iconSample = texture2D(uAtlas, auv);
        if (vObjN.y > 0.5) {
          vec2 p = vLocal.xz;
          float d = sdRoundBox(p, uTileHalf, 0.45);
          float border = smoothstep(-0.26, -0.2, d);
          vec3 inner = base * (1.0 + 0.18 * smoothstep(0.4, -1.2, p.y + p.x * 0.3));
          vec3 col = mix(inner, vec3(1.0), border);
          col = mix(col, iconSample.rgb, iconSample.a * iconMask);
          float gloss = smoothstep(0.08, 0.0, abs(p.x + p.y * 0.6 - 0.9)) * 0.25;
          col += gloss;
          if (vGlow > 1.5) {
            float hh = fract(uTime * 0.25 + (vIconP.x - vIconP.y) * 0.12);
            vec3 rainbow = clamp(abs(mod(hh * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
            float rim = 1.0 - smoothstep(-0.5, -0.2, sdRoundBox(vIconP, uTileHalf, 0.45));
            col = mix(col, mix(rainbow, vec3(1.0), 0.25), (1.0 - iconSample.a * iconMask) * rim * 0.85);
            emis += 0.2;
          } else if (vGlow > 0.5) {
            float sweep = fract(uTime * 0.45);
            float band = smoothstep(0.22, 0.0, abs((vIconP.x + vIconP.y) * 0.25 + 0.5 - sweep * 1.6 + 0.3));
            vec2 cell = floor(vIconP * 3.0);
            float tw = step(0.8, h21(cell)) * pow(max(0.0, sin(uTime * 4.0 + h21(cell + 7.0) * 30.0)), 12.0);
            col += vec3(1.0, 0.95, 0.7) * (band * 0.8 + tw * 0.9);
            emis += 0.35 + 0.15 * sin(uTime * 3.0);
          }
          base = col;
          emis += vActive * (0.25 + 0.2 * sin(uTime * 6.0));
        } else {
          base *= 0.72;
          emis += step(0.5, vGlow) * step(vGlow, 1.5) * (0.25 + 0.15 * sin(uTime * 3.0));
        }
        vec3 col = toonShade(base, N, V, 1.0) + base * emis + vec3(1.0, 0.95, 0.6) * emis * 0.4;
        col = applyFog(col, length(vViewPos));
        gl_FragColor = vec4(col, 1.0);${OUT_F}
      }`,
  });
  sharedMaterials.add(m);
  return m;
}
