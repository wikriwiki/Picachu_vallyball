/**
 * @pyramid-spec      design/view/toolkit/toon/toon.md
 * @pyramid-parent    design/view/toolkit/toolkit.md
 * @pyramid-on-change 1) design/view/toolkit/toon/toon.md 먼저 수정 2) 이 코드 수정 3) design/view/toolkit/toolkit.md 「통합 방식」 영향 검토
 */
import * as THREE from 'three';

export const TOON_LIGHT_FN = /* glsl */ `
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
  float band = smoothstep(0.02, 0.07, lit) * 0.62 + smoothstep(0.55, 0.6, lit) * 0.38;
  vec3 shade = base * uShadeTint;
  vec3 col = mix(shade, base, band) * mix(vec3(0.85), lightColor, 0.35);
  float hemi = N.y * 0.5 + 0.5;
  col += base * mix(uGroundColor, uSkyColor, hemi) * 0.28;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0);
  col += lightColor * smoothstep(0.45, 0.5, spec) * uSpecular * sh;
  float rim = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
  col += mix(uSkyColor, vec3(1.0), 0.5) * smoothstep(0.35, 0.6, rim) * uRimStrength * (0.35 + 0.65 * band);
  return col;
}

vec3 applyFog(vec3 col, float depth) {
  float f = smoothstep(uFogNear, uFogFar, depth);
  return mix(col, uFogColor, f);
}
`;

const TOON_VERT = /* glsl */ `
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

const TOON_FRAG = /* glsl */ `
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

export function toonUniforms(extra: Record<string, THREE.IUniform> = {}): Record<string, THREE.IUniform> {
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

export const sharedMaterials = new Set<THREE.ShaderMaterial>();

export interface ToonOptions { vertexColors?: boolean; side?: THREE.Side; emissive?: THREE.ColorRepresentation; rim?: number; specular?: number; grass?: number; }

export function toonMaterial(color: THREE.ColorRepresentation = 0xffffff, opts: ToonOptions = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: toonUniforms(),
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
    lights: true,
    vertexColors: !!opts.vertexColors,
    side: opts.side ?? THREE.FrontSide,
  });
  (m.uniforms.uColor.value as THREE.Color).set(color);
  if (opts.emissive != null) (m.uniforms.uEmissive.value as THREE.Color).set(opts.emissive);
  if (opts.rim != null) m.uniforms.uRimStrength.value = opts.rim;
  if (opts.specular != null) m.uniforms.uSpecular.value = opts.specular;
  if (opts.grass) m.uniforms.uGrassNoise.value = opts.grass;
  sharedMaterials.add(m);
  return m;
}

export function outlineMaterial(color: THREE.ColorRepresentation = 0x2a2238, thickness = 0.035): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uThickness: { value: thickness } },
    vertexShader: /* glsl */ `
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
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}
