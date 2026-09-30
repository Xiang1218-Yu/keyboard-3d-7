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
  keyCode?: string | null;
}

export interface LayoutConfig {
  type: LayoutType;
  name: string;
  description: string;
  keys: KeyConfig[];
  width: number;
  height: number;
}

/**
 * 用户保存的自定义布局。
 * 持久化时必须保留 id、keyCode、label、zone 四个字段，
 * 以便恢复出与内置布局一致的键位数据。
 */
export interface CustomLayout {
  id: string;
  name: string;
  /** 该布局基于哪套内置布局 */
  baseType: LayoutType;
  keys: KeyConfig[];
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

/** 拖动时 Shift 对齐产生的参考线（棋盘局部坐标） */
export interface AlignmentGuide {
  axis: 'x' | 'z';
  value: number;
  from: number;
  to: number;
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
