import React, { useEffect, useRef, useState, useCallback } from 'react';
import type * as THREE from 'three';
import { MinecraftEngine } from './engine.ts';
import { BlockType, BLOCK_COLORS, BLOCK_NAMES, PLACEABLE_BLOCKS } from './types.ts';

const MinecraftPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MinecraftEngine | null>(null);
  const [fps, setFps] = useState(0);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
  const [selectedBlock, setSelectedBlock] = useState<BlockType>(PLACEABLE_BLOCKS[0]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(true);

  const handleStatsUpdate = useCallback((newFps: number, pos: THREE.Vector3, block: BlockType) => {
    setFps(newFps);
    setPlayerPos({ x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) });
    setSelectedBlock(block);
  }, []);

  const handleInventoryUpdate = useCallback((index: number) => {
    setSelectedIndex(index);
    setSelectedBlock(PLACEABLE_BLOCKS[index]);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new MinecraftEngine(containerRef.current);
    engineRef.current = engine;

    engine.onStatsUpdate = handleStatsUpdate;
    engine.onInventoryUpdate = handleInventoryUpdate;
    engine.start();

    // Auto-hide help after 8 seconds
    const helpTimer = setTimeout(() => setShowHelp(false), 8000);

    return () => {
      clearTimeout(helpTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleStatsUpdate, handleInventoryUpdate]);

  const colorToHex = (color: number): string => {
    return '#' + color.toString(16).padStart(6, '0');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Game canvas container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* HUD Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        fontFamily: '"Courier New", monospace',
      }}>
        {/* Crosshair */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '24px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          userSelect: 'none',
        }}>
          +
        </div>

        {/* Debug info */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          color: 'white',
          fontSize: '14px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          lineHeight: '1.6',
        }}>
          <div>Minecraft Clone</div>
          <div>FPS: {fps}</div>
          <div>XYZ: {playerPos.x} / {playerPos.y} / {playerPos.z}</div>
        </div>

        {/* Hotbar */}
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '2px',
          padding: '4px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '4px',
        }}>
          {PLACEABLE_BLOCKS.map((block, index) => (
            <div
              key={block}
              style={{
                width: 48,
                height: 48,
                border: index === selectedIndex ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: index === selectedIndex ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)',
                position: 'relative',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '3px',
                background: colorToHex(BLOCK_COLORS[block].top),
                border: `2px solid ${colorToHex(BLOCK_COLORS[block].side)}`,
              }} />
              <div style={{
                position: 'absolute',
                top: 2,
                left: 4,
                fontSize: '10px',
                color: 'rgba(255,255,255,0.7)',
              }}>
                {index + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Selected block name */}
        <div style={{
          position: 'absolute',
          bottom: 76,
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          fontSize: '14px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        }}>
          {BLOCK_NAMES[selectedBlock]}
        </div>

        {/* Help overlay */}
        {showHelp && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.75)',
            color: 'white',
            padding: '30px',
            borderRadius: '10px',
            fontSize: '15px',
            lineHeight: '2',
            textAlign: 'left',
            pointerEvents: 'auto',
            maxWidth: '400px',
          }}>
            <h2 style={{ margin: '0 0 15px', textAlign: 'center', fontSize: '22px' }}>
              Minecraft Clone
            </h2>
            <div><b>Click</b> to start playing</div>
            <div><b>WASD</b> - Move</div>
            <div><b>Mouse</b> - Look around</div>
            <div><b>Left Click</b> - Break block</div>
            <div><b>Right Click</b> - Place block</div>
            <div><b>Space</b> - Jump</div>
            <div><b>Shift</b> - Sprint</div>
            <div><b>1-9</b> or <b>Scroll</b> - Select block</div>
            <div><b>ESC</b> - Release mouse</div>
            <div style={{ marginTop: '15px', fontSize: '12px', opacity: 0.7, textAlign: 'center' }}>
              This help disappears in a few seconds
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MinecraftPage;
