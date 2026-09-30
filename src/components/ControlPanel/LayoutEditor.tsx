import { useEffect, useRef, useState } from 'react';
import {
  PencilRuler,
  Save,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Magnet,
  MousePointer2,
  Check,
} from 'lucide-react';
import { useKeyboardStore } from '@/store/useKeyboardStore';
import { ZONE_CONFIGS } from '@/data/zones';

const GRID_SIZES = [0.05, 0.1, 0.25];

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  onCommit: (value: number) => void;
}

function NumberField({ label, value, min, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  const commit = () => {
    const parsed = parseFloat(text);
    if (Number.isFinite(parsed) && parsed >= min) {
      onCommit(parsed);
    } else {
      setText(value.toFixed(2));
    }
  };

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-4">{label}</span>
      <input
        type="number"
        step={0.05}
        min={min}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full px-2 py-1.5 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-200 focus:outline-none focus:border-indigo-500/60"
      />
    </label>
  );
}

export function LayoutEditor() {
  const editMode = useKeyboardStore((s) => s.editMode);
  const editingKeys = useKeyboardStore((s) => s.editingKeys);
  const selectedKeyId = useKeyboardStore((s) => s.selectedKeyId);
  const gridSnap = useKeyboardStore((s) => s.gridSnap);
  const gridSize = useKeyboardStore((s) => s.gridSize);
  const customLayouts = useKeyboardStore((s) => s.customLayouts);
  const activeCustomLayoutId = useKeyboardStore((s) => s.activeCustomLayoutId);

  const enterEditMode = useKeyboardStore((s) => s.enterEditMode);
  const exitEditMode = useKeyboardStore((s) => s.exitEditMode);
  const selectKey = useKeyboardStore((s) => s.selectKey);
  const updateEditingKey = useKeyboardStore((s) => s.updateEditingKey);
  const setGridSnap = useKeyboardStore((s) => s.setGridSnap);
  const setGridSize = useKeyboardStore((s) => s.setGridSize);
  const saveCustomLayout = useKeyboardStore((s) => s.saveCustomLayout);
  const loadCustomLayout = useKeyboardStore((s) => s.loadCustomLayout);
  const deleteCustomLayout = useKeyboardStore((s) => s.deleteCustomLayout);
  const resetToDefaultLayout = useKeyboardStore((s) => s.resetToDefaultLayout);
  const exportLayoutJson = useKeyboardStore((s) => s.exportLayoutJson);
  const importLayoutJson = useKeyboardStore((s) => s.importLayoutJson);

  const [layoutName, setLayoutName] = useState('');
  const [savedTip, setSavedTip] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedKey = editingKeys?.find((k) => k.id === selectedKeyId) ?? null;

  const handleSave = () => {
    if (!layoutName.trim()) return;
    saveCustomLayout(layoutName);
    setLayoutName('');
    setSavedTip(true);
    window.setTimeout(() => setSavedTip(false), 1500);
  };

  const handleExport = () => {
    const json = exportLayoutJson();
    const state = useKeyboardStore.getState();
    const custom = state.customLayouts.find((l) => l.id === state.activeCustomLayoutId);
    const filename = `${custom ? custom.name : `layout-${state.layout}`}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importLayoutJson(String(reader.result ?? ''));
      setImportError(result.ok ? null : (result.error ?? '导入失败'));
    };
    reader.onerror = () => setImportError('读取文件失败');
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PencilRuler className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-medium text-gray-200">布局编辑</h3>
        </div>
        <button
          onClick={() => (editMode ? exitEditMode() : enterEditMode())}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
            editMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-500'
              : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/60 border border-gray-700/50'
          }`}
        >
          {editMode ? '完成编辑' : '进入编辑'}
        </button>
      </div>

      {editMode && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <MousePointer2 className="w-4 h-4 text-indigo-300 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-200/80 leading-relaxed">
              拖动键帽在 X/Z 平面移动 · 拖动角点调整宽高 · 按住 Shift 对齐其他键位 · 点击空白处取消选中
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setGridSnap(!gridSnap)}
              className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-all ${
                gridSnap
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                  : 'bg-gray-800/40 border-gray-700/50 text-gray-400'
              }`}
            >
              <Magnet className="w-3.5 h-3.5" />
              网格吸附 {gridSnap ? '开' : '关'}
            </button>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(parseFloat(e.target.value))}
              disabled={!gridSnap}
              className="px-2 py-2 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-300 focus:outline-none focus:border-indigo-500/60 disabled:opacity-40"
            >
              {GRID_SIZES.map((s) => (
                <option key={s} value={s}>
                  网格 {s}u
                </option>
              ))}
            </select>
          </div>

          {selectedKey ? (
            <div className="p-3 bg-gray-800/40 border border-gray-700/40 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white">
                  「{selectedKey.label}」
                  <span className="text-gray-500 font-normal ml-1.5">{selectedKey.id}</span>
                </span>
                <button
                  onClick={() => selectKey(null)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  取消选中
                </button>
              </div>
              <div className="text-xs text-gray-500">
                键码 <span className="text-gray-300">{selectedKey.keyCode ?? '—'}</span>
                <span className="mx-1.5">·</span>
                分区 <span className="text-gray-300">{ZONE_CONFIGS[selectedKey.zone].name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="X"
                  value={selectedKey.x}
                  min={0}
                  onCommit={(v) => updateEditingKey(selectedKey.id, { x: v })}
                />
                <NumberField
                  label="Y"
                  value={selectedKey.y}
                  min={0}
                  onCommit={(v) => updateEditingKey(selectedKey.id, { y: v })}
                />
                <NumberField
                  label="宽"
                  value={selectedKey.width}
                  min={0.5}
                  onCommit={(v) => updateEditingKey(selectedKey.id, { width: v })}
                />
                <NumberField
                  label="高"
                  value={selectedKey.height}
                  min={0.5}
                  onCommit={(v) => updateEditingKey(selectedKey.id, { height: v })}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 px-1">点击一个键帽查看和微调它的位置与尺寸</p>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="布局名称，如：我的 65%"
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/60"
            />
            <button
              onClick={handleSave}
              disabled={!layoutName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savedTip ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {savedTip ? '已保存' : '保存'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={resetToDefaultLayout}
              className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 text-gray-300 rounded-lg transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复默认
            </button>
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 text-gray-300 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              导出
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-2 py-2 text-xs bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 text-gray-300 rounded-lg transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              导入
            </button>
          </div>
          {importError && <p className="text-xs text-red-400 px-1">导入失败：{importError}</p>}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      {customLayouts.length > 0 && (
        <div className={editMode ? 'mt-4' : ''}>
          <div className="text-xs text-gray-500 mb-2 px-1">已保存的布局</div>
          <div className="space-y-1.5">
            {customLayouts.map((layout) => {
              const isActive = layout.id === activeCustomLayoutId;
              return (
                <div
                  key={layout.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 border-indigo-500/40'
                      : 'bg-gray-800/40 border-gray-700/40 hover:bg-gray-800/60'
                  }`}
                >
                  <button
                    onClick={() => loadCustomLayout(layout.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div
                      className={`text-xs font-medium truncate ${
                        isActive ? 'text-indigo-200' : 'text-gray-200'
                      }`}
                    >
                      {layout.name}
                      {isActive && <span className="ml-1.5 text-indigo-400">· 当前</span>}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      基于 {layout.baseLayout} · {layout.keys.length} 键
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`删除布局「${layout.name}」？`)) {
                        deleteCustomLayout(layout.id);
                      }
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                    title="删除布局"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
