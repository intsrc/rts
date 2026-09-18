import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { engine } from "../game/engine";
import { WORLD } from "../game/defs";
import { Sky, skyState, useSkyMaterial } from "./Sky";
import { EnvProbe } from "./EnvProbe";
import { GroundCursor, TerrainView } from "./TerrainView";
import { Bolts, Buildings, Enemies, Nodes, Particles, Scatter, TetherLines, Units } from "./Entities";
import { cam, input } from "./camera";
import { view } from "./view";
import { Post, Quality } from "./Post";

function CameraRig() {
  const { camera, gl } = useThree();

  useEffect(() => {
    view.camera = camera as THREE.PerspectiveCamera;
    view.el = gl.domElement;
  }, [camera, gl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const k = input.keys;
    let mx = 0;
    let mz = 0;
    if (k.has("w") || k.has("arrowup")) mz -= 1;
    if (k.has("s") || k.has("arrowdown")) mz += 1;
    if (k.has("a") || k.has("arrowleft")) mx -= 1;
    if (k.has("d") || k.has("arrowright")) mx += 1;
    mx += input.edgeX;
    mz += input.edgeY;
    if (k.has("q")) cam.yaw -= dt * 1.5;
    if (k.has("e")) cam.yaw += dt * 1.5;

    if (mx || mz) {
      const len = Math.hypot(mx, mz) || 1;
      const speed = (26 + cam.sdist * 0.55) * dt;
      const fx = Math.sin(cam.yaw);
      const fz = Math.cos(cam.yaw);
      cam.tx += ((mz / len) * -fx + (mx / len) * fz) * speed;
      cam.tz += ((mz / len) * -fz - (mx / len) * fx) * speed;
    }

    cam.yaw += input.rotDX * 0.006;
    cam.pitch = Math.max(0.2, Math.min(1.45, cam.pitch + input.rotDY * 0.005));
    input.rotDX = 0;
    input.rotDY = 0;

    if (input.zoom) {
      cam.dist = Math.max(16, Math.min(200, cam.dist * (1 + input.zoom * 0.0016)));
      input.zoom = 0;
    }

    const lim = WORLD.half - 20;
    cam.tx = Math.max(-lim, Math.min(lim, cam.tx));
    cam.tz = Math.max(-lim, Math.min(lim, cam.tz));

    const f = Math.min(1, dt * 9);
    cam.sx += (cam.tx - cam.sx) * f;
    cam.sz += (cam.tz - cam.sz) * f;
    cam.syaw += (cam.yaw - cam.syaw) * f;
    cam.spitch += (cam.pitch - cam.spitch) * f;
    cam.sdist += (cam.dist - cam.sdist) * f;

    const gy = engine.terrain.heightAt(cam.sx, cam.sz);
    const cx = cam.sx + Math.sin(cam.syaw) * Math.cos(cam.spitch) * cam.sdist;
    const cz = cam.sz + Math.cos(cam.syaw) * Math.cos(cam.spitch) * cam.sdist;
    let cy = gy + Math.sin(cam.spitch) * cam.sdist;
    cy = Math.max(cy, engine.terrain.heightAt(cx, cz) + 4);
    camera.position.set(cx, cy, cz);
    camera.lookAt(cam.sx, gy + 2, cam.sz);
    // Slight dolly-driven FOV breathe keeps wide shots from feeling flat.
    const pc = camera as THREE.PerspectiveCamera;
    const targetFov = 46 + Math.min(10, cam.sdist * 0.045);
    if (Math.abs(pc.fov - targetFov) > 0.01) {
      pc.fov += (targetFov - pc.fov) * Math.min(1, dt * 3);
      pc.updateProjectionMatrix();
    }
  });
  return null;
}

function Lighting({ quality }: { quality: Quality }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.FogExp2(0xc8a898, 0.0038), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(() => {
    const s = skyState;
    const day = s.day;
    const storm = s.storm;

    if (sun.current) {
      const L = 150;
      sun.current.position.set(cam.sx + s.sunDir.x * L, Math.max(14, s.sunDir.y * L), cam.sz + s.sunDir.z * L);
      sun.current.target.position.set(cam.sx, engine.terrain.heightAt(cam.sx, cam.sz), cam.sz);
      sun.current.target.updateMatrixWorld();
      sun.current.color.copy(s.sunColor);
      sun.current.intensity = (0.15 + day * 3.1) * (1 - storm * 0.7);
      // keep the shadow frustum tight around whatever we're looking at
      const c = sun.current.shadow.camera as THREE.OrthographicCamera;
      const span = THREE.MathUtils.clamp(cam.sdist * 1.15, 42, 135);
      if (Math.abs(c.right - span) > 1) {
        c.left = -span;
        c.right = span;
        c.top = span;
        c.bottom = -span;
        c.updateProjectionMatrix();
      }
    }
    if (fill.current) {
      // cool bounce from the opposite side, colour-matched to the sky dome
      fill.current.position.set(cam.sx - s.sunDir.x * 90, 60, cam.sz - s.sunDir.z * 90);
      fill.current.target.position.set(cam.sx, 0, cam.sz);
      fill.current.target.updateMatrixWorld();
      fill.current.color.copy(s.zenith).lerp(tmp.set("#ffffff"), 0.35);
      fill.current.intensity = 0.34 + day * 0.42;
    }
    if (hemi.current) {
      hemi.current.color.copy(s.zenith).lerp(tmp.set("#ffffff"), day * 0.35);
      hemi.current.groundColor.set(day > 0.1 ? "#6d4038" : "#241a30");
      hemi.current.intensity = 0.42 + day * 0.75;
    }

    tmp.copy(s.horizon);
    if (storm > 0) tmp.lerp(new THREE.Color("#a96b45"), storm * 0.8);
    fog.color.copy(tmp);
    fog.density = 0.0026 + (1 - day) * 0.0013 + storm * 0.011;
  });

  const shadowSize = quality === "high" ? 3072 : quality === "medium" ? 2048 : 1024;

  return (
    <>
      <directionalLight
        ref={sun}
        castShadow
        intensity={2.6}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-near={1}
        shadow-camera-far={420}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-bias={-0.0004}
        shadow-normalBias={0.22}
        shadow-radius={3}
      />
      <directionalLight ref={fill} intensity={0.4} />
      <hemisphereLight ref={hemi} intensity={0.8} />
    </>
  );
}

function GameLoop() {
  useFrame((_, dt) => {
    engine.update(dt);
    if (input.digging && engine.tool !== "select" && !engine.placing) {
      engine.terraform(engine.hover.x, engine.hover.z, Math.min(0.05, dt));
    }
  });
  return null;
}

export function World({ quality }: { quality: Quality }) {
  const skyMat = useSkyMaterial();
  return (
    <>
      <CameraRig />
      <GameLoop />
      <Lighting quality={quality} />
      <Sky material={skyMat} />
      <EnvProbe material={skyMat} />
      <TerrainView />
      <Scatter />
      <GroundCursor />
      <TetherLines />
      <Nodes />
      <Buildings />
      <Units />
      <Enemies />
      <Bolts />
      <Particles />
      <Post quality={quality} />
    </>
  );
}
