import { Layout, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useLayout } from '@/store/useKeyboardStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { LAYOUT_LIST, LAYOUT_CONFIGS } from '@/data/layouts';
import { LayoutType } from '@/types/keyboard';

export function LayoutSelector() {
  const currentLayout = useLayout();
  const setLayout = useKeyboardStore((state) => state.setLayout);
  const [isOpen, setIsOpen] = useState(false);
  const currentConfig = LAYOUT_CONFIGS[currentLayout];

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-3">
        <Layout className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-gray-200">键位布局</h3>
      </div>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 rounded-xl transition-all duration-200 group"
      >
        <div className="text-left">
          <div className="text-white font-medium">{currentConfig.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{currentConfig.description}</div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-20 w-full mt-2 py-2 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl">
          {LAYOUT_LIST.map((layout) => {
            const config = LAYOUT_CONFIGS[layout];
            const isSelected = layout === currentLayout;
            return (
              <button
                key={layout}
                onClick={() => {
                  setLayout(layout as LayoutType);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-3 text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-indigo-600/30 border-l-2 border-indigo-500'
                    : 'hover:bg-gray-700/50 border-l-2 border-transparent'
                }`}
              >
                <div className={`font-medium ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                  {config.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{config.description}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
