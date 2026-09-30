import { useMemo } from 'react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { LAYOUT_CONFIGS } from '@/data/layouts';
import { getKeysBounds } from '@/lib/layoutUtils';
import { KeyConfig } from '@/types/keyboard';

export interface ActiveLayout {
  keys: KeyConfig[];
  width: number;
  height: number;
  name: string;
  isCustom: boolean;
}

/**
 * 当前生效的布局：编辑模式用工作副本（实时包围盒），
 * 其次已保存的自定义布局，最后内置布局。
 */
export function useActiveLayout(): ActiveLayout {
  const layout = useKeyboardStore((s) => s.layout);
  const editMode = useKeyboardStore((s) => s.editMode);
  const editingKeys = useKeyboardStore((s) => s.editingKeys);
  const customLayouts = useKeyboardStore((s) => s.customLayouts);
  const activeCustomLayoutId = useKeyboardStore((s) => s.activeCustomLayoutId);

  return useMemo(() => {
    if (editMode && editingKeys) {
      const bounds = getKeysBounds(editingKeys);
      return {
        keys: editingKeys,
        width: bounds.width,
        height: bounds.height,
        name: '编辑中…',
        isCustom: true,
      };
    }
    const custom = customLayouts.find((l) => l.id === activeCustomLayoutId);
    if (custom) {
      return {
        keys: custom.keys,
        width: custom.width,
        height: custom.height,
        name: custom.name,
        isCustom: true,
      };
    }
    const builtin = LAYOUT_CONFIGS[layout];
    return {
      keys: builtin.keys,
      width: builtin.width,
      height: builtin.height,
      name: builtin.name,
      isCustom: false,
    };
  }, [layout, editMode, editingKeys, customLayouts, activeCustomLayoutId]);
}
