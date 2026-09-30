export type LayoutType = '60%' | '65%' | '75%' | 'TKL' | 'Full';

export type KeyZone = 
  | 'alphanumeric'
  | 'function'
  | 'navigation'
  | 'numpad'
  | 'modifiers'
  | 'spacebar';

export type CaseMaterial = 'aluminum' | 'plastic' | 'wood' | 'carbon';

export interface KeyConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
  zone: KeyZone;
  keyCode?: string;
}

export interface LayoutConfig {
  type: LayoutType;
  name: string;
  description: string;
  keys: KeyConfig[];
  width: number;
  height: number;
}

export interface MaterialConfig {
  id: CaseMaterial;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
}

export interface ZoneConfig {
  id: KeyZone;
  name: string;
  description: string;
  defaultColor: string;
}

/** 用户保存的自定义布局（完整保留 id / keyCode / label / zone） */
export interface CustomLayout {
  id: string;
  name: string;
  baseLayout: LayoutType;
  keys: KeyConfig[];
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

/** 导出 / 导入的 JSON 文件格式 */
export interface LayoutExportFile {
  version: 1;
  name: string;
  baseLayout: LayoutType;
  width: number;
  height: number;
  keys: KeyConfig[];
}

/** Shift 对齐时的参考线（布局局部坐标） */
export interface AlignmentGuides {
  /** 垂直参考线的 x 坐标 */
  vertical: number[];
  /** 水平参考线的 z 坐标（即键位的 y） */
  horizontal: number[];
}

export interface KeyboardState {
  layout: LayoutType;
  caseMaterial: CaseMaterial;
  zoneColors: Record<KeyZone, string>;
  pressedKeys: Set<string>;
}

export interface KeyboardActions {
  setLayout: (layout: LayoutType) => void;
  setCaseMaterial: (material: CaseMaterial) => void;
  setZoneColor: (zone: KeyZone, color: string) => void;
  pressKey: (keyId: string) => void;
  releaseKey: (keyId: string) => void;
  resetColors: () => void;
}

export interface LayoutEditorState {
  /** 是否处于布局编辑模式 */
  editMode: boolean;
  /** 编辑中的键位工作副本（深拷贝，绝不直接改内置布局） */
  editingKeys: KeyConfig[] | null;
  selectedKeyId: string | null;
  /** 正在拖动/缩放键位（用于禁用 OrbitControls） */
  isKeyDragging: boolean;
  /** Shift 对齐参考线 */
  alignGuides: AlignmentGuides;
  gridSnap: boolean;
  gridSize: number;
  /** 已保存的多套自定义布局（持久化） */
  customLayouts: CustomLayout[];
  /** 当前应用的自定义布局 id，null 表示使用内置布局 */
  activeCustomLayoutId: string | null;
}

export interface LayoutEditorActions {
  enterEditMode: () => void;
  exitEditMode: () => void;
  selectKey: (keyId: string | null) => void;
  /** 更新编辑副本中的键位几何，带重叠/边界校验，返回是否应用成功 */
  updateEditingKey: (
    keyId: string,
    patch: Partial<Pick<KeyConfig, 'x' | 'y' | 'width' | 'height'>>
  ) => boolean;
  setKeyDragging: (dragging: boolean) => void;
  setAlignGuides: (guides: AlignmentGuides) => void;
  setGridSnap: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  /** 把当前键位保存为一套自定义布局（同名则覆盖） */
  saveCustomLayout: (name: string) => void;
  loadCustomLayout: (id: string) => void;
  deleteCustomLayout: (id: string) => void;
  /** 恢复为内置布局（编辑中则重置编辑副本） */
  resetToDefaultLayout: () => void;
  /** 导出当前键位为 JSON 字符串 */
  exportLayoutJson: () => string;
  /** 从 JSON 导入一套布局 */
  importLayoutJson: (json: string) => { ok: boolean; error?: string };
}
