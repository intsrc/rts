import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { engine, Building, Unit, Enemy } from "../game/engine";
import { mulberry32 } from "../game/terrain";
import { skyState } from "./Sky";
import { cam } from "./camera";
import { BUILDINGS, RESOURCES, ResourceKey, UNITS } from "../game/defs";

function useRoster() {
  return useSyncExternalStore(engine.subscribe, () => engine.rosterVersion);
}

const UP = new THREE.Vector3(0, 1, 0);

/** Emissive surfaces bloom harder after dark so the colony reads as lit. */
export function applyNightGlow(root: THREE.Object3D, extra = 1) {
  const boost = (0.85 + (1 - skyState.day) * 1.85) * extra;
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || !(m as any).isMeshStandardMaterial || !m.emissive) return;
    if (m.userData.baseEmissive === undefined) m.userData.baseEmissive = m.emissiveIntensity;
    m.emissiveIntensity = m.userData.baseEmissive * boost;
  });
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

// ============================================================
//  BUILDINGS
// ============================================================

function BuildingModel({ kind, accent }: { kind: string; accent: string }) {
  const hull = (
    <meshPhysicalMaterial
      color="#eceae6"
      roughness={0.34}
      metalness={0.28}
      clearcoat={0.85}
      clearcoatRoughness={0.22}
      envMapIntensity={1.35}
      sheen={0.25}
      sheenColor="#bcd8ff"
    />
  );
  const dark = (
    <meshPhysicalMaterial
      color="#2b303b"
      roughness={0.30}
      metalness={0.92}
      envMapIntensity={1.7}
      clearcoat={0.4}
    />
  );
  const glass = (
    <meshPhysicalMaterial
      color="#8fd2ff"
      roughness={0.06}
      metalness={0.05}
      transparent
      opacity={0.42}
      envMapIntensity={2.4}
      clearcoat={1}
      clearcoatRoughness={0.03}
      side={THREE.DoubleSide}
    />
  );
  const glow = (
    <meshStandardMaterial
      color={accent}
      emissive={accent}
      emissiveIntensity={3.4}
      roughness={0.3}
      metalness={0.1}
      toneMapped={false}
    />
  );
  switch (kind) {
    case "habitat":
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[5.4, 6, 1, 32]} />
            {dark}
          </mesh>
          <mesh castShadow receiveShadow position={[0, 1.2, 0]}>
            <sphereGeometry args={[4.4, 40, 22, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {hull}
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[4.62, 40, 22, 0, Math.PI * 2, 0, Math.PI / 2.35]} />
            {glass}
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <sphereGeometry args={[3.1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#123047" emissive={accent} emissiveIntensity={0.55} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.25, 0]}>
            <torusGeometry args={[4.42, 0.16, 12, 64]} />
            {glow}
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos((i / 5) * 6.28) * 3.9, 2.6, Math.sin((i / 5) * 6.28) * 3.9]} rotation={[0, -(i / 5) * 6.28, 0]}>
              <boxGeometry args={[1.5, 0.9, 0.2]} />
              {glow}
            </mesh>
          ))}
          <mesh castShadow position={[0, 6.4, 0]}>
            <cylinderGeometry args={[0.12, 0.2, 4, 6]} />
            {dark}
          </mesh>
          <mesh position={[0, 8.6, 0]}>
            <icosahedronGeometry args={[0.55, 0]} />
            {glow}
          </mesh>
        </group>
      );
    case "tether":
      return (
        <group>
          <mesh castShadow position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.12, 0.22, 2.8, 6]} />
            {dark}
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <octahedronGeometry args={[0.62, 0]} />
            {glow}
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.85, 12]} />
            <meshBasicMaterial color={accent} transparent opacity={0.4} toneMapped={false} />
          </mesh>
        </group>
      );
    case "solar":
      return (
        <group>
          <mesh castShadow position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.3, 0.55, 2.2, 16]} />
            {dark}
          </mesh>
          <group position={[0, 2.5, 0]} rotation={[-0.62, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[5, 0.16, 3.2]} />
              <meshPhysicalMaterial color="#111c3a" roughness={0.09} metalness={0.85} envMapIntensity={2.6} clearcoat={1} clearcoatRoughness={0.05} emissive={accent} emissiveIntensity={0.18} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[4.6, 0.02, 2.9]} />
              {glow}
            </mesh>
          </group>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[1.5, 1.7, 0.4, 10]} />
            {hull}
          </mesh>
        </group>
      );
    case "turbine":
      return (
        <group>
          <mesh castShadow position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.24, 0.5, 6.4, 16]} />
            {hull}
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[1.3, 1.6, 0.5, 8]} />
            {dark}
          </mesh>
          <group name="spin" position={[0, 6.5, 0]}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} castShadow rotation={[0, 0, (i / 3) * 6.28]} position={[Math.cos((i / 3) * 6.28) * 1.7, Math.sin((i / 3) * 6.28) * 1.7, 0]}>
                <boxGeometry args={[3.2, 0.42, 0.1]} />
                {hull}
              </mesh>
            ))}
            <mesh>
              <sphereGeometry args={[0.45, 10, 8]} />
              {glow}
            </mesh>
          </group>
        </group>
      );
    case "generator":
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
            <boxGeometry args={[3.4, 2.2, 2.6]} />
            {hull}
          </mesh>
          <mesh position={[1.1, 3, 0.6]} castShadow>
            <cylinderGeometry args={[0.36, 0.44, 2.4, 8]} />
            {dark}
          </mesh>
          <mesh position={[-0.9, 2.35, 0]}>
            <boxGeometry args={[1.3, 0.5, 2.2]} />
            {glow}
          </mesh>
          <mesh position={[0, 1.1, 1.32]}>
            <boxGeometry args={[2.2, 0.9, 0.06]} />
            {glow}
          </mesh>
        </group>
      );
    case "smelter":
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 1.4, 0]}>
            <cylinderGeometry args={[1.8, 2.5, 2.8, 24]} />
            {hull}
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow>
            <cylinderGeometry args={[1.1, 1.6, 1.4, 24]} />
            {dark}
          </mesh>
          <mesh position={[0, 4.4, 0]}>
            <torusGeometry args={[0.9, 0.2, 12, 36]} />
            {glow}
          </mesh>
          <mesh position={[0, 1.5, 2.1]}>
            <boxGeometry args={[1.6, 1.2, 0.1]} />
            {glow}
          </mesh>
        </group>
      );
    case "printer":
      return (
        <group>
          <mesh receiveShadow position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[5, 0.5, 5]} />
            {dark}
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow position={[s * 2.1, 2, 0]}>
              <boxGeometry args={[0.4, 4, 0.4]} />
              {hull}
            </mesh>
          ))}
          <mesh position={[0, 3.9, 0]} castShadow>
            <boxGeometry args={[4.8, 0.5, 1.4]} />
            {hull}
          </mesh>
          <mesh name="spin" position={[0, 1.8, 0]}>
            <torusGeometry args={[1.5, 0.12, 10, 40]} />
            {glow}
          </mesh>
          <mesh position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4, 4]} />
            <meshBasicMaterial color={accent} transparent opacity={0.22} toneMapped={false} />
          </mesh>
        </group>
      );
    case "research":
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 0.8, 0]}>
            <cylinderGeometry args={[2.3, 2.6, 1.6, 6]} />
            {hull}
          </mesh>
          <mesh name="spin" position={[0, 3, 0]} castShadow>
            <icosahedronGeometry args={[1.5, 0]} />
            <meshPhysicalMaterial color={accent} emissive={accent} emissiveIntensity={2.4} roughness={0.04} metalness={0.0} transparent opacity={0.6} transmission={0.55} thickness={1.6} ior={1.7} envMapIntensity={2.5} toneMapped={false} />
          </mesh>
          <mesh position={[0, 3, 0]}>
            <torusGeometry args={[2.1, 0.08, 10, 48]} />
            {glow}
          </mesh>
        </group>
      );
    case "silo":
      return (
        <group>
          {[[-1.1, -0.6], [1.1, -0.6], [0, 1.2]].map((p, i) => (
            <mesh key={i} castShadow receiveShadow position={[p[0], 1.6, p[1]]}>
              <cylinderGeometry args={[0.95, 0.95, 3.2, 20]} />
              {hull}
            </mesh>
          ))}
          <mesh position={[0, 3.35, 0]}>
            <torusGeometry args={[1.6, 0.1, 10, 40]} />
            {glow}
          </mesh>
        </group>
      );
    case "turret":
      return (
        <group>
          <mesh castShadow position={[0, 0.6, 0]}>
            <cylinderGeometry args={[1.4, 1.8, 1.2, 20]} />
            {dark}
          </mesh>
          <group name="spin" position={[0, 2.2, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[1.1, 20, 16]} />
              {hull}
            </mesh>
            {[-0.5, 0.5].map((s) => (
              <mesh key={s} castShadow position={[s, 0.15, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.16, 0.16, 2.4, 6]} />
                {dark}
              </mesh>
            ))}
            <mesh position={[0, 0.15, 2.1]}>
              <sphereGeometry args={[0.22, 16, 12]} />
              {glow}
            </mesh>
          </group>
        </group>
      );
    case "beacon":
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[4, 4.6, 1, 6]} />
            {dark}
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} castShadow position={[Math.cos((i / 6) * 6.28) * 3, 2.6, Math.sin((i / 6) * 6.28) * 3]} rotation={[0, 0, Math.cos((i / 6) * 6.28) * 0.18]}>
              <cylinderGeometry args={[0.22, 0.34, 4.4, 6]} />
              {hull}
            </mesh>
          ))}
          <mesh name="spin" position={[0, 6, 0]}>
            <icosahedronGeometry args={[2, 1]} />
            {glow}
          </mesh>
          <mesh position={[0, 6, 0]}>
            <sphereGeometry args={[2.6, 16, 12]} />
            <meshBasicMaterial color={accent} transparent opacity={0.16} toneMapped={false} />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh castShadow position={[0, 1, 0]}>
          <boxGeometry args={[2, 2, 2]} />
          {hull}
        </mesh>
      );
  }
}

function BuildingView({ b }: { b: Building }) {
  const grp = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const bar = useRef<THREE.Mesh>(null);
  const glowT = useRef(Math.random());
  const def = BUILDINGS[b.kind];
  const { camera } = useThree();

  useFrame((_, dt) => {
    const g = grp.current;
    if (!g) return;
    g.position.set(b.x, b.y, b.z);
    glowT.current -= dt;
    if (glowT.current <= 0) {
      glowT.current = 0.4 + Math.random() * 0.3;
      applyNightGlow(g, b.powered ? 1 : 0.28);
    }
    if (inner.current) {
      const p = b.built ? 1 : 0.15 + b.progress * 0.85;
      inner.current.scale.setScalar(p);
      inner.current.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.name === "spin") o.rotation.y += dt * (b.powered ? 1.4 : 0.1);
        if ((o as THREE.Group).name === "spin" && !(o as THREE.Mesh).isMesh) {
          if (b.kind === "turbine") o.rotation.z += dt * (b.powered ? 3.2 : 0.3);
          else o.rotation.y += dt * (b.powered ? 1.2 : 0.1);
        }
      });
    }
    if (ring.current) {
      ring.current.visible = b.selected;
      ring.current.scale.setScalar(def.foot + 1.4);
      ring.current.rotation.z += dt * 0.5;
    }
    if (bar.current) {
      const dmg = b.hp < b.maxHp - 1;
      bar.current.visible = dmg || !b.built;
      if (bar.current.visible) {
        const f = b.built ? b.hp / b.maxHp : b.progress;
        bar.current.scale.set(Math.max(0.02, f) * 4, 0.36, 1);
        bar.current.position.set(0, def.foot * 1.5 + 4.4, 0);
        bar.current.position.x = -(1 - Math.max(0.02, f)) * 2;
        (bar.current.material as THREE.MeshBasicMaterial).color.set(
          b.built ? (f > 0.5 ? "#7dffc4" : "#ff6b83") : "#8fe3ff"
        );
        bar.current.quaternion.copy(camera.quaternion);
      }
    }
  });

  return (
    <group ref={grp}>
      <group ref={inner}>
        <BuildingModel kind={b.kind} accent={def.accent} />
      </group>
      {!b.built && (
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[def.foot * 0.75, def.foot, 24]} />
          <meshBasicMaterial color="#8fe3ff" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.28, 0]}>
        <ringGeometry args={[0.88, 1, 40]} />
        <meshBasicMaterial color="#9bffd8" transparent opacity={0.9} toneMapped={false} depthTest={false} />
      </mesh>
      <mesh ref={bar} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#7dffc4" toneMapped={false} depthTest={false} transparent />
      </mesh>
    </group>
  );
}

export function Buildings() {
  useRoster();
  return (
    <group>
      {engine.buildings.map((b) => (
        <BuildingView key={b.id} b={b} />
      ))}
    </group>
  );
}

// ============================================================
//  UNITS
// ============================================================

function UnitModel({ kind, accent }: { kind: string; accent: string }) {
  const hull = (
    <meshPhysicalMaterial
      color="#f4f1ec"
      roughness={0.26}
      metalness={0.35}
      clearcoat={1}
      clearcoatRoughness={0.14}
      envMapIntensity={1.7}
    />
  );
  const dark = <meshPhysicalMaterial color="#262b36" roughness={0.24} metalness={0.95} envMapIntensity={2.0} />;
  const glow = (
    <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={4.2} roughness={0.25} toneMapped={false} />
  );
  if (kind === "prospector")
    return (
      <group>
        <mesh castShadow>
          <sphereGeometry args={[0.85, 28, 20]} />
          {hull}
        </mesh>
        <mesh position={[0, 0.2, 0.7]}>
          <sphereGeometry args={[0.42, 20, 16]} />
          {glow}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} castShadow position={[s * 0.95, -0.1, 0]} rotation={[0, 0, s * 0.5]}>
            <capsuleGeometry args={[0.18, 0.7, 6, 16]} />
            {dark}
          </mesh>
        ))}
        <mesh position={[0, -0.75, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.1, 10, 32]} />
          {glow}
        </mesh>
      </group>
    );
  if (kind === "constructor")
    return (
      <group>
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.9, 1.7]} />
          {hull}
        </mesh>
        <mesh position={[0, 0.66, 0.2]} castShadow>
          <boxGeometry args={[0.9, 0.5, 0.9]} />
          {dark}
        </mesh>
        <mesh position={[0, 0.2, 1.05]}>
          <boxGeometry args={[1.1, 0.34, 0.12]} />
          {glow}
        </mesh>
        <mesh position={[0, -0.2, 1.3]} rotation={[0.5, 0, 0]} castShadow>
          <coneGeometry args={[0.3, 0.8, 8]} />
          {dark}
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.85, -0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32, 0.09, 10, 28]} />
            {glow}
          </mesh>
        ))}
      </group>
    );
  return (
    <group>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.5, 1.1, 8, 24]} />
        {hull}
      </mesh>
      <mesh position={[0, 0.34, -0.2]} castShadow>
        <boxGeometry args={[1.9, 0.14, 0.7]} />
        {dark}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.82, 0.34, 0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1, 6]} />
          {glow}
        </mesh>
      ))}
      <mesh position={[0, 0, 0.95]}>
        <sphereGeometry args={[0.28, 18, 14]} />
        {glow}
      </mesh>
      <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.08, 10, 28]} />
        {glow}
      </mesh>
    </group>
  );
}

function UnitView({ u }: { u: Unit }) {
  const grp = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const cargo = useRef<THREE.Mesh>(null);
  const bar = useRef<THREE.Mesh>(null);
  const glowT = useRef(Math.random());
  const { camera } = useThree();
  const def = UNITS[u.kind];

  useFrame((_, dt) => {
    const g = grp.current;
    if (!g) return;
    g.position.set(u.x, u.y, u.z);
    glowT.current -= dt;
    if (glowT.current <= 0) {
      glowT.current = 0.45 + Math.random() * 0.3;
      applyNightGlow(g);
    }
    if (body.current) {
      let diff = u.heading - body.current.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      body.current.rotation.y += diff * Math.min(1, dt * 8);
      body.current.rotation.z = -u.vx * 0.02;
      body.current.rotation.x = u.vz * 0.02;
      body.current.position.y = Math.sin(u.bob * 1.6) * 0.1;
    }
    if (ring.current) {
      ring.current.visible = u.selected;
      ring.current.position.y = -(u.y - engine.terrain.heightAt(u.x, u.z)) + 0.25;
      ring.current.rotation.z += dt * 1.2;
    }
    if (beam.current) {
      beam.current.visible = u.beam.on;
      if (u.beam.on) {
        _a.set(u.x, u.y, u.z);
        _b.set(u.beam.x, u.beam.y, u.beam.z);
        const d = _b.clone().sub(_a);
        const len = d.length();
        beam.current.position.copy(_b).sub(_a).multiplyScalar(0.5);
        _q.setFromUnitVectors(UP, d.normalize());
        beam.current.quaternion.copy(_q);
        beam.current.scale.set(1, len, 1);
        const m = beam.current.material as THREE.MeshBasicMaterial;
        m.color.set(u.beam.color);
        m.opacity = 0.35 + Math.abs(Math.sin(performance.now() * 0.02)) * 0.4;
      }
    }
    if (cargo.current) {
      const on = u.cargo > 0.2 && !!u.cargoType;
      cargo.current.visible = on;
      if (on) {
        const s = 0.25 + (u.cargo / def.cargo) * 0.45;
        cargo.current.scale.setScalar(s);
        cargo.current.position.y = 1.25 + Math.sin(u.bob * 2) * 0.06;
        cargo.current.rotation.y += dt * 1.6;
        (cargo.current.material as THREE.MeshStandardMaterial).color.set(RESOURCES[u.cargoType as ResourceKey].color);
        (cargo.current.material as THREE.MeshStandardMaterial).emissive.set(RESOURCES[u.cargoType as ResourceKey].color);
      }
    }
    if (bar.current) {
      const dmg = u.hp < u.maxHp - 0.5;
      bar.current.visible = dmg;
      if (dmg) {
        const f = Math.max(0.02, u.hp / u.maxHp);
        bar.current.scale.set(f * 1.6, 0.16, 1);
        bar.current.position.set(-(1 - f) * 0.8, 1.9, 0);
        (bar.current.material as THREE.MeshBasicMaterial).color.set(f > 0.4 ? "#7dffc4" : "#ff6b83");
        bar.current.quaternion.copy(camera.quaternion);
      }
    }
  });

  return (
    <group ref={grp}>
      <group ref={body}>
        <UnitModel kind={u.kind} accent={def.accent} />
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.25, 1.5, 28]} />
        <meshBasicMaterial color="#9bffd8" transparent opacity={0.95} toneMapped={false} depthTest={false} />
      </mesh>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.07, 0.16, 1, 6, 1, true]} />
        <meshBasicMaterial color="#ffd06b" transparent opacity={0.6} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={cargo} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.7} toneMapped={false} />
      </mesh>
      <mesh ref={bar} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#7dffc4" toneMapped={false} depthTest={false} transparent />
      </mesh>
    </group>
  );
}

export function Units() {
  useRoster();
  return (
    <group>
      {engine.units.map((u) => (
        <UnitView key={u.id} u={u} />
      ))}
    </group>
  );
}

// ============================================================
//  ENEMIES
// ============================================================

function EnemyView({ e }: { e: Enemy }) {
  const grp = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const bar = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const big = e.kind === "brute";

  useFrame((_, dt) => {
    const g = grp.current;
    if (!g) return;
    g.position.set(e.x, e.y + Math.abs(Math.sin(e.phase)) * (big ? 0.2 : 0.45), e.z);
    g.rotation.y = e.heading;
    if (core.current) {
      core.current.rotation.x += dt * 2;
      core.current.rotation.y += dt * 1.4;
      const m = core.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.4 + e.flash * 5;
    }
    if (bar.current) {
      const f = Math.max(0.02, e.hp / e.maxHp);
      bar.current.visible = e.hp < e.maxHp;
      bar.current.scale.set(f * 2, 0.18, 1);
      bar.current.position.set(-(1 - f), big ? 3.4 : 2.2, 0);
      bar.current.quaternion.copy(camera.quaternion);
    }
  });

  const s = big ? 1.9 : 1;
  return (
    <group ref={grp}>
      <group scale={s}>
        <mesh ref={core} castShadow>
          <icosahedronGeometry args={[0.85, 1]} />
          <meshPhysicalMaterial color="#2a0f42" emissive="#c25cff" emissiveIntensity={2.6} roughness={0.12} metalness={0.3} clearcoat={1} envMapIntensity={1.8} toneMapped={false} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return (
            <mesh key={i} castShadow position={[Math.cos(a) * 0.8, -0.3, Math.sin(a) * 0.8]} rotation={[0.5 * Math.sin(a), -a, 0.5 * Math.cos(a)]}>
              <coneGeometry args={[0.16, 1.1, 5]} />
              <meshPhysicalMaterial color="#4a2168" roughness={0.3} metalness={0.6} envMapIntensity={1.3} clearcoat={0.7} />
            </mesh>
          );
        })}
      </group>
      <mesh ref={bar} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff6b83" toneMapped={false} depthTest={false} transparent />
      </mesh>
    </group>
  );
}

export function Enemies() {
  useRoster();
  return (
    <group>
      {engine.enemies.map((e) => (
        <EnemyView key={e.id} e={e} />
      ))}
    </group>
  );
}

// ============================================================
//  RESOURCE NODES (instanced crystals)
// ============================================================

const NODE_TYPES: ResourceKey[] = ["compound", "resin", "organic", "laterite", "malachite"];

export function Nodes() {
  useRoster();
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const haloRefs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const timer = useRef(0);
  const pulse = useRef(0);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of NODE_TYPES) c[t] = 0;
    for (const n of engine.nodes) c[n.type] += n.shards.length;
    return c;
  }, [engine.rosterVersion]);

  const rebuild = () => {
    const cursor: Record<string, number> = {};
    for (const t of NODE_TYPES) cursor[t] = 0;
    for (const n of engine.nodes) {
      const mesh = refs.current[n.type];
      if (!mesh) continue;
      const frac = Math.max(0.18, n.amount / n.max);
      for (const sh of n.shards) {
        const i = cursor[n.type]++;
        if (i >= mesh.count) break;
        const sc = sh.s * n.scale * (0.45 + frac * 0.75);
        if (!n.discovered) {
          _m.makeScale(0, 0, 0);
        } else {
          _e.set(Math.sin(sh.r) * 0.25, sh.r * 3, Math.cos(sh.r) * 0.25);
          _q.setFromEuler(_e);
          _a.set(n.x + sh.x, engine.terrain.heightAt(n.x + sh.x, n.z + sh.z) + sh.h * sc * 0.42, n.z + sh.z);
          _s.set(sc, sc * sh.h, sc);
          _m.compose(_a, _q, _s);
        }
        mesh.setMatrixAt(i, _m);
        const halo = haloRefs.current[n.type];
        if (halo && i < halo.count) halo.setMatrixAt(i, _m);
      }
    }
    for (const t of NODE_TYPES) {
      for (const mesh of [refs.current[t], haloRefs.current[t]]) {
        if (!mesh) continue;
        for (let i = cursor[t]; i < mesh.count; i++) {
          _m.makeScale(0, 0, 0);
          mesh.setMatrixAt(i, _m);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  };

  useFrame((_, dt) => {
    timer.current -= dt;
    pulse.current += dt;
    if (timer.current <= 0) {
      timer.current = 0.35;
      rebuild();
    }
    const o = 0.10 + Math.sin(pulse.current * 1.7) * 0.045;
    for (const t of NODE_TYPES) {
      const h = haloRefs.current[t];
      if (h) (h.material as THREE.MeshBasicMaterial).opacity = o;
    }
  });

  return (
    <group>
      {NODE_TYPES.map((t) => (
        <group key={t + counts[t]}>
          <instancedMesh
            ref={(r) => {
              refs.current[t] = r;
              if (r) rebuild();
            }}
            args={[undefined as any, undefined as any, Math.max(1, counts[t])]}
            castShadow
            receiveShadow
            frustumCulled={false}
          >
            <octahedronGeometry args={[0.8, 0]} />
            <meshPhysicalMaterial
              color={RESOURCES[t].color}
              emissive={RESOURCES[t].color}
              emissiveIntensity={1.15}
              roughness={0.05}
              metalness={0.0}
              transmission={0.45}
              thickness={2.0}
              ior={1.85}
              envMapIntensity={2.2}
              clearcoat={1}
              clearcoatRoughness={0.04}
              flatShading
            />
          </instancedMesh>
          <instancedMesh
            ref={(r) => {
              haloRefs.current[t] = r;
            }}
            args={[undefined as any, undefined as any, Math.max(1, counts[t])]}
            frustumCulled={false}
            renderOrder={3}
          >
            <octahedronGeometry args={[1.25, 0]} />
            <meshBasicMaterial
              color={RESOURCES[t].color}
              transparent
              opacity={0.13}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </instancedMesh>
        </group>
      ))}
    </group>
  );
}

// ============================================================
//  TETHER NETWORK
// ============================================================

const MAX_LINK = 320;
const LINK_SEG = 7;

/** Sagging energy conduits drawn as camera-facing glowing ribbons. */
export function TetherLines() {
  useRoster();
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const quads = MAX_LINK * LINK_SEG;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(quads * 4 * 3), 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(quads * 4), 1));
    g.setAttribute("aT", new THREE.BufferAttribute(new Float32Array(quads * 4), 1));
    g.setAttribute("aNext", new THREE.BufferAttribute(new Float32Array(quads * 4 * 3), 3));
    const idx = new Uint32Array(quads * 6);
    for (let q = 0; q < quads; q++) {
      const o = q * 4;
      idx[q * 6] = o;
      idx[q * 6 + 1] = o + 1;
      idx[q * 6 + 2] = o + 2;
      idx[q * 6 + 3] = o + 2;
      idx[q * 6 + 4] = o + 1;
      idx[q * 6 + 5] = o + 3;
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uPower: { value: 1 }, uColor: { value: new THREE.Color("#6ff2d8") } }),
    []
  );

  const timer = useRef(0);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    uniforms.uPower.value += ((engine.powerSat > 0.1 ? 1 : 0.22) - uniforms.uPower.value) * Math.min(1, dt * 4);
    timer.current -= dt;
    if (timer.current > 0) return;
    timer.current = 0.25;

    const pos = geo.attributes.position.array as Float32Array;
    const nxt = geo.attributes.aNext.array as Float32Array;
    const side = geo.attributes.aSide.array as Float32Array;
    const tt = geo.attributes.aT.array as Float32Array;
    let q = 0;
    const links = engine.networkLinks();
    for (let li = 0; li < links.length && li < MAX_LINK; li++) {
      const [a, b] = links[li];
      const ay = a.y + 2.8;
      const by = b.y + 2.8;
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      const sag = Math.min(2.4, span * 0.045);
      for (let sgi = 0; sgi < LINK_SEG; sgi++) {
        const t0 = sgi / LINK_SEG;
        const t1 = (sgi + 1) / LINK_SEG;
        const pt = (t: number) => {
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * sag;
          return [x, y, z];
        };
        const p0 = pt(t0);
        const p1 = pt(t1);
        for (let c = 0; c < 4; c++) {
          const base = (q * 4 + c) * 3;
          const src = c < 2 ? p0 : p1;
          const dst = c < 2 ? p1 : p0;
          pos[base] = src[0];
          pos[base + 1] = src[1];
          pos[base + 2] = src[2];
          nxt[base] = dst[0];
          nxt[base + 1] = dst[1];
          nxt[base + 2] = dst[2];
          side[q * 4 + c] = c % 2 === 0 ? -1 : 1;
          tt[q * 4 + c] = (li * LINK_SEG + sgi + (c < 2 ? 0 : 1)) / LINK_SEG;
        }
        q++;
      }
    }
    geo.setDrawRange(0, q * 6);
    for (const k of ["position", "aNext", "aSide", "aT"]) {
      (geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <mesh ref={ref} geometry={geo} frustumCulled={false} renderOrder={4}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        side={THREE.DoubleSide}
        vertexShader={`
          attribute float aSide;
          attribute float aT;
          attribute vec3 aNext;
          varying float vSide;
          varying float vT;
          void main(){
            vSide = aSide; vT = aT;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec4 mvn = modelViewMatrix * vec4(aNext, 1.0);
            vec2 dir = normalize((mvn.xy / max(0.001, -mvn.z)) - (mv.xy / max(0.001, -mv.z)) + vec2(1e-5));
            vec2 nrm = vec2(-dir.y, dir.x);
            float w = 0.09 * max(1.0, -mv.z * 0.055);
            mv.xy += nrm * aSide * w;
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={`
          uniform float uTime; uniform float uPower; uniform vec3 uColor;
          varying float vSide; varying float vT;
          void main(){
            float core = 1.0 - abs(vSide);
            float a = pow(core, 1.6) * 0.55;
            float pulseA = sin(vT * 9.0 - uTime * 5.0);
            float pulse = smoothstep(0.72, 1.0, pulseA);
            vec3 c = uColor * (0.7 + pulse * 2.6);
            gl_FragColor = vec4(c * uPower, (a + pulse * 0.45 * core) * uPower);
          }`}
      />
    </mesh>
  );
}

// ============================================================
//  BOLTS + PARTICLES
// ============================================================

const MAX_BOLT = 200;

/** Energy tracers rendered as screen-facing additive ribbons with a hot core. */
export function Bolts() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_BOLT * 4 * 3), 3));
    g.setAttribute("aNext", new THREE.BufferAttribute(new Float32Array(MAX_BOLT * 4 * 3), 3));
    g.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(MAX_BOLT * 4), 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(MAX_BOLT * 4 * 3), 3));
    g.setAttribute("aLife", new THREE.BufferAttribute(new Float32Array(MAX_BOLT * 4), 1));
    const idx = new Uint32Array(MAX_BOLT * 6);
    for (let q = 0; q < MAX_BOLT; q++) {
      const o = q * 4;
      idx[q * 6] = o; idx[q * 6 + 1] = o + 1; idx[q * 6 + 2] = o + 2;
      idx[q * 6 + 3] = o + 2; idx[q * 6 + 4] = o + 1; idx[q * 6 + 5] = o + 3;
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, []);
  const c = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const pos = geo.attributes.position.array as Float32Array;
    const nxt = geo.attributes.aNext.array as Float32Array;
    const side = geo.attributes.aSide.array as Float32Array;
    const col = geo.attributes.aColor.array as Float32Array;
    const life = geo.attributes.aLife.array as Float32Array;
    let q = 0;
    for (const b of engine.bolts) {
      if (q >= MAX_BOLT) break;
      const t = b.t / b.life;
      const head = Math.min(1, t * 2.4);
      const tail = Math.max(0, t * 2.4 - 0.4);
      const hx = b.x + (b.tx - b.x) * head;
      const hy = b.y + (b.ty - b.y) * head;
      const hz = b.z + (b.tz - b.z) * head;
      const sx = b.x + (b.tx - b.x) * tail;
      const sy = b.y + (b.ty - b.y) * tail;
      const sz = b.z + (b.tz - b.z) * tail;
      c.set(b.color);
      for (let k = 0; k < 4; k++) {
        const i3 = (q * 4 + k) * 3;
        const from = k < 2 ? [sx, sy, sz] : [hx, hy, hz];
        const to = k < 2 ? [hx, hy, hz] : [sx, sy, sz];
        pos[i3] = from[0]; pos[i3 + 1] = from[1]; pos[i3 + 2] = from[2];
        nxt[i3] = to[0]; nxt[i3 + 1] = to[1]; nxt[i3 + 2] = to[2];
        col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
        side[q * 4 + k] = k % 2 === 0 ? -1 : 1;
        life[q * 4 + k] = 1 - t;
      }
      q++;
    }
    geo.setDrawRange(0, q * 6);
    for (const k of ["position", "aNext", "aSide", "aColor", "aLife"]) {
      (geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <mesh geometry={geo} frustumCulled={false} renderOrder={6}>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        side={THREE.DoubleSide}
        vertexShader={`
          attribute vec3 aNext; attribute float aSide; attribute vec3 aColor; attribute float aLife;
          varying float vSide; varying vec3 vCol; varying float vLife;
          void main(){
            vSide = aSide; vCol = aColor; vLife = aLife;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec4 mvn = modelViewMatrix * vec4(aNext, 1.0);
            vec2 dir = normalize((mvn.xy / max(0.001, -mvn.z)) - (mv.xy / max(0.001, -mv.z)) + vec2(1e-5));
            vec2 nrm = vec2(-dir.y, dir.x);
            mv.xy += nrm * aSide * 0.16 * max(1.0, -mv.z * 0.05);
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={`
          varying float vSide; varying vec3 vCol; varying float vLife;
          void main(){
            float core = 1.0 - abs(vSide);
            float glow = pow(core, 1.4);
            float hot = pow(core, 7.0);
            vec3 c = vCol * glow * 2.2 + vec3(1.0) * hot * 1.6;
            gl_FragColor = vec4(c, (glow * 0.8 + hot) * vLife);
          }`}
      />
    </mesh>
  );
}

const pVert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = aSize * (300.0 / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;
const pFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if(r > 0.5) discard;
  float halo = pow(smoothstep(0.5, 0.0, r), 1.9);
  float core = pow(smoothstep(0.22, 0.0, r), 1.4);
  vec3 c = vColor * (halo * 1.3 + core * 1.9) + vec3(core * 0.55);
  gl_FragColor = vec4(c, (halo * 0.85 + core) * vAlpha);
}`;

const MAX_P = 1500;

export function Particles() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(MAX_P), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(MAX_P), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    return g;
  }, []);
  const c = useMemo(() => new THREE.Color(), []);
  const motes = useMemo(() => {
    const arr: { x: number; y: number; z: number; s: number; p: number; ground: boolean }[] = [];
    // low sheet that drifts along the dunes
    for (let i = 0; i < 360; i++)
      arr.push({
        x: (Math.random() - 0.5) * 260,
        y: Math.random() * 5.5,
        z: (Math.random() - 0.5) * 260,
        s: 0.6 + Math.random() * 2.2,
        p: Math.random() * 100,
        ground: true,
      });
    // high haze for aerial depth
    for (let i = 0; i < 200; i++)
      arr.push({
        x: (Math.random() - 0.5) * 340,
        y: 12 + Math.random() * 48,
        z: (Math.random() - 0.5) * 340,
        s: 0.4 + Math.random() * 1.3,
        p: Math.random() * 100,
        ground: false,
      });
    return arr;
  }, []);

  useFrame((_, dt) => {
    const pos = geo.attributes.position.array as Float32Array;
    const col = geo.attributes.aColor.array as Float32Array;
    const siz = geo.attributes.aSize.array as Float32Array;
    const alp = geo.attributes.aAlpha.array as Float32Array;
    let i = 0;

    for (const f of engine.fx) {
      const t = f.t / f.life;
      const n = f.kind === "burst" ? 8 : 3;
      for (let k = 0; k < n && i < MAX_P; k++) {
        const a = (k / n) * Math.PI * 2 + f.t * 2;
        const rad = f.size * t * 1.6 * (0.5 + (k % 3) * 0.3);
        pos[i * 3] = f.x + Math.cos(a) * rad;
        pos[i * 3 + 1] = f.y + t * f.size * (f.kind === "dust" ? 1.6 : 1.0) + Math.sin(k) * 0.2;
        pos[i * 3 + 2] = f.z + Math.sin(a) * rad;
        c.set(f.color);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        siz[i] = f.size * (1 - t) * 6;
        alp[i] = (1 - t) * 0.95;
        i++;
      }
    }

    // ---- ambient dust: a low sheet hugging the dunes + high aerial haze ----
    const storm = engine.storm > 0 ? Math.min(1, engine.storm / 6) : 0;
    const wind = 3.5 + storm * 34;
    const day = skyState.day;
    const cx = cam.sx;
    const cz = cam.sz;
    // dust picks up the sun colour so storms glow orange and nights go blue
    const lr = 0.30 + skyState.sunColor.r * (0.30 + day * 0.55) + skyState.zenith.r * 0.5;
    const lg = 0.28 + skyState.sunColor.g * (0.26 + day * 0.50) + skyState.zenith.g * 0.5;
    const lb = 0.30 + skyState.sunColor.b * (0.22 + day * 0.42) + skyState.zenith.b * 0.6;
    for (const m of motes) {
      if (i >= MAX_P) break;
      m.p += dt;
      m.x += dt * wind * (m.ground ? 1 : 0.6);
      m.z += dt * wind * 0.35;
      const span = m.ground ? 260 : 340;
      if (m.x > span / 2) m.x -= span;
      if (m.z > span / 2) m.z -= span;
      const wx = cx + m.x;
      const wz = cz + m.z;
      const y = m.ground
        ? engine.terrain.heightAt(wx, wz) + m.y + Math.sin(m.p * 1.1 + m.x) * 0.5
        : m.y + Math.sin(m.p * 0.5) * 2.2;
      pos[i * 3] = wx;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = wz;
      col[i * 3] = lr;
      col[i * 3 + 1] = lg;
      col[i * 3 + 2] = lb;
      siz[i] = m.s * (1 + storm * 2.2) * (m.ground ? 1.5 : 1);
      alp[i] = (m.ground ? 0.055 : 0.032) + storm * (m.ground ? 0.34 : 0.16);
      i++;
    }

    geo.setDrawRange(0, i);
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        vertexShader={pVert}
        fragmentShader={pFrag}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}


// ============================================================
//  ENVIRONMENT SCATTER
// ============================================================

interface Prop {
  x: number;
  z: number;
  s: number;
  r: number;
  tilt: number;
}

function makeScatter(count: number, mossy: boolean, seed: number) {
  const rng = mulberry32(seed);
  const t = engine.terrain;
  const out: Prop[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard++;
    const x = (rng() - 0.5) * (t.size - 30);
    const z = (rng() - 0.5) * (t.size - 30);
    if (Math.hypot(x, z) < 16) continue;
    const rough = t.roughness(x, z, 3);
    const m = t.mats[t.idx(t.clampI(Math.round((x + t.half) / t.cell)), t.clampI(Math.round((z + t.half) / t.cell)))];
    if (mossy) {
      if (m !== 2 || rough > 0.45) continue;
    } else if (rough < 0.12 && rng() > 0.25) continue;
    out.push({ x, z, s: 0.45 + rng() * (mossy ? 1.1 : 1.9), r: rng() * Math.PI * 2, tilt: (rng() - 0.5) * 0.35 });
  }
  return out;
}

function ScatterSet({
  props: items,
  color,
  emissive,
  geom,
  scale = 1,
  rough = 0.9,
  metal = 0.05,
  shadows = true,
}: {
  props: Prop[];
  color: string;
  emissive: string;
  geom: "rock" | "flora" | "spire";
  scale?: number;
  rough?: number;
  metal?: number;
  shadows?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const timer = useRef(0);
  const build = () => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      const y = engine.terrain.heightAt(p.x, p.z);
      _e.set(p.tilt, p.r, p.tilt * 0.6);
      _q.setFromEuler(_e);
      const ps = p.s * scale;
      _a.set(p.x, y + (geom === "rock" ? ps * 0.22 : ps * 0.85), p.z);
      _s.set(ps, ps * (geom === "flora" ? 1.9 : geom === "spire" ? 2.6 : 0.78), ps);
      _m.compose(_a, _q, _s);
      mesh.setMatrixAt(i, _m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  useFrame((_, dt) => {
    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = 2.2;
      build();
    }
  });
  return (
    <instancedMesh
      ref={(r) => {
        ref.current = r;
        if (r) build();
      }}
      args={[undefined as any, undefined as any, Math.max(1, items.length)]}
      castShadow={shadows}
      receiveShadow={shadows}
      frustumCulled={false}
    >
      {geom === "rock" ? (
        <dodecahedronGeometry args={[1, 0]} />
      ) : geom === "spire" ? (
        <octahedronGeometry args={[0.6, 0]} />
      ) : (
        <coneGeometry args={[0.45, 1.4, 6]} />
      )}
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={geom === "flora" ? 1.6 : geom === "spire" ? 0.9 : 0.02}
        roughness={rough}
        metalness={metal}
        envMapIntensity={geom === "spire" ? 2.2 : 0.6}
        flatShading
      />
    </instancedMesh>
  );
}

export function Scatter() {
  const boulders = useMemo(() => makeScatter(260, false, 5150), []);
  const pebbles = useMemo(() => makeScatter(520, false, 2277), []);
  const flora = useMemo(() => makeScatter(340, true, 8821), []);
  const flora2 = useMemo(() => makeScatter(150, true, 3312), []);
  const spires = useMemo(() => makeScatter(90, false, 6604), []);
  return (
    <group>
      <ScatterSet props={boulders} color="#7d605e" emissive="#000000" geom="rock" scale={1.45} rough={0.95} metal={0.04} />
      <ScatterSet props={pebbles} color="#93736c" emissive="#000000" geom="rock" scale={0.45} rough={1.0} metal={0.02} shadows={false} />
      <ScatterSet props={flora} color="#1f6f5e" emissive="#2fd6a8" geom="flora" scale={1} rough={0.35} metal={0.0} />
      <ScatterSet props={flora2} color="#6d2f5c" emissive="#ff6bd6" geom="flora" scale={0.9} rough={0.3} metal={0.0} />
      <ScatterSet props={spires} color="#4a5a7a" emissive="#5fa8ff" geom="spire" scale={2.6} rough={0.14} metal={0.35} />
    </group>
  );
}
