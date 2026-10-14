import { BlockType, CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from './types.ts';
import { fbm2, perlin2, seedNoise } from './noise.ts';

export class Chunk {
  x: number;
  z: number;
  blocks: Uint8Array;
  isDirty: boolean = true;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.AIR;
    }
    return this.blocks[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] as BlockType;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.blocks[x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE] = type;
    this.isDirty = true;
  }
}

export class World {
  chunks: Map<string, Chunk> = new Map();
  seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
    seedNoise(seed);
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(this.chunkKey(cx, cz));
  }

  getOrCreateChunk(cx: number, cz: number): Chunk {
    const key = this.chunkKey(cx, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.generateChunk(chunk);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  getBlock(wx: number, wy: number, wz: number): BlockType {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockType.AIR;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.getBlock(lx, wy, lz);
  }

  setBlock(wx: number, wy: number, wz: number, type: BlockType): void {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    chunk.setBlock(lx, wy, lz, type);

    // Mark neighboring chunks as dirty if block is on edge
    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);
  }

  private markChunkDirty(cx: number, cz: number): void {
    const chunk = this.getChunk(cx, cz);
    if (chunk) chunk.isDirty = true;
  }

  getHeightAt(wx: number, wz: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const block = this.getBlock(wx, y, wz);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
        return y + 1;
      }
    }
    return SEA_LEVEL;
  }

  private generateChunk(chunk: Chunk): void {
    const worldX = chunk.x * CHUNK_SIZE;
    const worldZ = chunk.z * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = worldX + lx;
        const wz = worldZ + lz;

        // Multi-octave terrain height
        const baseHeight = fbm2(wx * 0.01, wz * 0.01, 4, 2.0, 0.5);
        const detail = fbm2(wx * 0.05, wz * 0.05, 2, 2.0, 0.5);
        const mountainFactor = Math.max(0, fbm2(wx * 0.005, wz * 0.005, 3, 2.0, 0.5));

        // Height ranges from ~10 to ~50
        const height = Math.floor(
          SEA_LEVEL + baseHeight * 12 + detail * 3 + mountainFactor * 20
        );

        const clampedHeight = Math.min(height, WORLD_HEIGHT - 1);

        // Determine biome based on noise
        const biomeNoise = perlin2(wx * 0.008, wz * 0.008);
        const isDesert = biomeNoise > 0.3;
        const isSnowy = biomeNoise < -0.35;

        for (let y = 0; y <= clampedHeight; y++) {
          let blockType: BlockType;

          if (y === 0) {
            blockType = BlockType.BEDROCK;
          } else if (y < clampedHeight - 4) {
            blockType = BlockType.STONE;
          } else if (y < clampedHeight) {
            blockType = isDesert ? BlockType.SAND : BlockType.DIRT;
          } else {
            // Surface block
            if (isDesert) {
              blockType = BlockType.SAND;
            } else if (isSnowy) {
              blockType = BlockType.SNOW;
            } else if (y <= SEA_LEVEL + 1) {
              blockType = BlockType.SAND;
            } else {
              blockType = BlockType.GRASS;
            }
          }

          chunk.setBlock(lx, y, lz, blockType);
        }

        // Fill water up to sea level
        for (let y = clampedHeight + 1; y <= SEA_LEVEL; y++) {
          chunk.setBlock(lx, y, lz, BlockType.WATER);
        }
      }
    }

    // Generate trees
    this.generateTrees(chunk);

    chunk.isDirty = true;
  }

  private generateTrees(chunk: Chunk): void {
    const worldX = chunk.x * CHUNK_SIZE;
    const worldZ = chunk.z * CHUNK_SIZE;

    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const wx = worldX + lx;
        const wz = worldZ + lz;

        // Use noise to determine tree placement
        const treeNoise = perlin2(wx * 0.5, wz * 0.5);
        const biomeNoise = perlin2(wx * 0.008, wz * 0.008);

        // No trees in desert or water
        if (biomeNoise > 0.3) continue;

        // ~5% chance of tree at valid spots
        if (treeNoise > 0.4) {
          // Find surface
          let surfaceY = -1;
          for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            const block = chunk.getBlock(lx, y, lz);
            if (block === BlockType.GRASS || block === BlockType.SNOW) {
              surfaceY = y;
              break;
            }
          }

          if (surfaceY > SEA_LEVEL && surfaceY < WORLD_HEIGHT - 8) {
            this.placeTree(chunk, lx, surfaceY + 1, lz);
          }
        }
      }
    }
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number): void {
    const trunkHeight = 4 + Math.floor(Math.random() * 3);

    // Trunk
    for (let i = 0; i < trunkHeight; i++) {
      chunk.setBlock(x, y + i, z, BlockType.WOOD);
    }

    // Leaves (simple sphere-ish shape)
    const leafStart = y + trunkHeight - 2;
    const leafEnd = y + trunkHeight + 1;
    for (let ly = leafStart; ly <= leafEnd; ly++) {
      const radius = ly === leafEnd ? 1 : 2;
      for (let lx = -radius; lx <= radius; lx++) {
        for (let lz = -radius; lz <= radius; lz++) {
          if (lx === 0 && lz === 0 && ly < y + trunkHeight) continue; // trunk position
          if (Math.abs(lx) === radius && Math.abs(lz) === radius) continue; // corners
          const bx = x + lx;
          const bz = z + lz;
          if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && ly < WORLD_HEIGHT) {
            if (chunk.getBlock(bx, ly, bz) === BlockType.AIR) {
              chunk.setBlock(bx, ly, bz, BlockType.LEAVES);
            }
          }
        }
      }
    }
  }
}
