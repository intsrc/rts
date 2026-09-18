import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { engine } from "../game/engine";
import { strataColor, valueNoise } from "../game/terrain";
import { BUILDINGS } from "../game/defs";
import { makeTerrainMaterial } from "./terrainMaterial";
import { skyState } from "./Sky";

const tmpC: [number, number, number] = [0, 0, 0];

export function TerrainView() {
  const { material, uniforms } = useMemo(() => makeTerrainMaterial(), []);
  const time = useRef(0);

  const geometry = useMemo(() => {
    const t = engine.terrain;
    const res = t.res;
    const n = res * res;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const nrm = new Float32Array(n * 3);
    const idx = new Uint32Array((res - 1) * (res - 1) * 6);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const k = j * res + i;
        pos[k * 3] = i * t.cell - t.half;
        pos[k * 3 + 1] = t.heights[k];
        pos[k * 3 + 2] = j * t.cell - t.half;
        nrm[k * 3 + 1] = 1;
      }
    }
    let p = 0;
    for (let j = 0; j < res - 1; j++) {
      for (let i = 0; i < res - 1; i++) {
        const a = j * res + i;
        const b = a + 1;
        const c = a + res;
        const d = c + 1;
        // flip the diagonal on alternating cells: kills the regular-grid "corduroy"
        if ((i + j) & 1) {
          idx[p++] = a; idx[p++] = c; idx[p++] = b;
          idx[p++] = b; idx[p++] = c; idx[p++] = d;
        } else {
          idx[p++] = a; idx[p++] = c; idx[p++] = d;
          idx[p++] = a; idx[p++] = d; idx[p++] = b;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), t.half * 1.8);
    return g;
  }, []);

  const paint = useMemo(() => {
    const t = engine.terrain;
    const res = t.res;
    return (i0: number, j0: number, i1: number, j1: number) => {
      const pos = geometry.attributes.position.array as Float32Array;
      const col = geometry.attributes.color.array as Float32Array;
      const nrm = geometry.attributes.normal.array as Float32Array;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const k = j * res + i;
          const h = t.heights[k];
          pos[k * 3 + 1] = h;

          const il = i > 0 ? k - 1 : k;
          const ir = i < res - 1 ? k + 1 : k;
          const jd = j > 0 ? k - res : k;
          const ju = j < res - 1 ? k + res : k;
          const dx = (t.heights[ir] - t.heights[il]) / (2 * t.cell);
          const dz = (t.heights[ju] - t.heights[jd]) / (2 * t.cell);
          const nl = Math.hypot(-dx, 1, -dz);
          nrm[k * 3] = -dx / nl;
          nrm[k * 3 + 1] = 1 / nl;
          nrm[k * 3 + 2] = -dz / nl;
          const slope = Math.min(1, Math.hypot(dx, dz) * 0.62);

          strataColor(h, tmpC);
          let r = tmpC[0];
          let gg = tmpC[1];
          let b = tmpC[2];

          const mat = t.mats[k];
          if (mat === 2) {
            const m = (1 - slope) * 0.6;
            r += (0.13 - r) * m;
            gg += (0.50 - gg) * m;
            b += (0.40 - b) * m;
          } else if (mat === 3) {
            const m = (1 - slope) * 0.4;
            r += (0.94 - r) * m;
            gg += (0.81 - gg) * m;
            b += (0.62 - b) * m;
          } else if (mat === 0) {
            r *= 0.62;
            gg *= 0.58;
            b *= 0.70;
          }

          const rock = slope * 0.62;
          r += (0.26 - r) * rock;
          gg += (0.17 - gg) * rock;
          b += (0.23 - b) * rock;

          const v = (valueNoise(i * 0.55, j * 0.55, 71) - 0.5) * 0.06;
          col[k * 3] = Math.max(0, r + v);
          col[k * 3 + 1] = Math.max(0, gg + v);
          col[k * 3 + 2] = Math.max(0, b + v);
        }
      }
      (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (geometry.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    };
  }, [geometry]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    time.current += dt;
    const t = engine.terrain;
    if (t.dirty) {
      const pad = 2;
      paint(
        Math.max(0, t.dirtyMin[0] - pad),
        Math.max(0, t.dirtyMin[1] - pad),
        Math.min(t.res - 1, t.dirtyMax[0] + pad),
        Math.min(t.res - 1, t.dirtyMax[1] + pad)
      );
      t.dirty = false;
    }

    uniforms.uTime.value = time.current;
    uniforms.uSunDir.value.copy(skyState.sunDir);
    uniforms.uSunCol.value.copy(skyState.sunColor);
    uniforms.uHorizon.value.copy(skyState.horizon);
    uniforms.uDay.value = skyState.day;
    uniforms.uStorm.value = skyState.storm;
    uniforms.uCloud.value = 0.42 + skyState.storm * 0.3;

    const h = engine.hover;
    const showGrid = !!engine.placing || engine.tool !== "select";
    uniforms.uGridOn.value += ((showGrid ? 1 : 0) - uniforms.uGridOn.value) * Math.min(1, dt * 7);
    uniforms.uCursor.value.set(
      h.x,
      h.z,
      engine.placing ? BUILDINGS[engine.placing].foot + 1.2 : engine.brush,
      1
    );
    uniforms.uCursorCol.value.set(
      engine.placing ? (h.valid ? "#63ffb4" : "#ff5d78") : engine.tool === "lower" ? "#ffb35c" : engine.tool === "raise" ? "#7fd8ff" : "#d6a6ff"
    );
  });

  return <mesh geometry={geometry} material={material} receiveShadow castShadow frustumCulled={false} />;
}

/** Holographic placement ghost + brush ring. */
export function GroundCursor() {
  const ring = useRef<THREE.Mesh>(null);
  const ghost = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt;
    const h = engine.hover;
    const showGhost = !!engine.placing;
    const showBrush = engine.tool !== "select";

    if (ring.current) {
      ring.current.visible = showBrush || showGhost;
      if (ring.current.visible) {
        const r = showGhost ? BUILDINGS[engine.placing!].foot + 1.2 : engine.brush;
        ring.current.position.set(h.x, engine.terrain.heightAt(h.x, h.z) + 0.3, h.z);
        ring.current.scale.setScalar(r * (1 + Math.sin(t.current * 4) * 0.012));
        const m = ring.current.material as THREE.MeshBasicMaterial;
        m.color.set(
          showGhost ? (h.valid ? "#63ffb4" : "#ff5d78") : engine.tool === "lower" ? "#ffb35c" : engine.tool === "raise" ? "#7fd8ff" : "#d6a6ff"
        );
        ring.current.rotation.z += dt * 0.5;
      }
    }

    if (ghost.current) {
      ghost.current.visible = showGhost;
      if (showGhost) {
        const d = BUILDINGS[engine.placing!];
        ghost.current.position.set(h.x, engine.terrain.heightAt(h.x, h.z), h.z);
        ghost.current.scale.setScalar(d.foot * 0.42);
        ghost.current.rotation.y += dt * 0.7;
        ghost.current.children.forEach((c) => {
          const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial;
          if (m) m.color.set(h.valid ? "#63ffb4" : "#ff5d78");
        });
      }
    }

    if (beacon.current) {
      beacon.current.visible = showGhost;
      if (showGhost) {
        beacon.current.position.set(h.x, engine.terrain.heightAt(h.x, h.z) + 9, h.z);
        beacon.current.scale.set(1, 18, 1);
        const m = beacon.current.material as THREE.MeshBasicMaterial;
        m.color.set(h.valid ? "#63ffb4" : "#ff5d78");
        m.opacity = 0.10 + Math.abs(Math.sin(t.current * 3)) * 0.10;
      }
    }
  });

  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#63ffb4" transparent opacity={0.95} depthTest={false} toneMapped={false} />
      </mesh>
      <group ref={ghost}>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[2.6, 3, 2.6]} />
          <meshBasicMaterial color="#63ffb4" transparent opacity={0.3} wireframe toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[2.58, 2.98, 2.58]} />
          <meshBasicMaterial color="#63ffb4" transparent opacity={0.09} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={beacon}>
        <cylinderGeometry args={[0.16, 0.5, 1, 10, 1, true]} />
        <meshBasicMaterial
          color="#63ffb4"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
