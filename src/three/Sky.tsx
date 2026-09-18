import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { engine } from "../game/engine";

// Shared sky state so lighting / fog / env-map all agree with what's drawn.
export const skyState = {
  sunDir: new THREE.Vector3(0, 1, 0),
  sunColor: new THREE.Color(1, 1, 1),
  horizon: new THREE.Color(0.8, 0.6, 0.5),
  zenith: new THREE.Color(0.2, 0.4, 0.8),
  day: 1,
  storm: 0,
};

export const NOISE_GLSL = /* glsl */ `
float h21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm4(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
float fbm6(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++){ s += a * vnoise(p); p = p * 2.07 + 4.3; a *= 0.52; }
  return s;
}
`;

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSun;
uniform float uDay;
uniform float uStorm;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunCol;

${NOISE_GLSL}

float h31(vec3 p){
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;

  // ---- base atmosphere (Rayleigh-ish two-lobe gradient) --------------
  float t = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 1.1);
  vec3 col = mix(uHorizon, uZenith, smoothstep(0.44, 0.98, t));
  col = mix(col, uHorizon * 0.62, smoothstep(0.02, -0.30, h));

  // Mie forward-scattering halo around the sun
  float sd = max(dot(d, uSun), 0.0);
  float mie = pow(sd, 6.0) * 0.30 + pow(sd, 48.0) * 0.55;
  col += uSunCol * mie * (0.25 + uDay * 1.1);

  // Opposition glow (anti-solar brightening) keeps the dome from going flat
  col += uHorizon * 0.10 * pow(max(0.0, 1.0 - sd), 3.0) * uDay;

  float night = 1.0 - smoothstep(0.0, 0.26, uDay);

  // ---- stars ---------------------------------------------------------
  vec3 sp = floor(d * 320.0);
  float st = h31(sp);
  float star = smoothstep(0.9970, 0.99975, st);
  float tw = 0.55 + 0.45 * sin(uTime * 2.6 + st * 120.0);
  col += vec3(star * tw * night * 2.6) * mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.85, 0.7), h31(sp + 3.0));

  // bright hero stars
  float big = smoothstep(0.99990, 0.99998, h31(sp * 1.7));
  col += vec3(0.85, 0.92, 1.0) * big * night * 7.0 * tw;

  // ---- galactic band --------------------------------------------------
  float bandAxis = dot(d, normalize(vec3(0.55, 0.42, -0.72)));
  float band = exp(-bandAxis * bandAxis * 11.0);
  float ang = atan(d.z, d.x + 1e-5);
  float dust = fbm4(vec2(ang * 2.4, d.y * 3.4) * 1.6 + 4.0);
  col += night * band * (0.055 + dust * 0.10) * vec3(0.52, 0.42, 0.85);
  col += night * band * pow(dust, 3.0) * vec3(0.9, 0.7, 1.0) * 0.14;

  // ---- aurora ---------------------------------------------------------
  if (h > 0.02) {
    vec2 au = vec2(atan(d.z, d.x + 1e-5) * 1.5, d.y * 2.2);
    float curt = fbm4(au * vec2(2.2, 1.0) + vec2(uTime * 0.05, uTime * 0.02));
    float ribbon = smoothstep(0.52, 0.80, curt) * smoothstep(0.62, 0.16, d.y);
    float striate = 0.55 + 0.45 * sin(au.x * 26.0 + curt * 9.0 + uTime * 0.6);
    vec3 auroraCol = mix(vec3(0.16, 1.0, 0.62), vec3(0.42, 0.35, 1.0), curt);
    col += auroraCol * ribbon * striate * night * 0.42;
  }

  // ---- clouds (two parallax layers on a virtual plane) ----------------
  if (h > 0.012) {
    float cloudLight = 0.0;
    float acc = 0.0;
    for (int L = 0; L < 2; L++) {
      float ht = L == 0 ? 0.34 : 0.62;
      vec2 uv = d.xz / max(h + ht * 0.10, 0.085) * (L == 0 ? 0.55 : 0.30);
      uv += vec2(uTime * (L == 0 ? 0.010 : 0.005), uTime * 0.004);
      float n = fbm6(uv);
      float cover = mix(0.56, 0.30, uStorm) - float(L) * 0.06;
      float c = smoothstep(cover, cover + 0.26, n);
      c *= smoothstep(0.015, 0.20, h);
      // fake self-shadow: sample slightly toward the sun
      float ns = fbm6(uv + normalize(uSun.xz + 0.001) * 0.12);
      float lit = clamp((n - ns) * 3.2 + 0.55, 0.0, 1.0);
      cloudLight += lit * c * (1.0 - acc);
      acc += c * (1.0 - acc) * (L == 0 ? 0.85 : 0.6);
    }
    acc = clamp(acc, 0.0, 1.0);
    vec3 shade = mix(uHorizon * 0.35, uZenith * 0.55, 0.4) * (0.35 + uDay);
    vec3 bright = mix(uSunCol * 1.10, vec3(1.0), 0.35) * (0.22 + uDay * 1.15);
    vec3 cloudCol = mix(shade, bright, clamp(cloudLight, 0.0, 1.0));
    cloudCol += uSunCol * pow(sd, 22.0) * 0.9 * acc;      // silver lining
    cloudCol = mix(cloudCol, vec3(0.42, 0.30, 0.26), uStorm * 0.55);
    col = mix(col, cloudCol, acc * (0.55 + uStorm * 0.42));
  }

  // ---- sun disc with limb darkening ----------------------------------
  float sunAng = acos(clamp(sd, -1.0, 1.0));
  float disc = 1.0 - smoothstep(0.0128, 0.0155, sunAng);
  float limb = 1.0 - 0.42 * pow(clamp(sunAng / 0.0155, 0.0, 1.0), 2.0);
  col += uSunCol * disc * limb * 34.0 * smoothstep(-0.04, 0.05, uSun.y) * (1.0 - uStorm * 0.75);

  // ---- twin moons -----------------------------------------------------
  vec3 m1 = normalize(vec3(cos(uTime * 0.013) * 0.78, 0.40, sin(uTime * 0.013) * 0.78));
  float ma = acos(clamp(dot(d, m1), -1.0, 1.0));
  float md = 1.0 - smoothstep(0.030, 0.034, ma);
  // crescent shading from the sun direction
  vec3 mN = normalize(d - m1 * dot(d, m1) + vec3(1e-5)) * (ma / 0.034);
  float mLam = clamp(dot(normalize(m1 * 2.4 + mN), uSun) * 0.5 + 0.55, 0.06, 1.0);
  col = mix(col, vec3(0.80, 0.83, 0.92) * mLam * (0.35 + uDay * 0.9) + vec3(0.05, 0.06, 0.12), md);
  col += vec3(0.5, 0.6, 0.9) * exp(-ma * 32.0) * 0.16 * night;

  vec3 m2 = normalize(vec3(-0.62, 0.26, 0.74));
  float ma2 = acos(clamp(dot(d, m2), -1.0, 1.0));
  float md2 = 1.0 - smoothstep(0.0125, 0.0145, ma2);
  col = mix(col, vec3(0.92, 0.66, 0.54) * (0.3 + uDay * 0.9), md2);

  // ---- storm wash + horizon dust ---------------------------------------
  float dusty = smoothstep(0.30, -0.05, h);
  col = mix(col, vec3(0.50, 0.33, 0.27) * (0.30 + uDay * 0.9), uStorm * (0.45 + dusty * 0.5));

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

// palette keyframes: t -> [horizon, zenith, sunColor]
const NIGHT_H = new THREE.Color("#171227");
const NIGHT_Z = new THREE.Color("#04050f");
const DAWN_H = new THREE.Color("#ff8a52");
const DAWN_Z = new THREE.Color("#2b3f7a");
const DAY_H = new THREE.Color("#cfd9e8");
const DAY_Z = new THREE.Color("#2a6fc4");

const SUN_LOW = new THREE.Color("#ff7a3c");
const SUN_HIGH = new THREE.Color("#fff3dc");

export function computeSky(dayT: number, storm: number) {
  const a = dayT * Math.PI * 2 - Math.PI / 2;
  skyState.sunDir.set(Math.cos(a) * 0.42, Math.sin(a), Math.cos(a) * 0.8).normalize();
  const elev = skyState.sunDir.y;
  skyState.day = Math.max(0, elev);

  const dawn = Math.max(0, 1 - Math.abs(elev - 0.06) * 6.5); // horizon-hugging warmth
  const dayF = THREE.MathUtils.smoothstep(elev, -0.02, 0.32);

  skyState.horizon.copy(NIGHT_H).lerp(DAY_H, dayF).lerp(DAWN_H, dawn * 0.85);
  skyState.zenith.copy(NIGHT_Z).lerp(DAY_Z, dayF).lerp(DAWN_Z, dawn * 0.55);
  skyState.sunColor.copy(SUN_LOW).lerp(SUN_HIGH, THREE.MathUtils.smoothstep(elev, 0.0, 0.38));
  skyState.storm = storm;
  return skyState;
}

export function useSkyMaterial() {
  return useMemo(() => {
    const uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uDay: { value: 1 },
      uStorm: { value: 0 },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    return mat;
  }, []);
}

export function Sky({ material }: { material: THREE.ShaderMaterial }) {
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += dt;
    const u = material.uniforms;
    const s = computeSky(engine.dayT, engine.storm > 0 ? Math.min(1, engine.storm / 7) : 0);
    u.uTime.value = t.current;
    u.uDay.value = s.day;
    u.uStorm.value = s.storm;
    u.uSun.value.copy(s.sunDir);
    u.uZenith.value.copy(s.zenith);
    u.uHorizon.value.copy(s.horizon);
    u.uSunCol.value.copy(s.sunColor);
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <sphereGeometry args={[1200, 64, 40]} />
    </mesh>
  );
}
