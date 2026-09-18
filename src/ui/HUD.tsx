import { useEffect, useState } from "react";
import { BUILDINGS, RAW_RESOURCES, RESOURCES, ResourceKey, TECHS, TECH_ORDER, WORLD } from "../game/defs";
import { audio } from "../game/audio";
import { getQuality, Quality, setQuality } from "../three/quality";
import { engine } from "../game/engine";
import { CommandBar } from "./CommandBar";
import { Minimap } from "./Minimap";
import { fmt, useEngine } from "./useEngine";

function Chip({ k }: { k: ResourceKey }) {
  const e = useEngine();
  const r = RESOURCES[k];
  return (
    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1">
      <span className="text-[13px] leading-none" style={{ color: r.color }}>
        {r.glyph}
      </span>
      <span className="text-[12px] font-bold tabular-nums text-slate-100">{fmt(e.res[k])}</span>
    </div>
  );
}

function TopBar({
  onResearch,
  onHelp,
  muted,
  onMute,
  onGfx,
}: {
  onResearch: () => void;
  onHelp: () => void;
  muted: boolean;
  onMute: () => void;
  onGfx: () => void;
}) {
  const e = useEngine();
  const day = Math.floor(e.time / WORLD.dayLength) + 1;
  const night = e.isNight;
  const storage = e.totalStored / e.storageCap;
  const cap = WORLD.energyCap + e.buildings.filter((b) => b.built && b.kind === "silo").length * 30;

  return (
    <div className="pointer-events-auto flex max-w-[98vw] flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-slate-950/80 px-3 py-2 backdrop-blur-md">
      <div className="pr-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/80">Exo-Colony</div>
        <div className="text-[13px] font-black tracking-wide text-slate-100">KEPLER-442&nbsp;b</div>
      </div>

      <div className="h-9 w-px bg-white/10" />

      <div className="flex flex-col items-center px-1">
        <div className="text-[9px] uppercase tracking-widest text-slate-400">Sol {day}</div>
        <div className="flex items-center gap-1 text-[12px] font-bold text-slate-100">
          <span>{night ? "🌙" : "☀"}</span>
          <span className="tabular-nums">{Math.floor(e.dayT * 24).toString().padStart(2, "0")}:00</span>
        </div>
      </div>

      <div className="h-9 w-px bg-white/10" />

      <div className="flex items-center gap-1">
        {RAW_RESOURCES.map((k) => (
          <Chip key={k} k={k} />
        ))}
        <div className="mx-1 h-6 w-px bg-white/10" />
        <Chip k="aluminum" />
        <Chip k="copper" />
      </div>

      <div className="flex w-24 flex-col gap-0.5 px-1">
        <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-400">
          <span>Cargo</span>
          <span className="tabular-nums">{Math.floor(e.totalStored)}/{e.storageCap}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-slate-700">
          <div
            className={"h-full rounded " + (storage > 0.92 ? "bg-rose-400" : "bg-sky-400")}
            style={{ width: `${Math.min(100, storage * 100)}%` }}
          />
        </div>
      </div>

      <div className="h-9 w-px bg-white/10" />

      <div className="flex w-32 flex-col gap-0.5 px-1">
        <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-400">
          <span>Power</span>
          <span className={"tabular-nums " + (e.powerSat < 0.99 ? "text-rose-400" : "text-amber-300")}>
            {e.gen.toFixed(0)}/{e.demand.toFixed(0)} kW
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-slate-700">
          <div className="h-full rounded bg-amber-300" style={{ width: `${(e.energy / cap) * 100}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-1">
        <span className="text-[13px] leading-none text-cyan-300">⌬</span>
        <span className="text-[12px] font-bold tabular-nums text-cyan-100">{Math.floor(e.bytes)}</span>
      </div>

      <div className="h-9 w-px bg-white/10" />

      <div className="flex flex-col items-center px-1">
        <div className="text-[9px] uppercase tracking-widest text-rose-300/80">Swarm {e.wave + 1}</div>
        <div className="text-[12px] font-bold tabular-nums text-rose-200">
          {Math.floor(e.waveTimer / 60)}:{(Math.floor(e.waveTimer) % 60).toString().padStart(2, "0")}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {[0, 1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => {
              if (s === 0) engine.paused = !engine.paused;
              else {
                engine.paused = false;
                engine.speed = s;
              }
              engine.touch();
            }}
            className={
              "h-7 w-7 rounded border text-[11px] font-bold transition " +
              ((s === 0 ? engine.paused : !engine.paused && engine.speed === s)
                ? "border-cyan-300 bg-cyan-400/25 text-cyan-100"
                : "border-slate-600/60 bg-slate-800/60 text-slate-300 hover:border-cyan-300/60")
            }
          >
            {s === 0 ? "❚❚" : `${s}×`}
          </button>
        ))}
        <button
          onClick={onResearch}
          className="ml-1 h-7 rounded border border-violet-400/50 bg-violet-500/15 px-2 text-[10px] font-bold uppercase tracking-wider text-violet-200 hover:bg-violet-500/30"
        >
          Research
        </button>
        <button
          onClick={onGfx}
          title="Graphics quality"
          className="h-7 w-7 rounded border border-slate-600/60 bg-slate-800/60 text-[11px] font-bold text-slate-300 hover:border-cyan-300/60"
        >
          ✦
        </button>
        <button
          onClick={onMute}
          className="h-7 w-7 rounded border border-slate-600/60 bg-slate-800/60 text-[11px] font-bold text-slate-300 hover:border-cyan-300/60"
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          onClick={onHelp}
          className="h-7 w-7 rounded border border-slate-600/60 bg-slate-800/60 text-[11px] font-bold text-slate-300 hover:border-cyan-300/60"
        >
          ?
        </button>
      </div>
    </div>
  );
}

function EventLog() {
  const e = useEngine();
  const tone: Record<string, string> = {
    info: "text-slate-300",
    good: "text-emerald-300",
    warn: "text-amber-300",
    bad: "text-rose-300",
  };
  return (
    <div className="pointer-events-none w-[300px] space-y-0.5">
      {e.log.slice(0, 7).map((l, i) => (
        <div
          key={l.id}
          className={"rounded bg-slate-950/60 px-2 py-0.5 text-[11px] backdrop-blur-sm " + tone[l.tone]}
          style={{ opacity: 1 - i * 0.12 }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

function Objectives() {
  const e = useEngine();
  const has = (k: string) => e.buildings.some((b) => b.built && b.kind === (k as any));
  const goals = [
    { t: "Extract 40 Compound", done: e.res.compound >= 40 || e.techs.has("smelting") },
    { t: "Deploy a power source", done: has("solar") || has("turbine") || has("generator") },
    { t: "Build a Research Bay", done: has("research") },
    { t: "Research Thermal Smelting", done: e.techs.has("smelting") },
    { t: "Refine ore in a Furnace", done: e.res.aluminum >= 6 || e.res.copper >= 6 },
    { t: "Unlock Pulse Weaponry", done: e.techs.has("defense") },
    { t: "Research Terraforming Array", done: e.techs.has("terraform") },
    { t: "Charge the Beacon", done: e.beaconT >= e.beaconGoal },
  ];
  const next = goals.findIndex((g) => !g.done);
  return (
    <div className="pointer-events-auto w-[224px] rounded-xl border border-cyan-300/20 bg-slate-950/75 p-2.5 backdrop-blur-md">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Mission</div>
      <div className="space-y-1">
        {goals.map((g, i) => (
          <div
            key={g.t}
            className={
              "flex items-start gap-1.5 text-[11px] leading-tight " +
              (g.done ? "text-emerald-300/70 line-through" : i === next ? "text-slate-100" : "text-slate-500")
            }
          >
            <span className="mt-[1px] text-[10px]">{g.done ? "✔" : i === next ? "▸" : "·"}</span>
            <span>{g.t}</span>
          </div>
        ))}
      </div>
      {e.beaconT > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-[9px] uppercase tracking-wider text-lime-300">
            <span>Terraforming</span>
            <span className="tabular-nums">{Math.floor((e.beaconT / e.beaconGoal) * 100)}%</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded bg-slate-700">
            <div className="h-full bg-lime-400" style={{ width: `${(e.beaconT / e.beaconGoal) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ResearchPanel({ onClose }: { onClose: () => void }) {
  const e = useEngine();
  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-30 w-[330px] rounded-xl border border-violet-300/30 bg-slate-950/90 p-3 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-lg">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">Tech Catalogue</div>
          <div className="text-[11px] text-slate-400">
            <span className="font-bold text-cyan-200">{Math.floor(e.bytes)}</span> bytes available
          </div>
        </div>
        <button onClick={onClose} className="h-6 w-6 rounded border border-slate-600 text-slate-300 hover:border-violet-300">
          ✕
        </button>
      </div>
      <div className="space-y-1.5">
        {TECH_ORDER.map((k) => {
          const t = TECHS[k];
          const owned = e.techs.has(k);
          const blocked = t.requires && !e.techs.has(t.requires);
          const afford = e.bytes >= t.cost;
          return (
            <button
              key={k}
              disabled={owned || !!blocked}
              onClick={() => engine.startResearch(k)}
              className={
                "w-full rounded-lg border p-2 text-left transition " +
                (owned
                  ? "border-emerald-400/40 bg-emerald-400/10"
                  : blocked
                    ? "cursor-not-allowed border-slate-700 bg-slate-900/70 opacity-50"
                    : afford
                      ? "border-violet-400/50 bg-violet-500/10 hover:bg-violet-500/25"
                      : "border-slate-700 bg-slate-900/70")
              }
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wide text-slate-100">
                  {t.glyph} {t.name}
                </span>
                <span className={"text-[10px] font-bold tabular-nums " + (owned ? "text-emerald-300" : afford ? "text-cyan-200" : "text-slate-400")}>
                  {owned ? "OWNED" : `${t.cost} B`}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{t.desc}</div>
              {blocked && <div className="mt-0.5 text-[9px] text-amber-400/80">requires {TECHS[t.requires!].name}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const GFX_LABELS: Record<Quality, { name: string; desc: string }> = {
  high: { name: "Ultra", desc: "4K shadows · full AO · bloom · SMAA · 1.9× res" },
  medium: { name: "Balanced", desc: "2K shadows · fast AO · bloom · SMAA · 1.5× res" },
  low: { name: "Performance", desc: "1K shadows · no post stack · 1× res" },
};

function GfxPanel({ onClose }: { onClose: () => void }) {
  const current = getQuality();
  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-30 w-[300px] rounded-xl border border-cyan-300/30 bg-slate-950/92 p-3 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-lg">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Render Pipeline</div>
          <div className="text-[11px] text-slate-400">Applies instantly</div>
        </div>
        <button onClick={onClose} className="h-6 w-6 rounded border border-slate-600 text-slate-300 hover:border-cyan-300">
          ✕
        </button>
      </div>
      <div className="space-y-1.5">
        {(["high", "medium", "low"] as Quality[]).map((q) => (
          <button
            key={q}
            onClick={() => setQuality(q)}
            className={
              "w-full rounded-lg border p-2 text-left transition " +
              (current === q
                ? "border-cyan-300 bg-cyan-400/15"
                : "border-slate-700 bg-slate-900/70 hover:border-cyan-300/60")
            }
          >
            <div className="text-[11px] font-bold tracking-wide text-slate-100">{GFX_LABELS[q].name}</div>
            <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{GFX_LABELS[q].desc}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        Ultra adds ground-truth ambient occlusion, HDR bloom, chromatic aberration and ACES tone mapping.
      </p>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-[720px] max-w-[92vw] rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-6 shadow-[0_0_60px_rgba(34,211,238,0.15)]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300">Colonial Directive 07</div>
        <h1 className="mb-3 text-3xl font-black tracking-tight text-slate-50">
          EXO-COLONY <span className="text-cyan-300">::</span> TERRAFORM COMMAND
        </h1>
        <p className="mb-4 text-[13px] leading-relaxed text-slate-300">
          You command an automated survey colony on a hostile exoplanet. Sculpt the terrain, chain tether nodes to
          stretch your power grid, extract and refine resources, research the tech catalogue, and keep the swarm out
          long enough to charge the <span className="text-lime-300">Terraforming Beacon</span>.
        </p>
        <div className="grid grid-cols-2 gap-4 text-[12px] text-slate-300">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300">Camera</div>
            <ul className="space-y-0.5 text-slate-400">
              <li><b className="text-slate-200">WASD / edge</b> — pan</li>
              <li><b className="text-slate-200">Q / E · middle-drag</b> — rotate</li>
              <li><b className="text-slate-200">Wheel</b> — zoom</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300">Command</div>
            <ul className="space-y-0.5 text-slate-400">
              <li><b className="text-slate-200">Left-drag</b> — box-select drones</li>
              <li><b className="text-slate-200">Right-click</b> — move / mine / build / attack</li>
              <li><b className="text-slate-200">B</b> build · <b className="text-slate-200">R</b> research · <b className="text-slate-200">1-4</b> tools · <b className="text-slate-200">Esc</b> cancel</li>
              <li><b className="text-slate-200">✦</b> in the top bar switches render quality</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-300">Terraforming</div>
            <ul className="space-y-0.5 text-slate-400">
              <li>Pick <b className="text-slate-200">Excavate</b> and drag on the ground to dig — you recover raw material.</li>
              <li><b className="text-slate-200">Flatten</b> makes ground buildable. Deforming costs stored energy.</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-rose-300">Survival</div>
            <ul className="space-y-0.5 text-slate-400">
              <li>Everything must be inside the tether network to work.</li>
              <li>Solar dies at night and in dust storms — diversify.</li>
              <li>Xenofauna swarms escalate. Turrets need power to fire.</li>
            </ul>
          </div>
        </div>
        <button
          onClick={() => {
            audio.init();
            engine.paused = false;
            onClose();
          }}
          className="mt-5 w-full rounded-lg border border-cyan-300/60 bg-cyan-400/20 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-400/35"
        >
          Begin Operation
        </button>
      </div>
    </div>
  );
}

function EndScreen() {
  const e = useEngine();
  if (e.status === "playing") return null;
  const won = e.status === "won";
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
      <div className="text-center">
        <div className={"text-[12px] font-bold uppercase tracking-[0.4em] " + (won ? "text-lime-300" : "text-rose-400")}>
          {won ? "Directive complete" : "Colony lost"}
        </div>
        <h1 className="mt-2 text-6xl font-black tracking-tighter text-slate-50">
          {won ? "TERRAFORMED" : "SIGNAL LOST"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[13px] text-slate-400">
          {won
            ? "Atmospheric processors have taken hold. The colony will outlive you."
            : "The Habitat Core has fallen. The swarm reclaims the basin."}
        </p>
        <div className="mt-4 text-[12px] text-slate-400">
          Survived <b className="text-slate-100">{Math.floor(e.time / WORLD.dayLength) + 1}</b> sols · repelled{" "}
          <b className="text-slate-100">{e.wave}</b> swarms
        </div>
        <button
          onClick={() => location.reload()}
          className="mt-6 rounded-lg border border-cyan-300/60 bg-cyan-400/20 px-8 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-cyan-100 hover:bg-cyan-400/35"
        >
          New Expedition
        </button>
      </div>
    </div>
  );
}

export function HUD() {
  const e = useEngine();
  const [showBuild, setShowBuild] = useState(true);
  const [showResearch, setShowResearch] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showGfx, setShowGfx] = useState(false);

  useEffect(() => {
    engine.paused = true;
    engine.touch();
  }, []);

  const placing = e.placing;
  const lowPower = e.powerSat < 0.99 && e.demand > 0;

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement)?.tagName === "INPUT") return;
      const k = ev.key.toLowerCase();
      if (k === "b") setShowBuild((v) => !v);
      else if (k === "r") setShowResearch((v) => !v);
      else if (k === "h" || k === "?") setShowHelp((v) => !v);
      else if (k === "escape") {
        if (engine.placing) engine.placing = null;
        else if (engine.tool !== "select") engine.tool = "select";
        else {
          setShowResearch(false);
          setShowHelp(false);
          engine.clearSelection();
        }
        engine.touch();
      } else if (k === " ") {
        engine.paused = !engine.paused;
        engine.touch();
      } else if (["1", "2", "3", "4"].includes(k)) {
        engine.tool = (["select", "raise", "lower", "flatten"] as const)[+k - 1];
        engine.placing = null;
        engine.touch();
      } else if (k === "delete" || k === "x") {
        const b = engine.buildings.find((x) => x.selected);
        if (b && b.kind !== "habitat") {
          engine.buildings = engine.buildings.filter((x) => x !== b);
          engine.rosterVersion++;
          engine.recomputeNetwork();
          engine.touch();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* storm / damage vignette */}
      {e.storm > 0 && (
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(180,90,40,0.35)_100%)]" />
      )}
      {lowPower && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(220,40,60,0.22)_100%)]" />
      )}

      <div className="absolute left-1/2 top-3 -translate-x-1/2">
        <TopBar
          onResearch={() => setShowResearch((v) => !v)}
          onHelp={() => setShowHelp(true)}
          onGfx={() => setShowGfx((v) => !v)}
          muted={muted}
          onMute={() => {
            audio.init();
            const m = !muted;
            setMuted(m);
            audio.setEnabled(!m);
          }}
        />
      </div>

      <div className="absolute left-4 top-[74px]">
        <EventLog />
      </div>

      <div className="absolute right-4 top-[74px]">{!showResearch && <Objectives />}</div>

      {showResearch && <ResearchPanel onClose={() => setShowResearch(false)} />}
      {showGfx && <GfxPanel onClose={() => setShowGfx(false)} />}

      <div className="absolute bottom-4 left-4">
        <CommandBar showBuild={showBuild} setShowBuild={setShowBuild} />
      </div>

      <div className="absolute bottom-4 right-4">
        <Minimap />
      </div>

      {(placing || e.tool !== "select") && (
        <div className="absolute left-1/2 top-[70px] -translate-x-1/2">
          <div
            className={
              "rounded-full border px-4 py-1 text-[11px] font-bold uppercase tracking-widest backdrop-blur-md " +
              (placing
                ? e.hover.valid
                  ? "border-emerald-300/60 bg-emerald-400/15 text-emerald-200"
                  : "border-rose-400/60 bg-rose-500/15 text-rose-200"
                : "border-amber-300/50 bg-amber-400/15 text-amber-200")
            }
          >
            {placing
              ? e.hover.valid
                ? `Place ${BUILDINGS[placing].name} — left-click · Esc to cancel`
                : e.hover.reason
              : "Terraform mode — drag on the surface · Esc to exit"}
          </div>
        </div>
      )}

      {e.storm > 0 && (
        <div className="absolute left-1/2 top-[104px] -translate-x-1/2 rounded-full border border-orange-400/50 bg-orange-500/15 px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-200 backdrop-blur-md">
          ⚠ Dust storm · {Math.ceil(e.storm)}s
        </div>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <EndScreen />
    </div>
  );
}
