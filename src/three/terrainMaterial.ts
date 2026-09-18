import * as THREE from "three";
import { NOISE_GLSL } from "./Sky";

export interface TerrainUniforms {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunCol: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uDay: { value: number };
  uStorm: { value: number };
  uCloud: { value: number };
  uCursor: { value: THREE.Vector4 }; // x, z, radius, strength
  uCursorCol: { value: THREE.Color };
  uGridOn: { value: number };
}

/**
 * MeshStandardMaterial upgraded in-place:
 *  - multi-octave surface-gradient bump (no textures, no UVs, no seams)
 *  - triplanar rock striation on cliffs
 *  - drifting cloud shadows over the whole basin
 *  - sun-tinted aerial perspective / in-scattering
 *  - holographic survey grid around the build cursor
 */
export function makeTerrainMaterial() {
  const uniforms: TerrainUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, 1, 1) },
    uHorizon: { value: new THREE.Color(0.8, 0.6, 0.5) },
    uDay: { value: 1 },
    uStorm: { value: 0 },
    uCloud: { value: 0.55 },
    uCursor: { value: new THREE.Vector4(0, 0, 8, 0) },
    uCursorCol: { value: new THREE.Color("#7dffc4") },
    uGridOn: { value: 0 },
  };

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.45,
    dithering: true,
  });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWPos;
         varying float vHeight;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
         vHeight = transformed.y;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vWPos;
         varying float vHeight;
         uniform float uTime;
         uniform vec3  uSunDir;
         uniform vec3  uSunCol;
         uniform vec3  uHorizon;
         uniform float uDay;
         uniform float uStorm;
         uniform float uCloud;
         uniform vec4  uCursor;
         uniform vec3  uCursorCol;
         uniform float uGridOn;

         ${NOISE_GLSL}

         // Multi-scale micro relief. Cheap, analytic, seam free.
         float terrainDetail(vec3 p, float ny, float fade) {
           float n = 0.0;
           n += fbm4(p.xz * 0.085) * 1.00;
           if (fade > 0.02) {
             n += fbm4(p.xz * 0.34)  * 0.42 * fade;
             n += vnoise(p.xz * 1.35) * 0.16 * fade;
           }
           // strata banding revealed on steep faces (triplanar-ish)
           float slope = 1.0 - ny;
           float bands = sin(p.y * 1.25 + vnoise(p.xz * 0.2) * 5.0) * 0.5 + 0.5;
           n += bands * 0.42 * slope * slope;
           n += vnoise(vec2(p.y * 2.6, (p.x + p.z) * 0.9)) * 0.22 * slope * fade;
           return n;
         }

         float cloudCover(vec3 p) {
           vec2 uv = p.xz * 0.0042 + vec2(uTime * 0.0060, uTime * 0.0034);
           float c = fbm4(uv * 1.7);
           return smoothstep(0.40, 0.74, c);
         }`
      )
      // ---- perturb the shading normal --------------------------------
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
         {
           float dist = length(vViewPosition);
           float fade = 1.0 - smoothstep(55.0, 210.0, dist);
           float amp  = mix(0.09, 0.55, fade);
           float hgt  = terrainDetail(vWPos, abs(normal.y), fade);
           vec3 dpdx = dFdx(vWPos);
           vec3 dpdy = dFdy(vWPos);
           float dhdx = dFdx(hgt);
           float dhdy = dFdy(hgt);
           vec3 r1 = cross(dpdy, normal);
           vec3 r2 = cross(normal, dpdx);
           float det = dot(dpdx, r1);
           vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
           normal = normalize(abs(det) * normal - amp * grad);
         }`
      )
      // ---- albedo + roughness variation -------------------------------
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         {
           float g  = fbm4(vWPos.xz * 0.12);
           float g2 = vnoise(vWPos.xz * 0.9);
           diffuseColor.rgb *= 0.80 + 0.42 * g;
           diffuseColor.rgb *= 0.90 + 0.20 * g2;
           // fine mineral speckle
           float sp = vnoise(vWPos.xz * 7.0);
           diffuseColor.rgb += (sp - 0.5) * 0.045;
           // warm iron oxide wash in the hollows
           float low = 1.0 - smoothstep(-6.0, 16.0, vHeight);
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 0.86, 0.74), low * 0.35);
           // pale wind-blown dust on flats
           float flat0 = smoothstep(0.86, 0.995, abs(vNormal.y));
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.06, 1.0) + 0.045, flat0 * 0.55);
           diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
         }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
         {
           float rv = vnoise(vWPos.xz * 0.55);
           roughnessFactor = clamp(0.72 + rv * 0.30 - abs(vNormal.y) * 0.10, 0.30, 1.0);
         }`
      )
      // ---- cloud shadows over direct light ----------------------------
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
         {
           float cc = cloudCover(vWPos);
           float shade = 1.0 - cc * uCloud * (0.55 + 0.35 * uDay);
           reflectedLight.directDiffuse  *= shade;
           reflectedLight.directSpecular *= shade;
           // bounce / sky-dome ambient tint so shadows never read as flat grey
           reflectedLight.indirectDiffuse += diffuseColor.rgb * uHorizon * 0.16 * (0.35 + uDay * 0.8);
         }`
      )
      // ---- aerial perspective + build grid ----------------------------
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
         {
           float dist = length(vViewPosition);
           vec3 vd = normalize(vWPos - cameraPosition);
           float sunAmt = max(dot(vd, uSunDir), 0.0);
           float depth = 1.0 - exp(-dist * (0.0035 + uStorm * 0.010));
           gl_FragColor.rgb += uSunCol * pow(sunAmt, 7.0) * depth * (0.42 + uDay * 0.75);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizon, depth * 0.16);
         }
         if (uGridOn > 0.01) {
           float d = length(vWPos.xz - uCursor.xy);
           float reach = uCursor.z * 3.2;
           float falloff = 1.0 - smoothstep(reach * 0.25, reach, d);
           vec2 gv = abs(fract(vWPos.xz * 0.25 + 0.5) - 0.5) / fwidth(vWPos.xz * 0.25);
           float line = 1.0 - min(min(gv.x, gv.y), 1.0);
           float ring = smoothstep(0.05, 0.0, abs(d - uCursor.z) - 0.18);
           gl_FragColor.rgb += uCursorCol * (line * 0.30 * falloff + ring * 0.85) * uGridOn;
         }`
      );

    mat.userData.shader = shader;
  };

  mat.customProgramCacheKey = () => "exo-terrain-v2";
  return { material: mat, uniforms };
}
