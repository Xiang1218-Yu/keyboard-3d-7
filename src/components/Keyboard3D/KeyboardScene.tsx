import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Lights } from './Lights';
import { KeyboardCase } from './KeyboardCase';
import { KeyCap } from './KeyCap';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { useActiveLayout } from '@/hooks/useActiveLayout';
import { KeyZone } from '@/types/keyboard';
import * as THREE from 'three';

interface KeyboardContentProps {
  selectedZone: KeyZone | null;
}

function KeyboardContent({ selectedZone }: KeyboardContentProps) {
  const activeLayout = useActiveLayout();
  const editMode = useKeyboardStore((state) => state.editMode);
  const gridSize = useKeyboardStore((state) => state.gridSize);
  const alignGuides = useKeyboardStore((state) => state.alignGuides);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    }
  });

  const keys = useMemo(() => {
    return activeLayout.keys.map((keyConfig) => (
      <KeyCap
        key={keyConfig.id}
        keyConfig={keyConfig}
        selectedZone={selectedZone}
      />
    ));
  }, [activeLayout.keys, selectedZone]);

  return (
    <group ref={groupRef}>
      <KeyboardCase />
      <group position={[-activeLayout.width / 2, 0.35, -activeLayout.height / 2]}>
        {keys}

        {editMode && (
          <Grid
            position={[activeLayout.width / 2, -0.14, activeLayout.height / 2]}
            args={[activeLayout.width, activeLayout.height]}
            cellSize={gridSize}
            cellThickness={0.6}
            cellColor="#334155"
            sectionSize={gridSize * 4}
            sectionThickness={1}
            sectionColor="#6366f1"
            fadeDistance={45}
            fadeStrength={1}
          />
        )}

        {editMode &&
          alignGuides.vertical.map((x) => (
            <Line
              key={`guide-v-${x}`}
              points={[
                [x, 0.4, -0.4],
                [x, 0.4, activeLayout.height + 0.4],
              ]}
              color="#22d3ee"
              lineWidth={1.5}
              dashed
              dashSize={0.18}
              gapSize={0.1}
            />
          ))}
        {editMode &&
          alignGuides.horizontal.map((z) => (
            <Line
              key={`guide-h-${z}`}
              points={[
                [-0.4, 0.4, z],
                [activeLayout.width + 0.4, 0.4, z],
              ]}
              color="#22d3ee"
              lineWidth={1.5}
              dashed
              dashSize={0.18}
              gapSize={0.1}
            />
          ))}
      </group>
    </group>
  );
}

interface KeyboardSceneProps {
  selectedZone: KeyZone | null;
}

export function KeyboardScene({ selectedZone }: KeyboardSceneProps) {
  const isKeyDragging = useKeyboardStore((state) => state.isKeyDragging);
  const selectKey = useKeyboardStore((state) => state.selectKey);
  // 记录按下位置，区分「点击空白处取消选中」和「旋转视角后松手」
  const downPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className="h-full w-full"
      onPointerDownCapture={(e) => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 18, 22], fov: 45 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
        onPointerMissed={(e) => {
          if (!useKeyboardStore.getState().editMode) return;
          const moved = downPos.current
            ? Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y)
            : 0;
          if (moved <= 6) selectKey(null);
        }}
      >
        <color attach="background" args={['#0a0a0f']} />
        <fog attach="fog" args={['#0a0a0f', 15, 35]} />

        <Lights />
        <KeyboardContent selectedZone={selectedZone} />

        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={12}
          maxDistance={50}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 8}
          enablePan={true}
          target={[0, 0, 0]}
          enabled={!isKeyDragging}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            height={300}
            intensity={0.5}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
