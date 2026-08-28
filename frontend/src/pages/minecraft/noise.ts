// Simplex-like noise for terrain generation
// Based on improved Perlin noise

const PERM_SIZE = 256;
const perm: number[] = [];
const gradP: { x: number; y: number; z: number }[] = [];

const grad3 = [
  { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 }, { x: 1, y: -1, z: 0 }, { x: -1, y: -1, z: 0 },
  { x: 1, y: 0, z: 1 }, { x: -1, y: 0, z: 1 }, { x: 1, y: 0, z: -1 }, { x: -1, y: 0, z: -1 },
  { x: 0, y: 1, z: 1 }, { x: 0, y: -1, z: 1 }, { x: 0, y: 1, z: -1 }, { x: 0, y: -1, z: -1 },
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return (1 - t) * a + t * b;
}

function dot3(g: { x: number; y: number; z: number }, x: number, y: number, z: number): number {
  return g.x * x + g.y * y + g.z * z;
}

function dot2(g: { x: number; y: number; z: number }, x: number, y: number): number {
  return g.x * x + g.y * y;
}

export function seedNoise(seed: number): void {
  const p: number[] = [];
  for (let i = 0; i < PERM_SIZE; i++) {
    p[i] = i;
  }

  // Seed-based shuffle
  let s = seed;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }

  for (let i = 0; i < PERM_SIZE * 2; i++) {
    perm[i] = p[i & (PERM_SIZE - 1)];
    gradP[i] = grad3[perm[i] % 12];
  }
}

export function perlin2(x: number, y: number): number {
  let X = Math.floor(x);
  let Y = Math.floor(y);
  x = x - X;
  y = y - Y;
  X = X & (PERM_SIZE - 1);
  Y = Y & (PERM_SIZE - 1);

  const n00 = dot2(gradP[X + perm[Y]], x, y);
  const n01 = dot2(gradP[X + perm[Y + 1]], x, y - 1);
  const n10 = dot2(gradP[X + 1 + perm[Y]], x - 1, y);
  const n11 = dot2(gradP[X + 1 + perm[Y + 1]], x - 1, y - 1);

  const u = fade(x);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), fade(y));
}

export function perlin3(x: number, y: number, z: number): number {
  let X = Math.floor(x);
  let Y = Math.floor(y);
  let Z = Math.floor(z);
  x = x - X;
  y = y - Y;
  z = z - Z;
  X = X & (PERM_SIZE - 1);
  Y = Y & (PERM_SIZE - 1);
  Z = Z & (PERM_SIZE - 1);

  const n000 = dot3(gradP[X + perm[Y + perm[Z]]], x, y, z);
  const n001 = dot3(gradP[X + perm[Y + perm[Z + 1]]], x, y, z - 1);
  const n010 = dot3(gradP[X + perm[Y + 1 + perm[Z]]], x, y - 1, z);
  const n011 = dot3(gradP[X + perm[Y + 1 + perm[Z + 1]]], x, y - 1, z - 1);
  const n100 = dot3(gradP[X + 1 + perm[Y + perm[Z]]], x - 1, y, z);
  const n101 = dot3(gradP[X + 1 + perm[Y + perm[Z + 1]]], x - 1, y, z - 1);
  const n110 = dot3(gradP[X + 1 + perm[Y + 1 + perm[Z]]], x - 1, y - 1, z);
  const n111 = dot3(gradP[X + 1 + perm[Y + 1 + perm[Z + 1]]], x - 1, y - 1, z - 1);

  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  return lerp(
    lerp(lerp(n000, n100, u), lerp(n010, n110, u), v),
    lerp(lerp(n001, n101, u), lerp(n011, n111, u), v),
    w
  );
}

// Fractal Brownian Motion for more natural terrain
export function fbm2(x: number, y: number, octaves: number = 4, lacunarity: number = 2.0, gain: number = 0.5): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += perlin2(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

// Initialize with a default seed
seedNoise(42);
