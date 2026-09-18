import {
  BUILDINGS,
  BuildingKey,
  Cost,
  RAW_RESOURCES,
  ResourceKey,
  TECHS,
  TechKey,
  UNITS,
  UnitKey,
  WORLD,
} from "./defs";
import { Terrain, fbm, mulberry32 } from "./terrain";
import { audio } from "./audio";

export interface Unit {
  id: number;
  kind: UnitKey;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  hp: number;
  maxHp: number;
  cargo: number;
  cargoType: ResourceKey | null;
  task: Task;
  state: "idle" | "move" | "mine" | "haul" | "build" | "attack";
  cooldown: number;
  bob: number;
  selected: boolean;
  lastNode: number;
  beam: { x: number; y: number; z: number; on: boolean; color: string };
  flash: number;
}

export type Task =
  | { t: "idle" }
  | { t: "move"; x: number; z: number }
  | { t: "mine"; id: number }
  | { t: "haul"; id: number }
  | { t: "build"; id: number }
  | { t: "attack"; id: number };

export interface Building {
  id: number;
  kind: BuildingKey;
  x: number;
  y: number;
  z: number;
  rot: number;
  hp: number;
  maxHp: number;
  progress: number;
  built: boolean;
  connected: boolean;
  powered: boolean;
  selected: boolean;
  cooldown: number;
  work: number;
  queue: UnitKey[];
  queueT: number;
  spin: number;
  flash: number;
}

export interface ResNode {
  id: number;
  x: number;
  y: number;
  z: number;
  type: ResourceKey;
  amount: number;
  max: number;
  discovered: boolean;
  scale: number;
  seed: number;
  shards: { x: number; z: number; s: number; r: number; h: number }[];
}

export interface Enemy {
  id: number;
  kind: "crawler" | "brute";
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  heading: number;
  target: number;
  cooldown: number;
  phase: number;
  flash: number;
}

export interface Bolt {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  t: number;
  life: number;
  color: string;
  hostile: boolean;
}

export interface Fx {
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
  color: string;
  size: number;
  kind: "burst" | "dust" | "spark";
}

export interface LogEntry {
  id: number;
  text: string;
  tone: "info" | "good" | "warn" | "bad";
  t: number;
}

export type ToolMode = "select" | "raise" | "lower" | "flatten";

export interface Pick {
  kind: "unit" | "building" | "node" | "enemy";
  id: number;
  d: number;
}

let nextId = 1;
const id = () => nextId++;

export class Engine {
  terrain = new Terrain(20260420);
  rng = mulberry32(99173);
  units: Unit[] = [];
  buildings: Building[] = [];
  nodes: ResNode[] = [];
  enemies: Enemy[] = [];
  bolts: Bolt[] = [];
  fx: Fx[] = [];
  log: LogEntry[] = [];

  res: Record<ResourceKey, number> = {
    compound: 32,
    resin: 20,
    organic: 14,
    laterite: 0,
    malachite: 0,
    aluminum: 6,
    copper: 5,
  };
  bytes = 0;
  soil = 0;
  energy = 60;
  gen = 0;
  demand = 0;
  powerSat = 1;

  time = 0;
  wave = 0;
  waveTimer = 235;
  storm = 0;
  stormTimer = 95;
  beaconT = 0;
  beaconGoal = 90;
  status: "playing" | "won" | "lost" = "playing";

  techs = new Set<TechKey>();
  researching: TechKey | null = null;

  tool: ToolMode = "select";
  brush = 7;
  placing: BuildingKey | null = null;
  hover = { x: 0, y: 0, z: 0, valid: false, reason: "" };
  version = 0;
  rosterVersion = 0;
  listeners = new Set<() => void>();
  netTimer = 0;
  paused = false;
  speed = 1;

  constructor() {
    this.spawnWorld();
  }

  // ---------------------------------------------------------- store
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.version;
  private emit() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  touch() {
    this.emit();
  }

  say(text: string, tone: LogEntry["tone"] = "info") {
    this.log.unshift({ id: id(), text, tone, t: this.time });
    if (this.log.length > 60) this.log.pop();
  }

  // ---------------------------------------------------------- setup
  spawnWorld() {
    const t = this.terrain;
    // Habitat at origin
    this.addBuilding("habitat", 0, 0, true);

    // resource nodes
    const count = 132;
    let guard = 0;
    while (this.nodes.length < count && guard < 40000) {
      guard++;
      const a = this.rng() * Math.PI * 2;
      const r = 20 + Math.pow(this.rng(), 0.62) * (t.half - 34);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!t.inBounds(x, z)) continue;
      if (t.roughness(x, z, 5) > 0.5) continue;
      let tooClose = false;
      for (const n of this.nodes) {
        if (Math.hypot(n.x - x, n.z - z) < 11) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // biome-ish distribution: ore further out, organics in "moss" areas
      const b = fbm(x * 0.018 + 7, z * 0.018 - 3, 4242, 3);
      let type: ResourceKey;
      const roll = this.rng();
      if (r > t.half * 0.45 && roll > 0.52) type = b > 0.5 ? "laterite" : "malachite";
      else if (b > 0.58) type = roll > 0.45 ? "organic" : "resin";
      else type = roll > 0.42 ? "compound" : "resin";
      if (r < 42 && (type === "laterite" || type === "malachite") && this.rng() > 0.35)
        type = "compound";
      const max = 70 + Math.floor(this.rng() * 130);
      const shardCount = 4 + Math.floor(this.rng() * 5);
      const shards = [];
      for (let k = 0; k < shardCount; k++) {
        const sa = this.rng() * Math.PI * 2;
        const sr = this.rng() * 2.1;
        shards.push({
          x: Math.cos(sa) * sr,
          z: Math.sin(sa) * sr,
          s: 0.5 + this.rng() * 0.85,
          r: this.rng() * Math.PI,
          h: 0.7 + this.rng() * 1.5,
        });
      }
      this.nodes.push({
        id: id(),
        x,
        z,
        y: t.heightAt(x, z),
        type,
        amount: max,
        max,
        discovered: r < 55,
        scale: 0.9 + this.rng() * 0.5,
        seed: this.rng() * 1000,
        shards,
      });
    }
    this.rosterVersion++;

    // starting drones
    for (let i = 0; i < 3; i++) this.addUnit("prospector", Math.cos(i * 2.1) * 10, Math.sin(i * 2.1) * 10);
    this.addUnit("constructor", -8, 8);
    this.say("Landing sequence complete. Habitat Core online.", "good");
    this.say("Order prospectors onto resource nodes with right-click.", "info");
  }

  addUnit(kind: UnitKey, x: number, z: number) {
    const d = UNITS[kind];
    const u: Unit = {
      id: id(),
      kind,
      x,
      z,
      y: this.terrain.heightAt(x, z) + 2.4,
      vx: 0,
      vz: 0,
      heading: this.rng() * Math.PI * 2,
      hp: d.hp,
      maxHp: d.hp,
      cargo: 0,
      cargoType: null,
      task: { t: "idle" },
      state: "idle",
      cooldown: 0,
      bob: this.rng() * 10,
      selected: false,
      lastNode: 0,
      beam: { x: 0, y: 0, z: 0, on: false, color: "#fff" },
      flash: 0,
    };
    this.units.push(u);
    this.rosterVersion++;
    return u;
  }

  addBuilding(kind: BuildingKey, x: number, z: number, instant = false) {
    const d = BUILDINGS[kind];
    const b: Building = {
      id: id(),
      kind,
      x,
      z,
      y: this.terrain.heightAt(x, z),
      rot: 0,
      hp: instant ? d.hp : d.hp * 0.25,
      maxHp: d.hp,
      progress: instant ? 1 : 0,
      built: instant,
      connected: kind === "habitat",
      powered: false,
      selected: false,
      cooldown: 0,
      work: 0,
      queue: [],
      queueT: 0,
      spin: 0,
      flash: 0,
    };
    this.buildings.push(b);
    this.rosterVersion++;
    this.recomputeNetwork();
    return b;
  }

  // ---------------------------------------------------------- helpers
  get storageCap() {
    let c = WORLD.baseStorage;
    for (const b of this.buildings) if (b.built && b.kind === "silo") c += 120;
    if (this.techs.has("logistics")) c += 100;
    return c;
  }

  get totalStored() {
    let s = 0;
    for (const k of Object.keys(this.res) as ResourceKey[]) s += this.res[k];
    return s;
  }

  canAfford(cost: Cost) {
    for (const k of Object.keys(cost) as ResourceKey[]) {
      if ((this.res[k] ?? 0) < (cost[k] ?? 0)) return false;
    }
    return true;
  }

  pay(cost: Cost) {
    for (const k of Object.keys(cost) as ResourceKey[]) this.res[k] -= cost[k] ?? 0;
  }

  missing(cost: Cost) {
    const out: string[] = [];
    for (const k of Object.keys(cost) as ResourceKey[]) {
      const need = (cost[k] ?? 0) - (this.res[k] ?? 0);
      if (need > 0) out.push(`${Math.ceil(need)} ${k}`);
    }
    return out;
  }

  linkRange(b: Building) {
    const base = BUILDINGS[b.kind].link;
    return this.techs.has("logistics") && b.kind === "tether" ? base * 1.4 : base;
  }

  recomputeNetwork() {
    for (const b of this.buildings) b.connected = false;
    const root = this.buildings.find((b) => b.kind === "habitat" && b.hp > 0);
    if (!root) return;
    root.connected = true;
    const queue = [root];
    while (queue.length) {
      const cur = queue.pop()!;
      const cr = this.linkRange(cur);
      for (const b of this.buildings) {
        if (b.connected || b.hp <= 0) continue;
        const d = Math.hypot(b.x - cur.x, b.z - cur.z);
        if (d <= Math.max(cr, this.linkRange(b))) {
          b.connected = true;
          queue.push(b);
        }
      }
    }
  }

  networkLinks() {
    const links: [Building, Building][] = [];
    for (let i = 0; i < this.buildings.length; i++) {
      const a = this.buildings[i];
      if (!a.connected) continue;
      for (let j = i + 1; j < this.buildings.length; j++) {
        const b = this.buildings[j];
        if (!b.connected) continue;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d <= Math.max(this.linkRange(a), this.linkRange(b))) links.push([a, b]);
      }
    }
    return links;
  }

  nearestDepot(x: number, z: number) {
    let best: Building | null = null;
    let bd = Infinity;
    for (const b of this.buildings) {
      if (!b.built || b.hp <= 0) continue;
      if (b.kind !== "habitat" && b.kind !== "silo") continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  byId<T extends { id: number }>(arr: T[], i: number) {
    for (const a of arr) if (a.id === i) return a;
    return undefined;
  }

  get daylight() {
    const t = (this.time / WORLD.dayLength) % 1;
    // sun elevation curve
    const e = Math.sin(t * Math.PI * 2 - Math.PI / 2);
    return Math.max(0, e);
  }
  get dayT() {
    return (this.time / WORLD.dayLength) % 1;
  }
  get isNight() {
    return this.daylight <= 0.02;
  }

  // ---------------------------------------------------------- placement
  validatePlacement(kind: BuildingKey, x: number, z: number) {
    const d = BUILDINGS[kind];
    if (!this.terrain.inBounds(x, z)) return { ok: false, reason: "Outside survey zone" };
    if (this.terrain.roughness(x, z, d.foot) > d.maxSlope)
      return { ok: false, reason: "Ground too uneven — flatten it first" };
    for (const b of this.buildings) {
      if (Math.hypot(b.x - x, b.z - z) < d.foot + BUILDINGS[b.kind].foot + 0.8)
        return { ok: false, reason: "Blocked by " + BUILDINGS[b.kind].name };
    }
    for (const n of this.nodes) {
      if (Math.hypot(n.x - x, n.z - z) < d.foot + 2.4)
        return { ok: false, reason: "Resource node in the way" };
    }
    let linked = false;
    for (const b of this.buildings) {
      if (!b.connected) continue;
      if (Math.hypot(b.x - x, b.z - z) <= Math.max(this.linkRange(b), d.link))
        linked = true;
    }
    if (!linked) return { ok: false, reason: "Out of tether range — chain Tether Nodes" };
    if (!this.canAfford(d.cost))
      return { ok: false, reason: "Need " + this.missing(d.cost).join(", ") };
    return { ok: true, reason: "" };
  }

  tryPlace(x: number, z: number) {
    if (!this.placing) return false;
    const kind = this.placing;
    const v = this.validatePlacement(kind, x, z);
    if (!v.ok) {
      this.say(v.reason, "warn");
      audio.play("error");
      return false;
    }
    this.pay(BUILDINGS[kind].cost);
    const b = this.addBuilding(kind, x, z);
    this.say(`${BUILDINGS[kind].name} foundation deployed.`, "good");
    audio.play("place");
    // send selected constructors
    const cons = this.units.filter((u) => u.selected && u.kind === "constructor");
    const crew = cons.length ? cons : this.units.filter((u) => u.kind === "constructor" && u.state === "idle");
    for (const c of crew) c.task = { t: "build", id: b.id };
    this.emit();
    return true;
  }

  // ---------------------------------------------------------- commands
  clearSelection() {
    for (const u of this.units) u.selected = false;
    for (const b of this.buildings) b.selected = false;
  }

  selectedUnits() {
    return this.units.filter((u) => u.selected);
  }
  selectedBuilding() {
    return this.buildings.find((b) => b.selected);
  }

  boxSelect(
    project: (x: number, y: number, z: number) => [number, number] | null,
    rect: { x0: number; y0: number; x1: number; y1: number },
    additive: boolean
  ) {
    if (!additive) this.clearSelection();
    let found = false;
    for (const u of this.units) {
      const p = project(u.x, u.y, u.z);
      if (!p) continue;
      if (p[0] >= rect.x0 && p[0] <= rect.x1 && p[1] >= rect.y0 && p[1] <= rect.y1) {
        u.selected = true;
        found = true;
      }
    }
    if (found) for (const b of this.buildings) b.selected = false;
    this.emit();
    return found;
  }

  pickAt(x: number, z: number, radius = 4): Pick | null {
    let best: Pick | null = null;
    const test = (kind: any, i: number, ox: number, oz: number, r: number) => {
      const d = Math.hypot(ox - x, oz - z);
      if (d < r && (!best || d < best.d)) best = { kind, id: i, d };
    };
    for (const u of this.units) test("unit", u.id, u.x, u.z, radius);
    for (const e of this.enemies) test("enemy", e.id, e.x, e.z, radius);
    for (const n of this.nodes) if (n.discovered) test("node", n.id, n.x, n.z, 4.2);
    for (const b of this.buildings) test("building", b.id, b.x, b.z, BUILDINGS[b.kind].foot + 1.4);
    return best as Pick | null;
  }

  leftClick(x: number, z: number, additive: boolean, picked?: Pick | null) {
    const hit = picked !== undefined ? picked : this.pickAt(x, z);
    if (!additive) this.clearSelection();
    if (!hit) {
      this.emit();
      return;
    }
    if (hit.kind === "unit") {
      const u = this.byId(this.units, hit.id);
      if (u) u.selected = true;
      audio.play("select");
    } else if (hit.kind === "building") {
      const b = this.byId(this.buildings, hit.id);
      if (b) {
        this.clearSelection();
        b.selected = true;
      }
    }
    this.emit();
  }

  rightClick(x: number, z: number, picked?: Pick | null) {
    const sel = this.selectedUnits();
    if (!sel.length) return;
    const hit = picked !== undefined ? picked : this.pickAt(x, z, 4.5);
    if (hit && hit.kind === "node") {
      for (const u of sel) {
        if (u.kind === "sentinel") {
          u.task = { t: "move", x: x + (this.rng() - 0.5) * 8, z: z + (this.rng() - 0.5) * 8 };
          continue;
        }
        u.task = { t: "mine", id: hit.id };
        u.lastNode = hit.id;
      }
      this.pingFx(x, z, "#ffd06b");
    } else if (hit && hit.kind === "enemy") {
      for (const u of sel) u.task = { t: "attack", id: hit.id };
      this.pingFx(x, z, "#ff5f7a");
    } else if (hit && hit.kind === "building" && this.byId(this.buildings, hit.id)) {
      const b = this.byId(this.buildings, hit.id)!;
      for (const u of sel) {
        if (!b.built || b.hp < b.maxHp) u.task = { t: "build", id: b.id };
        else if (u.cargo > 0) u.task = { t: "haul", id: b.id };
        else u.task = { t: "move", x: b.x + (this.rng() - 0.5) * 6, z: b.z + (this.rng() - 0.5) * 6 };
      }
      this.pingFx(x, z, "#8fe3ff");
    } else {
      const n = sel.length;
      sel.forEach((u, i) => {
        const ring = Math.floor(i / 6);
        const a = (i % 6) * (Math.PI / 3) + ring * 0.5;
        const r = n > 1 ? 3 + ring * 3.2 : 0;
        u.task = { t: "move", x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
      });
      this.pingFx(x, z, "#9bffd8");
    }
  }

  pingFx(x: number, z: number, color: string) {
    audio.play("command");
    this.fx.push({
      x,
      y: this.terrain.heightAt(x, z) + 0.4,
      z,
      t: 0,
      life: 0.7,
      color,
      size: 3,
      kind: "burst",
    });
  }

  // ---------------------------------------------------------- terraform
  terraform(x: number, z: number, dt: number) {
    if (this.tool === "select" || this.status !== "playing") return;
    for (const b of this.buildings) {
      if (Math.hypot(b.x - x, b.z - z) < BUILDINGS[b.kind].foot + 2.5) return;
    }
    const cost = (1.6 + this.brush * 0.42) * dt;
    if (this.energy < cost) return;
    this.energy -= cost;
    const mode = this.tool === "raise" ? 1 : this.tool === "lower" ? -1 : 0;
    const strength = mode === 0 ? 3.2 : 3.6 * dt;
    const vol = this.terrain.deform(x, z, this.brush, mode, mode === 0 ? strength * dt : strength);
    if (mode < 0) {
      this.soil += vol * 0.55;
      while (this.soil >= 10) {
        this.soil -= 10;
        const k: ResourceKey = this.rng() > 0.55 ? "compound" : "resin";
        this.give(k, 1);
      }
    }
    if (this.rng() > 0.6) {
      this.fx.push({
        x: x + (this.rng() - 0.5) * this.brush,
        y: this.terrain.heightAt(x, z) + 1,
        z: z + (this.rng() - 0.5) * this.brush,
        t: 0,
        life: 0.55,
        color: mode < 0 ? "#c9a98a" : "#e8d5b8",
        size: 1.4,
        kind: "dust",
      });
    }
    // nodes ride the terrain
    for (const n of this.nodes) {
      if (Math.hypot(n.x - x, n.z - z) < this.brush + 3) n.y = this.terrain.heightAt(n.x, n.z);
    }
  }

  give(k: ResourceKey, n: number) {
    const space = this.storageCap - this.totalStored;
    this.res[k] += Math.max(0, Math.min(n, space));
  }

  // ---------------------------------------------------------- research
  startResearch(k: TechKey) {
    const t = TECHS[k];
    if (this.techs.has(k)) return;
    if (t.requires && !this.techs.has(t.requires)) {
      this.say(`Requires ${TECHS[t.requires].name}`, "warn");
      return;
    }
    if (this.bytes < t.cost) {
      this.say(`Need ${Math.ceil(t.cost - this.bytes)} more Bytes`, "warn");
      return;
    }
    this.bytes -= t.cost;
    this.techs.add(k);
    this.say(`${t.name} researched!`, "good");
    audio.play("research");
    if (k === "terraform") this.say("Terraforming Beacon unlocked — build it to win.", "good");
    this.emit();
  }

  queueUnit(b: Building, kind: UnitKey) {
    const d = UNITS[kind];
    if (d.tech && !this.techs.has(d.tech)) return;
    if (!this.canAfford(d.cost)) {
      this.say("Need " + this.missing(d.cost).join(", "), "warn");
      return;
    }
    this.pay(d.cost);
    b.queue.push(kind);
    this.emit();
  }

  // ---------------------------------------------------------- tick
  update(dtRaw: number) {
    if (this.paused || this.status !== "playing") {
      this.stepFx(dtRaw);
      return;
    }
    const dt = Math.min(0.05, dtRaw) * this.speed;
    this.time += dt;

    this.netTimer -= dt;
    if (this.netTimer <= 0) {
      this.netTimer = 0.4;
      this.recomputeNetwork();
    }

    this.updateWeather(dt);
    this.updatePower(dt);
    this.updateBuildings(dt);
    this.updateUnits(dt);
    this.updateEnemies(dt);
    this.updateBolts(dt);
    this.stepFx(dt);
    this.updateWaves(dt);

    if (Math.floor(this.time * 6) !== Math.floor((this.time - dt) * 6)) this.emit();
  }

  updateWeather(dt: number) {
    audio.setStorm(this.storm > 0 ? Math.min(1, this.storm / 8) : 0);
    this.stormTimer -= dt;
    if (this.storm > 0) {
      this.storm -= dt;
      if (this.storm <= 0) {
        this.say("Dust storm has passed.", "good");
        this.stormTimer = 110 + this.rng() * 90;
      }
    } else if (this.stormTimer <= 0) {
      this.storm = 26 + this.rng() * 16;
      this.say("Dust storm inbound! Solar output failing.", "warn");
    }
  }

  updatePower(dt: number) {
    let gen = 0;
    let demand = 0;
    const day = this.daylight;
    const stormy = this.storm > 0;
    for (const b of this.buildings) {
      if (!b.built || b.hp <= 0 || !b.connected) continue;
      const d = BUILDINGS[b.kind];
      if (d.power > 0) {
        if (b.kind === "solar") gen += d.power * day * (stormy ? 0.15 : 1);
        else if (b.kind === "turbine") gen += d.power * (stormy ? 2 : 0.55 + 0.45 * (1 - day));
        else if (b.kind === "generator") {
          if (this.res.organic > 0) {
            this.res.organic = Math.max(0, this.res.organic - 0.22 * dt);
            gen += d.power;
          }
        } else gen += d.power;
      } else demand -= d.power;
    }
    this.gen = gen;
    this.demand = demand;
    const net = gen - demand;
    const cap = WORLD.energyCap + this.buildings.filter((b) => b.built && b.kind === "silo").length * 30;
    if (net >= 0) {
      this.energy = Math.min(cap, this.energy + net * dt);
      this.powerSat = 1;
    } else {
      const need = -net * dt;
      if (this.energy >= need) {
        this.energy -= need;
        this.powerSat = 1;
      } else {
        const avail = gen + this.energy / Math.max(dt, 0.0001);
        this.powerSat = Math.max(0, Math.min(1, avail / Math.max(demand, 0.001)));
        this.energy = 0;
      }
    }
  }

  updateBuildings(dt: number) {
    const sat = this.powerSat;
    for (const b of this.buildings) {
      if (b.hp <= 0) continue;
      b.flash = Math.max(0, b.flash - dt * 3);
      const d = BUILDINGS[b.kind];
      b.powered = b.connected && (d.power > 0 || sat > 0.05);
      if (!b.built) {
        // passive auto-assembly when connected to grid
        if (b.connected) {
          b.progress = Math.min(1, b.progress + (dt / d.buildTime) * 0.28 * sat);
          b.hp = d.hp * (0.25 + 0.75 * b.progress);
          if (b.progress >= 1) this.finishBuilding(b);
        }
        continue;
      }
      b.spin += dt * (b.powered ? 1 : 0.05);

      switch (b.kind) {
        case "smelter": {
          if (!b.powered) break;
          const ore: ResourceKey | null =
            this.res.laterite >= 1 ? "laterite" : this.res.malachite >= 1 ? "malachite" : null;
          if (!ore) break;
          b.work += dt * sat * 0.55;
          if (b.work >= 1) {
            b.work = 0;
            this.res[ore] -= 1;
            this.give(ore === "laterite" ? "aluminum" : "copper", 1);
            this.fx.push({ x: b.x, y: b.y + 3, z: b.z, t: 0, life: 0.6, color: "#ff9a5c", size: 1.6, kind: "spark" });
          }
          break;
        }
        case "research": {
          if (!b.powered) break;
          this.bytes += dt * 1.05 * sat;
          break;
        }
        case "printer": {
          if (!b.powered || !b.queue.length) break;
          const kind = b.queue[0];
          b.queueT += dt * sat;
          if (b.queueT >= UNITS[kind].buildTime) {
            b.queueT = 0;
            b.queue.shift();
            const a = this.rng() * Math.PI * 2;
            const u = this.addUnit(kind, b.x + Math.cos(a) * 5, b.z + Math.sin(a) * 5);
            u.task = { t: "idle" };
            this.say(`${UNITS[kind].name} printed.`, "good");
            this.fx.push({ x: b.x, y: b.y + 2, z: b.z, t: 0, life: 0.8, color: UNITS[kind].accent, size: 3, kind: "burst" });
          }
          break;
        }
        case "turret": {
          b.cooldown -= dt;
          if (!b.powered || b.cooldown > 0) break;
          let best: Enemy | null = null;
          let bd = 34;
          for (const e of this.enemies) {
            const dd = Math.hypot(e.x - b.x, e.z - b.z);
            if (dd < bd) {
              bd = dd;
              best = e;
            }
          }
          if (best) {
            b.cooldown = 0.55;
            this.fire(b.x, b.y + 3.4, b.z, best, 22, "#ff5f8f", false);
          }
          break;
        }
        case "habitat": {
          b.cooldown -= dt;
          if (b.cooldown > 0) break;
          let close: Enemy | null = null;
          let cd = 27;
          for (const e of this.enemies) {
            const dd = Math.hypot(e.x - b.x, e.z - b.z);
            if (dd < cd) {
              cd = dd;
              close = e;
            }
          }
          if (close) {
            b.cooldown = 0.75;
            this.fire(b.x, b.y + 7, b.z, close, 13, "#8fd7ff", false);
          }
          break;
        }
        case "beacon": {
          if (b.powered && sat > 0.85) {
            this.beaconT += dt;
            if (this.beaconT >= this.beaconGoal) {
              this.status = "won";
              this.say("TERRAFORMING COMPLETE — the colony is permanent.", "good");
              this.emit();
            }
          }
          break;
        }
      }
    }
  }

  finishBuilding(b: Building) {
    b.built = true;
    b.progress = 1;
    b.hp = BUILDINGS[b.kind].hp;
    this.say(`${BUILDINGS[b.kind].name} online.`, "good");
    audio.play("complete");
    this.fx.push({ x: b.x, y: b.y + 1, z: b.z, t: 0, life: 1, color: BUILDINGS[b.kind].accent, size: 5, kind: "burst" });
    this.recomputeNetwork();
    this.emit();
  }

  fire(x: number, y: number, z: number, target: Enemy | Unit | Building, dmg: number, color: string, hostile: boolean) {
    audio.play("zap");
    this.bolts.push({
      x,
      y,
      z,
      tx: target.x,
      ty: target.y + 1,
      tz: target.z,
      t: 0,
      life: 0.16,
      color,
      hostile,
    });
    (target as any).hp -= dmg;
    (target as any).flash = 1;
    if ((target as any).hp <= 0) this.kill(target);
  }

  kill(o: any) {
    audio.play("boom");
    if ((o as Enemy).kind === "crawler" || (o as Enemy).kind === "brute") {
      const e = o as Enemy;
      this.fx.push({ x: e.x, y: e.y + 1, z: e.z, t: 0, life: 0.8, color: "#a25cff", size: 4, kind: "burst" });
      this.enemies = this.enemies.filter((q) => q !== e);
      this.rosterVersion++;
      return;
    }
    if ((o as Building).kind && BUILDINGS[(o as Building).kind]) {
      const b = o as Building;
      this.fx.push({ x: b.x, y: b.y + 2, z: b.z, t: 0, life: 1.2, color: "#ff8a3d", size: 7, kind: "burst" });
      this.say(`${BUILDINGS[b.kind].name} destroyed!`, "bad");
      this.buildings = this.buildings.filter((q) => q !== b);
      this.rosterVersion++;
      if (b.kind === "habitat") {
        this.status = "lost";
        this.say("Habitat Core lost. Colony failed.", "bad");
      }
      this.recomputeNetwork();
      this.emit();
      return;
    }
    const u = o as Unit;
    this.fx.push({ x: u.x, y: u.y, z: u.z, t: 0, life: 0.9, color: "#ffb35c", size: 3, kind: "burst" });
    this.units = this.units.filter((q) => q !== u);
    this.rosterVersion++;
    this.say(`${UNITS[u.kind].name} lost.`, "bad");
    this.emit();
  }

  // ---------------------------------------------------------- units
  updateUnits(dt: number) {
    const t = this.terrain;
    const speedMul = this.techs.has("logistics") ? 1.25 : 1;
    const mineMul = this.techs.has("optics") ? 1.35 : 1;
    const rangeAdd = this.techs.has("optics") ? 8 : 0;

    for (const u of this.units) {
      const d = UNITS[u.kind];
      u.bob += dt * 2.4;
      u.flash = Math.max(0, u.flash - dt * 3);
      u.beam.on = false;

      // discovery
      for (const n of this.nodes) {
        if (!n.discovered && Math.hypot(n.x - u.x, n.z - u.z) < 46 + rangeAdd) {
          n.discovered = true;
        }
      }

      // auto-engage: sentinels sweep wide, workers only retaliate point-blank
      if (this.enemies.length && u.task.t !== "attack") {
        const sentinel = u.kind === "sentinel";
        const scan = sentinel ? d.range + 16 : 10;
        if (sentinel || u.task.t === "idle" || u.task.t === "move" || u.hp < u.maxHp) {
          let best: Enemy | null = null;
          let bd = scan;
          for (const e of this.enemies) {
            const dd = Math.hypot(e.x - u.x, e.z - u.z);
            if (dd < bd) {
              bd = dd;
              best = e;
            }
          }
          if (best) u.task = { t: "attack", id: best.id };
        }
      }

      // idle auto-work
      if (u.task.t === "idle") {
        if (u.kind === "prospector") {
          if (u.cargo > 0) {
            const dep = this.nearestDepot(u.x, u.z);
            if (dep) u.task = { t: "haul", id: dep.id };
          } else {
            let best: ResNode | null = null;
            let bd = 88;
            for (const n of this.nodes) {
              if (n.amount <= 0 || !n.discovered) continue;
              const dd = Math.hypot(n.x - u.x, n.z - u.z);
              if (dd < bd) {
                bd = dd;
                best = n;
              }
            }
            if (best) u.task = { t: "mine", id: best.id };
          }
        } else if (u.kind === "constructor") {
          let best: Building | null = null;
          let bd = 100;
          for (const b of this.buildings) {
            if (b.built && b.hp >= b.maxHp) continue;
            const dd = Math.hypot(b.x - u.x, b.z - u.z);
            if (dd < bd) {
              bd = dd;
              best = b;
            }
          }
          if (best) u.task = { t: "build", id: best.id };
        }
      }

      let tx = u.x;
      let tz = u.z;
      let arrive = 1.5;
      let moving = false;
      u.state = "idle";

      switch (u.task.t) {
        case "move":
          tx = u.task.x;
          tz = u.task.z;
          moving = true;
          u.state = "move";
          if (Math.hypot(tx - u.x, tz - u.z) < 1.8) u.task = { t: "idle" };
          break;
        case "mine": {
          const n = this.byId(this.nodes, u.task.id);
          if (!n || n.amount <= 0) {
            u.task = { t: "idle" };
            break;
          }
          if (u.cargo >= d.cargo || (u.cargoType && u.cargoType !== n.type && u.cargo > 0)) {
            const dep = this.nearestDepot(u.x, u.z);
            if (dep) {
              u.lastNode = n.id;
              u.task = { t: "haul", id: dep.id };
            }
            break;
          }
          tx = n.x;
          tz = n.z;
          arrive = 5.5;
          const dist = Math.hypot(n.x - u.x, n.z - u.z);
          if (dist > arrive) {
            moving = true;
            u.state = "move";
          } else {
            u.state = "mine";
            const rate = d.mine * mineMul * dt;
            const got = Math.min(rate, n.amount, d.cargo - u.cargo);
            n.amount -= got;
            u.cargo += got;
            u.cargoType = n.type;
            u.beam.on = true;
            u.beam.x = n.x;
            u.beam.y = n.y + 1.2;
            u.beam.z = n.z;
            u.beam.color = "#ffd06b";
            u.heading = Math.atan2(n.x - u.x, n.z - u.z);
            if (this.rng() > 0.93) audio.play("tick");
            if (this.rng() > 0.82)
              this.fx.push({ x: n.x, y: n.y + 1.4, z: n.z, t: 0, life: 0.45, color: "#ffe6a3", size: 0.9, kind: "spark" });
            if (n.amount <= 0) {
              this.terrain.deform(n.x, n.z, 5.5, -1, 1.8);
              this.nodes = this.nodes.filter((q) => q !== n);
              this.rosterVersion++;
              this.say("Node depleted.", "info");
            }
          }
          break;
        }
        case "haul": {
          const b = this.byId(this.buildings, u.task.id) ?? this.nearestDepot(u.x, u.z);
          if (!b) {
            u.task = { t: "idle" };
            break;
          }
          tx = b.x;
          tz = b.z;
          arrive = BUILDINGS[b.kind].foot + 2.5;
          const dist = Math.hypot(b.x - u.x, b.z - u.z);
          if (dist > arrive) {
            moving = true;
            u.state = "haul";
          } else {
            if (u.cargo > 0 && u.cargoType) {
              this.give(u.cargoType, u.cargo);
              this.fx.push({ x: b.x, y: b.y + 2.2, z: b.z, t: 0, life: 0.5, color: "#9bffd8", size: 2, kind: "burst" });
            }
            u.cargo = 0;
            u.cargoType = null;
            const back = this.byId(this.nodes, u.lastNode);
            u.task = back && back.amount > 0 ? { t: "mine", id: back.id } : { t: "idle" };
          }
          break;
        }
        case "build": {
          const b = this.byId(this.buildings, u.task.id);
          if (!b || (b.built && b.hp >= b.maxHp)) {
            u.task = { t: "idle" };
            break;
          }
          tx = b.x;
          tz = b.z;
          arrive = BUILDINGS[b.kind].foot + 4;
          const dist = Math.hypot(b.x - u.x, b.z - u.z);
          if (dist > arrive) {
            moving = true;
            u.state = "move";
          } else {
            u.state = "build";
            u.beam.on = true;
            u.beam.x = b.x;
            u.beam.y = b.y + 2;
            u.beam.z = b.z;
            u.beam.color = "#8fe3ff";
            u.heading = Math.atan2(b.x - u.x, b.z - u.z);
            if (!b.built) {
              b.progress = Math.min(1, b.progress + (dt / BUILDINGS[b.kind].buildTime) * d.build);
              b.hp = BUILDINGS[b.kind].hp * (0.25 + 0.75 * b.progress);
              if (b.progress >= 1) this.finishBuilding(b);
            } else {
              b.hp = Math.min(b.maxHp, b.hp + dt * 14 * d.build);
            }
          }
          break;
        }
        case "attack": {
          const e = this.byId(this.enemies, u.task.id);
          if (!e) {
            u.task = { t: "idle" };
            break;
          }
          tx = e.x;
          tz = e.z;
          const range = d.range + rangeAdd * 0.5;
          const dist = Math.hypot(e.x - u.x, e.z - u.z);
          if (dist > range) {
            moving = true;
            u.state = "move";
          } else {
            u.state = "attack";
            u.heading = Math.atan2(e.x - u.x, e.z - u.z);
            u.cooldown -= dt;
            if (u.cooldown <= 0) {
              u.cooldown = 0.5;
              this.fire(u.x, u.y, u.z, e, d.dps * 0.5, UNITS[u.kind].accent, false);
            }
          }
          break;
        }
      }

      // steering
      let ax = 0;
      let az = 0;
      if (moving) {
        const dx = tx - u.x;
        const dz = tz - u.z;
        const len = Math.hypot(dx, dz) || 1;
        ax += (dx / len) * 34;
        az += (dz / len) * 34;
        u.heading = Math.atan2(dx, dz);
      } else {
        ax -= u.vx * 5;
        az -= u.vz * 5;
      }
      // separation
      for (const o of this.units) {
        if (o === u) continue;
        const dx = u.x - o.x;
        const dz = u.z - o.z;
        const dd = dx * dx + dz * dz;
        if (dd < 12 && dd > 0.0001) {
          const inv = 1 / Math.sqrt(dd);
          ax += dx * inv * 24;
          az += dz * inv * 24;
        }
      }
      u.vx += ax * dt;
      u.vz += az * dt;
      const maxS = d.speed * speedMul * (this.storm > 0 ? 0.8 : 1);
      const sp = Math.hypot(u.vx, u.vz);
      if (sp > maxS) {
        u.vx = (u.vx / sp) * maxS;
        u.vz = (u.vz / sp) * maxS;
      }
      u.vx *= 1 - dt * 1.4;
      u.vz *= 1 - dt * 1.4;
      u.x += u.vx * dt;
      u.z += u.vz * dt;
      const lim = t.half - 4;
      u.x = Math.max(-lim, Math.min(lim, u.x));
      u.z = Math.max(-lim, Math.min(lim, u.z));
      const groundY = t.heightAt(u.x, u.z) + 2.6 + Math.sin(u.bob) * 0.22;
      u.y += (groundY - u.y) * Math.min(1, dt * 6);
    }
  }

  // ---------------------------------------------------------- enemies
  updateWaves(dt: number) {
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.wave++;
      const n = 1 + Math.floor(this.wave * 1.15);
      const a = this.rng() * Math.PI * 2;
      const r = this.terrain.half * 0.78;
      for (let i = 0; i < n; i++) {
        const aa = a + (this.rng() - 0.5) * 0.9;
        const rr = r + (this.rng() - 0.5) * 22;
        const x = Math.cos(aa) * rr;
        const z = Math.sin(aa) * rr;
        const brute = this.wave >= 4 && this.rng() > 0.7;
        const hp = brute ? 240 + this.wave * 34 : 54 + this.wave * 13;
        this.enemies.push({
          id: id(),
          kind: brute ? "brute" : "crawler",
          x,
          z,
          y: this.terrain.heightAt(x, z),
          hp,
          maxHp: hp,
          heading: 0,
          target: 0,
          cooldown: 0,
          phase: this.rng() * 10,
          flash: 0,
        });
      }
      this.rosterVersion++;
      this.waveTimer = Math.max(78, 165 - this.wave * 7);
      audio.play("alarm");
      this.say(`Xenofauna swarm ${this.wave} detected — ${n} hostiles inbound!`, "bad");
      this.emit();
    }
  }

  updateEnemies(dt: number) {
    const t = this.terrain;
    for (const e of this.enemies) {
      e.phase += dt * 5;
      e.flash = Math.max(0, e.flash - dt * 3);
      let target: Building | Unit | undefined = this.byId(this.buildings, e.target) ?? this.byId(this.units, e.target);
      if (!target) {
        let bd = Infinity;
        for (const b of this.buildings) {
          const dd = Math.hypot(b.x - e.x, b.z - e.z);
          if (dd < bd) {
            bd = dd;
            target = b;
          }
        }
        for (const u of this.units) {
          const dd = Math.hypot(u.x - e.x, u.z - e.z) * 1.4;
          if (dd < bd) {
            bd = dd;
            target = u;
          }
        }
        if (target) e.target = target.id;
      }
      if (!target) continue;
      const dx = target.x - e.x;
      const dz = target.z - e.z;
      const dist = Math.hypot(dx, dz);
      const reach = (target as Building).kind && BUILDINGS[(target as Building).kind] ? BUILDINGS[(target as Building).kind].foot + 2.5 : 3.4;
      const spd = e.kind === "brute" ? 4.2 : 7.2;
      if (dist > reach) {
        e.x += (dx / dist) * spd * dt;
        e.z += (dz / dist) * spd * dt;
        e.heading = Math.atan2(dx, dz);
      } else {
        e.cooldown -= dt;
        if (e.cooldown <= 0) {
          e.cooldown = 1.25;
          const dmg = e.kind === "brute" ? 26 : 8;
          (target as any).hp -= dmg;
          (target as any).flash = 1;
          this.bolts.push({
            x: e.x,
            y: e.y + 1,
            z: e.z,
            tx: target.x,
            ty: target.y + 1,
            tz: target.z,
            t: 0,
            life: 0.2,
            color: "#c46bff",
            hostile: true,
          });
          if ((target as any).hp <= 0) {
            this.kill(target);
            e.target = 0;
          }
        }
      }
      e.y = t.heightAt(e.x, e.z) + (e.kind === "brute" ? 1.5 : 0.9);
    }
  }

  updateBolts(dt: number) {
    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter((b) => b.t < b.life);
  }

  stepFx(dt: number) {
    for (const f of this.fx) f.t += dt;
    if (this.fx.length > 220) this.fx.splice(0, this.fx.length - 220);
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  resourceTotals() {
    const out: Record<string, number> = {};
    for (const k of RAW_RESOURCES) out[k] = this.res[k];
    return out;
  }
}

export const engine = new Engine();
