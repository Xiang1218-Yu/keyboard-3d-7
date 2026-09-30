import { KeyConfig, LayoutType, LayoutExportFile, KeyZone } from '@/types/keyboard';
import { ZONE_LIST } from '@/data/zones';
import { LAYOUT_LIST } from '@/data/layouts';

export const MIN_KEY_SIZE = 0.5;
/** 判定重叠时的容差：允许键帽贴边，但不允许真的交叠 */
export const OVERLAP_EPSILON = 0.02;
/** Shift 对齐的吸附阈值（键位单位） */
export const ALIGN_THRESHOLD = 0.15;

export interface KeyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const keyRect = (k: KeyConfig): KeyRect => ({ x: k.x, y: k.y, w: k.width, h: k.height });

export const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** 深拷贝键位数组，保证编辑副本与内置布局 / 已存布局互不影响 */
export function cloneKeys(keys: KeyConfig[]): KeyConfig[] {
  return keys.map((k) => ({ ...k }));
}

/** 键位包围盒（布局局部坐标，原点为左上角） */
export function getKeysBounds(keys: KeyConfig[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const k of keys) {
    width = Math.max(width, k.x + k.width);
    height = Math.max(height, k.y + k.height);
  }
  return { width: round3(width), height: round3(height) };
}

export function rectsOverlap(a: KeyRect, b: KeyRect, eps: number = OVERLAP_EPSILON): boolean {
  return (
    a.x < b.x + b.w - eps &&
    a.x + a.w > b.x + eps &&
    a.y < b.y + b.h - eps &&
    a.y + a.h > b.y + eps
  );
}

/** 目标矩形是否与除 excludeId 外的任何键位重叠 */
export function keyWouldOverlap(keys: KeyConfig[], excludeId: string, rect: KeyRect): boolean {
  return keys.some((k) => k.id !== excludeId && rectsOverlap(rect, keyRect(k)));
}

export function snapValue(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export interface AlignmentResult {
  dx: number;
  dz: number;
  vertical: number[];
  horizontal: number[];
}

/**
 * Shift 对齐：把移动中键位的 左/中/右、上/中/下 与其他键位对齐，
 * 返回修正偏移量和需要绘制的参考线。
 */
export function computeAlignment(
  keys: KeyConfig[],
  excludeId: string,
  rect: KeyRect,
  threshold: number = ALIGN_THRESHOLD
): AlignmentResult {
  const candX = [rect.x, rect.x + rect.w / 2, rect.x + rect.w];
  const candZ = [rect.y, rect.y + rect.h / 2, rect.y + rect.h];
  let bestX: { d: number; line: number } | null = null;
  let bestZ: { d: number; line: number } | null = null;

  for (const k of keys) {
    if (k.id === excludeId) continue;
    const xs = [k.x, k.x + k.width / 2, k.x + k.width];
    const zs = [k.y, k.y + k.height / 2, k.y + k.height];
    for (const tx of xs) {
      for (const cx of candX) {
        const d = tx - cx;
        if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) {
          bestX = { d, line: tx };
        }
      }
    }
    for (const tz of zs) {
      for (const cz of candZ) {
        const d = tz - cz;
        if (Math.abs(d) <= threshold && (!bestZ || Math.abs(d) < Math.abs(bestZ.d))) {
          bestZ = { d, line: tz };
        }
      }
    }
  }

  return {
    dx: bestX ? bestX.d : 0,
    dz: bestZ ? bestZ.d : 0,
    vertical: bestX ? [bestX.line] : [],
    horizontal: bestZ ? [bestZ.line] : [],
  };
}

/** 序列化为导出文件（完整保留 id / keyCode / label / zone 等全部字段） */
export function serializeLayout(
  name: string,
  baseLayout: LayoutType,
  keys: KeyConfig[]
): LayoutExportFile {
  const { width, height } = getKeysBounds(keys);
  return {
    version: 1,
    name,
    baseLayout,
    width,
    height,
    keys: cloneKeys(keys),
  };
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 解析并校验导入的 JSON，缺字段或格式非法时抛出中文错误 */
export function parseLayoutExport(json: string): LayoutExportFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('文件不是合法的 JSON');
  }
  const obj = raw as Partial<LayoutExportFile>;
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.keys)) {
    throw new Error('文件缺少 keys 数组，不是有效的布局文件');
  }
  if (obj.keys.length === 0) {
    throw new Error('布局不能为空（keys 为空）');
  }

  const keys: KeyConfig[] = obj.keys.map((k, i) => {
    const key = k as Partial<KeyConfig>;
    if (typeof key.id !== 'string' || !key.id) throw new Error(`第 ${i + 1} 个键缺少 id`);
    if (typeof key.label !== 'string') throw new Error(`第 ${i + 1} 个键缺少 label`);
    if (!ZONE_LIST.includes(key.zone as KeyZone)) throw new Error(`第 ${i + 1} 个键的 zone 非法`);
    if (!isFiniteNumber(key.x) || !isFiniteNumber(key.y)) throw new Error(`第 ${i + 1} 个键坐标非法`);
    if (!isFiniteNumber(key.width) || !isFiniteNumber(key.height) || key.width <= 0 || key.height <= 0) {
      throw new Error(`第 ${i + 1} 个键宽高非法`);
    }
    return {
      id: key.id,
      label: key.label,
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      row: isFiniteNumber(key.row) ? key.row : 0,
      col: isFiniteNumber(key.col) ? key.col : i,
      zone: key.zone as KeyZone,
      keyCode: typeof key.keyCode === 'string' ? key.keyCode : undefined,
    };
  });

  const ids = new Set<string>();
  for (const k of keys) {
    if (ids.has(k.id)) throw new Error(`键位 id 重复: ${k.id}`);
    ids.add(k.id);
  }

  const bounds = getKeysBounds(keys);
  return {
    version: 1,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : '导入的布局',
    baseLayout: LAYOUT_LIST.includes(obj.baseLayout as LayoutType) ? (obj.baseLayout as LayoutType) : '65%',
    width: bounds.width,
    height: bounds.height,
    keys,
  };
}
