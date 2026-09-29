import { create } from 'zustand';
import { KeyboardState, KeyboardActions, LayoutType, CaseMaterial, KeyZone } from '@/types/keyboard';
import { DEFAULT_ZONE_COLORS } from '@/data/zones';

interface KeyboardStore extends KeyboardState, KeyboardActions {}

export const useKeyboardStore = create<KeyboardStore>((set) => ({
  layout: '65%',
  caseMaterial: 'aluminum',
  zoneColors: { ...DEFAULT_ZONE_COLORS },
  pressedKeys: new Set<string>(),

  setLayout: (layout: LayoutType) => {
    set({ layout });
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
}));

export const useLayout = () => useKeyboardStore((state) => state.layout);
export const useCaseMaterial = () => useKeyboardStore((state) => state.caseMaterial);
export const useZoneColors = () => useKeyboardStore((state) => state.zoneColors);
export const usePressedKeys = () => useKeyboardStore((state) => state.pressedKeys);
export const useIsKeyPressed = (keyId: string) =>
  useKeyboardStore((state) => state.pressedKeys.has(keyId));
