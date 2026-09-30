import { create } from 'zustand';
import {
  CustomLayout,
  KeyConfig,
  LayoutType,
  AlignmentGuide,
} from '@/types/keyboard';
import { LAYOUT_CONFIGS } from '@/data/layouts';
import { useKeyboardStore } from './useKeyboardStore';
import {
  cloneKeys,
  loadLibrary,
  persistLibrary,
} from '@/lib/layoutStorage';
import {
  computeDragPosition,
  computeResize,
  DEFAULT_GRID_SIZE,
  ResizeHandle,
} from '@/lib/layoutMath';

interface DraftState {
  baseType: LayoutType;
  name: string;
  keys: KeyConfig[];
  width: number;
  height: number;
  /** 若编辑的是已保存布局，记录其 id，保存时更新而非新建 */
  sourceId: string | null;
}

interface LayoutEditorState {
  /** 是否处于布局编辑模式 */
  editing: boolean;
  /** 编辑草稿（进入编辑时深拷贝当前生效布局，绝不直接改内置布局） */
  draft: DraftState | null;
  /** 编辑模式下选中的键帽 id */
  selectedKeyId: string | null;
  /** 正在拖动/缩放键帽（用于禁用 OrbitControls，防止误触旋转） */
  interacting: boolean;
  /** 网格大小（键盘单位） */
  gridSize: number;
  /** 是否开启网格吸附 */
  snapEnabled: boolean;
  /** 拖动对齐参考线 */
  guides: AlignmentGuide[];
  /** 已保存的自定义布局库 */
  savedLayouts: CustomLayout[];
  /** 当前生效的自定义布局 id；null 表示使用内置布局 */
  activeCustomId: string | null;

  startEditing: () => void;
  cancelEditing: () => void;
  saveDraft: (name?: string) => void;
  selectKey: (id: string | null) => void;
  beginInteraction: () => void;
  endInteraction: () => void;
  updateDraftKeyPosition: (id: string, rawX: number, rawZ: number, align: boolean) => void;
  resizeDraftKey: (
    id: string,
    startKey: KeyConfig,
    handle: ResizeHandle,
    dx: number,
    dz: number
  ) => void;
  updateDraftKeyMeta: (
    id: string,
    patch: Partial<Pick<KeyConfig, 'label' | 'keyCode' | 'zone'>>
  ) => void;
  setGridSize: (size: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  loadCustomLayout: (id: string) => void;
  deleteCustomLayout: (id: string) => void;
  restoreDefault: () => void;
  importLayouts: (layouts: CustomLayout[]) => void;
}

const persisted = loadLibrary();

export const useLayoutEditorStore = create<LayoutEditorState>((set, get) => ({
  editing: false,
  draft: null,
  selectedKeyId: null,
  interacting: false,
  gridSize: DEFAULT_GRID_SIZE,
  snapEnabled: true,
  guides: [],
  savedLayouts: persisted.layouts,
  activeCustomId: persisted.activeId,

  startEditing: () => {
    const state = get();
    const baseType = useKeyboardStore.getState().layout;
    const active = state.activeCustomId
      ? state.savedLayouts.find((l) => l.id === state.activeCustomId)
      : undefined;
    const builtin = LAYOUT_CONFIGS[baseType];
    const source = active ?? builtin;
    const draftBaseType: LayoutType = active ? active.baseType : builtin.type;

    set({
      editing: true,
      selectedKeyId: null,
      guides: [],
      draft: {
        baseType: draftBaseType,
        name: source.name,
        keys: cloneKeys(source.keys),
        width: source.width,
        height: source.height,
        sourceId: active ? active.id : null,
      },
    });
  },

  cancelEditing: () => {
    set({
      editing: false,
      draft: null,
      selectedKeyId: null,
      guides: [],
      interacting: false,
    });
  },

  saveDraft: (name) => {
    const state = get();
    if (!state.draft) return;
    const now = Date.now();
    const finalName =
      (name ?? state.draft.name ?? '').trim() ||
      `${state.draft.baseType} 自定义布局`;

    let layouts: CustomLayout[];
    let savedId: string;

    if (state.draft.sourceId) {
      // 更新已保存布局
      savedId = state.draft.sourceId;
      layouts = state.savedLayouts.map((l) =>
        l.id === savedId
          ? {
              ...l,
              name: finalName,
              keys: cloneKeys(state.draft!.keys),
              width: state.draft!.width,
              height: state.draft!.height,
              updatedAt: now,
            }
          : l
      );
    } else {
      // 新建布局
      savedId = `custom-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const layout: CustomLayout = {
        id: savedId,
        name: finalName,
        baseType: state.draft.baseType,
        keys: cloneKeys(state.draft.keys),
        width: state.draft.width,
        height: state.draft.height,
        createdAt: now,
        updatedAt: now,
      };
      layouts = [...state.savedLayouts, layout];
    }

    persistLibrary(layouts, savedId);
    set({
      savedLayouts: layouts,
      activeCustomId: savedId,
      editing: false,
      draft: null,
      selectedKeyId: null,
      guides: [],
      interacting: false,
    });
  },

  selectKey: (id) => set({ selectedKeyId: id }),

  beginInteraction: () => set({ interacting: true }),

  endInteraction: () => set({ interacting: false, guides: [] }),

  updateDraftKeyPosition: (id, rawX, rawZ, align) => {
    const state = get();
    if (!state.draft) return;
    const key = state.draft.keys.find((k) => k.id === id);
    if (!key) return;

    const result = computeDragPosition(
      key,
      state.draft.keys,
      rawX,
      rawZ,
      state.gridSize,
      state.snapEnabled,
      align,
      state.draft.width,
      state.draft.height
    );

    // 棋盘随键位外扩自动变大（不缩小，避免抖动）
    const width = Math.max(state.draft.width, result.x + key.width + 0.1);
    const height = Math.max(state.draft.height, result.z + key.height + 0.1);

    set({
      draft: {
        ...state.draft,
        width,
        height,
        keys: state.draft.keys.map((k) =>
          k.id === id ? { ...k, x: result.x, y: result.z } : k
        ),
      },
      guides: result.guides,
    });
  },

  resizeDraftKey: (id, startKey, handle, dx, dz) => {
    const state = get();
    if (!state.draft) return;

    const result = computeResize(
      startKey,
      handle,
      dx,
      dz,
      state.draft.keys,
      state.gridSize,
      state.snapEnabled,
      state.draft.width,
      state.draft.height
    );
    if (!result) return;

    const width = Math.max(state.draft.width, result.x + result.width + 0.1);
    const height = Math.max(state.draft.height, result.z + result.height + 0.1);

    set({
      draft: {
        ...state.draft,
        width,
        height,
        keys: state.draft.keys.map((k) =>
          k.id === id
            ? { ...k, x: result.x, y: result.z, width: result.width, height: result.height }
            : k
        ),
      },
    });
  },

  updateDraftKeyMeta: (id, patch) => {
    const state = get();
    if (!state.draft) return;
    set({
      draft: {
        ...state.draft,
        keys: state.draft.keys.map((k) => (k.id === id ? { ...k, ...patch } : k)),
      },
    });
  },

  setGridSize: (size) => set({ gridSize: size }),
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

  loadCustomLayout: (id) => {
    const layout = get().savedLayouts.find((l) => l.id === id);
    if (!layout) return;
    useKeyboardStore.getState().setLayout(layout.baseType);
    persistLibrary(get().savedLayouts, id);
    set({
      activeCustomId: id,
      editing: false,
      draft: null,
      selectedKeyId: null,
      guides: [],
      interacting: false,
    });
  },

  deleteCustomLayout: (id) => {
    const state = get();
    const layouts = state.savedLayouts.filter((l) => l.id !== id);
    const activeId = state.activeCustomId === id ? null : state.activeCustomId;
    persistLibrary(layouts, activeId);
    set({ savedLayouts: layouts, activeCustomId: activeId });
  },

  restoreDefault: () => {
    const state = get();
    persistLibrary(state.savedLayouts, null);
    set({
      activeCustomId: null,
      editing: false,
      draft: null,
      selectedKeyId: null,
      guides: [],
      interacting: false,
    });
  },

  importLayouts: (layouts) => {
    const state = get();
    const existing = new Set(state.savedLayouts.map((l) => l.id));
    const merged = [...state.savedLayouts, ...layouts.filter((l) => !existing.has(l.id))];
    persistLibrary(merged, state.activeCustomId);
    set({ savedLayouts: merged });
  },
}));

/**
 * 当前生效的布局：编辑模式下返回草稿，否则返回当前自定义布局，
 * 都没有时返回内置布局。内置布局永远不会被修改。
 */
export interface EffectiveLayout {
  type: LayoutType;
  name: string;
  keys: KeyConfig[];
  width: number;
  height: number;
  isCustom: boolean;
  isDraft: boolean;
}

export function useEffectiveLayout(): EffectiveLayout {
  const baseType = useKeyboardStore((s) => s.layout);
  const base = LAYOUT_CONFIGS[baseType];
  const editing = useLayoutEditorStore((s) => s.editing);
  const draft = useLayoutEditorStore((s) => s.draft);
  const custom = useLayoutEditorStore((s) =>
    s.activeCustomId ? s.savedLayouts.find((l) => l.id === s.activeCustomId) : undefined
  );

  if (editing && draft) {
    return {
      type: draft.baseType,
      name: draft.name,
      keys: draft.keys,
      width: draft.width,
      height: draft.height,
      isCustom: false,
      isDraft: true,
    };
  }
  if (custom) {
    return {
      type: custom.baseType,
      name: custom.name,
      keys: custom.keys,
      width: custom.width,
      height: custom.height,
      isCustom: true,
      isDraft: false,
    };
  }
  return {
    type: base.type,
    name: base.name,
    keys: base.keys,
    width: base.width,
    height: base.height,
    isCustom: false,
    isDraft: false,
  };
}

export const useIsEditing = () => useLayoutEditorStore((s) => s.editing);
export const useDraftSelectedKey = (): KeyConfig | null =>
  useLayoutEditorStore((s) => {
    if (!s.draft || !s.selectedKeyId) return null;
    return s.draft.keys.find((k) => k.id === s.selectedKeyId) ?? null;
  });
