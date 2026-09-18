import * as THREE from "three";
import { engine } from "../game/engine";

export const view = {
  camera: null as THREE.PerspectiveCamera | null,
  el: null as HTMLElement | null,
  width: 1,
  height: 1,
};

const _v = new THREE.Vector3();
const _ray = new THREE.Ray();
const _ndc = new THREE.Vector2();

/** Convert screen pixel coords into a point on the terrain. */
export function screenToGround(cx: number, cy: number) {
  const cam = view.camera;
  const el = view.el;
  if (!cam || !el) return null;
  const r = el.getBoundingClientRect();
  _ndc.x = ((cx - r.left) / r.width) * 2 - 1;
  _ndc.y = -((cy - r.top) / r.height) * 2 + 1;
  _v.set(_ndc.x, _ndc.y, 0.5).unproject(cam);
  _ray.origin.copy(cam.position);
  _ray.direction.copy(_v).sub(cam.position).normalize();
  const hit = engine.terrain.raycast(
    _ray.origin.x,
    _ray.origin.y,
    _ray.origin.z,
    _ray.direction.x,
    _ray.direction.y,
    _ray.direction.z
  );
  if (hit) return hit;
  // fall back to the y=0 plane
  if (Math.abs(_ray.direction.y) < 1e-4) return null;
  const t = -_ray.origin.y / _ray.direction.y;
  if (t < 0) return null;
  return {
    x: _ray.origin.x + _ray.direction.x * t,
    y: 0,
    z: _ray.origin.z + _ray.direction.z * t,
    dist: t,
  };
}

/** Project a world point to screen pixels (relative to the canvas element). */
export function project(x: number, y: number, z: number): [number, number] | null {
  const cam = view.camera;
  const el = view.el;
  if (!cam || !el) return null;
  _v.set(x, y, z).project(cam);
  if (_v.z > 1) return null;
  const r = el.getBoundingClientRect();
  return [((_v.x + 1) / 2) * r.width, ((1 - _v.y) / 2) * r.height];
}
