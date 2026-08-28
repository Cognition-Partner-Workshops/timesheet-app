// Block types as const values (no enum due to erasableSyntaxOnly)
export const BlockType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  WATER: 7,
  COBBLESTONE: 8,
  PLANKS: 9,
  BEDROCK: 10,
  SNOW: 11,
} as const;

export type BlockType = (typeof BlockType)[keyof typeof BlockType];

// Block colors (top, side, bottom)
export interface BlockColors {
  top: number;
  side: number;
  bottom: number;
}

export const BLOCK_COLORS: Record<BlockType, BlockColors> = {
  [BlockType.AIR]: { top: 0x000000, side: 0x000000, bottom: 0x000000 },
  [BlockType.GRASS]: { top: 0x5b8c2a, side: 0x6b8e3a, bottom: 0x8b6914 },
  [BlockType.DIRT]: { top: 0x8b6914, side: 0x8b6914, bottom: 0x8b6914 },
  [BlockType.STONE]: { top: 0x808080, side: 0x808080, bottom: 0x808080 },
  [BlockType.WOOD]: { top: 0x9c7c4e, side: 0x6b4226, bottom: 0x9c7c4e },
  [BlockType.LEAVES]: { top: 0x2d7a2d, side: 0x2d7a2d, bottom: 0x2d7a2d },
  [BlockType.SAND]: { top: 0xc2b280, side: 0xc2b280, bottom: 0xc2b280 },
  [BlockType.WATER]: { top: 0x3355cc, side: 0x3355cc, bottom: 0x3355cc },
  [BlockType.COBBLESTONE]: { top: 0x6b6b6b, side: 0x6b6b6b, bottom: 0x6b6b6b },
  [BlockType.PLANKS]: { top: 0xbc9458, side: 0xbc9458, bottom: 0xbc9458 },
  [BlockType.BEDROCK]: { top: 0x333333, side: 0x333333, bottom: 0x333333 },
  [BlockType.SNOW]: { top: 0xfffafa, side: 0xf0f0f0, bottom: 0xd0d0d0 },
};

export const BLOCK_NAMES: Record<BlockType, string> = {
  [BlockType.AIR]: 'Air',
  [BlockType.GRASS]: 'Grass',
  [BlockType.DIRT]: 'Dirt',
  [BlockType.STONE]: 'Stone',
  [BlockType.WOOD]: 'Wood',
  [BlockType.LEAVES]: 'Leaves',
  [BlockType.SAND]: 'Sand',
  [BlockType.WATER]: 'Water',
  [BlockType.COBBLESTONE]: 'Cobblestone',
  [BlockType.PLANKS]: 'Planks',
  [BlockType.BEDROCK]: 'Bedrock',
  [BlockType.SNOW]: 'Snow',
};

// World constants
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const SEA_LEVEL = 20;
export const RENDER_DISTANCE = 4;

// Player constants
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SPEED = 8;
export const PLAYER_SPRINT_SPEED = 14;
export const JUMP_FORCE = 8;
export const GRAVITY = 20;

// Inventory items the player can place
export const PLACEABLE_BLOCKS: BlockType[] = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.WOOD,
  BlockType.LEAVES,
  BlockType.SAND,
  BlockType.COBBLESTONE,
  BlockType.PLANKS,
  BlockType.SNOW,
];
