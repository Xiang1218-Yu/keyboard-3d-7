import { Box } from 'lucide-react';
import { useCaseMaterial } from '@/store/useKeyboardStore';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { MATERIAL_LIST, MATERIAL_CONFIGS } from '@/data/materials';
import { CaseMaterial } from '@/types/keyboard';

export function MaterialSelector() {
  const currentMaterial = useCaseMaterial();
  const setCaseMaterial = useKeyboardStore((state) => state.setCaseMaterial);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Box className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-medium text-gray-200">外壳材质</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {MATERIAL_LIST.map((material) => {
          const config = MATERIAL_CONFIGS[material as CaseMaterial];
          const isSelected = material === currentMaterial;
          
          return (
            <button
              key={material}
              onClick={() => setCaseMaterial(material as CaseMaterial)}
              className={`relative p-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-700/60 hover:border-gray-600/50 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-md border border-gray-600/50 shadow-inner"
                  style={{
                    backgroundColor: config.color,
                    boxShadow: isSelected
                      ? `0 0 12px ${config.color}40`
                      : 'none',
                  }}
                />
                <span className="text-sm font-medium">{config.name}</span>
              </div>
              
              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
