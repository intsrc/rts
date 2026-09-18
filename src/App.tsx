import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BUILDINGS, RESOURCES, UNITS } from "./game/defs";
import { audio } from "./game/audio";
import { engine, Pick } from "./game/engine";
import { World } from "./three/World";
import { detectQuality } from "./three/Post";
import { initQuality, useQuality } from "./three/quality";
import { cam, input } from "./three/camera";
import { project, screenToGround } from "./three/view";
import { HUD } from "./ui/HUD";

export default function App() {
  const wrap = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  useMemo(() => initQuality(detectQuality()), []);
  const quality = useQuality();
  const world = useMemo(() => <World quality={quality} />, [quality]);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drag = useRef<{ mode: "none" | "box" | "rotate" | "dig"; sx: number; sy: number }>({
    mode: "none",
    sx: 0,
    sy: 0,
  });

  // ---- keyboard (camera + global) ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      input.keys.add(k);
      if (k === " ") e.preventDefault();
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.key.toLowerCase());
    const blur = () => input.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const updateHover = (cx: number, cy: number) => {
    const g = screenToGround(cx, cy);
    if (!g) return null;
    engine.hover.x = g.x;
    engine.hover.y = g.y;
    engine.hover.z = g.z;
    if (engine.placing) {
      const v = engine.validatePlacement(engine.placing, g.x, g.z);
      engine.hover.valid = v.ok;
      engine.hover.reason = v.reason;
    }
    // imperative tooltip (no React re-render)
    const tip = tipRef.current;
    if (tip) {
      let title = "";
      let sub = "";
      let color = "#e2e8f0";
      if (!engine.placing && engine.tool === "select") {
        const hit = pickFor(cx, cy, g.x, g.z);
        if (hit) {
          if (hit.kind === "node") {
            const n = engine.nodes.find((q) => q.id === hit.id)!;
            title = RESOURCES[n.type].name;
            sub = `${Math.ceil(n.amount)} / ${n.max} remaining`;
            color = RESOURCES[n.type].color;
          } else if (hit.kind === "building") {
            const b = engine.buildings.find((q) => q.id === hit.id)!;
            title = BUILDINGS[b.kind].name;
            sub = b.built
              ? `${Math.ceil(b.hp)} / ${b.maxHp} hp · ${b.connected ? "tethered" : "OFF-GRID"}`
              : `assembling ${(b.progress * 100) | 0}%`;
            color = BUILDINGS[b.kind].accent;
          } else if (hit.kind === "unit") {
            const u = engine.units.find((q) => q.id === hit.id)!;
            title = UNITS[u.kind].name;
            sub = `${u.state}${u.cargo > 0.2 ? ` · cargo ${u.cargo.toFixed(0)}` : ""}`;
            color = UNITS[u.kind].accent;
          } else {
            const en = engine.enemies.find((q) => q.id === hit.id)!;
            title = en.kind === "brute" ? "Xeno Brute" : "Xeno Crawler";
            sub = `${Math.ceil(en.hp)} hp`;
            color = "#ff5ce0";
          }
        }
      }
      if (title) {
        tip.style.display = "block";
        tip.style.left = cx + 16 + "px";
        tip.style.top = cy + 16 + "px";
        tip.style.borderColor = color + "66";
        tip.innerHTML = `<div style="color:${color}" class="text-[11px] font-bold uppercase tracking-wider">${title}</div><div class="text-[10px] text-slate-400">${sub}</div>`;
      } else {
        tip.style.display = "none";
      }
    }
    return g;
  };

  const screenPick = (cx: number, cy: number): Pick | null => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return null;
    const px = cx - r.left;
    const py = cy - r.top;
    let best: Pick | null = null;
    let bd = 34;
    const test = (kind: Pick["kind"], id: number, x: number, y: number, z: number, rad: number) => {
      const p = project(x, y, z);
      if (!p) return;
      const d = Math.hypot(p[0] - px, p[1] - py);
      if (d < rad && d < bd) {
        bd = d;
        best = { kind, id, d };
      }
    };
    for (const u of engine.units) test("unit", u.id, u.x, u.y, u.z, 30);
    for (const en of engine.enemies) test("enemy", en.id, en.x, en.y + 1, en.z, 30);
    for (const n of engine.nodes) if (n.discovered) test("node", n.id, n.x, n.y + 1.2, n.z, 26);
    for (const b of engine.buildings) test("building", b.id, b.x, b.y + 2, b.z, 34);
    return best;
  };

  const pickFor = (cx: number, cy: number, gx: number, gz: number): Pick | null =>
    screenPick(cx, cy) ?? engine.pickAt(gx, gz, 4.5);

  const onPointerDown = (e: React.PointerEvent) => {
    audio.init();
    if ((e.target as HTMLElement).tagName !== "CANVAS") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const g = updateHover(e.clientX, e.clientY);
    if (e.button === 1) {
      e.preventDefault();
      drag.current = { mode: "rotate", sx: e.clientX, sy: e.clientY };
      return;
    }
    if (e.button === 2) {
      if (engine.placing) {
        engine.placing = null;
        engine.touch();
      } else if (engine.tool !== "select") {
        engine.tool = "select";
        engine.touch();
      } else if (g) {
        engine.rightClick(g.x, g.z, pickFor(e.clientX, e.clientY, g.x, g.z));
      }
      return;
    }
    if (e.button !== 0) return;
    if (engine.placing && g) {
      const ok = engine.tryPlace(g.x, g.z);
      if (ok && !e.shiftKey) engine.placing = null;
      engine.touch();
      return;
    }
    if (engine.tool !== "select") {
      input.digging = true;
      drag.current = { mode: "dig", sx: e.clientX, sy: e.clientY };
      return;
    }
    drag.current = { mode: "box", sx: e.clientX, sy: e.clientY };
    setBox({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.mode === "rotate") {
      input.rotDX += e.movementX;
      input.rotDY += e.movementY;
      return;
    }
    updateHover(e.clientX, e.clientY);
    if (d.mode === "box") {
      setBox({ x0: d.sx, y0: d.sy, x1: e.clientX, y1: e.clientY });
    }
    // edge scrolling
    const r = wrap.current?.getBoundingClientRect();
    if (r && d.mode === "none") {
      const m = 26;
      input.edgeX = e.clientX - r.left < m ? -1 : r.right - e.clientX < m ? 1 : 0;
      input.edgeY = e.clientY - r.top < m ? -1 : r.bottom - e.clientY < m ? 1 : 0;
    } else {
      input.edgeX = 0;
      input.edgeY = 0;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d.mode === "box") {
      const w = Math.abs(e.clientX - d.sx);
      const h = Math.abs(e.clientY - d.sy);
      const r = wrap.current!.getBoundingClientRect();
      if (w < 6 && h < 6) {
        const g = screenToGround(e.clientX, e.clientY);
        if (g) engine.leftClick(g.x, g.z, e.shiftKey, pickFor(e.clientX, e.clientY, g.x, g.z));
      } else {
        engine.boxSelect(
          project,
          {
            x0: Math.min(d.sx, e.clientX) - r.left,
            y0: Math.min(d.sy, e.clientY) - r.top,
            x1: Math.max(d.sx, e.clientX) - r.left,
            y1: Math.max(d.sy, e.clientY) - r.top,
          },
          e.shiftKey
        );
      }
      setBox(null);
    }
    input.digging = false;
    drag.current = { mode: "none", sx: 0, sy: 0 };
  };

  const onWheel = (e: React.WheelEvent) => {
    input.zoom += e.deltaY;
  };

  return (
    <div
      ref={wrap}
      className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans text-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        input.edgeX = 0;
        input.edgeY = 0;
      }}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        key={quality}
        shadows
        dpr={quality === "high" ? [1, 1.9] : quality === "medium" ? [1, 1.5] : 1}
        gl={{
          antialias: quality === "low",
          powerPreference: "high-performance",
          stencil: false,
          alpha: false,
        }}
        camera={{ fov: 48, near: 0.5, far: 3000, position: [0, 60, 80] }}
        onCreated={({ gl, scene }) => {
          // Post stack owns tone mapping; renderer stays linear-HDR.
          gl.toneMapping = quality === "low" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.shadowMap.autoUpdate = true;
          scene.background = null;
          cam.tx = 0;
          cam.tz = 0;
        }}
      >
        {world}
      </Canvas>

      <div
        ref={tipRef}
        style={{ display: "none" }}
        className="pointer-events-none absolute z-20 rounded-md border bg-slate-950/85 px-2 py-1 backdrop-blur-sm"
      />

      {box && (
        <div
          className="pointer-events-none absolute border border-cyan-300 bg-cyan-300/10"
          style={{
            left: Math.min(box.x0, box.x1),
            top: Math.min(box.y0, box.y1),
            width: Math.abs(box.x1 - box.x0),
            height: Math.abs(box.y1 - box.y0),
          }}
        />
      )}

      <HUD />
    </div>
  );
}
