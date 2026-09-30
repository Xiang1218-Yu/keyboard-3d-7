import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { KeyConfig } from '@/types/keyboard';
import { useKeyboardStore, useIsKeyPressed } from '@/store/useKeyboardStore';
import { useZoneColors } from '@/store/useKeyboardStore';
import { useLayoutEditorStore } from '@/store/useLayoutEditorStore';
import { BOARD_Y, ResizeHandle } from '@/lib/layoutMath';

interface KeyCapProps {
  keyConfig: KeyConfig;
  selectedZone?: string | null;
  editMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const RESIZE_HANDLES: { handle: ResizeHandle; cursor: string; pos: (w: number, d: number) => [number, number] }[] = [
  { handle: 'nw', cursor: 'nwse-resize', pos: (w, d) => [-w / 2, -d / 2] },
  { handle: 'ne', cursor: 'nesw-resize', pos: (w, d) => [w / 2, -d / 2] },
  { handle: 'sw', cursor: 'nesw-resize', pos: (w, d) => [-w / 2, d / 2] },
  { handle: 'se', cursor: 'nwse-resize', pos: (w, d) => [w / 2, d / 2] },
];

export function KeyCap({ keyConfig, selectedZone, editMode = false, selected = false, onSelect }: KeyCapProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const isPressed = useIsKeyPressed(keyConfig.id);
  const zoneColors = useZoneColors();
  const pressKey = useKeyboardStore((state) => state.pressKey);
  const releaseKey = useKeyboardStore((state) => state.releaseKey);

  const beginInteraction = useLayoutEditorStore((s) => s.beginInteraction);
  const endInteraction = useLayoutEditorStore((s) => s.endInteraction);
  const updateDraftKeyPosition = useLayoutEditorStore((s) => s.updateDraftKeyPosition);
  const resizeDraftKey = useLayoutEditorStore((s) => s.resizeDraftKey);

  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_Y),
    []
  );

  const color = zoneColors[keyConfig.zone];
  const isZoneSelected = selectedZone === keyConfig.zone;

  const pressDepth = useMemo(() => (isPressed ? -0.15 : 0), [isPressed]);
  const targetScale = useMemo(() => (isPressed ? 0.98 : 1), [isPressed]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        pressDepth,
        delta * 15
      );
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        targetScale,
        delta * 12
      );
      meshRef.current.scale.x = THREE.MathUtils.lerp(
        meshRef.current.scale.x,
        targetScale,
        delta * 12
      );
      meshRef.current.scale.z = THREE.MathUtils.lerp(
        meshRef.current.scale.z,
        targetScale,
        delta * 12
      );
    }
  });

  // 拖动/缩放状态（用 ref 保存，避免闭包读到旧值）
  const dragState = useRef<{
    kind: 'move' | 'resize';
    handle?: ResizeHandle;
    startPointer: THREE.Vector2;
    startKey: KeyConfig;
  } | null>(null);

  const hitPlane = useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const point = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, point)) return point;
      return null;
    },
    [camera, gl, raycaster, dragPlane]
  );

  useEffect(() => {
    if (!dragState.current) return;

    const handleMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;
      const point = hitPlane(e.clientX, e.clientY);
      if (!point) return;

      const draft = useLayoutEditorStore.getState().draft;
      if (!draft) return;

      if (state.kind === 'move') {
        // 世界坐标 -> 棋盘局部坐标（键位组在 [-w/2, -h/2]）
        const localX = point.x + draft.width / 2;
        const localZ = point.z + draft.height / 2;
        updateDraftKeyPosition(keyConfig.id, localX, localZ, e.shiftKey);
      } else if (state.handle) {
        const dx = point.x - state.startPointer.x;
        const dz = point.z - state.startPointer.y;
        resizeDraftKey(keyConfig.id, state.startKey, state.handle, dx, dz);
      }
    };

    const handleUp = () => {
      dragState.current = null;
      endInteraction();
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [hitPlane, keyConfig.id, updateDraftKeyPosition, resizeDraftKey, endInteraction]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (editMode) {
      // 编辑模式：选中并开始拖动，不触发按动
      onSelect?.(keyConfig.id);
      const point = hitPlane(e.nativeEvent.clientX, e.nativeEvent.clientY);
      if (!point) return;
      dragState.current = {
        kind: 'move',
        startPointer: new THREE.Vector2(point.x, point.z),
        startKey: { ...keyConfig },
      };
      beginInteraction();
      document.body.style.cursor = 'grabbing';
    } else {
      pressKey(keyConfig.id);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!editMode) {
      releaseKey(keyConfig.id);
    }
  };

  const handlePointerOut = () => {
    setHovered(false);
    if (isPressed) {
      releaseKey(keyConfig.id);
    }
  };

  const startResize = (e: ThreeEvent<PointerEvent>, handle: ResizeHandle) => {
    e.stopPropagation();
    const point = hitPlane(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (!point) return;
    dragState.current = {
      kind: 'resize',
      handle,
      startPointer: new THREE.Vector2(point.x, point.z),
      startKey: { ...keyConfig },
    };
    beginInteraction();
    document.body.style.cursor =
      RESIZE_HANDLES.find((h) => h.handle === handle)?.cursor ?? 'nwse-resize';
  };

  const emissiveIntensity = editMode
    ? selected
      ? 0.55
      : hovered
        ? 0.35
        : 0.12
    : hovered || isZoneSelected
      ? 0.3
      : isPressed
        ? 0.5
        : 0.1;
  const emissiveColor = editMode
    ? selected
      ? '#f59e0b'
      : hovered
        ? '#6366f1'
        : '#000000'
    : isPressed
      ? '#ffffff'
      : hovered
        ? '#6366f1'
        : isZoneSelected
          ? '#8b5cf6'
          : '#000000';

  const fontSize = keyConfig.width > 1.5 ? 0.28 : keyConfig.width > 1 ? 0.32 : 0.38;

  return (
    <group position={[keyConfig.x + keyConfig.width / 2, 0, keyConfig.y + keyConfig.height / 2]}>
      <RoundedBox
        ref={meshRef}
        args={[keyConfig.width * 0.92, 0.4, keyConfig.height * 0.92]}
        radius={0.08}
        smoothness={4}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerOut}
        onPointerOver={() => {
          setHovered(true);
          if (editMode && !dragState.current) {
            document.body.style.cursor = 'grab';
          }
        }}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.1}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      <Text
        position={[0, 0.21, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={fontSize}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
        fontWeight={600}
      >
        {keyConfig.label}
      </Text>

      {editMode &&
        selected &&
        RESIZE_HANDLES.map((h) => {
          const [hx, hz] = h.pos(keyConfig.width, keyConfig.height);
          return (
            <mesh
              key={h.handle}
              position={[hx, 0.28, hz]}
              onPointerDown={(e) => startResize(e, h.handle)}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = h.cursor;
              }}
              onPointerOut={() => {
                if (!dragState.current) document.body.style.cursor = '';
              }}
            >
              <boxGeometry args={[0.24, 0.24, 0.24]} />
              <meshStandardMaterial
                color="#f59e0b"
                emissive="#f59e0b"
                emissiveIntensity={0.7}
                toneMapped={false}
              />
            </mesh>
          );
        })}
    </group>
  );
}
