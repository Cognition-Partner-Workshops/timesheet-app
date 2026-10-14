import { describe, it, expect } from 'vitest';
import {
  createPlayer,
  createObstacle,
  applyGravity,
  jump,
  moveObstacles,
  checkCollision,
  calculateScore,
  getLevel,
  getLevelTheme,
  LEVEL_THEMES,
} from './App';
import type { LevelTheme } from './App';

// ─── createPlayer Tests ───
describe('createPlayer', () => {
  it('should create a player at the correct starting position', () => {
    const player = createPlayer();
    expect(player.x).toBe(80);
    expect(player.y).toBe(270); // GROUND_Y(320) - PLAYER_HEIGHT(50)
    expect(player.width).toBe(40);
    expect(player.height).toBe(50);
  });

  it('should create a player that is not jumping', () => {
    const player = createPlayer();
    expect(player.isJumping).toBe(false);
    expect(player.velocityY).toBe(0);
  });
});

// ─── createObstacle Tests ───
describe('createObstacle', () => {
  it('should create an obstacle at the right edge of the canvas', () => {
    const obstacle = createObstacle(800);
    expect(obstacle.x).toBe(800);
  });

  it('should create an obstacle with valid dimensions', () => {
    const obstacle = createObstacle(800);
    expect(obstacle.width).toBe(30);
    expect(obstacle.height).toBeGreaterThanOrEqual(30);
    expect(obstacle.height).toBeLessThanOrEqual(70);
  });

  it('should create an obstacle that has not been passed', () => {
    const obstacle = createObstacle(800);
    expect(obstacle.passed).toBe(false);
  });

  it('should create obstacles with varying heights', () => {
    const heights = new Set<number>();
    for (let i = 0; i < 50; i++) {
      heights.add(Math.round(createObstacle(800).height));
    }
    expect(heights.size).toBeGreaterThan(1);
  });
});

// ─── applyGravity Tests ───
describe('applyGravity', () => {
  it('should increase velocity and move player down when in the air', () => {
    const player = createPlayer();
    const jumpingPlayer = { ...player, y: 100, velocityY: -5, isJumping: true };
    const result = applyGravity(jumpingPlayer);
    expect(result.velocityY).toBeCloseTo(-5 + 0.6);
    expect(result.y).toBeCloseTo(100 + (-5 + 0.6));
  });

  it('should stop the player at ground level', () => {
    const player = createPlayer();
    const fallingPlayer = { ...player, y: 268, velocityY: 5, isJumping: true };
    const result = applyGravity(fallingPlayer);
    expect(result.y).toBe(270); // GROUND_Y - PLAYER_HEIGHT
    expect(result.velocityY).toBe(0);
    expect(result.isJumping).toBe(false);
  });

  it('should not move a player already on the ground with zero velocity', () => {
    const player = createPlayer(); // starts on the ground
    const result = applyGravity(player);
    // velocity increases by GRAVITY but is clamped to ground
    expect(result.y).toBe(270);
    expect(result.velocityY).toBe(0);
    expect(result.isJumping).toBe(false);
  });
});

// ─── jump Tests ───
describe('jump', () => {
  it('should apply jump force to a grounded player', () => {
    const player = createPlayer();
    const result = jump(player);
    expect(result.velocityY).toBe(-12);
    expect(result.isJumping).toBe(true);
  });

  it('should not allow double jumping', () => {
    const player = createPlayer();
    const jumped = jump(player);
    const doubleJumped = jump(jumped);
    expect(doubleJumped.velocityY).toBe(-12); // same as single jump
    expect(doubleJumped).toBe(jumped); // returns same reference
  });

  it('should not modify the original player object', () => {
    const player = createPlayer();
    const result = jump(player);
    expect(player.isJumping).toBe(false);
    expect(result.isJumping).toBe(true);
  });
});

// ─── moveObstacles Tests ───
describe('moveObstacles', () => {
  it('should move obstacles to the left by the given speed', () => {
    const obstacles = [
      { x: 500, width: 30, height: 50, passed: false },
      { x: 300, width: 30, height: 40, passed: false },
    ];
    const moved = moveObstacles(obstacles, 5);
    expect(moved[0].x).toBe(495);
    expect(moved[1].x).toBe(295);
  });

  it('should remove obstacles that have gone off screen', () => {
    const obstacles = [
      { x: -100, width: 30, height: 50, passed: true },
      { x: 400, width: 30, height: 40, passed: false },
    ];
    const moved = moveObstacles(obstacles, 5);
    expect(moved.length).toBe(1);
    expect(moved[0].x).toBe(395);
  });

  it('should keep obstacles that are partially visible', () => {
    const obstacles = [
      { x: -40, width: 30, height: 50, passed: true },
    ];
    const moved = moveObstacles(obstacles, 5);
    // -40 - 5 = -45, and -45 + 30 = -15 which is > -50
    expect(moved.length).toBe(1);
  });

  it('should return an empty array when no obstacles remain', () => {
    const obstacles = [
      { x: -90, width: 30, height: 50, passed: true },
    ];
    const moved = moveObstacles(obstacles, 5);
    // -90 - 5 = -95, -95 + 30 = -65 which is < -50
    expect(moved.length).toBe(0);
  });

  it('should handle an empty obstacle array', () => {
    const moved = moveObstacles([], 5);
    expect(moved).toEqual([]);
  });
});

// ─── checkCollision Tests ───
describe('checkCollision', () => {
  it('should detect collision when player overlaps with obstacle', () => {
    const player = createPlayer(); // x=80, y=270, w=40, h=50
    const obstacle = { x: 85, width: 30, height: 60, passed: false };
    // obstacle top = 320 - 60 = 260, player bottom = 270 + 50 = 320
    // playerRight = 80+40-5=115 > 85+5=90, player.x+5=85 < 85+30-5=110
    // playerBottom=320 > 260, player.y=270 < 320
    expect(checkCollision(player, obstacle)).toBe(true);
  });

  it('should not detect collision when player is above obstacle', () => {
    const player = { ...createPlayer(), y: 100 }; // high in the air
    const obstacle = { x: 85, width: 30, height: 50, passed: false };
    // obstacleTop = 320 - 50 = 270, playerBottom = 100 + 50 = 150
    // 150 > 270 is false
    expect(checkCollision(player, obstacle)).toBe(false);
  });

  it('should not detect collision when obstacle is far ahead', () => {
    const player = createPlayer(); // x=80
    const obstacle = { x: 500, width: 30, height: 50, passed: false };
    expect(checkCollision(player, obstacle)).toBe(false);
  });

  it('should not detect collision when obstacle is behind the player', () => {
    const player = createPlayer(); // x=80
    const obstacle = { x: 10, width: 30, height: 50, passed: true };
    // playerRight = 115 > 10+5=15 YES, but player.x+5=85 < 10+30-5=35? NO, 85 > 35
    expect(checkCollision(player, obstacle)).toBe(false);
  });
});

// ─── calculateScore Tests ───
describe('calculateScore', () => {
  it('should increment score when obstacle passes the player', () => {
    const obstacles = [
      { x: 10, width: 30, height: 50, passed: false }, // x + width = 40 < playerX(80)
    ];
    const result = calculateScore(obstacles, 80, 0);
    expect(result.score).toBe(1);
    expect(result.obstacles[0].passed).toBe(true);
  });

  it('should not increment score for obstacles still ahead', () => {
    const obstacles = [
      { x: 200, width: 30, height: 50, passed: false },
    ];
    const result = calculateScore(obstacles, 80, 0);
    expect(result.score).toBe(0);
    expect(result.obstacles[0].passed).toBe(false);
  });

  it('should not re-score already passed obstacles', () => {
    const obstacles = [
      { x: 10, width: 30, height: 50, passed: true },
    ];
    const result = calculateScore(obstacles, 80, 5);
    expect(result.score).toBe(5);
  });

  it('should handle multiple obstacles at once', () => {
    const obstacles = [
      { x: 10, width: 30, height: 50, passed: false },
      { x: 20, width: 30, height: 40, passed: false },
      { x: 300, width: 30, height: 60, passed: false },
    ];
    const result = calculateScore(obstacles, 80, 0);
    expect(result.score).toBe(2); // first two pass, third is ahead
    expect(result.obstacles[0].passed).toBe(true);
    expect(result.obstacles[1].passed).toBe(true);
    expect(result.obstacles[2].passed).toBe(false);
  });

  it('should accumulate with existing score', () => {
    const obstacles = [
      { x: 10, width: 30, height: 50, passed: false },
    ];
    const result = calculateScore(obstacles, 80, 10);
    expect(result.score).toBe(11);
  });

  it('should handle empty obstacles array', () => {
    const result = calculateScore([], 80, 5);
    expect(result.score).toBe(5);
    expect(result.obstacles).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════
// NEGATIVE / EDGE-CASE TESTS
// ═══════════════════════════════════════════════════════

// ─── Negative: Gravity Edge Cases ───
describe('applyGravity - negative cases', () => {
  it('should handle extremely high velocity without crashing', () => {
    const player = { ...createPlayer(), y: 0, velocityY: 9999, isJumping: true };
    const result = applyGravity(player);
    // Should clamp to ground, not go below it
    expect(result.y).toBe(270); // GROUND_Y - PLAYER_HEIGHT
    expect(result.velocityY).toBe(0);
    expect(result.isJumping).toBe(false);
  });

  it('should handle extreme negative velocity (upward)', () => {
    const player = { ...createPlayer(), y: 200, velocityY: -9999, isJumping: true };
    const result = applyGravity(player);
    // Player should go way above screen but not crash
    expect(result.y).toBeLessThan(0);
    expect(result.isJumping).toBe(true); // still in air
  });

  it('should handle player already below ground level', () => {
    const player = { ...createPlayer(), y: 500, velocityY: 0, isJumping: true };
    const result = applyGravity(player);
    // Should snap back to ground
    expect(result.y).toBe(270);
    expect(result.velocityY).toBe(0);
    expect(result.isJumping).toBe(false);
  });

  it('should handle zero-height player at ground', () => {
    const player = { ...createPlayer(), height: 0, y: 320 };
    const result = applyGravity(player);
    // groundLevel = GROUND_Y - 0 = 320, newY = 320 + 0.6 = 320.6 >= 320
    expect(result.y).toBe(320);
    expect(result.velocityY).toBe(0);
  });
});

// ─── Negative: Jump Edge Cases ───
describe('jump - negative cases', () => {
  it('should not allow jump when player is mid-air (high velocity)', () => {
    const airbornePlayer = {
      ...createPlayer(),
      y: 50,
      velocityY: -10,
      isJumping: true,
    };
    const result = jump(airbornePlayer);
    // Should return same reference - no jump allowed
    expect(result).toBe(airbornePlayer);
    expect(result.velocityY).toBe(-10); // unchanged
  });

  it('should not allow jump when player is falling', () => {
    const fallingPlayer = {
      ...createPlayer(),
      y: 150,
      velocityY: 8,
      isJumping: true,
    };
    const result = jump(fallingPlayer);
    expect(result).toBe(fallingPlayer);
    expect(result.velocityY).toBe(8); // unchanged
  });

  it('should allow jump immediately after landing', () => {
    const landedPlayer = {
      ...createPlayer(),
      y: 270,
      velocityY: 0,
      isJumping: false, // just landed
    };
    const result = jump(landedPlayer);
    expect(result.velocityY).toBe(-12);
    expect(result.isJumping).toBe(true);
  });
});

// ─── Negative: Obstacle Creation Edge Cases ───
describe('createObstacle - negative cases', () => {
  it('should handle zero canvas width', () => {
    const obstacle = createObstacle(0);
    expect(obstacle.x).toBe(0);
    expect(obstacle.width).toBe(30);
    expect(obstacle.height).toBeGreaterThanOrEqual(30);
  });

  it('should handle negative canvas width', () => {
    const obstacle = createObstacle(-100);
    expect(obstacle.x).toBe(-100);
    // Obstacle is still created, just at a negative x position
    expect(obstacle.width).toBe(30);
  });

  it('should handle very large canvas width', () => {
    const obstacle = createObstacle(999999);
    expect(obstacle.x).toBe(999999);
    expect(obstacle.width).toBe(30);
  });
});

// ─── Negative: moveObstacles Edge Cases ───
describe('moveObstacles - negative cases', () => {
  it('should handle zero speed (obstacles do not move)', () => {
    const obstacles = [
      { x: 500, width: 30, height: 50, passed: false },
    ];
    const moved = moveObstacles(obstacles, 0);
    expect(moved[0].x).toBe(500); // no change
  });

  it('should handle negative speed (obstacles move right)', () => {
    const obstacles = [
      { x: 500, width: 30, height: 50, passed: false },
    ];
    const moved = moveObstacles(obstacles, -5);
    expect(moved[0].x).toBe(505); // moves right instead
  });

  it('should handle extremely high speed', () => {
    const obstacles = [
      { x: 500, width: 30, height: 50, passed: false },
      { x: 100, width: 30, height: 40, passed: false },
    ];
    const moved = moveObstacles(obstacles, 99999);
    // All obstacles should be removed (far off screen)
    expect(moved.length).toBe(0);
  });

  it('should not mutate the original obstacles array', () => {
    const obstacles = [
      { x: 500, width: 30, height: 50, passed: false },
    ];
    const originalX = obstacles[0].x;
    moveObstacles(obstacles, 5);
    expect(obstacles[0].x).toBe(originalX); // unchanged
  });
});

// ─── Negative: Collision Detection Edge Cases ───
describe('checkCollision - negative cases', () => {
  it('should not collide when player barely misses obstacle above', () => {
    // Player bottom is exactly at obstacle top (no overlap)
    const player = { ...createPlayer(), y: 220, height: 50 };
    // obstacleTop = 320 - 50 = 270, playerBottom = 220 + 50 = 270
    // playerBottom > obstacleTop → 270 > 270 is FALSE
    const obstacle = { x: 85, width: 30, height: 50, passed: false };
    expect(checkCollision(player, obstacle)).toBe(false);
  });

  it('should not collide with zero-height obstacle', () => {
    const player = createPlayer();
    const obstacle = { x: 85, width: 30, height: 0, passed: false };
    // obstacleTop = 320 - 0 = 320, playerBottom = 320
    // playerBottom > obstacleTop → 320 > 320 is FALSE
    expect(checkCollision(player, obstacle)).toBe(false);
  });

  it('should not collide with zero-width obstacle (within padding)', () => {
    const player = createPlayer();
    const obstacle = { x: 85, width: 0, height: 60, passed: false };
    // obstacle.x + 5 = 90, obstacle.x + width - 5 = 80
    // player.x + 5 = 85 < 80? NO → no collision
    expect(checkCollision(player, obstacle)).toBe(false);
  });

  it('should handle player at exact same position as obstacle', () => {
    const player = createPlayer(); // x=80
    const obstacle = { x: 80, width: 30, height: 60, passed: false };
    // playerRight=115 > 85, player.x+5=85 < 105, playerBottom=320 > 260, player.y=270 < 320
    expect(checkCollision(player, obstacle)).toBe(true);
  });

  it('should handle very tall obstacle (taller than canvas)', () => {
    const player = { ...createPlayer(), y: 50 }; // high up
    const obstacle = { x: 85, width: 30, height: 500, passed: false };
    // obstacleTop = 320 - 500 = -180, playerBottom = 100
    // playerBottom > -180 YES, player.y=50 < 320 YES
    expect(checkCollision(player, obstacle)).toBe(true);
  });

  it('should handle collision with player at boundary of obstacle x-range', () => {
    const player = createPlayer(); // x=80, width=40
    // playerRight = 80+40-5 = 115, player.x+5 = 85
    // obstacle.x+5 = 115, so playerRight > 115 is FALSE (exactly at boundary)
    const obstacle = { x: 110, width: 30, height: 60, passed: false };
    expect(checkCollision(player, obstacle)).toBe(false);
  });
});

// ─── Negative: Score Calculation Edge Cases ───
describe('calculateScore - negative cases', () => {
  it('should not give negative score', () => {
    const result = calculateScore([], 80, 0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('should handle obstacle exactly at player position (not passed yet)', () => {
    // obstacle x + width = 80 which equals playerX → not strictly less than
    const obstacles = [
      { x: 50, width: 30, height: 50, passed: false }, // 50+30=80 = playerX
    ];
    const result = calculateScore(obstacles, 80, 0);
    // 80 < 80 is false, so should NOT be scored
    expect(result.score).toBe(0);
    expect(result.obstacles[0].passed).toBe(false);
  });

  it('should handle large number of obstacles without performance issue', () => {
    const obstacles = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      width: 30,
      height: 50,
      passed: false,
    }));
    const result = calculateScore(obstacles, 500, 0);
    // All obstacles where x + 30 < 500 → x < 470 → indices 0-469 = 470 obstacles
    expect(result.score).toBe(470);
  });

  it('should preserve score when no new obstacles are passed', () => {
    const obstacles = [
      { x: 500, width: 30, height: 50, passed: false },
      { x: 600, width: 30, height: 40, passed: false },
    ];
    const result = calculateScore(obstacles, 80, 42);
    expect(result.score).toBe(42); // unchanged
  });

  it('should not re-score when called multiple times on same data', () => {
    const obstacles = [
      { x: 10, width: 30, height: 50, passed: false },
    ];
    const first = calculateScore(obstacles, 80, 0);
    const second = calculateScore(first.obstacles, 80, first.score);
    expect(second.score).toBe(1); // still 1, not 2
  });
});

// ═══════════════════════════════════════════════════════
// LEVEL SYSTEM TESTS
// ═══════════════════════════════════════════════════════

// ─── getLevel Tests ───
describe('getLevel', () => {
  it('should return level 1 for score 0', () => {
    expect(getLevel(0)).toBe(1);
  });

  it('should return level 1 for score 4', () => {
    expect(getLevel(4)).toBe(1);
  });

  it('should return level 2 for score 5', () => {
    expect(getLevel(5)).toBe(2);
  });

  it('should return level 2 for score 9', () => {
    expect(getLevel(9)).toBe(2);
  });

  it('should return level 3 for score 10', () => {
    expect(getLevel(10)).toBe(3);
  });

  it('should return level 4 for score 15', () => {
    expect(getLevel(15)).toBe(4);
  });

  it('should return level 5 for score 20', () => {
    expect(getLevel(20)).toBe(5);
  });

  it('should cap at level 5 for score 25 and above', () => {
    expect(getLevel(25)).toBe(5);
    expect(getLevel(100)).toBe(5);
    expect(getLevel(9999)).toBe(5);
  });

  it('should handle negative score gracefully', () => {
    const level = getLevel(-1);
    expect(level).toBeGreaterThanOrEqual(1);
  });
});

// ─── getLevelTheme Tests ───
describe('getLevelTheme', () => {
  it('should return Meadow theme for level 1', () => {
    const theme = getLevelTheme(1);
    expect(theme.name).toBe('Meadow');
    expect(theme.speedMultiplier).toBe(1.0);
    expect(theme.spawnMultiplier).toBe(1.0);
    expect(theme.obstacleHeightBonus).toBe(0);
  });

  it('should return Desert theme for level 2', () => {
    const theme = getLevelTheme(2);
    expect(theme.name).toBe('Desert');
    expect(theme.speedMultiplier).toBe(1.15);
    expect(theme.spawnMultiplier).toBe(0.9);
    expect(theme.obstacleHeightBonus).toBe(5);
  });

  it('should return Arctic theme for level 3', () => {
    const theme = getLevelTheme(3);
    expect(theme.name).toBe('Arctic');
    expect(theme.speedMultiplier).toBe(1.3);
  });

  it('should return Volcano theme for level 4', () => {
    const theme = getLevelTheme(4);
    expect(theme.name).toBe('Volcano');
    expect(theme.speedMultiplier).toBe(1.5);
  });

  it('should return Space theme for level 5', () => {
    const theme = getLevelTheme(5);
    expect(theme.name).toBe('Space');
    expect(theme.speedMultiplier).toBe(1.7);
    expect(theme.obstacleHeightBonus).toBe(20);
  });

  it('should clamp to first theme for level 0 or below', () => {
    const theme = getLevelTheme(0);
    expect(theme.name).toBe('Meadow');
    const themeNeg = getLevelTheme(-5);
    expect(themeNeg.name).toBe('Meadow');
  });

  it('should clamp to last theme for level above 5', () => {
    const theme = getLevelTheme(99);
    expect(theme.name).toBe('Space');
  });

  it('should have all required properties on every theme', () => {
    for (let lvl = 1; lvl <= 5; lvl++) {
      const theme: LevelTheme = getLevelTheme(lvl);
      expect(theme.name).toBeDefined();
      expect(theme.skyTop).toBeDefined();
      expect(theme.groundColor).toBeDefined();
      expect(theme.playerBody).toBeDefined();
      expect(theme.speedMultiplier).toBeGreaterThan(0);
      expect(theme.spawnMultiplier).toBeGreaterThan(0);
      expect(theme.obstacleHeightBonus).toBeGreaterThanOrEqual(0);
    }
  });

  it('should have increasing difficulty across levels', () => {
    for (let lvl = 2; lvl <= 5; lvl++) {
      const prev = getLevelTheme(lvl - 1);
      const curr = getLevelTheme(lvl);
      expect(curr.speedMultiplier).toBeGreaterThan(prev.speedMultiplier);
      expect(curr.obstacleHeightBonus).toBeGreaterThanOrEqual(prev.obstacleHeightBonus);
    }
  });
});

// ─── LEVEL_THEMES Array Tests ───
describe('LEVEL_THEMES', () => {
  it('should have exactly 5 themes', () => {
    expect(LEVEL_THEMES.length).toBe(5);
  });

  it('should have unique names for each theme', () => {
    const names = LEVEL_THEMES.map(t => t.name);
    expect(new Set(names).size).toBe(5);
  });
});

// ─── createObstacle with Level Tests ───
describe('createObstacle - with level parameter', () => {
  it('should create obstacle with level 1 default height range', () => {
    const obstacle = createObstacle(800, 1);
    expect(obstacle.height).toBeGreaterThanOrEqual(30);
    expect(obstacle.height).toBeLessThanOrEqual(70); // 70 + 0 bonus
  });

  it('should create taller obstacles at level 5', () => {
    // Level 5 Space: obstacleHeightBonus = 20, so max height = 70 + 20 = 90
    const obstacle = createObstacle(800, 5);
    expect(obstacle.height).toBeGreaterThanOrEqual(30);
    expect(obstacle.height).toBeLessThanOrEqual(90);
  });

  it('should default to level 1 when no level is provided', () => {
    const obstacle = createObstacle(800);
    expect(obstacle.height).toBeGreaterThanOrEqual(30);
    expect(obstacle.height).toBeLessThanOrEqual(70);
  });

  it('should apply Desert level height bonus (+5)', () => {
    const obstacle = createObstacle(800, 2);
    expect(obstacle.height).toBeLessThanOrEqual(75); // 70 + 5
  });

  it('should apply Volcano level height bonus (+15)', () => {
    const obstacle = createObstacle(800, 4);
    expect(obstacle.height).toBeLessThanOrEqual(85); // 70 + 15
  });
});
