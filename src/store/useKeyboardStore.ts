import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  KeyboardState,
  KeyboardActions,
  LayoutEditorState,
  LayoutEditorActions,
  LayoutType,
  CaseMaterial,
  KeyZone,
  KeyConfig,
  CustomLayout,
  AlignmentGuides,
} from '@/types/keyboard';
import { DEFAULT_ZONE_COLORS } from '@/data/zones';
import { LAYOUT_CONFIGS } from '@/data/layouts';
import {
  cloneKeys,
  getKeysBounds,
  keyRect,
  keyWouldOverlap,
  round3,
  serializeLayout,
  parseLayoutExport,
  MIN_KEY_SIZE,
} from '@/lib/layoutUtils';

interface KeyboardStore extends KeyboardState, KeyboardActions, LayoutEditorState, LayoutEditorActions {}

const EMPTY_GUIDES: AlignmentGuides = { vertical: [], horizontal: [] };

const newLayoutId = () => `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** 当前生效的键位来源：已保存的自定义布局优先，否则内置布局（只读，绝不修改） */
const resolveActiveKeys = (state: {
  layout: LayoutType;
  customLayouts: CustomLayout[];
  activeCustomLayoutId: string | null;
}): KeyConfig[] => {
  const custom = state.customLayouts.find((l) => l.id === state.activeCustomLayoutId);
  return custom ? custom.keys : LAYOUT_CONFIGS[state.layout].keys;
};

export const useKeyboardStore = create<KeyboardStore>()(
  persist(
    (set, get) => ({
      layout: '65%',
      caseMaterial: 'aluminum',
      zoneColors: { ...DEFAULT_ZONE_COLORS },
      pressedKeys: new Set<string>(),

      editMode: false,
      editingKeys: null,
      selectedKeyId: null,
      isKeyDragging: false,
      alignGuides: EMPTY_GUIDES,
      gridSnap: true,
      gridSize: 0.05,
      customLayouts: [],
      activeCustomLayoutId: null,

      setLayout: (layout: LayoutType) => {
        set((state) => ({
          layout,
          // 切换内置布局时退出自定义布局，编辑中则重建工作副本
          activeCustomLayoutId: null,
          ...(state.editMode
            ? { editingKeys: cloneKeys(LAYOUT_CONFIGS[layout].keys), selectedKeyId: null }
            : {}),
        }));
      },

      setCaseMaterial: (caseMaterial: CaseMaterial) => {
        set({ caseMaterial });
      },

      setZoneColor: (zone: KeyZone, color: string) => {
        set((state) => ({
          zoneColors: {
            ...state.zoneColors,
            [zone]: color,
          },
        }));
      },

      pressKey: (keyId: string) => {
        set((state) => {
          const newPressedKeys = new Set(state.pressedKeys);
          newPressedKeys.add(keyId);
          return { pressedKeys: newPressedKeys };
        });
      },

      releaseKey: (keyId: string) => {
        set((state) => {
          const newPressedKeys = new Set(state.pressedKeys);
          newPressedKeys.delete(keyId);
          return { pressedKeys: newPressedKeys };
        });
      },

      resetColors: () => {
        set({ zoneColors: { ...DEFAULT_ZONE_COLORS } });
      },

      // ---------- 布局编辑 ----------

      enterEditMode: () => {
        set((state) => ({
          editMode: true,
          // 深拷贝当前生效键位作为工作副本，内置布局保持不变
          editingKeys: cloneKeys(resolveActiveKeys(state)),
          selectedKeyId: null,
          alignGuides: EMPTY_GUIDES,
        }));
      },

      exitEditMode: () => {
        // 直接丢弃工作副本：未保存的修改不影响任何已存/内置布局
        set({
          editMode: false,
          editingKeys: null,
          selectedKeyId: null,
          isKeyDragging: false,
          alignGuides: EMPTY_GUIDES,
        });
      },

      selectKey: (keyId: string | null) => {
        set({ selectedKeyId: keyId });
      },

      updateEditingKey: (keyId, patch) => {
        let applied = false;
        set((state) => {
          if (!state.editingKeys) return {};
          const current = state.editingKeys.find((k) => k.id === keyId);
          if (!current) return {};
          const next: KeyConfig = {
            ...current,
            x: round3(Math.max(0, patch.x ?? current.x)),
            y: round3(Math.max(0, patch.y ?? current.y)),
            width: round3(Math.max(MIN_KEY_SIZE, patch.width ?? current.width)),
            height: round3(Math.max(MIN_KEY_SIZE, patch.height ?? current.height)),
          };
          // 键位不能重叠：非法修改直接拒绝，保持上一个合法状态
          if (keyWouldOverlap(state.editingKeys, keyId, keyRect(next))) return {};
          applied = true;
          return {
            editingKeys: state.editingKeys.map((k) => (k.id === keyId ? next : k)),
          };
        });
        return applied;
      },

      setKeyDragging: (isKeyDragging: boolean) => {
        set({ isKeyDragging });
      },

      setAlignGuides: (alignGuides: AlignmentGuides) => {
        set({ alignGuides });
      },

      setGridSnap: (gridSnap: boolean) => {
        set({ gridSnap });
      },

      setGridSize: (gridSize: number) => {
        set({ gridSize });
      },

      saveCustomLayout: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => {
          const source =
            state.editMode && state.editingKeys ? state.editingKeys : resolveActiveKeys(state);
          const bounds = getKeysBounds(source);
          const now = Date.now();
          const existing = state.customLayouts.find((l) => l.name === trimmed);
          if (existing) {
            const updated: CustomLayout = {
              ...existing,
              keys: cloneKeys(source),
              width: bounds.width,
              height: bounds.height,
              updatedAt: now,
            };
            return {
              customLayouts: state.customLayouts.map((l) => (l.id === existing.id ? updated : l)),
              activeCustomLayoutId: existing.id,
            };
          }
          const layout: CustomLayout = {
            id: newLayoutId(),
            name: trimmed,
            baseLayout: state.layout,
            keys: cloneKeys(source),
            width: bounds.width,
            height: bounds.height,
            createdAt: now,
            updatedAt: now,
          };
          return {
            customLayouts: [...state.customLayouts, layout],
            activeCustomLayoutId: layout.id,
          };
        });
      },

      loadCustomLayout: (id: string) => {
        set((state) => {
          const target = state.customLayouts.find((l) => l.id === id);
          if (!target) return {};
          return {
            activeCustomLayoutId: id,
            // 编辑中加载：以该布局的副本继续编辑，已存数据不被引用
            ...(state.editMode
              ? { editingKeys: cloneKeys(target.keys), selectedKeyId: null }
              : {}),
          };
        });
      },

      deleteCustomLayout: (id: string) => {
        set((state) => {
          const customLayouts = state.customLayouts.filter((l) => l.id !== id);
          const wasActive = state.activeCustomLayoutId === id;
          return {
            customLayouts,
            activeCustomLayoutId: wasActive ? null : state.activeCustomLayoutId,
            ...(state.editMode && wasActive
              ? { editingKeys: cloneKeys(LAYOUT_CONFIGS[state.layout].keys), selectedKeyId: null }
              : {}),
          };
        });
      },

      resetToDefaultLayout: () => {
        set((state) => ({
          activeCustomLayoutId: null,
          selectedKeyId: null,
          // 编辑中：把编辑副本重置为内置布局的深拷贝，内置数据本身不被触碰
          ...(state.editMode
            ? { editingKeys: cloneKeys(LAYOUT_CONFIGS[state.layout].keys) }
            : {}),
        }));
      },

      exportLayoutJson: () => {
        const state = get();
        const keys =
          state.editMode && state.editingKeys ? state.editingKeys : resolveActiveKeys(state);
        const custom = state.customLayouts.find((l) => l.id === state.activeCustomLayoutId);
        const name = custom ? custom.name : LAYOUT_CONFIGS[state.layout].name;
        return JSON.stringify(serializeLayout(name, state.layout, keys), null, 2);
      },

      importLayoutJson: (json: string) => {
        try {
          const parsed = parseLayoutExport(json);
          set((state) => {
            const now = Date.now();
            const dup = state.customLayouts.some((l) => l.name === parsed.name);
            const layout: CustomLayout = {
              id: newLayoutId(),
              name: dup ? `${parsed.name} (导入)` : parsed.name,
              baseLayout: parsed.baseLayout,
              keys: cloneKeys(parsed.keys),
              width: parsed.width,
              height: parsed.height,
              createdAt: now,
              updatedAt: now,
            };
            return {
              customLayouts: [...state.customLayouts, layout],
              activeCustomLayoutId: layout.id,
              ...(state.editMode
                ? { editingKeys: cloneKeys(layout.keys), selectedKeyId: null }
                : {}),
            };
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : '导入失败' };
        }
      },
    }),
    {
      name: 'keyboard-studio-layouts',
      storage: createJSONStorage(() => localStorage),
      // 只持久化布局数据（含 id/keyCode/label/zone 全字段），不碰交互状态
      partialize: (state) => ({
        customLayouts: state.customLayouts,
        activeCustomLayoutId: state.activeCustomLayoutId,
      }),
    }
  )
);

export const useLayout = () => useKeyboardStore((state) => state.layout);
export const useCaseMaterial = () => useKeyboardStore((state) => state.caseMaterial);
export const useZoneColors = () => useKeyboardStore((state) => state.zoneColors);
export const usePressedKeys = () => useKeyboardStore((state) => state.pressedKeys);
export const useIsKeyPressed = (keyId: string) =>
  useKeyboardStore((state) => state.pressedKeys.has(keyId));
export const useEditMode = () => useKeyboardStore((state) => state.editMode);
