import { WORLD } from "./defs";

// ------------------------------------------------------------
//  Seeded noise
// ------------------------------------------------------------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x: number, y: number, seed: number, oct = 5, lac = 2.03, gain = 0.5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 977);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

// ------------------------------------------------------------
//  Terrain
// ------------------------------------------------------------
export class Terrain {
  res = WORLD.res;
  cell = WORLD.cell;
  size = WORLD.size;
  half = WORLD.half;
  heights: Float32Array;
  /** material index per vertex: 0 rock, 1 soil, 2 moss, 3 sand */
  mats: Uint8Array;
  dirty = true;
  dirtyMin = [0, 0];
  dirtyMax = [0, 0];
  seed: number;

  constructor(seed = 1337) {
    this.seed = seed;
    const n = this.res * this.res;
    this.heights = new Float32Array(n);
    this.mats = new Uint8Array(n);
    this.generate();
  }

  generate() {
    const { res, cell, half } = this;
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = i * cell - half;
        const z = j * cell - half;
        this.heights[j * res + i] = this.baseHeight(x, z);
        const m = fbm(x * 0.021 + 51, z * 0.021 - 12, this.seed + 3001, 3);
        this.mats[j * res + i] = m > 0.62 ? 2 : m < 0.38 ? 3 : 1;
      }
    }
    this.markAll();
  }

  baseHeight(x: number, z: number) {
    const s = this.seed;
    // continental shape
    let h = (fbm(x * 0.0065, z * 0.0065, s, 5) - 0.5) * 46;
    // rolling dunes
    h += (fbm(x * 0.021, z * 0.021, s + 91, 4) - 0.5) * 13;
    // fine detail
    h += (fbm(x * 0.075, z * 0.075, s + 555, 3) - 0.5) * 3.2;
    // ridges
    const r = Math.abs(fbm(x * 0.013, z * 0.013, s + 202, 3) - 0.5) * 2;
    h += (1 - r) * (1 - r) * 9;

    // flatten landing zone in the middle
    const d = Math.hypot(x, z);
    const flat = 1 - smoothstep(16, 52, d);
    h = h * (1 - flat) + 2.5 * flat;

    // soft bowl at the world rim so the map reads as a crater basin
    const rim = smoothstep(this.half * 0.62, this.half * 1.02, d);
    h += rim * 30;
    return h;
  }

  idx(i: number, j: number) {
    return j * this.res + i;
  }

  clampI(i: number) {
    return i < 0 ? 0 : i > this.res - 1 ? this.res - 1 : i;
  }

  /** bilinear sampled height at world x,z */
  heightAt(x: number, z: number) {
    const fx = (x + this.half) / this.cell;
    const fz = (z + this.half) / this.cell;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const i0 = this.clampI(i);
    const j0 = this.clampI(j);
    const i1 = this.clampI(i + 1);
    const j1 = this.clampI(j + 1);
    const h = this.heights;
    const a = h[this.idx(i0, j0)];
    const b = h[this.idx(i1, j0)];
    const c = h[this.idx(i0, j1)];
    const d = h[this.idx(i1, j1)];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  normalAt(x: number, z: number, out: [number, number, number]) {
    const e = this.cell;
    const hl = this.heightAt(x - e, z);
    const hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e);
    const hu = this.heightAt(x, z + e);
    let nx = hl - hr;
    let ny = 2 * e;
    let nz = hd - hu;
    const l = Math.hypot(nx, ny, nz) || 1;
    out[0] = nx / l;
    out[1] = ny / l;
    out[2] = nz / l;
    return out;
  }

  /** 0 = flat, 1 = vertical-ish. Max deviation within radius. */
  roughness(x: number, z: number, radius: number) {
    let min = Infinity;
    let max = -Infinity;
    const steps = 6;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      for (const rr of [radius * 0.55, radius]) {
        const h = this.heightAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
        if (h < min) min = h;
        if (h > max) max = h;
      }
    }
    const h0 = this.heightAt(x, z);
    min = Math.min(min, h0);
    max = Math.max(max, h0);
    return (max - min) / Math.max(1, radius);
  }

  markAll() {
    this.dirty = true;
    this.dirtyMin = [0, 0];
    this.dirtyMax = [this.res - 1, this.res - 1];
  }

  markRegion(i0: number, j0: number, i1: number, j1: number) {
    if (!this.dirty) {
      this.dirty = true;
      this.dirtyMin = [i0, j0];
      this.dirtyMax = [i1, j1];
    } else {
      this.dirtyMin = [Math.min(this.dirtyMin[0], i0), Math.min(this.dirtyMin[1], j0)];
      this.dirtyMax = [Math.max(this.dirtyMax[0], i1), Math.max(this.dirtyMax[1], j1)];
    }
  }

  /**
   * Astroneer-style deform.
   * mode: -1 lower, 1 raise, 0 flatten toward targetH
   * returns volume of soil moved
   */
  deform(x: number, z: number, radius: number, mode: number, strength: number, targetH?: number) {
    const { cell, half } = this;
    const i0 = this.clampI(Math.floor((x - radius + half) / cell));
    const i1 = this.clampI(Math.ceil((x + radius + half) / cell));
    const j0 = this.clampI(Math.floor((z - radius + half) / cell));
    const j1 = this.clampI(Math.ceil((z + radius + half) / cell));
    let volume = 0;
    const tgt = targetH ?? this.heightAt(x, z);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const wx = i * cell - half;
        const wz = j * cell - half;
        const d = Math.hypot(wx - x, wz - z);
        if (d > radius) continue;
        const fall = Math.pow(1 - d / radius, 1.6);
        const k = this.idx(i, j);
        const h = this.heights[k];
        let nh: number;
        if (mode === 0) {
          nh = h + (tgt - h) * Math.min(1, fall * strength * 0.9);
        } else {
          nh = h + mode * fall * strength;
        }
        nh = Math.max(-48, Math.min(64, nh));
        volume += Math.abs(nh - h);
        this.heights[k] = nh;
        if (mode < 0 && fall > 0.4) this.mats[k] = 0;
        if (mode > 0 && fall > 0.5) this.mats[k] = 1;
      }
    }
    this.markRegion(i0, j0, i1, j1);
    return volume * 0.35;
  }

  /** Ray march against the heightfield. Returns world hit point or null. */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist = 900) {
    let t = 0;
    let step = 1.2;
    let px = ox;
    let py = oy;
    let pz = oz;
    let prevDiff = py - this.heightAt(px, pz);
    if (prevDiff < 0) return null;
    while (t < maxDist) {
      t += step;
      px = ox + dx * t;
      py = oy + dy * t;
      pz = oz + dz * t;
      if (
        px < -this.half - 40 ||
        px > this.half + 40 ||
        pz < -this.half - 40 ||
        pz > this.half + 40
      ) {
        if (py < -80) return null;
        continue;
      }
      const diff = py - this.heightAt(px, pz);
      if (diff <= 0) {
        // binary refine
        let lo = t - step;
        let hi = t;
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          const mx = ox + dx * mid;
          const my = oy + dy * mid;
          const mz = oz + dz * mid;
          if (my - this.heightAt(mx, mz) > 0) lo = mid;
          else hi = mid;
        }
        const ft = (lo + hi) / 2;
        return {
          x: ox + dx * ft,
          y: oy + dy * ft,
          z: oz + dz * ft,
          dist: ft,
        };
      }
      prevDiff = diff;
      step = Math.min(6, Math.max(1.0, prevDiff * 0.6));
    }
    return null;
  }

  inBounds(x: number, z: number) {
    const m = this.half - 6;
    return x > -m && x < m && z > -m && z < m;
  }
}

export function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------
//  Strata palette — pastel alien desert
// ------------------------------------------------------------
const STRATA: Array<[number, [number, number, number]]> = [
  [-30, [0.16, 0.11, 0.22]],
  [-14, [0.27, 0.17, 0.32]],
  [-6, [0.45, 0.26, 0.35]],
  [0, [0.62, 0.36, 0.36]],
  [6, [0.79, 0.53, 0.42]],
  [14, [0.89, 0.71, 0.55]],
  [24, [0.95, 0.85, 0.73]],
  [40, [0.99, 0.96, 0.93]],
];

export function strataColor(h: number, out: [number, number, number]) {
  let i = 0;
  while (i < STRATA.length - 1 && h > STRATA[i + 1][0]) i++;
  const [h0, c0] = STRATA[i];
  const [h1, c1] = STRATA[Math.min(i + 1, STRATA.length - 1)];
  const t = h1 === h0 ? 0 : Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
  out[0] = c0[0] + (c1[0] - c0[0]) * t;
  out[1] = c0[1] + (c1[1] - c0[1]) * t;
  out[2] = c0[2] + (c1[2] - c0[2]) * t;
  return out;
}
