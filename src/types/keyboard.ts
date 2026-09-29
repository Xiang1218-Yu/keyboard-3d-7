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
