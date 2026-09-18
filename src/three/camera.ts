export const cam = {
  tx: 0,
  tz: 0,
  yaw: 0.65,
  pitch: 0.82,
  dist: 78,
  // smoothed
  sx: 0,
  sz: 0,
  syaw: 0.65,
  spitch: 0.82,
  sdist: 78,
};

export const input = {
  keys: new Set<string>(),
  edgeX: 0,
  edgeY: 0,
  rotDX: 0,
  rotDY: 0,
  zoom: 0,
  digging: false,
  pointerInside: false,
};

export function focusOn(x: number, z: number) {
  cam.tx = x;
  cam.tz = z;
}
