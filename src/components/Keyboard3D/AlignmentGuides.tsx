import { useLayoutEditorStore } from '@/store/useLayoutEditorStore';

/**
 * 编辑模式下的 Shift 对齐参考线，渲染在棋盘局部坐标系中。
 */
export function AlignmentGuides() {
  const guides = useLayoutEditorStore((s) => s.guides);
  const editing = useLayoutEditorStore((s) => s.editing);

  if (!editing || guides.length === 0) return null;

  return (
    <group>
      {guides.map((g, i) => {
        const length = Math.max(0.01, g.to - g.from);
        const center = (g.from + g.to) / 2;
        const position: [number, number, number] =
          g.axis === 'x' ? [g.value, 0.05, center] : [center, 0.05, g.value];
        const scale: [number, number, number] =
          g.axis === 'x' ? [0.05, 0.05, length] : [length, 0.05, 0.05];

        return (
          <mesh key={`${g.axis}-${i}`} position={position} scale={scale}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#22d3ee" toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}
