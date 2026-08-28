import * as THREE from 'three';
import type { Chunk } from './world.ts';
import type { World } from './world.ts';
import { BlockType, BLOCK_COLORS, CHUNK_SIZE, WORLD_HEIGHT } from './types.ts';

// Face directions: +x, -x, +y, -y, +z, -z
const FACES = [
  { dir: [1, 0, 0], corners: [[1,0,1],[1,0,0],[1,1,1],[1,1,0]], normal: [1,0,0] },   // right
  { dir: [-1, 0, 0], corners: [[0,0,0],[0,0,1],[0,1,0],[0,1,1]], normal: [-1,0,0] },  // left
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]], normal: [0,1,0] },    // top
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[0,0,1],[1,0,1]], normal: [0,-1,0] },  // bottom
  { dir: [0, 0, 1], corners: [[0,0,1],[1,0,1],[0,1,1],[1,1,1]], normal: [0,0,1] },    // front
  { dir: [0, 0, -1], corners: [[1,0,0],[0,0,0],[1,1,0],[0,1,0]], normal: [0,0,-1] },  // back
];

function isTransparent(blockType: BlockType): boolean {
  return blockType === BlockType.AIR || blockType === BlockType.WATER;
}

function getBlockColor(blockType: BlockType, faceIdx: number): THREE.Color {
  const colors = BLOCK_COLORS[blockType];
  let hex: number;
  if (faceIdx === 2) hex = colors.top;       // +y = top
  else if (faceIdx === 3) hex = colors.bottom; // -y = bottom
  else hex = colors.side;
  return new THREE.Color(hex);
}

export function buildChunkMesh(chunk: Chunk, world: World): THREE.Mesh | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const waterPositions: number[] = [];
  const waterNormals: number[] = [];
  const waterColors: number[] = [];
  const waterIndices: number[] = [];

  const worldX = chunk.x * CHUNK_SIZE;
  const worldZ = chunk.z * CHUNK_SIZE;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const blockType = chunk.getBlock(x, y, z);
        if (blockType === BlockType.AIR) continue;

        const isWater = blockType === BlockType.WATER;

        for (let faceIdx = 0; faceIdx < FACES.length; faceIdx++) {
          const face = FACES[faceIdx];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];

          // Get neighbor block type
          let neighborType: BlockType;
          if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < WORLD_HEIGHT && nz >= 0 && nz < CHUNK_SIZE) {
            neighborType = chunk.getBlock(nx, ny, nz);
          } else {
            // Check across chunk boundary
            const gwx = worldX + nx;
            const gwz = worldZ + nz;
            neighborType = world.getBlock(gwx, ny, gwz);
          }

          // Only render face if neighbor is transparent (and different for water)
          if (isWater) {
            if (neighborType !== BlockType.AIR) continue;
          } else {
            if (!isTransparent(neighborType)) continue;
          }

          const targetPositions = isWater ? waterPositions : positions;
          const targetNormals = isWater ? waterNormals : normals;
          const targetColors = isWater ? waterColors : colors;
          const targetIndices = isWater ? waterIndices : indices;

          const baseVertex = targetPositions.length / 3;

          const color = getBlockColor(blockType, faceIdx);

          // Add simple ambient occlusion shading
          for (let i = 0; i < 4; i++) {
            const corner = face.corners[i];
            targetPositions.push(
              worldX + x + corner[0],
              y + corner[1],
              worldZ + z + corner[2]
            );
            targetNormals.push(face.normal[0], face.normal[1], face.normal[2]);

            // Slight variation for visual interest
            const shade = 0.85 + Math.random() * 0.15;
            targetColors.push(color.r * shade, color.g * shade, color.b * shade);
          }

          // Two triangles per face
          targetIndices.push(
            baseVertex, baseVertex + 1, baseVertex + 2,
            baseVertex + 2, baseVertex + 1, baseVertex + 3
          );
        }
      }
    }
  }

  const group = new THREE.Group();

  // Solid mesh
  if (positions.length > 0) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
  }

  // Water mesh (transparent)
  if (waterPositions.length > 0) {
    const waterGeometry = new THREE.BufferGeometry();
    waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
    waterGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
    waterGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));
    waterGeometry.setIndex(waterIndices);

    const waterMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    group.add(waterMesh);
  }

  if (group.children.length === 0) return null;

  // Return as a single mesh-like object (actually a group)
  return group as unknown as THREE.Mesh;
}
