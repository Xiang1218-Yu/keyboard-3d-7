import { CustomLayout, KeyConfig, KeyZone, LayoutType } from '@/types/keyboard';

const STORAGE_KEY = 'keyboard-studio-layouts-v1';
const ZONES: KeyZone[] = [
  'alphanumeric',
  'function',
  'navigation',
  'numpad',
  'modifiers',
  'spacebar',
];
const BASE_TYPES: LayoutType[] = ['60%', '65%', '75%', 'TKL', 'Full'];

interface PersistedShape {
  layouts: CustomLayout[];
  activeId: string | null;
}

/** 深拷贝键位，避免草稿污染内置布局数据 */
export function cloneKeys(keys: KeyConfig[]): KeyConfig[] {
  return keys.map((k) => ({ ...k }));
}

function normalizeKey(raw: unknown): KeyConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const k = raw as Record<string, unknown>;
  if (typeof k.id !== 'string' || typeof k.label !== 'string') return null;
  if (
    typeof k.x !== 'number' ||
    typeof k.y !== 'number' ||
    typeof k.width !== 'number' ||
    typeof k.height !== 'number'
  )
    return null;

  return {
    id: k.id,
    label: k.label,
    x: k.x,
    y: k.y,
    width: k.width,
    height: k.height,
    row: typeof k.row === 'number' ? k.row : 0,
    col: typeof k.col === 'number' ? k.col : 0,
    zone: (ZONES.includes(k.zone as KeyZone) ? k.zone : 'alphanumeric') as KeyZone,
    keyCode: typeof k.keyCode === 'string' ? k.keyCode : null,
  };
}

/** 校验并规范化一份导入的布局，非法数据返回 null */
export function validateLayout(raw: unknown): CustomLayout | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const l = raw as Record<string, unknown>;
  if (!Array.isArray(l.keys)) return null;
  if (typeof l.baseType !== 'string' || !BASE_TYPES.includes(l.baseType as LayoutType)) {
    return null;
  }

  const keys: KeyConfig[] = [];
  for (const rawKey of l.keys as unknown[]) {
    const key = normalizeKey(rawKey);
    if (!key) return null;
    keys.push(key);
  }

  const now = Date.now();
  return {
    id: typeof l.id === 'string' ? l.id : `import-${now}`,
    name: typeof l.name === 'string' && l.name.trim() ? l.name : `${l.baseType} 导入布局`,
    baseType: l.baseType as LayoutType,
    keys,
    width: typeof l.width === 'number' ? l.width : 16,
    height: typeof l.height === 'number' ? l.height : 6,
    createdAt: typeof l.createdAt === 'number' ? l.createdAt : now,
    updatedAt: typeof l.updatedAt === 'number' ? l.updatedAt : now,
  };
}

export function loadLibrary(): PersistedShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { layouts: [], activeId: null };
    const parsed = JSON.parse(raw) as Partial<PersistedShape>;
    const layouts = Array.isArray(parsed.layouts)
      ? parsed.layouts
          .map(validateLayout)
          .filter((l): l is CustomLayout => l !== null)
      : [];
    const activeId =
      typeof parsed.activeId === 'string' && layouts.some((l) => l.id === parsed.activeId)
        ? parsed.activeId
        : null;
    return { layouts, activeId };
  } catch {
    return { layouts: [], activeId: null };
  }
}

export function persistLibrary(layouts: CustomLayout[], activeId: string | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ layouts, activeId }));
  } catch {
    // 存储不可用时静默失败（如隐私模式）
  }
}

/** 导出为带元信息的 JSON 字符串 */
export function layoutToJson(layout: CustomLayout): string {
  return JSON.stringify(
    {
      app: 'keyboard-studio',
      version: 1,
      exportedAt: new Date().toISOString(),
      layout,
    },
    null,
    2
  );
}

export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 从文件读取并校验布局 */
export function readLayoutFile(file: File): Promise<CustomLayout> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // 兼容两种格式：{ layout: CustomLayout } 或直接 CustomLayout
        const candidate =
          parsed && typeof parsed === 'object' && 'layout' in parsed
            ? (parsed as { layout: unknown }).layout
            : parsed;
        const layout = validateLayout(candidate);
        if (!layout) {
          reject(new Error('无效的布局文件：缺少必要字段'));
          return;
        }
        resolve(layout);
      } catch {
        reject(new Error('JSON 解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
