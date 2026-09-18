import { useEffect, useRef } from "react";
import { engine } from "../game/engine";
import { RESOURCES } from "../game/defs";
import { strataColor } from "../game/terrain";
import { cam } from "../three/camera";
import { screenToGround, view } from "../three/view";

const SIZE = 196;

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);
  const lastBase = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const t = engine.terrain;
    const res = t.res;

    const buildBase = () => {
      if (!base.current) {
        base.current = document.createElement("canvas");
        base.current.width = res;
        base.current.height = res;
      }
      const bctx = base.current.getContext("2d")!;
      const img = bctx.createImageData(res, res);
      const col: [number, number, number] = [0, 0, 0];
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const k = j * res + i;
          const h = t.heights[k];
          strataColor(h, col);
          const hl = t.heights[Math.max(0, k - 1)];
          const hu = t.heights[Math.max(0, k - res)];
          const sh = 1 + Math.max(-0.45, Math.min(0.45, (h - (hl + hu) / 2) * 0.22));
          const m = t.mats[k];
          let r = col[0] * sh;
          let g = col[1] * sh;
          let b = col[2] * sh;
          if (m === 2) {
            g += 0.1;
            b += 0.05;
          }
          const o = k * 4;
          img.data[o] = Math.min(255, r * 255);
          img.data[o + 1] = Math.min(255, g * 255);
          img.data[o + 2] = Math.min(255, b * 255);
          img.data[o + 3] = 255;
        }
      }
      bctx.putImageData(img, 0, 0);
    };

    const w2m = (x: number, z: number): [number, number] => [
      ((x + t.half) / t.size) * SIZE,
      ((z + t.half) / t.size) * SIZE,
    ];

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      if (now - lastBase.current > 1400) {
        lastBase.current = now;
        buildBase();
      }
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (base.current) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(base.current, 0, 0, SIZE, SIZE);
      }
      // night tint
      const day = engine.daylight;
      ctx.fillStyle = `rgba(12,10,32,${0.45 * (1 - Math.min(1, day * 2.4))})`;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // nodes
      for (const n of engine.nodes) {
        if (!n.discovered) continue;
        const [x, y] = w2m(n.x, n.z);
        ctx.fillStyle = RESOURCES[n.type].color;
        ctx.fillRect(x - 1, y - 1, 2.4, 2.4);
      }
      // tether links
      ctx.strokeStyle = "rgba(111,242,216,0.5)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const [a, b] of engine.networkLinks()) {
        const p = w2m(a.x, a.z);
        const q = w2m(b.x, b.z);
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
      // buildings
      for (const b of engine.buildings) {
        const [x, y] = w2m(b.x, b.z);
        ctx.fillStyle = b.built ? "#e8f6ff" : "rgba(143,227,255,0.6)";
        const s = b.kind === "habitat" ? 5 : 3;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      // units
      for (const u of engine.units) {
        const [x, y] = w2m(u.x, u.z);
        ctx.fillStyle = u.selected ? "#9bffd8" : "#7dd3ff";
        ctx.fillRect(x - 1.3, y - 1.3, 2.6, 2.6);
      }
      // enemies
      for (const e of engine.enemies) {
        const [x, y] = w2m(e.x, e.z);
        ctx.fillStyle = "#ff5ce0";
        ctx.beginPath();
        ctx.arc(x, y, e.kind === "brute" ? 3 : 2, 0, 7);
        ctx.fill();
      }
      // camera footprint
      if (view.el) {
        const r = view.el.getBoundingClientRect();
        const pts: [number, number][] = [];
        const corners = [
          [r.left + 4, r.top + 4],
          [r.right - 4, r.top + 4],
          [r.right - 4, r.bottom - 4],
          [r.left + 4, r.bottom - 4],
        ];
        for (const [cx, cy] of corners) {
          const g = screenToGround(cx, cy);
          if (g) pts.push(w2m(g.x, g.z));
        }
        if (pts.length === 4) {
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.closePath();
          ctx.stroke();
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const jump = (ev: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const t = engine.terrain;
    const x = ((ev.clientX - r.left) / r.width) * t.size - t.half;
    const z = ((ev.clientY - r.top) / r.height) * t.size - t.half;
    cam.tx = x;
    cam.tz = z;
  };

  return (
    <div className="pointer-events-auto rounded-xl border border-cyan-300/25 bg-slate-950/75 p-1.5 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        className="block cursor-crosshair rounded-lg"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          jump(e);
        }}
        onPointerMove={(e) => dragging.current && jump(e)}
        onPointerUp={() => (dragging.current = false)}
      />
    </div>
  );
}
