import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { RoundedBox, Text, Edges, useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { KeyConfig } from '@/types/keyboard';
import { useKeyboardStore, useIsKeyPressed } from '@/store/useKeyboardStore';
import { useZoneColors } from '@/store/useKeyboardStore';
import { computeAlignment, snapValue, round3, MIN_KEY_SIZE } from '@/lib/layoutUtils';

interface KeyCapProps {
  keyConfig: KeyConfig;
  selectedZone?: string | null;
}

interface DragSession {
  mode: 'move' | 'resize';
  /** 拖拽所在水平面的世界高度 */
  planeY: number;
  /** 按下时指针在该平面上的世界坐标 */
  startX: number;
  startZ: number;
  /** 按下时键位的几何 */
  rect: { x: number; y: number; w: number; h: number };
}

const EMPTY_GUIDES = { vertical: [] as number[], horizontal: [] as number[] };

/** 射线与水平面求交（世界坐标）。键位组在 X/Z 上无父级变换，世界位移即布局局部位移 */
const intersectPlane = (ray: THREE.Ray, planeY: number) => {
  const t = (planeY - ray.origin.y) / ray.direction.y;
  return {
    x: ray.origin.x + ray.direction.x * t,
    z: ray.origin.z + ray.direction.z * t,
  };
};

export function KeyCap({ keyConfig, selectedZone }: KeyCapProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const isPressed = useIsKeyPressed(keyConfig.id);
  const zoneColors = useZoneColors();
  const pressKey = useKeyboardStore((state) => state.pressKey);
  const releaseKey = useKeyboardStore((state) => state.releaseKey);
  const editMode = useKeyboardStore((state) => state.editMode);
  const isSelected = useKeyboardStore((state) => state.selectedKeyId === keyConfig.id);

  const dragRef = useRef<DragSession | null>(null);
  const guidesCache = useRef('');

  // 组件卸载（如切换布局）时若仍在拖拽，恢复 OrbitControls
  useEffect(() => {
    return () => {
      if (dragRef.current) {
        dragRef.current = null;
        const store = useKeyboardStore.getState();
        store.setKeyDragging(false);
        store.setAlignGuides({ vertical: [], horizontal: [] });
      }
    };
  }, []);

  const color = zoneColors[keyConfig.zone];
  const isZoneSelected = selectedZone === keyConfig.zone;

  useCursor(editMode && (hovered || handleHovered), handleHovered ? 'nwse-resize' : 'move');

  // 编辑模式下禁用按压动画
  const pressDepth = useMemo(() => (!editMode && isPressed ? -0.15 : 0), [isPressed, editMode]);
  const targetScale = useMemo(() => (!editMode && isPressed ? 0.98 : 1), [isPressed, editMode]);

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

  const beginDrag = (e: ThreeEvent<PointerEvent>, mode: DragSession['mode']) => {
    const store = useKeyboardStore.getState();
    store.selectKey(keyConfig.id);
    // 拖动期间禁用 OrbitControls，避免误触旋转/平移
    store.setKeyDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = intersectPlane(e.ray, e.point.y);
    dragRef.current = {
      mode,
      planeY: e.point.y,
      startX: p.x,
      startZ: p.z,
      rect: { x: keyConfig.x, y: keyConfig.y, w: keyConfig.width, h: keyConfig.height },
    };
  };

  const endDrag = (e?: ThreeEvent<PointerEvent>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    guidesCache.current = '';
    const store = useKeyboardStore.getState();
    store.setKeyDragging(false);
    store.setAlignGuides(EMPTY_GUIDES);
    if (e) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* 指针可能已释放 */
      }
    }
  };

  const pushGuides = (guides: { vertical: number[]; horizontal: number[] }) => {
    const signature = `${guides.vertical.join(',')}|${guides.horizontal.join(',')}`;
    if (signature !== guidesCache.current) {
      guidesCache.current = signature;
      useKeyboardStore.getState().setAlignGuides(guides);
    }
  };

  const handleEditDrag = (e: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const store = useKeyboardStore.getState();
    if (!store.editingKeys) return;

    const p = intersectPlane(e.ray, drag.planeY);
    const dx = p.x - drag.startX;
    const dz = p.z - drag.startZ;
    const { gridSnap, gridSize } = store;
    // 按住 Shift：吸附到其他键位的边缘/中心并显示参考线
    const align = e.shiftKey;

    if (drag.mode === 'move') {
      let nx = drag.rect.x + dx;
      let ny = drag.rect.y + dz;
      if (gridSnap) {
        nx = snapValue(nx, gridSize);
        ny = snapValue(ny, gridSize);
      }
      if (align) {
        const result = computeAlignment(store.editingKeys, keyConfig.id, {
          x: nx,
          y: ny,
          w: drag.rect.w,
          h: drag.rect.h,
        });
        nx += result.dx;
        ny += result.dz;
        pushGuides({ vertical: result.vertical, horizontal: result.horizontal });
      } else {
        pushGuides(EMPTY_GUIDES);
      }
      // 重叠/越界校验在 store 内完成，非法位置会被拒绝
      store.updateEditingKey(keyConfig.id, { x: nx, y: ny });
    } else {
      let nw = Math.max(MIN_KEY_SIZE, drag.rect.w + dx);
      let nh = Math.max(MIN_KEY_SIZE, drag.rect.h + dz);
      if (gridSnap) {
        nw = Math.max(MIN_KEY_SIZE, snapValue(nw, gridSize));
        nh = Math.max(MIN_KEY_SIZE, snapValue(nh, gridSize));
      }
      if (align) {
        const result = computeAlignment(store.editingKeys, keyConfig.id, {
          x: drag.rect.x,
          y: drag.rect.y,
          w: nw,
          h: nh,
        });
        nw += result.dx;
        nh += result.dz;
        pushGuides({ vertical: result.vertical, horizontal: result.horizontal });
      } else {
        pushGuides(EMPTY_GUIDES);
      }
      store.updateEditingKey(keyConfig.id, {
        width: round3(Math.max(MIN_KEY_SIZE, nw)),
        height: round3(Math.max(MIN_KEY_SIZE, nh)),
      });
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (editMode) {
      beginDrag(e, 'move');
      return;
    }
    pressKey(keyConfig.id);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!editMode || !dragRef.current) return;
    e.stopPropagation();
    handleEditDrag(e);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (editMode) {
      endDrag(e);
      return;
    }
    releaseKey(keyConfig.id);
  };

  const handlePointerOut = () => {
    setHovered(false);
    // 拖动中依靠 pointer capture 持续接收事件，滑出键帽不中断拖拽
    if (!editMode && isPressed) {
      releaseKey(keyConfig.id);
    }
  };

  const emissiveIntensity =
    isSelected && editMode ? 0.45 : hovered || isZoneSelected ? 0.3 : isPressed ? 0.5 : 0.1;
  const emissiveColor =
    isSelected && editMode
      ? '#6366f1'
      : isPressed
        ? '#ffffff'
        : hovered
          ? '#6366f1'
          : isZoneSelected
            ? '#8b5cf6'
            : '#000000';

  const fontSize = keyConfig.width > 1.5 ? 0.28 : keyConfig.width > 1 ? 0.32 : 0.38;

  return (
    <group
      position={[keyConfig.x + keyConfig.width / 2, 0, keyConfig.y + keyConfig.height / 2]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => endDrag()}
      onPointerOut={handlePointerOut}
      onPointerOver={() => setHovered(true)}
    >
      <RoundedBox
        ref={meshRef}
        args={[keyConfig.width * 0.92, 0.4, keyConfig.height * 0.92]}
        radius={0.08}
        smoothness={4}
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
        {editMode && isSelected && <Edges scale={1.02} threshold={15} color="#818cf8" />}
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

      {editMode && isSelected && (
        <mesh
          position={[keyConfig.width / 2, 0.28, keyConfig.height / 2]}
          onPointerDown={(e) => {
            e.stopPropagation();
            beginDrag(e, 'resize');
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            e.stopPropagation();
            handleEditDrag(e);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            endDrag(e);
          }}
          onPointerCancel={() => endDrag()}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHandleHovered(true);
          }}
          onPointerOut={() => setHandleHovered(false)}
        >
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial
            color="#818cf8"
            emissive="#6366f1"
            emissiveIntensity={handleHovered ? 1.2 : 0.6}
          />
        </mesh>
      )}
    </group>
  );
}
