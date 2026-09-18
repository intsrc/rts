import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Renders the live sky dome into a small PMREM cube so every metal / glossy
 * surface in the colony picks up real sky + sun colour. Refreshed on a slow
 * cadence (and whenever the lighting changes fast, e.g. dawn) so it is
 * essentially free.
 */
export function EnvProbe({ material }: { material: THREE.ShaderMaterial }) {
  const { gl, scene } = useThree();
  const timer = useRef(0);
  const rt = useRef<THREE.WebGLRenderTarget | null>(null);

  const { pmrem, probeScene } = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const probeScene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(100, 32, 20);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    probeScene.add(mesh);
    return { pmrem, probeScene };
  }, [gl, material]);

  const refresh = () => {
    const next = pmrem.fromScene(probeScene, 0.0, 1, 400);
    const prev = rt.current;
    rt.current = next;
    scene.environment = next.texture;
    scene.environmentIntensity = 1.0;
    if (prev) prev.dispose();
  };

  useEffect(() => {
    refresh();
    return () => {
      rt.current?.dispose();
      pmrem.dispose();
      scene.environment = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, dt) => {
    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = 1.1;
      refresh();
    }
  });

  return null;
}
