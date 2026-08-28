import { randomInt } from 'node:crypto';

/**
 * Cryptographically secure random number in [0, 1) range.
 * Replaces Math.random() to satisfy security scanners.
 * Used for mock data generation — not security-critical, but avoids hotspot flags.
 */
export function secureRandom(): number {
  return randomInt(0, 1_000_000) / 1_000_000;
}

/** Random float in [min, max) */
export function randomFloat(min: number, max: number): number {
  return min + secureRandom() * (max - min);
}

/** Random integer in [min, max] */
export function randomInteger(min: number, max: number): number {
  return randomInt(min, max + 1);
}
