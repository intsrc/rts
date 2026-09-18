import { BUILDINGS, BUILD_MENU, BuildingKey, RESOURCES, ResourceKey, UNITS, UnitKey } from "../game/defs";
import { engine, ToolMode } from "../game/engine";
import { focusOn } from "../three/camera";
import { useEngine } from "./useEngine";

function CostChips({ cost }: { cost: Partial<Record<ResourceKey, number>> }) {
  const keys = Object.keys(cost) as ResourceKey[];
  if (!keys.length) return <span className="text-[10px] text-slate-500">free</span>;
  return (
    <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
      {keys.map((k) => {
        const need = cost[k] ?? 0;
        const have = engine.res[k] >= need;
        return (
          <span key={k} className={"text-[10px] font-semibold tabular-nums " + (have ? "text-slate-300" : "text-rose-400")}>
            <span style={{ color: have ? RESOURCES[k].color : undefined }}>{RESOURCES[k].glyph}</span>
            {need}
          </span>
        );
      })}
    </span>
  );
}

const TOOLS: { k: ToolMode; label: string; glyph: string; key: string; tip: string }[] = [
  { k: "select", label: "Command", glyph: "➤", key: "1", tip: "Select & order drones" },
  { k: "raise", label: "Raise", glyph: "▲", key: "2", tip: "Terraform: pull terrain upward" },
  { k: "lower", label: "Excavate", glyph: "▼", key: "3", tip: "Terraform: dig away terrain, yields material" },
  { k: "flatten", label: "Flatten", glyph: "▬", key: "4", tip: "Terraform: level ground for buildings" },
];

export function CommandBar({ showBuild, setShowBuild }: { showBuild: boolean; setShowBuild: (v: boolean) => void }) {
  const e = useEngine();
  const selUnits = e.units.filter((u) => u.selected);
  const selB = e.buildings.find((b) => b.selected);

  return (
    <div className="pointer-events-none flex items-end gap-3">
      {/* ---------- selection panel ---------- */}
      <div className="pointer-events-auto w-[272px] rounded-xl border border-cyan-300/20 bg-slate-950/80 p-3 backdrop-blur-md">
        {selB ? (
          <BuildingPanel id={selB.id} />
        ) : selUnits.length ? (
          <UnitPanel />
        ) : (
          <div className="text-[11px] leading-relaxed text-slate-400">
            <div className="mb-1 font-bold tracking-widest text-cyan-300">NO SELECTION</div>
            Left-drag to box-select drones. Right-click a crystal node to mine, a hostile to attack, or the ground to
            move.
          </div>
        )}
      </div>

      {/* ---------- tools + build ---------- */}
      <div className="pointer-events-auto flex flex-col gap-2">
        {showBuild && (
          <div className="grid w-[560px] grid-cols-5 gap-1.5 rounded-xl border border-cyan-300/20 bg-slate-950/85 p-2 backdrop-blur-md">
            {BUILD_MENU.map((k) => (
              <BuildButton key={k} k={k} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-slate-950/80 p-2 backdrop-blur-md">
          {TOOLS.map((t) => {
            const on = e.tool === t.k && !e.placing;
            return (
              <button
                key={t.k}
                title={t.tip}
                onClick={() => {
                  engine.tool = t.k;
                  engine.placing = null;
                  engine.touch();
                }}
                className={
                  "group relative flex h-14 w-16 flex-col items-center justify-center rounded-lg border text-[10px] font-bold uppercase tracking-wider transition " +
                  (on
                    ? "border-cyan-300 bg-cyan-400/20 text-cyan-100 shadow-[0_0_14px_rgba(103,232,249,0.35)]"
                    : "border-slate-600/50 bg-slate-800/50 text-slate-300 hover:border-cyan-300/60 hover:bg-slate-700/60")
                }
              >
                <span className="text-lg leading-none">{t.glyph}</span>
                <span className="mt-1">{t.label}</span>
                <span className="absolute right-1 top-0.5 text-[9px] text-slate-500">{t.key}</span>
              </button>
            );
          })}

          <div className="mx-1 h-12 w-px bg-slate-600/50" />

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Brush {e.brush.toFixed(0)}m</span>
            <input
              type="range"
              min={3}
              max={16}
              step={1}
              value={e.brush}
              onChange={(ev) => {
                engine.brush = +ev.target.value;
                engine.touch();
              }}
              className="h-1 w-24 cursor-pointer appearance-none rounded bg-slate-600 accent-cyan-400"
            />
          </div>

          <div className="mx-1 h-12 w-px bg-slate-600/50" />

          <button
            onClick={() => setShowBuild(!showBuild)}
            className={
              "flex h-14 w-20 flex-col items-center justify-center rounded-lg border text-[10px] font-bold uppercase tracking-wider transition " +
              (showBuild
                ? "border-amber-300 bg-amber-400/20 text-amber-100 shadow-[0_0_14px_rgba(252,211,77,0.3)]"
                : "border-slate-600/50 bg-slate-800/50 text-slate-200 hover:border-amber-300/60")
            }
          >
            <span className="text-lg leading-none">⬚</span>
            <span className="mt-1">Build</span>
            <span className="text-[9px] text-slate-500">B</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function BuildButton({ k }: { k: BuildingKey }) {
  const e = useEngine();
  const d = BUILDINGS[k];
  const locked = d.tech && !e.techs.has(d.tech);
  const afford = e.canAfford(d.cost);
  const active = e.placing === k;
  return (
    <button
      disabled={!!locked}
      onClick={() => {
        engine.placing = active ? null : k;
        engine.tool = "select";
        engine.touch();
      }}
      title={d.desc}
      className={
        "flex flex-col items-start rounded-lg border p-1.5 text-left transition " +
        (locked
          ? "cursor-not-allowed border-slate-700/50 bg-slate-900/60 opacity-45"
          : active
            ? "border-emerald-300 bg-emerald-400/20 shadow-[0_0_14px_rgba(110,231,183,0.35)]"
            : afford
              ? "border-slate-600/50 bg-slate-800/60 hover:border-cyan-300/70 hover:bg-slate-700/60"
              : "border-slate-700/60 bg-slate-900/60")
      }
    >
      <div className="flex w-full items-center gap-1">
        <span className="text-base leading-none" style={{ color: d.accent }}>
          {d.glyph}
        </span>
        <span className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-100">{d.name}</span>
      </div>
      <div className="mt-1">{locked ? <span className="text-[10px] text-amber-400/80">🔒 research</span> : <CostChips cost={d.cost} />}</div>
      <div className="mt-0.5 text-[9px] tabular-nums text-slate-400">
        {d.power > 0 ? `+${d.power}kW` : d.power < 0 ? `${d.power}kW` : "—"}
      </div>
    </button>
  );
}

function UnitPanel() {
  const e = useEngine();
  const sel = e.units.filter((u) => u.selected);
  const groups = new Map<UnitKey, number>();
  for (const u of sel) groups.set(u.kind, (groups.get(u.kind) ?? 0) + 1);
  const avgHp = sel.reduce((a, u) => a + u.hp / u.maxHp, 0) / Math.max(1, sel.length);
  const cargo = sel.reduce((a, u) => a + u.cargo, 0);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-widest text-cyan-300">SQUAD · {sel.length}</span>
        <span className="text-[10px] tabular-nums text-slate-400">cargo {cargo.toFixed(0)}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {[...groups].map(([k, n]) => (
          <span
            key={k}
            className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold"
            style={{ borderColor: UNITS[k].accent + "66", color: UNITS[k].accent }}
          >
            {UNITS[k].glyph} {UNITS[k].name} ×{n}
          </span>
        ))}
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded bg-slate-700">
        <div className="h-full rounded bg-emerald-400" style={{ width: `${avgHp * 100}%` }} />
      </div>
      <div className="mb-2 text-[10px] text-slate-400">
        {sel[0] && <>state: <span className="text-slate-200">{sel[0].state}</span></>}
      </div>
      <div className="flex gap-1.5">
        <button
          className="flex-1 rounded border border-slate-600 bg-slate-800/70 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:border-cyan-300"
          onClick={() => {
            sel.forEach((u) => (u.task = { t: "idle" }));
            engine.touch();
          }}
        >
          Stop
        </button>
        <button
          className="flex-1 rounded border border-slate-600 bg-slate-800/70 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:border-cyan-300"
          onClick={() => {
            const h = engine.buildings.find((b) => b.kind === "habitat");
            if (h) sel.forEach((u, i) => (u.task = { t: "move", x: h.x + Math.cos(i) * 8, z: h.z + Math.sin(i) * 8 }));
            engine.touch();
          }}
        >
          Recall
        </button>
        <button
          className="rounded border border-slate-600 bg-slate-800/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:border-cyan-300"
          onClick={() => sel[0] && focusOn(sel[0].x, sel[0].z)}
        >
          ⌖
        </button>
      </div>
    </div>
  );
}

function BuildingPanel({ id }: { id: number }) {
  const e = useEngine();
  const b = e.buildings.find((x) => x.id === id);
  if (!b) return null;
  const d = BUILDINGS[b.kind];
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg leading-none" style={{ color: d.accent }}>
          {d.glyph}
        </span>
        <span className="text-[11px] font-bold tracking-widest text-cyan-300">{d.name.toUpperCase()}</span>
      </div>
      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded bg-slate-700">
        <div
          className={"h-full rounded " + (b.built ? "bg-emerald-400" : "bg-sky-400")}
          style={{ width: `${(b.built ? b.hp / b.maxHp : b.progress) * 100}%` }}
        />
      </div>
      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        <span className={b.connected ? "text-emerald-300" : "text-rose-400"}>
          {b.connected ? "◉ tethered" : "◌ off-grid"}
        </span>
        <span className="text-slate-500">|</span>
        <span className={b.powered ? "text-amber-300" : "text-slate-500"}>
          {d.power > 0 ? `+${d.power} kW` : d.power < 0 ? `${d.power} kW` : "no draw"}
        </span>
        {!b.built && <span className="text-sky-300">· assembling {(b.progress * 100) | 0}%</span>}
      </div>
      <p className="mb-2 text-[10px] leading-relaxed text-slate-400">{d.desc}</p>

      {b.kind === "printer" && b.built && (
        <div className="mb-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">Fabricate</div>
          <div className="flex gap-1">
            {(Object.keys(UNITS) as UnitKey[]).map((k) => {
              const u = UNITS[k];
              const locked = u.tech && !e.techs.has(u.tech);
              return (
                <button
                  key={k}
                  disabled={!!locked}
                  onClick={() => engine.queueUnit(b, k)}
                  title={u.desc}
                  className={
                    "flex-1 rounded border p-1 text-left transition " +
                    (locked
                      ? "cursor-not-allowed border-slate-700 bg-slate-900/60 opacity-40"
                      : "border-slate-600 bg-slate-800/70 hover:border-cyan-300")
                  }
                >
                  <div className="text-[10px] font-bold" style={{ color: u.accent }}>
                    {u.glyph} {u.name}
                  </div>
                  <CostChips cost={u.cost} />
                </button>
              );
            })}
          </div>
          {b.queue.length > 0 && (
            <div className="mt-1.5">
              <div className="h-1 w-full overflow-hidden rounded bg-slate-700">
                <div
                  className="h-full bg-violet-400"
                  style={{ width: `${(b.queueT / UNITS[b.queue[0]].buildTime) * 100}%` }}
                />
              </div>
              <div className="mt-0.5 text-[9px] text-slate-400">queue: {b.queue.map((q) => UNITS[q].glyph).join(" ")}</div>
            </div>
          )}
        </div>
      )}

      {b.kind === "habitat" && (
        <div className="mb-2 text-[10px] text-slate-400">
          storage <span className="text-slate-100">{Math.floor(e.totalStored)}</span> / {e.storageCap}
        </div>
      )}

      {b.kind === "beacon" && (
        <div className="mb-2">
          <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-lime-300">Terraform charge</div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-700">
            <div className="h-full bg-lime-400" style={{ width: `${(e.beaconT / e.beaconGoal) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          className="flex-1 rounded border border-slate-600 bg-slate-800/70 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:border-cyan-300"
          onClick={() => focusOn(b.x, b.z)}
        >
          Center
        </button>
        {b.kind !== "habitat" && (
          <button
            className="flex-1 rounded border border-rose-500/50 bg-rose-900/30 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-200 hover:border-rose-400"
            onClick={() => {
              for (const k of Object.keys(d.cost) as ResourceKey[]) engine.give(k, (d.cost[k] ?? 0) * 0.5);
              engine.buildings = engine.buildings.filter((x) => x !== b);
              engine.rosterVersion++;
              engine.recomputeNetwork();
              engine.say(`${d.name} salvaged.`, "info");
              engine.touch();
            }}
          >
            Salvage
          </button>
        )}
      </div>
    </div>
  );
}
