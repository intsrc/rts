// ============================================================
//  EXO-COLONY :: CORE DEFINITIONS
// ============================================================

export type ResourceKey =
  | "compound"
  | "resin"
  | "organic"
  | "laterite"
  | "malachite"
  | "aluminum"
  | "copper";

export type Cost = Partial<Record<ResourceKey, number>>;

export const RESOURCES: Record<
  ResourceKey,
  { name: string; color: string; glyph: string; refined?: boolean }
> = {
  compound: { name: "Compound", color: "#dfe6f2", glyph: "◆" },
  resin: { name: "Resin", color: "#f2a93b", glyph: "❖" },
  organic: { name: "Organic", color: "#7fd66a", glyph: "✿" },
  laterite: { name: "Laterite", color: "#e0563f", glyph: "▲" },
  malachite: { name: "Malachite", color: "#39c9a6", glyph: "▲" },
  aluminum: { name: "Aluminum", color: "#b9c6d6", glyph: "▮", refined: true },
  copper: { name: "Copper", color: "#f08a53", glyph: "▮", refined: true },
};

export const RAW_RESOURCES: ResourceKey[] = [
  "compound",
  "resin",
  "organic",
  "laterite",
  "malachite",
];

// ------------------------------------------------------------
//  BUILDINGS
// ------------------------------------------------------------

export type BuildingKey =
  | "habitat"
  | "tether"
  | "solar"
  | "turbine"
  | "generator"
  | "smelter"
  | "printer"
  | "research"
  | "silo"
  | "turret"
  | "beacon";

export interface BuildingDef {
  key: BuildingKey;
  name: string;
  glyph: string;
  cost: Cost;
  hp: number;
  /** network link radius */
  link: number;
  /** footprint radius used for placement / flatness test */
  foot: number;
  /** positive = generates, negative = consumes (kW) */
  power: number;
  buildTime: number;
  tech?: TechKey;
  desc: string;
  accent: string;
  maxSlope: number;
}

export const BUILDINGS: Record<BuildingKey, BuildingDef> = {
  habitat: {
    key: "habitat",
    name: "Habitat Core",
    glyph: "⌂",
    cost: {},
    hp: 3200,
    link: 30,
    foot: 6,
    power: 4,
    buildTime: 1,
    accent: "#8fd7ff",
    maxSlope: 0.45,
    desc: "Colony heart. Anchors the oxygen + power grid and stores all cargo.",
  },
  tether: {
    key: "tether",
    name: "Tether Node",
    glyph: "†",
    cost: { compound: 4 },
    hp: 90,
    link: 26,
    foot: 1.1,
    power: 0,
    buildTime: 1.5,
    accent: "#7ef9e0",
    maxSlope: 0.85,
    desc: "Cheap relay that extends the oxygen tether + power grid outward.",
  },
  solar: {
    key: "solar",
    name: "Solar Array",
    glyph: "◫",
    cost: { compound: 8, copper: 2 },
    hp: 170,
    link: 16,
    foot: 2.6,
    power: 9,
    buildTime: 7,
    accent: "#ffd66b",
    maxSlope: 0.3,
    desc: "Generates 9 kW in daylight. Output dies at night and in storms.",
  },
  turbine: {
    key: "turbine",
    name: "Wind Turbine",
    glyph: "✳",
    cost: { compound: 10, aluminum: 2 },
    hp: 190,
    link: 16,
    foot: 2.4,
    power: 5,
    buildTime: 8,
    accent: "#a9e8ff",
    maxSlope: 0.3,
    desc: "Steady 5 kW, doubles during storms. Blows all night long.",
  },
  generator: {
    key: "generator",
    name: "Bio Generator",
    glyph: "⛽",
    cost: { resin: 8, compound: 6 },
    hp: 230,
    link: 16,
    foot: 2.4,
    power: 14,
    buildTime: 9,
    tech: "combustion",
    accent: "#ff9d5c",
    maxSlope: 0.3,
    desc: "Burns Organic for a reliable 14 kW. Needs fuel in the silo.",
  },
  smelter: {
    key: "smelter",
    name: "Smelting Furnace",
    glyph: "♨",
    cost: { compound: 12, resin: 6 },
    hp: 320,
    link: 18,
    foot: 3.4,
    power: -6,
    buildTime: 11,
    tech: "smelting",
    accent: "#ff7a4d",
    maxSlope: 0.27,
    desc: "Refines Laterite → Aluminum and Malachite → Copper.",
  },
  printer: {
    key: "printer",
    name: "Drone Printer",
    glyph: "⎔",
    cost: { compound: 14, aluminum: 3 },
    hp: 330,
    link: 18,
    foot: 3.4,
    power: -5,
    buildTime: 12,
    accent: "#c9a6ff",
    maxSlope: 0.27,
    desc: "Fabricates new drones. Queue units here.",
  },
  research: {
    key: "research",
    name: "Research Bay",
    glyph: "⌬",
    cost: { compound: 10, resin: 10, copper: 2 },
    hp: 280,
    link: 18,
    foot: 3.2,
    power: -7,
    buildTime: 12,
    accent: "#7ad7ff",
    maxSlope: 0.27,
    desc: "Converts power into Bytes for the tech catalogue.",
  },
  silo: {
    key: "silo",
    name: "Cargo Silo",
    glyph: "▤",
    cost: { compound: 8, resin: 4 },
    hp: 260,
    link: 18,
    foot: 2.8,
    power: 0,
    buildTime: 8,
    accent: "#d7e3f0",
    maxSlope: 0.25,
    desc: "+120 storage and a drop-off point for prospectors.",
  },
  turret: {
    key: "turret",
    name: "Pulse Turret",
    glyph: "⌖",
    cost: { aluminum: 4, copper: 3, compound: 6 },
    hp: 420,
    link: 14,
    foot: 2.2,
    power: -4,
    buildTime: 10,
    tech: "defense",
    accent: "#ff5f8f",
    maxSlope: 0.3,
    desc: "Automated defense. Needs grid power to fire.",
  },
  beacon: {
    key: "beacon",
    name: "Terraforming Beacon",
    glyph: "✦",
    cost: { aluminum: 16, copper: 14, compound: 30, resin: 20 },
    hp: 900,
    link: 24,
    foot: 5,
    power: -25,
    buildTime: 30,
    tech: "terraform",
    accent: "#b6ff7a",
    maxSlope: 0.22,
    desc: "VICTORY OBJECTIVE — keep it powered for 90s to terraform the planet.",
  },
};

export const BUILD_MENU: BuildingKey[] = [
  "tether",
  "solar",
  "turbine",
  "generator",
  "silo",
  "smelter",
  "printer",
  "research",
  "turret",
  "beacon",
];

// ------------------------------------------------------------
//  UNITS
// ------------------------------------------------------------

export type UnitKey = "prospector" | "constructor" | "sentinel";

export interface UnitDef {
  key: UnitKey;
  name: string;
  glyph: string;
  cost: Cost;
  hp: number;
  speed: number;
  cargo: number;
  mine: number;
  build: number;
  dps: number;
  range: number;
  buildTime: number;
  accent: string;
  tech?: TechKey;
  desc: string;
}

export const UNITS: Record<UnitKey, UnitDef> = {
  prospector: {
    key: "prospector",
    name: "Prospector",
    glyph: "⛏",
    cost: { compound: 6, resin: 3 },
    hp: 90,
    speed: 9.5,
    cargo: 22,
    mine: 2.2,
    build: 0.4,
    dps: 3,
    range: 7,
    buildTime: 9,
    accent: "#ffd06b",
    desc: "Extracts resource nodes and hauls cargo back to the grid.",
  },
  constructor: {
    key: "constructor",
    name: "Constructor",
    glyph: "⚒",
    cost: { compound: 8, aluminum: 2 },
    hp: 120,
    speed: 8.5,
    cargo: 6,
    mine: 0.8,
    build: 2.4,
    dps: 2,
    range: 8,
    buildTime: 11,
    accent: "#8fe3ff",
    desc: "Assembles and repairs structures far faster than the auto-grid.",
  },
  sentinel: {
    key: "sentinel",
    name: "Sentinel",
    glyph: "✦",
    cost: { aluminum: 4, copper: 2, compound: 5 },
    hp: 220,
    speed: 10.5,
    cargo: 0,
    mine: 0,
    build: 0.3,
    dps: 17,
    range: 15,
    buildTime: 12,
    tech: "defense",
    accent: "#ff6f9c",
    desc: "Combat drone. Auto-engages xenofauna inside its scan radius.",
  },
};

// ------------------------------------------------------------
//  TECH
// ------------------------------------------------------------

export type TechKey =
  | "smelting"
  | "combustion"
  | "defense"
  | "optics"
  | "logistics"
  | "terraform";

export interface TechDef {
  key: TechKey;
  name: string;
  cost: number;
  requires?: TechKey;
  desc: string;
  glyph: string;
}

export const TECHS: Record<TechKey, TechDef> = {
  smelting: {
    key: "smelting",
    name: "Thermal Smelting",
    cost: 40,
    glyph: "♨",
    desc: "Unlocks the Smelting Furnace — refine ore into Aluminum & Copper.",
  },
  combustion: {
    key: "combustion",
    name: "Bio Combustion",
    cost: 55,
    glyph: "⛽",
    desc: "Unlocks the Bio Generator for weather-proof power.",
  },
  optics: {
    key: "optics",
    name: "Deep Optics",
    cost: 70,
    requires: "smelting",
    glyph: "◎",
    desc: "+35% extraction rate and +8 scan radius on every drone.",
  },
  defense: {
    key: "defense",
    name: "Pulse Weaponry",
    cost: 90,
    requires: "smelting",
    glyph: "⌖",
    desc: "Unlocks Pulse Turrets and Sentinel drones.",
  },
  logistics: {
    key: "logistics",
    name: "Grid Logistics",
    cost: 110,
    requires: "combustion",
    glyph: "⇄",
    desc: "+25% drone speed, +40% tether link range, +100 storage.",
  },
  terraform: {
    key: "terraform",
    name: "Terraforming Array",
    cost: 180,
    requires: "logistics",
    glyph: "✦",
    desc: "Unlocks the Terraforming Beacon — the path to victory.",
  },
};

export const TECH_ORDER: TechKey[] = [
  "smelting",
  "combustion",
  "optics",
  "defense",
  "logistics",
  "terraform",
];

// ------------------------------------------------------------
//  MISC TUNING
// ------------------------------------------------------------

export const WORLD = {
  /** heightmap resolution (vertices per side) */
  res: 217,
  /** world units per cell */
  cell: 1.3333333,
  get size() {
    return (this.res - 1) * this.cell;
  },
  get half() {
    return this.size / 2;
  },
  dayLength: 150,
  baseStorage: 160,
  energyCap: 120,
};
