import { ZoneConfig, KeyZone } from '@/types/keyboard';

export const ZONE_CONFIGS: Record<KeyZone, ZoneConfig> = {
  alphanumeric: {
    id: 'alphanumeric',
    name: '字母数字区',
    description: '主键盘区的字母和数字键',
    defaultColor: '#f8fafc',
  },
  function: {
    id: 'function',
    name: '功能键区',
    description: 'F1-F12及顶部功能键',
    defaultColor: '#e2e8f0',
  },
  navigation: {
    id: 'navigation',
    name: '导航键区',
    description: '方向键及导航控制键',
    defaultColor: '#cbd5e1',
  },
  numpad: {
    id: 'numpad',
    name: '数字键盘区',
    description: '右侧数字小键盘',
    defaultColor: '#e2e8f0',
  },
  modifiers: {
    id: 'modifiers',
    name: '修饰键区',
    description: 'Ctrl、Shift、Alt、Win等修饰键',
    defaultColor: '#94a3b8',
  },
  spacebar: {
    id: 'spacebar',
    name: '空格键区',
    description: '空格键',
    defaultColor: '#64748b',
  },
};

export const DEFAULT_ZONE_COLORS: Record<KeyZone, string> = Object.fromEntries(
  Object.entries(ZONE_CONFIGS).map(([key, config]) => [key, config.defaultColor])
) as Record<KeyZone, string>;

export const ZONE_LIST: KeyZone[] = [
  'alphanumeric',
  'function',
  'navigation',
  'numpad',
  'modifiers',
  'spacebar',
];
