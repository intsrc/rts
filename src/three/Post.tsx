import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { Component, ReactNode, useEffect, useState } from "react";
import * as THREE from "three";

/** If the composer ever fails to init we still want a playable scene. */
class PostBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[exo] post-processing disabled:", err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type Quality = "low" | "medium" | "high";

export function detectQuality(): Quality {
  const nav = navigator as any;
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  if (mem <= 4 || cores <= 4) return "low";
  if (mem <= 8 && cores <= 8) return "medium";
  return "high";
}

export function Post({ quality }: { quality: Quality }) {
  // Give the scene a frame to warm up before attaching the composer.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready || quality === "low") return null;

  const hi = quality === "high";

  return (
    <PostBoundary>
    <EffectComposer multisampling={0} frameBufferType={THREE.HalfFloatType} enableNormalPass={false}>
      <N8AO
        halfRes
        quality={hi ? "medium" : "performance"}
        aoRadius={7}
        distanceFalloff={1.1}
        intensity={hi ? 2.6 : 2.0}
        aoSamples={hi ? 16 : 8}
        denoiseSamples={hi ? 6 : 3}
        denoiseRadius={10}
        color="#150c22"
        screenSpaceRadius={false}
      />
      <Bloom
        mipmapBlur
        intensity={hi ? 1.05 : 0.8}
        luminanceThreshold={0.62}
        luminanceSmoothing={0.28}
        radius={0.72}
      />
      <HueSaturation saturation={0.12} hue={0} />
      <BrightnessContrast brightness={-0.015} contrast={0.11} />
      <ChromaticAberration
        offset={new THREE.Vector2(0.00042, 0.00052)}
        radialModulation
        modulationOffset={0.28}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette offset={0.22} darkness={0.55} eskil={false} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
    </PostBoundary>
  );
}
