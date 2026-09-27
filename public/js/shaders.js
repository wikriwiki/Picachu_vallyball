// 커스텀 GLSL 셰이더 모음
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 공통: 툰 라이팅 (방향광 + 그림자맵 + 반구광 + 림라이트 + 안개)
// ---------------------------------------------------------------------------
const TOON_LIGHT_FN = /* glsl */`
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uShadeTint;
uniform float uRimPower;
uniform float uRimStrength;
uniform float uSpecular;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

float toonShadow() {
  float shadow = 1.0;
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow ds = directionalLightShadows[ 0 ];
    shadow = getShadow( directionalShadowMap[ 0 ], ds.shadowMapSize, ds.shadowIntensity, ds.shadowBias, ds.shadowRadius, vDirectionalShadowCoord[ 0 ] );
  #endif
  return shadow;
}

vec3 toonShade(vec3 base, vec3 N, vec3 V, float extraShadow) {
  vec3 L = directionalLights[ 0 ].direction;
  vec3 lightColor = directionalLights[ 0 ].color;
  float ndl = dot(N, L);
  float sh = toonShadow() * extraShadow;
  float lit = clamp(ndl, 0.0, 1.0) * sh;
  // 3단계 셀 셰이딩 (부드러운 경계)
  float band = smoothstep(0.02, 0.07, lit) * 0.62 + smoothstep(0.55, 0.6, lit) * 0.38;
  vec3 shade = base * uShadeTint;
  vec3 col = mix(shade, base, band) * mix(vec3(0.85), lightColor, 0.35);
  // 반구광 (하늘/땅 반사)
  float hemi = N.y * 0.5 + 0.5;
  col += base * mix(uGroundColor, uSkyColor, hemi) * 0.28;
  // 블린-퐁 하이라이트 (툰 스텝)
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0);
  col += lightColor * smoothstep(0.45, 0.5, spec) * uSpecular * sh;
  // 림 라이트
  float rim = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
  col += mix(uSkyColor, vec3(1.0), 0.5) * smoothstep(0.35, 0.6, rim) * uRimStrength * (0.35 + 0.65 * band);
  return col;
}

vec3 applyFog(vec3 col, float depth) {
  float f = smoothstep(uFogNear, uFogFar, depth);
  return mix(col, uFogColor, f);
}
`;

const TOON_VERT = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vWorldPos;
varying vec3 vCol;
void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vNormalV = normalize(transformedNormal);
  vViewPos = -mvPosition.xyz;
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  vWorldPos = (modelMatrix * wp).xyz;
  vCol = vec3(1.0);
  #ifdef USE_COLOR
    vCol *= color;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vCol *= instanceColor;
  #endif
}
`;

const TOON_FRAG = /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uTime;
uniform float uGrassNoise;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying vec3 vWorldPos;
varying vec3 vCol;
${TOON_LIGHT_FN}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec3 base = uColor * vCol;
  if (uGrassNoise > 0.0) {
    float n = vnoise(vWorldPos.xz * 0.15) * 0.6 + vnoise(vWorldPos.xz * 0.9) * 0.4;
    base *= mix(0.86, 1.12, n * uGrassNoise + (1.0 - uGrassNoise) * 0.5);
  }
  vec3 N = normalize(vNormalV);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vViewPos);
  vec3 col = toonShade(base, N, V, 1.0) + uEmissive;
  col = applyFog(col, length(vViewPos));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function toonUniforms(extra = {}) {
  return THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    {
      uColor: { value: new THREE.Color(0xffffff) },
      uEmissive: { value: new THREE.Color(0x000000) },
      uSkyColor: { value: new THREE.Color(0xbfe3ff) },
      uGroundColor: { value: new THREE.Color(0x7a6a50) },
      uShadeTint: { value: new THREE.Color(0.62, 0.6, 0.82) },
      uRimPower: { value: 2.5 },
      uRimStrength: { value: 0.35 },
      uSpecular: { value: 0.25 },
      uFogColor: { value: new THREE.Color(0xcfe8ff) },
      uFogNear: { value: 90 },
      uFogFar: { value: 260 },
      uTime: { value: 0 },
      uGrassNoise: { value: 0 },
      ...extra,
    },
  ]);
}

// 공유 조명/안개 유니폼을 한 번에 갱신하기 위한 레지스트리
export const sharedMaterials = new Set();

export function toonMaterial(color = 0xffffff, opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: toonUniforms(),
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
    lights: true,
    vertexColors: !!opts.vertexColors,
    side: opts.side || THREE.FrontSide,
  });
  m.uniforms.uColor.value.set(color);
  if (opts.emissive) m.uniforms.uEmissive.value.set(opts.emissive);
  if (opts.rim != null) m.uniforms.uRimStrength.value = opts.rim;
  if (opts.specular != null) m.uniforms.uSpecular.value = opts.specular;
  if (opts.grass) m.uniforms.uGrassNoise.value = opts.grass;
  sharedMaterials.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// 아웃라인 (뒤집힌 헐 방식, 화면 공간 두께 보정)
// ---------------------------------------------------------------------------
export function outlineMaterial(color = 0x2a2238, thickness = 0.035) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uThickness: { value: thickness } },
    vertexShader: /* glsl */`
      uniform float uThickness;
      void main() {
        vec3 p = position;
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = (instanceMatrix * vec4(p, 1.0)).xyz;
          n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec3 nv = normalize(normalMatrix * n);
        float dist = clamp(-mv.z, 2.0, 80.0);
        mv.xyz += nv * uThickness * (0.6 + dist * 0.03);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
  return m;
}

// ---------------------------------------------------------------------------
// 보드 칸 셰이더 (인스턴싱 + 아이콘 아틀라스 + 테두리 + 활성 칸 펄스)
// ---------------------------------------------------------------------------
export function tileMaterial(atlas, atlasGrid) {
  const m = new THREE.ShaderMaterial({
    uniforms: toonUniforms({
      uAtlas: { value: atlas },
      uGrid: { value: atlasGrid },
      uActive: { value: -1 },
      uTime: { value: 0 },
      uTileHalf: { value: new THREE.Vector2(1.35, 1.35) },
      uTopY: { value: 0.5 },
    }),
    lights: true,
    vertexShader: /* glsl */`
      #include <common>
      #include <shadowmap_pars_vertex>
      attribute float aIcon;
      attribute float aIndex;
      attribute vec3 aColor;
      uniform float uActive;
      uniform float uTime;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      varying vec3 vLocal;
      varying vec3 vObjN;
      varying float vIcon;
      varying float vActive;
      varying vec3 vTileColor;
      varying vec2 vIconP;
      void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        float act = 1.0 - step(0.5, abs(aIndex - uActive));
        transformed.y += act * (0.25 + 0.12 * sin(uTime * 5.0));
        #include <project_vertex>
        #include <worldpos_vertex>
        #include <shadowmap_vertex>
        vNormalV = normalize(transformedNormal);
        vViewPos = -mvPosition.xyz;
        vLocal = position;
        vObjN = normal;
        vIcon = aIcon;
        vActive = act;
        // 아이콘은 월드 축 기준 (카메라 기본 방향에서 항상 똑바로 보이게)
        vec2 wOff = (mat3(instanceMatrix) * position).xz;
        vIconP = wOff / length(instanceMatrix[0].xyz);
        vTileColor = aColor;
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      uniform sampler2D uAtlas;
      uniform vec2 uGrid;
      uniform vec2 uTileHalf;
      uniform float uTopY;
      uniform float uTime;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      varying vec3 vLocal;
      varying vec3 vObjN;
      varying float vIcon;
      varying float vActive;
      varying vec3 vTileColor;
      varying vec2 vIconP;
      ${TOON_LIGHT_FN}
      float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec3 base = vTileColor;
        vec3 N = normalize(vNormalV);
        vec3 V = normalize(vViewPos);
        float emis = 0.0;
        if (vObjN.y > 0.5) {
          vec2 p = vLocal.xz;
          float d = sdRoundBox(p, uTileHalf, 0.45);
          // 흰 테두리 + 안쪽 색 + 광택 줄
          float border = smoothstep(-0.26, -0.2, d);
          vec3 inner = base * (1.0 + 0.18 * smoothstep(0.4, -1.2, p.y + p.x * 0.3));
          vec3 col = mix(inner, vec3(1.0), border);
          // 아이콘
          vec2 uv = vec2(-vIconP.x, vIconP.y) / (uTileHalf * 1.55) * 0.5 + 0.5;
          if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
            float cx = mod(vIcon, uGrid.x);
            float cy = floor(vIcon / uGrid.x);
            vec2 auv = (vec2(cx, cy) + vec2(uv.x, 1.0 - uv.y)) / uGrid;
            auv.y = 1.0 - auv.y;
            vec4 ic = texture2D(uAtlas, auv);
            col = mix(col, ic.rgb, ic.a);
          }
          float gloss = smoothstep(0.08, 0.0, abs(p.x + p.y * 0.6 - 0.9)) * 0.25;
          col += gloss;
          base = col;
          emis = vActive * (0.25 + 0.2 * sin(uTime * 6.0));
        } else {
          base *= 0.72;
        }
        vec3 col = toonShade(base, N, V, 1.0) + base * emis + vec3(1.0, 0.95, 0.6) * emis * 0.4;
        col = applyFog(col, length(vViewPos));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  sharedMaterials.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// 물 셰이더 (거스트너풍 파도 + 프레넬 + 해안 거품)
// ---------------------------------------------------------------------------
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x1c6fb8) },
      uShallow: { value: new THREE.Color(0x4fd6e0) },
      uSky: { value: new THREE.Color(0xcfeaff) },
      uIslandCenter: { value: new THREE.Vector2(0, 0) },
      uIslandHalf: { value: new THREE.Vector2(60, 60) },
      uIslandRadius: { value: 18 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uFogColor: { value: new THREE.Color(0xcfe8ff) },
      uFogNear: { value: 90 },
      uFogFar: { value: 260 },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform vec2 uIslandCenter, uIslandHalf;
      uniform float uIslandRadius;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vCrest;
      varying float vDepth;
      float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
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
        float calm = smoothstep(-2.0, 12.0, sdRoundBox(p.xz - uIslandCenter, uIslandHalf, uIslandRadius));
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
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uSky, uFogColor, uSunDir;
      uniform vec2 uIslandCenter, uIslandHalf;
      uniform float uIslandRadius, uFogNear, uFogFar;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vCrest;
      varying float vDepth;
      float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 N = normalize(vN);
        float shore = sdRoundBox(vWorld.xz - uIslandCenter, uIslandHalf, uIslandRadius);
        float shallow = 1.0 - smoothstep(0.0, 22.0, shore);
        vec3 col = mix(uDeep, uShallow, shallow);
        // 코스틱 느낌의 셀 무늬
        float c1 = noise(vWorld.xz * 0.35 + uTime * 0.4);
        float c2 = noise(vWorld.xz * 0.35 * 1.7 - uTime * 0.3);
        float caustic = 1.0 - smoothstep(0.0, 0.06, abs(c1 - c2));
        col += caustic * 0.08 * shallow;
        // 프레넬 반사
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = mix(col, uSky, fres * 0.6);
        // 태양 하이라이트 (툰)
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 180.0);
        col += vec3(1.0) * smoothstep(0.3, 0.35, spec);
        // 해안 거품 (움직이는 띠)
        float band = sin(shore * 0.9 - uTime * 2.2) * 0.5 + 0.5;
        float foam = (1.0 - smoothstep(0.0, 3.2, shore)) * smoothstep(0.45, 0.55, band + noise(vWorld.xz * 0.8) * 0.4);
        foam = max(foam, 1.0 - smoothstep(0.0, 0.9, shore));
        foam += smoothstep(0.5, 0.62, vCrest + noise(vWorld.xz * 0.5 + uTime) * 0.3) * 0.5;
        col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0));
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------
// 하늘 (그라데이션 + 태양 + fbm 구름)
// ---------------------------------------------------------------------------
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0x4aa3ff) },
      uHorizon: { value: new THREE.Color(0xd8f0ff) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    },
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */`
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

// ---------------------------------------------------------------------------
// 룰렛 원판 (극좌표 세그먼트 + 각속도 기반 모션 블러 + 금속 림)
// ---------------------------------------------------------------------------
export function rouletteMaterial(numbersTex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNumbers: { value: numbersTex },
      uAngle: { value: 0 },
      uBlur: { value: 0 },
      uHighlight: { value: -1 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uNumbers;
      uniform float uAngle, uBlur, uHighlight, uTime;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      const float TAU = 6.28318530718;
      vec3 segColor(float i) {
        if (i < 0.5) return vec3(0.98, 0.33, 0.35);
        if (i < 1.5) return vec3(1.0, 0.62, 0.2);
        if (i < 2.5) return vec3(1.0, 0.85, 0.2);
        if (i < 3.5) return vec3(0.45, 0.85, 0.35);
        if (i < 4.5) return vec3(0.2, 0.75, 0.6);
        if (i < 5.5) return vec3(0.25, 0.65, 0.98);
        if (i < 6.5) return vec3(0.35, 0.45, 0.95);
        if (i < 7.5) return vec3(0.62, 0.42, 0.95);
        if (i < 8.5) return vec3(0.95, 0.45, 0.8);
        return vec3(0.98, 0.55, 0.62);
      }
      vec3 sampleDisc(vec2 p) {
        float r = length(p);
        float a = atan(p.y, p.x);
        float t = fract(a / TAU + 1.0);
        float seg = floor(t * 10.0);
        vec3 col = segColor(seg);
        // 세그먼트 경계선
        float edge = abs(fract(t * 10.0) - 0.5);
        col = mix(vec3(1.0), col, smoothstep(0.5, 0.47, edge));
        // 하이라이트 칸
        if (abs(seg - uHighlight) < 0.5) col = mix(col, vec3(1.0), 0.25 + 0.25 * sin(uTime * 10.0));
        // 숫자 (별도 텍스처, 회전 좌표 그대로 사용)
        vec4 num = texture2D(uNumbers, p * 0.5 + 0.5);
        col = mix(col, num.rgb, num.a);
        // 방사형 음영
        col *= mix(1.08, 0.86, smoothstep(0.2, 1.0, r));
        return col;
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        vec3 col;
        if (r > 0.9) {
          // 금색 림 + 페그
          float a = atan(p.y, p.x);
          float peg = smoothstep(0.035, 0.02, length(vec2(fract(a / TAU * 10.0 + 0.5) - 0.5, (r - 0.95) * 1.2)));
          vec3 gold = mix(vec3(0.75, 0.55, 0.15), vec3(1.0, 0.9, 0.5), 0.5 + 0.5 * sin(a * 3.0 + uAngle * 2.0));
          col = mix(gold, vec3(1.0), peg);
        } else if (r < 0.2) {
          // 금속 허브
          float l = 0.6 + 0.4 * (1.0 - r / 0.2);
          col = vec3(0.95, 0.95, 1.0) * l;
          col = mix(col, vec3(1.0, 0.85, 0.3), smoothstep(0.17, 0.2, r));
        } else {
          // 각속도 모션 블러: 원주 방향으로 여러 번 샘플
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

// ---------------------------------------------------------------------------
// 파티클 (색종이 / 반짝이) — GPU에서 궤적 계산
// ---------------------------------------------------------------------------
export function particleMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStart: { value: -100 }, uOrigin: { value: new THREE.Vector3() }, uScale: { value: 300 } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime, uStart, uScale;
      uniform vec3 uOrigin;
      attribute vec3 aVel;
      attribute vec3 aColor;
      attribute float aSeed;
      varying vec3 vColor;
      varying float vLife;
      varying float vSeed;
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
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vColor;
      varying float vLife;
      varying float vSeed;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float a = uTime * (4.0 + vSeed * 6.0) + vSeed * 10.0;
        mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
        c = r * c;
        // 납작한 종이 회전 효과
        float flip = abs(sin(uTime * 7.0 + vSeed * 30.0));
        c.y /= max(flip, 0.15);
        if (abs(c.x) > 0.32 || abs(c.y) > 0.2) discard;
        if (vLife <= 0.0) discard;
        gl_FragColor = vec4(vColor * (0.75 + 0.25 * flip), vLife);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------------
// 후처리: 틸트시프트(미니어처) + 비네트 + 컬러 그레이딩
// ---------------------------------------------------------------------------
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.55 },
    uBlur: { value: 1.6 },
    uVignette: { value: 0.35 },
    uSaturation: { value: 1.12 },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
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
