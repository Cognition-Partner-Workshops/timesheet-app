import * as THREE from 'three';
import { World } from './world.ts';
import { buildChunkMesh } from './meshBuilder.ts';
import {
  BlockType,
  CHUNK_SIZE,
  RENDER_DISTANCE,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_SPRINT_SPEED,
  JUMP_FORCE,
  GRAVITY,
  PLACEABLE_BLOCKS,
  SEA_LEVEL,
} from './types.ts';

export class MinecraftEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: World;
  private chunkMeshes: Map<string, THREE.Object3D> = new Map();

  // Player state
  private playerPos: THREE.Vector3;
  private playerVelocity: THREE.Vector3 = new THREE.Vector3();
  private yaw: number = 0;
  private pitch: number = 0;
  private isOnGround: boolean = false;
  private isSprinting: boolean = false;

  // Controls
  private keys: Set<string> = new Set();
  private isPointerLocked: boolean = false;

  // Block interaction
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private highlightMesh: THREE.Mesh;
  private selectedBlockIndex: number = 0;

  // Crosshair
  private crosshairGroup: THREE.Group;

  // Stats
  private frameCount: number = 0;
  private lastFpsTime: number = 0;
  private currentFps: number = 0;

  // Callbacks
  onStatsUpdate: ((fps: number, pos: THREE.Vector3, selectedBlock: BlockType) => void) | null = null;
  onInventoryUpdate: ((selectedIndex: number) => void) | null = null;

  private container: HTMLElement;
  private animationFrameId: number = 0;
  private isRunning: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.world = new World(Math.floor(Math.random() * 100000));

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87ceeb); // Sky blue
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 40, RENDER_DISTANCE * CHUNK_SIZE * 0.9);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      RENDER_DISTANCE * CHUNK_SIZE * 1.5
    );

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x606060, 1.2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(50, 100, 30);
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.4);
    this.scene.add(hemisphereLight);

    // Block highlight
    const highlightGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    this.highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Crosshair
    this.crosshairGroup = this.createCrosshair();
    this.scene.add(this.crosshairGroup);

    // Spawn player
    this.playerPos = new THREE.Vector3(8, 0, 8);
    // Generate initial chunks first, then find spawn height
    this.generateChunksAround(0, 0);
    const spawnHeight = this.world.getHeightAt(8, 8) + 2;
    this.playerPos.y = Math.max(spawnHeight, SEA_LEVEL + 2);

    // Event listeners
    this.setupEventListeners();

    // Set raycaster distance
    this.raycaster.far = 6;
  }

  private createCrosshair(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });

    const hGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.01, 0, -0.5),
      new THREE.Vector3(0.01, 0, -0.5),
    ]);
    const vGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.01, -0.5),
      new THREE.Vector3(0, 0.01, -0.5),
    ]);

    group.add(new THREE.Line(hGeo, material));
    group.add(new THREE.Line(vGeo, material));
    group.renderOrder = 999;
    return group;
  }

  private setupEventListeners(): void {
    // Pointer lock
    this.renderer.domElement.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        this.renderer.domElement.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    });

    // Mouse
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));

    // Keyboard
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Resize
    window.addEventListener('resize', () => this.onResize());

    // Scroll for inventory
    document.addEventListener('wheel', (e) => this.onWheel(e));
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isPointerLocked) return;

    const sensitivity = 0.002;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.isPointerLocked) return;

    const hit = this.raycast();
    if (!hit) return;

    if (e.button === 0) {
      // Left click: destroy block
      this.world.setBlock(hit.blockX, hit.blockY, hit.blockZ, BlockType.AIR);
    } else if (e.button === 2) {
      // Right click: place block
      const px = hit.blockX + hit.normalX;
      const py = hit.blockY + hit.normalY;
      const pz = hit.blockZ + hit.normalZ;

      // Don't place block inside player
      const playerMinX = this.playerPos.x - 0.3;
      const playerMaxX = this.playerPos.x + 0.3;
      const playerMinY = this.playerPos.y - PLAYER_HEIGHT;
      const playerMaxY = this.playerPos.y;
      const playerMinZ = this.playerPos.z - 0.3;
      const playerMaxZ = this.playerPos.z + 0.3;

      if (
        px + 1 > playerMinX && px < playerMaxX &&
        py + 1 > playerMinY && py < playerMaxY &&
        pz + 1 > playerMinZ && pz < playerMaxZ
      ) {
        return;
      }

      const selectedBlock = PLACEABLE_BLOCKS[this.selectedBlockIndex];
      this.world.setBlock(px, py, pz, selectedBlock);
    }

    // Update dirty chunks
    this.updateDirtyChunks();
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);

    // Number keys for inventory
    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
      const idx = parseInt(e.code.charAt(5)) - 1;
      if (idx < PLACEABLE_BLOCKS.length) {
        this.selectedBlockIndex = idx;
        this.onInventoryUpdate?.(this.selectedBlockIndex);
      }
    }

    if (e.code === 'ShiftLeft') {
      this.isSprinting = true;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
    if (e.code === 'ShiftLeft') {
      this.isSprinting = false;
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.isPointerLocked) return;
    if (e.deltaY > 0) {
      this.selectedBlockIndex = (this.selectedBlockIndex + 1) % PLACEABLE_BLOCKS.length;
    } else {
      this.selectedBlockIndex = (this.selectedBlockIndex - 1 + PLACEABLE_BLOCKS.length) % PLACEABLE_BLOCKS.length;
    }
    this.onInventoryUpdate?.(this.selectedBlockIndex);
  }

  private onResize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private raycast(): { blockX: number; blockY: number; blockZ: number; normalX: number; normalY: number; normalZ: number } | null {
    // Cast ray from camera center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const origin = this.raycaster.ray.origin;
    const direction = this.raycaster.ray.direction;

    // DDA ray marching through voxel grid
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = direction.x >= 0 ? 1 : -1;
    const stepY = direction.y >= 0 ? 1 : -1;
    const stepZ = direction.z >= 0 ? 1 : -1;

    const tDeltaX = direction.x !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = direction.y !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = direction.z !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = direction.x !== 0
      ? ((direction.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX)
      : Infinity;
    let tMaxY = direction.y !== 0
      ? ((direction.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY)
      : Infinity;
    let tMaxZ = direction.z !== 0
      ? ((direction.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ)
      : Infinity;

    let normalX = 0, normalY = 0, normalZ = 0;

    for (let i = 0; i < 60; i++) {
      const block = this.world.getBlock(x, y, z);
      if (block !== BlockType.AIR && block !== BlockType.WATER) {
        return { blockX: x, blockY: y, blockZ: z, normalX, normalY, normalZ };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          tMaxX += tDeltaX;
          normalX = -stepX; normalY = 0; normalZ = 0;
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          normalX = 0; normalY = 0; normalZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          tMaxY += tDeltaY;
          normalX = 0; normalY = -stepY; normalZ = 0;
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          normalX = 0; normalY = 0; normalZ = -stepZ;
        }
      }

      // Distance check
      const dx = x - origin.x;
      const dy = y - origin.y;
      const dz = z - origin.z;
      if (dx * dx + dy * dy + dz * dz > 64) break; // 8 block distance
    }

    return null;
  }

  private updatePlayer(dt: number): void {
    // Movement direction
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();

    const right = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw)
    ).normalize();

    const moveDir = new THREE.Vector3();

    if (this.keys.has('KeyW')) moveDir.add(forward);
    if (this.keys.has('KeyS')) moveDir.sub(forward);
    if (this.keys.has('KeyA')) moveDir.sub(right);
    if (this.keys.has('KeyD')) moveDir.add(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    const speed = this.isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;
    this.playerVelocity.x = moveDir.x * speed;
    this.playerVelocity.z = moveDir.z * speed;

    // Gravity
    if (!this.isOnGround) {
      this.playerVelocity.y -= GRAVITY * dt;
    }

    // Jump
    if (this.keys.has('Space') && this.isOnGround) {
      this.playerVelocity.y = JUMP_FORCE;
      this.isOnGround = false;
    }

    // Apply velocity with collision
    this.moveWithCollision(dt);
  }

  private moveWithCollision(dt: number): void {
    const playerRadius = 0.3;
    const pos = this.playerPos;

    // Move X
    const newX = pos.x + this.playerVelocity.x * dt;
    if (!this.checkCollision(newX, pos.y, pos.z, playerRadius)) {
      pos.x = newX;
    } else {
      this.playerVelocity.x = 0;
    }

    // Move Z
    const newZ = pos.z + this.playerVelocity.z * dt;
    if (!this.checkCollision(pos.x, pos.y, newZ, playerRadius)) {
      pos.z = newZ;
    } else {
      this.playerVelocity.z = 0;
    }

    // Move Y
    const newY = pos.y + this.playerVelocity.y * dt;
    if (!this.checkCollision(pos.x, newY, pos.z, playerRadius)) {
      pos.y = newY;
      this.isOnGround = false;
    } else {
      if (this.playerVelocity.y < 0) {
        this.isOnGround = true;
      }
      this.playerVelocity.y = 0;
    }

    // Prevent falling into void
    if (pos.y < 0) {
      pos.y = 40;
      this.playerVelocity.set(0, 0, 0);
    }
  }

  private checkCollision(x: number, y: number, z: number, radius: number): boolean {
    // Check blocks around player (player eyes at y, feet at y - PLAYER_HEIGHT)
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - PLAYER_HEIGHT);
    const maxY = Math.floor(y + 0.1);
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius);

    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const block = this.world.getBlock(bx, by, bz);
          if (block !== BlockType.AIR && block !== BlockType.WATER) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private generateChunksAround(playerChunkX: number, playerChunkZ: number): void {
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = playerChunkX + dx;
        const cz = playerChunkZ + dz;
        this.world.getOrCreateChunk(cx, cz);
      }
    }
  }

  private updateChunks(): void {
    const playerChunkX = Math.floor(this.playerPos.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(this.playerPos.z / CHUNK_SIZE);

    // Generate chunks in range
    this.generateChunksAround(playerChunkX, playerChunkZ);

    // Build/update meshes
    for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
      for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
        const cx = playerChunkX + dx;
        const cz = playerChunkZ + dz;
        const key = `${cx},${cz}`;
        const chunk = this.world.getChunk(cx, cz);

        if (chunk && chunk.isDirty) {
          // Remove old mesh
          const oldMesh = this.chunkMeshes.get(key);
          if (oldMesh) {
            this.scene.remove(oldMesh);
            oldMesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                  child.material.forEach(m => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
          }

          // Build new mesh
          const mesh = buildChunkMesh(chunk, this.world);
          if (mesh) {
            this.scene.add(mesh);
            this.chunkMeshes.set(key, mesh);
          }
          chunk.isDirty = false;
        }
      }
    }

    // Remove chunks that are too far
    const keysToRemove: string[] = [];
    for (const [key, mesh] of this.chunkMeshes) {
      const parts = key.split(',');
      const cx = parseInt(parts[0]);
      const cz = parseInt(parts[1]);
      if (
        Math.abs(cx - playerChunkX) > RENDER_DISTANCE + 1 ||
        Math.abs(cz - playerChunkZ) > RENDER_DISTANCE + 1
      ) {
        this.scene.remove(mesh);
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => this.chunkMeshes.delete(k));
  }

  private updateDirtyChunks(): void {
    for (const [key, chunk] of this.world.chunks) {
      if (chunk.isDirty) {
        const meshKey = key;
        const oldMesh = this.chunkMeshes.get(meshKey);
        if (oldMesh) {
          this.scene.remove(oldMesh);
          oldMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }

        const mesh = buildChunkMesh(chunk, this.world);
        if (mesh) {
          this.scene.add(mesh);
          this.chunkMeshes.set(meshKey, mesh);
        }
        chunk.isDirty = false;
      }
    }
  }

  private updateHighlight(): void {
    if (!this.isPointerLocked) {
      this.highlightMesh.visible = false;
      return;
    }

    const hit = this.raycast();
    if (hit) {
      this.highlightMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
      this.highlightMesh.visible = true;
    } else {
      this.highlightMesh.visible = false;
    }
  }

  start(): void {
    this.isRunning = true;
    this.lastFpsTime = performance.now();

    // Prevent context menu
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    let lastTime = performance.now();

    const gameLoop = () => {
      if (!this.isRunning) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap at 100ms
      lastTime = now;

      // FPS counter
      this.frameCount++;
      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsTime = now;
      }

      // Update
      this.updatePlayer(dt);
      this.updateChunks();
      this.updateHighlight();

      // Camera
      this.camera.position.copy(this.playerPos);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;

      // Crosshair follows camera
      this.crosshairGroup.position.copy(this.camera.position);
      this.crosshairGroup.rotation.copy(this.camera.rotation);

      // Callback
      this.onStatsUpdate?.(this.currentFps, this.playerPos, PLACEABLE_BLOCKS[this.selectedBlockIndex]);

      // Render
      this.renderer.render(this.scene, this.camera);

      this.animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  dispose(): void {
    this.stop();

    // Remove event listeners
    document.exitPointerLock();

    // Dispose all meshes
    for (const [, mesh] of this.chunkMeshes) {
      this.scene.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this.chunkMeshes.clear();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  getSelectedBlockIndex(): number {
    return this.selectedBlockIndex;
  }
}
