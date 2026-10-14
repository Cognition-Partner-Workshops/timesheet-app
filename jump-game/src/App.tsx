import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';

// ─── Game Constants ───
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 320;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 50;
const OBSTACLE_WIDTH = 30;
const OBSTACLE_MIN_HEIGHT = 30;
const OBSTACLE_MAX_HEIGHT = 70;
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 0.001;
const OBSTACLE_SPAWN_INTERVAL = 1500;
const POINTS_PER_LEVEL = 5;

// ─── Level Themes ───
export interface LevelTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  groundColor: string;
  grassColor: string;
  cloudColor: string;
  obstacleColor: string;
  obstacleDetail: string;
  playerBody: string;
  playerHead: string;
  speedMultiplier: number;
  spawnMultiplier: number;
  obstacleHeightBonus: number;
}

export const LEVEL_THEMES: LevelTheme[] = [
  {
    name: 'Meadow',
    skyTop: '#87CEEB',
    skyMid: '#E0F0FF',
    skyBottom: '#F5E6D3',
    groundColor: '#8B7355',
    grassColor: '#4CAF50',
    cloudColor: 'rgba(255, 255, 255, 0.8)',
    obstacleColor: '#2E7D32',
    obstacleDetail: '#1B5E20',
    playerBody: '#FF6B35',
    playerHead: '#FFD93D',
    speedMultiplier: 1.0,
    spawnMultiplier: 1.0,
    obstacleHeightBonus: 0,
  },
  {
    name: 'Desert',
    skyTop: '#FF9A56',
    skyMid: '#FFD194',
    skyBottom: '#FFF3E0',
    groundColor: '#D4A574',
    grassColor: '#C4A265',
    cloudColor: 'rgba(255, 235, 200, 0.6)',
    obstacleColor: '#8D6E63',
    obstacleDetail: '#6D4C41',
    playerBody: '#E64A19',
    playerHead: '#FFCC02',
    speedMultiplier: 1.15,
    spawnMultiplier: 0.9,
    obstacleHeightBonus: 5,
  },
  {
    name: 'Arctic',
    skyTop: '#B3E5FC',
    skyMid: '#E1F5FE',
    skyBottom: '#ECEFF1',
    groundColor: '#CFD8DC',
    grassColor: '#B0BEC5',
    cloudColor: 'rgba(255, 255, 255, 0.9)',
    obstacleColor: '#546E7A',
    obstacleDetail: '#37474F',
    playerBody: '#1565C0',
    playerHead: '#FFD93D',
    speedMultiplier: 1.3,
    spawnMultiplier: 0.8,
    obstacleHeightBonus: 10,
  },
  {
    name: 'Volcano',
    skyTop: '#4A0000',
    skyMid: '#8B0000',
    skyBottom: '#FF6F00',
    groundColor: '#3E2723',
    grassColor: '#BF360C',
    cloudColor: 'rgba(100, 100, 100, 0.6)',
    obstacleColor: '#D84315',
    obstacleDetail: '#BF360C',
    playerBody: '#FFC107',
    playerHead: '#FFEB3B',
    speedMultiplier: 1.5,
    spawnMultiplier: 0.7,
    obstacleHeightBonus: 15,
  },
  {
    name: 'Space',
    skyTop: '#0D0D2B',
    skyMid: '#1A1A4E',
    skyBottom: '#2C2C54',
    groundColor: '#4A4A7A',
    grassColor: '#7C4DFF',
    cloudColor: 'rgba(150, 150, 255, 0.4)',
    obstacleColor: '#7C4DFF',
    obstacleDetail: '#651FFF',
    playerBody: '#00E5FF',
    playerHead: '#EEFF41',
    speedMultiplier: 1.7,
    spawnMultiplier: 0.6,
    obstacleHeightBonus: 20,
  },
];

// ─── Types ───
interface Obstacle {
  x: number;
  width: number;
  height: number;
  passed: boolean;
}

interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  isJumping: boolean;
}

interface GameState {
  player: Player;
  obstacles: Obstacle[];
  score: number;
  highScore: number;
  speed: number;
  isRunning: boolean;
  isGameOver: boolean;
  frameCount: number;
  level: number;
  levelUpTimer: number;
}

// ─── Game Logic (exported for testing) ───
export function createPlayer(): Player {
  return {
    x: 80,
    y: GROUND_Y - PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    velocityY: 0,
    isJumping: false,
  };
}

export function getLevel(score: number): number {
  const level = Math.floor(score / POINTS_PER_LEVEL) + 1;
  return Math.max(1, Math.min(level, LEVEL_THEMES.length));
}

export function getLevelTheme(level: number): LevelTheme {
  const index = Math.max(0, Math.min(level - 1, LEVEL_THEMES.length - 1));
  return LEVEL_THEMES[index];
}

export function createObstacle(canvasWidth: number, level?: number): Obstacle {
  const theme = getLevelTheme(level ?? 1);
  const maxHeight = OBSTACLE_MAX_HEIGHT + theme.obstacleHeightBonus;
  const height =
    OBSTACLE_MIN_HEIGHT + Math.random() * (maxHeight - OBSTACLE_MIN_HEIGHT);
  return {
    x: canvasWidth,
    width: OBSTACLE_WIDTH,
    height,
    passed: false,
  };
}

export function applyGravity(player: Player): Player {
  const newVelocityY = player.velocityY + GRAVITY;
  const newY = player.y + newVelocityY;
  const groundLevel = GROUND_Y - player.height;

  if (newY >= groundLevel) {
    return {
      ...player,
      y: groundLevel,
      velocityY: 0,
      isJumping: false,
    };
  }
  return {
    ...player,
    y: newY,
    velocityY: newVelocityY,
  };
}

export function jump(player: Player): Player {
  if (player.isJumping) return player;
  return {
    ...player,
    velocityY: JUMP_FORCE,
    isJumping: true,
  };
}

export function moveObstacles(
  obstacles: Obstacle[],
  speed: number
): Obstacle[] {
  return obstacles
    .map((obs) => ({ ...obs, x: obs.x - speed }))
    .filter((obs) => obs.x + obs.width > -50);
}

export function checkCollision(player: Player, obstacle: Obstacle): boolean {
  const playerRight = player.x + player.width - 5;
  const playerBottom = player.y + player.height;
  const obstacleTop = GROUND_Y - obstacle.height;

  return (
    playerRight > obstacle.x + 5 &&
    player.x + 5 < obstacle.x + obstacle.width - 5 &&
    playerBottom > obstacleTop &&
    player.y < GROUND_Y
  );
}

export function calculateScore(
  obstacles: Obstacle[],
  playerX: number,
  currentScore: number
): { score: number; obstacles: Obstacle[] } {
  let score = currentScore;
  const updatedObstacles = obstacles.map((obs) => {
    if (!obs.passed && obs.x + obs.width < playerX) {
      score += 1;
      return { ...obs, passed: true };
    }
    return obs;
  });
  return { score, obstacles: updatedObstacles };
}

// ─── Drawing Helpers ───
function drawBackground(
  ctx: CanvasRenderingContext2D,
  frameCount: number,
  theme: LevelTheme
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(0.6, theme.skyMid);
  gradient.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Stars for Space level
  if (theme.name === 'Space') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + frameCount * 0.2) % CANVAS_WIDTH;
      const sy = (i * 97) % (GROUND_Y - 20);
      const size = (i % 3) + 1;
      ctx.fillRect(sx, sy, size, size);
    }
  }

  ctx.fillStyle = theme.cloudColor;
  const cloudOffset = (frameCount * 0.3) % (CANVAS_WIDTH + 200);
  drawCloud(ctx, CANVAS_WIDTH - cloudOffset, 60, 1);
  drawCloud(ctx, CANVAS_WIDTH - cloudOffset + 350, 100, 0.7);
  drawCloud(ctx, CANVAS_WIDTH - cloudOffset + 600, 40, 1.2);

  ctx.fillStyle = theme.groundColor;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

  ctx.fillStyle = theme.grassColor;
  ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 4);
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.arc(25, -10, 25, 0, Math.PI * 2);
  ctx.arc(50, 0, 20, 0, Math.PI * 2);
  ctx.arc(25, 5, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  frameCount: number,
  theme: LevelTheme
) {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = theme.playerBody;
  ctx.fillRect(5, 10, 30, 25);

  ctx.fillStyle = theme.playerHead;
  ctx.beginPath();
  ctx.arc(20, 8, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(16, 5, 2, 0, Math.PI * 2);
  ctx.arc(24, 5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(20, 9, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  if (!player.isJumping) {
    const legOffset = Math.sin(frameCount * 0.3) * 5;
    ctx.fillStyle = '#4A90D9';
    ctx.fillRect(10, 35, 8, 15 + legOffset);
    ctx.fillRect(22, 35, 8, 15 - legOffset);
  } else {
    ctx.fillStyle = '#4A90D9';
    ctx.fillRect(10, 35, 8, 10);
    ctx.fillRect(22, 35, 8, 10);
  }

  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  obstacle: Obstacle,
  theme: LevelTheme
) {
  const obstacleY = GROUND_Y - obstacle.height;

  ctx.fillStyle = theme.obstacleColor;
  ctx.fillRect(obstacle.x + 5, obstacleY, obstacle.width - 10, obstacle.height);

  if (obstacle.height > 45) {
    ctx.fillRect(obstacle.x - 2, obstacleY + 10, 10, 6);
    ctx.fillRect(obstacle.x - 2, obstacleY + 10, 6, 20);
    ctx.fillRect(obstacle.x + obstacle.width - 8, obstacleY + 20, 10, 6);
    ctx.fillRect(obstacle.x + obstacle.width - 2, obstacleY + 20, 6, 15);
  }

  ctx.fillStyle = theme.obstacleDetail;
  for (let i = 0; i < obstacle.height; i += 8) {
    ctx.fillRect(obstacle.x + 3, obstacleY + i, 2, 4);
    ctx.fillRect(obstacle.x + obstacle.width - 5, obstacleY + i, 2, 4);
  }
}

function drawScore(
  ctx: CanvasRenderingContext2D,
  score: number,
  highScore: number,
  level: number,
  theme: LevelTheme
) {
  const textColor =
    theme.name === 'Space' || theme.name === 'Volcano' ? '#FFF' : '#333';

  ctx.fillStyle = textColor;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Score: ${score}`, CANVAS_WIDTH - 20, 30);
  ctx.font = '14px monospace';
  ctx.fillText(`Best: ${highScore}`, CANVAS_WIDTH - 20, 50);

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`Lv.${level} ${theme.name}`, 20, 30);
}

function drawLevelUp(
  ctx: CanvasRenderingContext2D,
  level: number,
  timer: number
) {
  if (timer <= 0) return;

  const alpha = Math.min(1, timer / 30);
  const scale = 1 + (1 - alpha) * 0.5;
  const theme = getLevelTheme(level);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  const textWidth = 200;
  const textHeight = 60;
  ctx.beginPath();
  ctx.roundRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 12);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Level ${level}`, 0, -8);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = theme.grassColor;
  ctx.fillText(theme.name, 0, 16);

  ctx.restore();
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  score: number,
  level: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Game Over', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);

  ctx.font = '22px sans-serif';
  ctx.fillText(
    `Score: ${score}  |  Level ${level}`,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 10
  );

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#CCC';
  ctx.fillText(
    'Press Space or Tap to restart',
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 50
  );
}

function drawStartScreen(ctx: CanvasRenderingContext2D) {
  const theme = LEVEL_THEMES[0];
  drawBackground(ctx, 0, theme);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Jump Game', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

  ctx.font = '20px sans-serif';
  ctx.fillText(
    'Press Space or Tap to start',
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 10
  );

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#DDD';
  ctx.fillText(
    'Jump over obstacles to score points!',
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 45
  );

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#BBB';
  ctx.fillText(
    '5 levels: Meadow > Desert > Arctic > Volcano > Space',
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 70
  );
}

// ─── Main Component ───
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>({
    player: createPlayer(),
    obstacles: [],
    score: 0,
    highScore: parseInt(localStorage.getItem('jumpGameHighScore') || '0', 10),
    speed: INITIAL_SPEED,
    isRunning: false,
    isGameOver: false,
    frameCount: 0,
    level: 1,
    levelUpTimer: 0,
  });
  const animationRef = useRef<number>(0);
  const lastObstacleTimeRef = useRef<number>(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayHighScore, setDisplayHighScore] = useState(
    gameStateRef.current.highScore
  );
  const [displayLevel, setDisplayLevel] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const resetGame = useCallback(() => {
    const state = gameStateRef.current;
    state.player = createPlayer();
    state.obstacles = [];
    state.score = 0;
    state.speed = INITIAL_SPEED;
    state.isRunning = true;
    state.isGameOver = false;
    state.frameCount = 0;
    state.level = 1;
    state.levelUpTimer = 0;
    lastObstacleTimeRef.current = Date.now();
    setGameStarted(true);
    setGameOver(false);
    setDisplayScore(0);
    setDisplayLevel(1);
  }, []);

  const handleAction = useCallback(() => {
    const state = gameStateRef.current;
    if (state.isGameOver) {
      resetGame();
      return;
    }
    if (!state.isRunning) {
      resetGame();
      return;
    }
    state.player = jump(state.player);
  }, [resetGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      const state = gameStateRef.current;

      if (!state.isRunning) {
        drawStartScreen(ctx);
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (state.isGameOver) {
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      state.frameCount++;

      // Check for level up
      const newLevel = getLevel(state.score);
      if (newLevel > state.level) {
        state.level = newLevel;
        state.levelUpTimer = 90; // ~1.5 seconds at 60fps
        setDisplayLevel(newLevel);
      }
      if (state.levelUpTimer > 0) {
        state.levelUpTimer--;
      }

      const theme = getLevelTheme(state.level);

      state.player = applyGravity(state.player);

      // Apply level speed multiplier
      state.speed =
        (INITIAL_SPEED + state.frameCount * SPEED_INCREMENT) *
        theme.speedMultiplier;

      const now = Date.now();
      const baseInterval = Math.max(
        800,
        OBSTACLE_SPAWN_INTERVAL - state.frameCount * 0.5
      );
      const spawnInterval = baseInterval * theme.spawnMultiplier;
      if (now - lastObstacleTimeRef.current > spawnInterval) {
        state.obstacles.push(createObstacle(CANVAS_WIDTH, state.level));
        lastObstacleTimeRef.current = now;
      }

      state.obstacles = moveObstacles(state.obstacles, state.speed);

      for (const obs of state.obstacles) {
        if (checkCollision(state.player, obs)) {
          state.isGameOver = true;
          state.isRunning = false;
          if (state.score > state.highScore) {
            state.highScore = state.score;
            localStorage.setItem(
              'jumpGameHighScore',
              state.score.toString()
            );
            setDisplayHighScore(state.score);
          }
          setGameOver(true);
          break;
        }
      }

      const scoreResult = calculateScore(
        state.obstacles,
        state.player.x,
        state.score
      );
      state.score = scoreResult.score;
      state.obstacles = scoreResult.obstacles;
      setDisplayScore(state.score);

      drawBackground(ctx, state.frameCount, theme);
      state.obstacles.forEach((obs) => drawObstacle(ctx, obs, theme));
      drawPlayer(ctx, state.player, state.frameCount, theme);
      drawScore(ctx, state.score, state.highScore, state.level, theme);

      // Draw level up animation
      if (state.levelUpTimer > 0) {
        drawLevelUp(ctx, state.level, state.levelUpTimer);
      }

      if (state.isGameOver) {
        drawGameOver(ctx, state.score, state.level);
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  const currentTheme = getLevelTheme(displayLevel);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-gray-800 mb-4 tracking-tight">
        Jump Game
      </h1>

      <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-gray-700">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleAction}
          onTouchStart={(e) => {
            e.preventDefault();
            handleAction();
          }}
          className="block cursor-pointer"
          data-testid="game-canvas"
        />
      </div>

      <div className="mt-6 flex gap-6 text-lg font-mono">
        <div className="bg-white px-5 py-3 rounded-lg shadow-md">
          <span className="text-gray-500 text-sm">Level</span>
          <p className="text-2xl font-bold" style={{ color: currentTheme.obstacleColor }} data-testid="level-display">
            {displayLevel}
          </p>
        </div>
        <div className="bg-white px-5 py-3 rounded-lg shadow-md">
          <span className="text-gray-500 text-sm">Score</span>
          <p className="text-2xl font-bold text-gray-800" data-testid="score-display">
            {displayScore}
          </p>
        </div>
        <div className="bg-white px-5 py-3 rounded-lg shadow-md">
          <span className="text-gray-500 text-sm">Best</span>
          <p className="text-2xl font-bold text-amber-600" data-testid="high-score-display">
            {displayHighScore}
          </p>
        </div>
      </div>

      <div className="mt-3 text-gray-600 text-sm">
        {gameStarted && !gameOver && (
          <p className="text-center">
            <span className="font-semibold" style={{ color: currentTheme.obstacleColor }}>
              {currentTheme.name}
            </span>
            {' \u2014 '}
            Next level at {displayLevel < LEVEL_THEMES.length ? displayLevel * POINTS_PER_LEVEL : 'MAX'} pts
          </p>
        )}
      </div>

      <div className="mt-2 text-gray-600 text-sm">
        {!gameStarted && <p>Press <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">Space</kbd> or tap to start</p>}
        {gameStarted && !gameOver && <p>Press <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">Space</kbd> / <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">Up Arrow</kbd> or tap to jump</p>}
        {gameOver && <p>Press <kbd className="px-2 py-1 bg-gray-200 rounded text-xs font-mono">Space</kbd> or tap to restart</p>}
      </div>
    </div>
  );
}

export default App;
