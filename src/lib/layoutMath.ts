import { KeyConfig, AlignmentGuide } from '@/types/keyboard';

/** 可选中的网格大小（键盘单位，1u = 一个标准键帽宽度） */
export const GRID_SIZES = [0.1, 0.25, 0.5] as const;
export const DEFAULT_GRID_SIZE = 0.25;

/** Shift 对齐的吸附阈值（键盘单位） */
const ALIGN_THRESHOLD = 0.35;
/** 键帽最小尺寸 */
const MIN_SIZE = 0.5;
/** 重叠判定容差，避免紧贴的键被误判 */
const OVERLAP_EPS = 0.02;
/** 棋盘厚度方向（Y）的偏移，与 KeyboardScene 中键位组的 Y 偏移一致 */
export const BOARD_Y = 0.35;

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export const keyRect = (k: KeyConfig): Rect => ({
  x: k.x,
  z: k.y,
  w: k.width,
  d: k.height,
});

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x + OVERLAP_EPS < b.x + b.w &&
    a.x + a.w - OVERLAP_EPS > b.x &&
    a.z + OVERLAP_EPS < b.z + b.d &&
    a.z + a.d - OVERLAP_EPS > b.z
  );
}

export function overlapsOthers(
  rect: Rect,
  keys: KeyConfig[],
  exceptId: string
): boolean {
  for (const k of keys) {
    if (k.id === exceptId) continue;
    if (rectsOverlap(rect, keyRect(k))) return true;
  }
  return false;
}

export function snapValue(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

export interface DragResult {
  x: number;
  z: number;
  guides: AlignmentGuide[];
}

/**
 * 计算拖动后的键位：网格吸附 + Shift 对齐 + 边界约束 + 碰撞回退。
 * 碰撞时优先保留单轴方向的移动（可沿其他键边缘滑动），全重叠则回到原位。
 */
export function computeDragPosition(
  dragged: KeyConfig,
  keys: KeyConfig[],
  rawX: number,
  rawZ: number,
  grid: number,
  snapEnabled: boolean,
  alignEnabled: boolean,
  boardW: number,
  boardH: number
): DragResult {
  let x = snapEnabled ? snapValue(rawX, grid) : rawX;
  let z = snapEnabled ? snapValue(rawZ, grid) : rawZ;
  const w = dragged.width;
  const d = dragged.height;

  const guides: AlignmentGuide[] = [];

  if (alignEnabled) {
    // X 轴对齐：左/右/中 三条竖边，吸附其他键的同名边
    const myXEdges = [
      { pos: x },
      { pos: x + w },
      { pos: x + w / 2 },
    ];
    let bestX: { delta: number; value: number; from: number; to: number } | null = null;
    for (const other of keys) {
      if (other.id === dragged.id) continue;
      const otherEdges = [other.x, other.x + other.width, other.x + other.width / 2];
      const from = Math.min(other.y, z);
      const to = Math.max(other.y + other.height, z + d);
      for (const oe of otherEdges) {
        for (const me of myXEdges) {
          const delta = oe - me.pos;
          if (Math.abs(delta) < ALIGN_THRESHOLD) {
            if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) {
              bestX = { delta, value: oe, from, to };
            }
          }
        }
      }
    }
    if (bestX) {
      x += bestX.delta;
      guides.push({ axis: 'x', value: bestX.value, from: bestX.from, to: bestX.to });
    }

    // Z 轴对齐：上/下/中 三条横边
    const myZEdges = [
      { pos: z },
      { pos: z + d },
      { pos: z + d / 2 },
    ];
    let bestZ: { delta: number; value: number; from: number; to: number } | null = null;
    for (const other of keys) {
      if (other.id === dragged.id) continue;
      const otherEdges = [other.y, other.y + other.height, other.y + other.height / 2];
      const from = Math.min(other.x, x);
      const to = Math.max(other.x + other.width, x + w);
      for (const oe of otherEdges) {
        for (const me of myZEdges) {
          const delta = oe - me.pos;
          if (Math.abs(delta) < ALIGN_THRESHOLD) {
            if (!bestZ || Math.abs(delta) < Math.abs(bestZ.delta)) {
              bestZ = { delta, value: oe, from, to };
            }
          }
        }
      }
    }
    if (bestZ) {
      z += bestZ.delta;
      guides.push({ axis: 'z', value: bestZ.value, from: bestZ.from, to: bestZ.to });
    }
  }

  // 边界约束（不超出棋盘）
  x = clamp(x, 0, Math.max(0, boardW - w));
  z = clamp(z, 0, Math.max(0, boardH - d));

  // 碰撞回退：全重叠时依次尝试只动 X / 只动 Z / 回到原位
  if (overlapsOthers({ x, z, w, d }, keys, dragged.id)) {
    if (!overlapsOthers({ x, z: dragged.y, w, d }, keys, dragged.id)) {
      z = dragged.y;
    } else if (!overlapsOthers({ x: dragged.x, z, w, d }, keys, dragged.id)) {
      x = dragged.x;
    } else {
      x = dragged.x;
      z = dragged.y;
    }
  }

  // 碰撞/边界修正后，参考线的起止范围按最终位置重算
  for (const g of guides) {
    if (g.axis === 'x') {
      g.from = Math.min(g.from, z);
      g.to = Math.max(g.to, z + d);
    } else {
      g.from = Math.min(g.from, x);
      g.to = Math.max(g.to, x + w);
    }
  }

  return { x, z, guides };
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface ResizeResult {
  x: number;
  z: number;
  width: number;
  height: number;
}

/**
 * 缩放键帽。dx/dz 为相对起始位置的累计棋盘坐标增量，
 * 因此调用方需传入起始键位与累计增量，避免逐帧叠加误差。
 * 返回 null 表示该缩放会导致重叠或越界，调用方应忽略。
 */
export function computeResize(
  start: KeyConfig,
  handle: ResizeHandle,
  dx: number,
  dz: number,
  keys: KeyConfig[],
  grid: number,
  snapEnabled: boolean,
  boardW: number,
  boardH: number
): ResizeResult | null {
  let x = start.x;
  let z = start.y;
  let w = start.width;
  let d = start.height;

  if (handle.includes('w')) {
    x += dx;
    w -= dx;
  }
  if (handle.includes('e')) w += dx;
  if (handle.includes('n')) {
    z += dz;
    d -= dz;
  }
  if (handle.includes('s')) d += dz;

  if (snapEnabled) {
    if (handle.includes('w')) {
      const sx = snapValue(x, grid);
      w -= sx - x;
      x = sx;
    }
    if (handle.includes('e')) {
      const ex = snapValue(x + w, grid);
      w = ex - x;
    }
    if (handle.includes('n')) {
      const sz = snapValue(z, grid);
      d -= sz - z;
      z = sz;
    }
    if (handle.includes('s')) {
      const es = snapValue(z + d, grid);
      d = es - z;
    }
  }

  // 最小尺寸
  if (w < MIN_SIZE) {
    if (handle.includes('w')) x -= MIN_SIZE - w;
    w = MIN_SIZE;
  }
  if (d < MIN_SIZE) {
    if (handle.includes('n')) z -= MIN_SIZE - d;
    d = MIN_SIZE;
  }

  // 边界约束
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (z < 0) {
    d += z;
    z = 0;
  }
  if (x + w > boardW) w = boardW - x;
  if (z + d > boardH) d = boardH - z;

  if (w < MIN_SIZE || d < MIN_SIZE) return null;

  if (overlapsOthers({ x, z, w, d }, keys, start.id)) return null;

  return { x, z, width: w, height: d };
}
