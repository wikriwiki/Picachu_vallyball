/**
 * @pyramid-spec      design/view/toolkit/fx/fx.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/fx/fx.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';

export const ROULETTE_COLORS: readonly [number, number, number][] = [
  [0.97, 0.78, 0.0], [0.95, 0.57, 0.0], [0.91, 0.2, 0.17], [0.91, 0.2, 0.48], [0.7, 0.12, 0.39],
  [0.17, 0.18, 0.49], [0.12, 0.37, 0.75], [0.25, 0.71, 0.92], [0.12, 0.65, 0.35], [0.55, 0.78, 0.25],
];
const glslVec = ([r, g, b]: readonly number[]) => `vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`;
const SEG_COLOR_FN = `vec3 segColor(float i) {\n${ROULETTE_COLORS.map((c, k) => (k < 9 ? `  if (i < ${k}.5) return ${glslVec(c)};` : `  return ${glslVec(c)};`)).join('\n')}\n}`;

const SD_ISLANDS = /* glsl */ `
uniform vec4 uIsl[4];
uniform float uIslR[4];
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float islandSd(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < 4; i++) { if (uIsl[i].z > 0.0) d = min(d, sdRoundBox(p - uIsl[i].xy, uIsl[i].zw, uIslR[i])); }
  return d;
}
`;

export function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1c6fb8) },
      uShallow: { value: new THREE.Color(0x4fd6e0) },
      uSky: { value: new THREE.Color(0xcfeaff) },
      uIsl: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
      uIslR: { value: [1, 1, 1, 1] },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uFogColor: { value: new THREE.Color(0xcfe8ff) },
      uFogNear: { value: 90 },
      uFogFar: { value: 260 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      ${SD_ISLANDS}
      varying vec3 vWorld; varying vec3 vN; varying float vCrest; varying float vDepth;
      vec3 wave(vec2 dir, float freq, float amp, float speed, vec3 p, inout vec3 tangent, inout vec3 binormal) {
        float f = dot(normalize(dir), p.xz) * freq + uTime * speed;
        float s = sin(f), c = cos(f);
        vec2 d = normalize(dir);
        tangent += vec3(-d.x * d.x * amp * freq * s * 0.6, d.x * amp * freq * c, -d.x * d.y * amp * freq * s * 0.6);
        binormal += vec3(-d.x * d.y * amp * freq * s * 0.6, d.y * amp * freq * c, -d.y * d.y * amp * freq * s * 0.6);
        return vec3(d.x * amp * c * 0.6, amp * s, d.y * amp * c * 0.6);
      }
      void main() {
        vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 t = vec3(1, 0, 0), b = vec3(0, 0, 1);
        vec3 off = vec3(0.0);
        float calm = smoothstep(-2.0, 12.0, islandSd(p.xz));
        off += wave(vec2(1.0, 0.3), 0.12, 0.45, 1.1, p, t, b);
        off += wave(vec2(-0.4, 1.0), 0.19, 0.25, 1.6, p, t, b);
        off += wave(vec2(0.7, -0.8), 0.31, 0.12, 2.3, p, t, b);
        p += off * (0.25 + 0.75 * calm);
        vCrest = off.y * calm;
        vN = normalize(cross(b, t));
        vWorld = p;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uSky, uFogColor, uSunDir;
      uniform float uFogNear, uFogFar;
      ${SD_ISLANDS}
      varying vec3 vWorld; varying vec3 vN; varying float vCrest; varying float vDepth;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 N = normalize(vN);
        float shore = islandSd(vWorld.xz);
        float shallow = 1.0 - smoothstep(0.0, 22.0, shore);
        vec3 col = mix(uDeep, uShallow, shallow);
        float c1 = noise(vWorld.xz * 0.35 + uTime * 0.4);
        float c2 = noise(vWorld.xz * 0.35 * 1.7 - uTime * 0.3);
        float caustic = 1.0 - smoothstep(0.0, 0.06, abs(c1 - c2));
        col += caustic * 0.08 * shallow;
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = mix(col, uSky, fres * 0.6);
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 180.0);
        col += vec3(1.0) * smoothstep(0.3, 0.35, spec);
        float band = sin(shore * 0.9 - uTime * 2.2) * 0.5 + 0.5;
        float foam = (1.0 - smoothstep(0.0, 3.2, shore)) * smoothstep(0.45, 0.55, band + noise(vWorld.xz * 0.8) * 0.4);
        foam = max(foam, 1.0 - smoothstep(0.0, 0.9, shore));
        foam += smoothstep(0.62, 0.72, vCrest + noise(vWorld.xz * 0.5 + uTime) * 0.2) * 0.25;
        col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0));
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function skyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0x4aa3ff) },
      uHorizon: { value: new THREE.Color(0xd8f0ff) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uTop, uHorizon, uSunDir;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(max(h, 0.0), 0.55));
        float sun = max(dot(d, normalize(uSunDir)), 0.0);
        col += vec3(1.0, 0.95, 0.8) * (smoothstep(0.9975, 0.999, sun) + pow(sun, 64.0) * 0.35);
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.25) * 1.4 + vec2(uTime * 0.01, uTime * 0.004);
          float c = fbm(uv);
          float cloud = smoothstep(0.52, 0.62, c) * smoothstep(0.0, 0.25, d.y);
          vec3 cc = mix(vec3(0.82, 0.86, 0.95), vec3(1.0), smoothstep(0.55, 0.75, c));
          col = mix(col, cc, cloud * 0.9);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function rouletteMaterial(numbers: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uNumbers: { value: numbers }, uAngle: { value: 0 }, uBlur: { value: 0 }, uHighlight: { value: -1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uNumbers;
      uniform float uAngle, uBlur, uHighlight, uTime;
      varying vec2 vUv;
      vec2 gdx, gdy;
      varying vec3 vN; varying vec3 vV;
      const float TAU = 6.28318530718;
      ${SEG_COLOR_FN}
      vec3 sampleDisc(vec2 p) {
        float r = length(p);
        float a = atan(p.y, p.x);
        float t = fract(a / TAU + 1.0);
        float seg = floor(t * 10.0);
        vec3 col;
        if (r > 0.55) {
          col = segColor(seg);
          if (abs(seg - uHighlight) < 0.5) col = mix(col, vec3(1.0), 0.2 + 0.2 * sin(uTime * 10.0));
          vec4 num = textureGrad(uNumbers, p * 0.5 + 0.5, gdx, gdy);
          col = mix(col, num.rgb, num.a);
          col *= mix(1.06, 0.92, smoothstep(0.6, 0.97, r));
        } else {
          col = vec3(0.96, 0.96, 0.97);
          float mid = abs(fract(t * 10.0) - 0.5);
          float spoke = smoothstep(0.06, 0.03, mid) * smoothstep(0.26, 0.3, r) * smoothstep(0.52, 0.48, r);
          col = mix(col, segColor(seg) * 0.35, spoke);
        }
        return col;
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        gdx = dFdx(vUv);
        gdy = dFdy(vUv);
        float r = length(p);
        if (r > 1.0) discard;
        vec3 col;
        if (r > 0.97) col = vec3(0.98);
        else if (r < 0.2) col = vec3(0.92);
        else {
          col = vec3(0.0);
          const int S = 12;
          for (int i = 0; i < S; i++) {
            float o = (float(i) / float(S - 1) - 0.5) * uBlur;
            float c = cos(o), s = sin(o);
            col += sampleDisc(mat2(c, -s, s, c) * p);
          }
          col /= float(S);
        }
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        float spec = pow(max(dot(reflect(-V, N), normalize(vec3(-0.4, 0.8, 0.6))), 0.0), 24.0);
        col += spec * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function particleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStart: { value: -100 }, uOrigin: { value: new THREE.Vector3() }, uScale: { value: 300 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uStart, uScale;
      uniform vec3 uOrigin;
      attribute vec3 aVel; attribute vec3 aColor; attribute float aSeed;
      varying vec3 vColor; varying float vLife; varying float vSeed;
      void main() {
        float t = uTime - uStart;
        vec3 p = uOrigin + aVel * t + vec3(0.0, -9.0, 0.0) * t * t * 0.5;
        p.x += sin(t * 6.0 + aSeed * 20.0) * 0.4 * t;
        vLife = clamp(1.0 - t / 2.6, 0.0, 1.0);
        vColor = aColor;
        vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * (0.22 + 0.1 * aSeed) / -mv.z * step(0.0, t);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vColor; varying float vLife; varying float vSeed;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = uTime * (4.0 + vSeed * 6.0) + vSeed * 10.0;
        mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
        c = r * c;
        float flip = abs(sin(uTime * 7.0 + vSeed * 30.0));
        c.y /= max(flip, 0.15);
        if (abs(c.x) > 0.32 || abs(c.y) > 0.2) discard;
        if (vLife <= 0.0) discard;
        gl_FragColor = vec4(vColor * (0.75 + 0.25 * flip), vLife);
        #include <colorspace_fragment>
      }`,
  });
}

export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.55 },
    uBlur: { value: 1.6 },
    uVignette: { value: 0.35 },
    uSaturation: { value: 1.12 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uFocus, uBlur, uVignette, uSaturation, uFlash;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float amt = smoothstep(0.18, 0.55, d) * uBlur;
      vec3 col = vec3(0.0);
      float tot = 0.0;
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 o = vec2(float(x), float(y)) * amt / uResolution;
          float w = 1.0 - length(vec2(x, y)) / 3.2;
          col += texture2D(tDiffuse, vUv + o).rgb * w;
          tot += w;
        }
      }
      col /= tot;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSaturation);
      col = pow(col, vec3(0.97));
      vec2 q = vUv - 0.5;
      col *= 1.0 - uVignette * dot(q, q) * 1.6;
      col = mix(col, vec3(1.0), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }`,
};
