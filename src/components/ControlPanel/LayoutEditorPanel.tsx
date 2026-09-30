import { useRef, useState } from 'react';
import {
  Pencil,
  Check,
  X,
  Save,
  FolderOpen,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Grid3x3,
  Magnet,
  MousePointer2,
  ChevronDown,
} from 'lucide-react';
import { useLayoutEditorStore } from '@/store/useLayoutEditorStore';
import { useEffectiveLayout } from '@/store/useLayoutEditorStore';
import { GRID_SIZES } from '@/lib/layoutMath';
import { ZONE_LIST, ZONE_CONFIGS } from '@/data/zones';
import { KeyZone } from '@/types/keyboard';
import { layoutToJson, downloadJson, readLayoutFile } from '@/lib/layoutStorage';

export function LayoutEditorPanel() {
  const editing = useLayoutEditorStore((s) => s.editing);
  const startEditing = useLayoutEditorStore((s) => s.startEditing);
  const cancelEditing = useLayoutEditorStore((s) => s.cancelEditing);
  const saveDraft = useLayoutEditorStore((s) => s.saveDraft);
  const gridSize = useLayoutEditorStore((s) => s.gridSize);
  const setGridSize = useLayoutEditorStore((s) => s.setGridSize);
  const snapEnabled = useLayoutEditorStore((s) => s.snapEnabled);
  const setSnapEnabled = useLayoutEditorStore((s) => s.setSnapEnabled);
  const selectedKeyId = useLayoutEditorStore((s) => s.selectedKeyId);
  const draft = useLayoutEditorStore((s) => s.draft);
  const updateDraftKeyMeta = useLayoutEditorStore((s) => s.updateDraftKeyMeta);
  const savedLayouts = useLayoutEditorStore((s) => s.savedLayouts);
  const activeCustomId = useLayoutEditorStore((s) => s.activeCustomId);
  const loadCustomLayout = useLayoutEditorStore((s) => s.loadCustomLayout);
  const deleteCustomLayout = useLayoutEditorStore((s) => s.deleteCustomLayout);
  const restoreDefault = useLayoutEditorStore((s) => s.restoreDefault);
  const importLayouts = useLayoutEditorStore((s) => s.importLayouts);

  const effective = useEffectiveLayout();
  const selectedKey =
    editing && draft ? draft.keys.find((k) => k.id === selectedKeyId) ?? null : null;

  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    saveDraft(saveName.trim() || undefined);
    setShowSaveInput(false);
    setSaveName('');
  };

  const handleExport = (id: string) => {
    const layout = savedLayouts.find((l) => l.id === id);
    if (!layout) return;
    const json = layoutToJson(layout);
    downloadJson(`${layout.name}.json`, json);
  };

  const handleExportAll = () => {
    if (savedLayouts.length === 0) return;
    const json = JSON.stringify(
      {
        app: 'keyboard-studio',
        version: 1,
        exportedAt: new Date().toISOString(),
        layouts: savedLayouts,
      },
      null,
      2
    );
    downloadJson(`keyboard-layouts-${savedLayouts.length}.json`, json);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const layout = await readLayoutFile(file);
      importLayouts([layout]);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败');
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Pencil className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-gray-200">布局编辑</h3>
      </div>

      {/* 当前生效布局状态 */}
      <div className="px-3 py-2 bg-gray-800/40 rounded-lg text-xs text-gray-400">
        当前:{' '}
        <span className={effective.isCustom ? 'text-emerald-300' : 'text-indigo-300'}>
          {effective.name}
        </span>
        <span className="text-gray-500 ml-1">({effective.keys.length} 键)</span>
        {effective.isDraft && (
          <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded">草稿</span>
        )}
      </div>

      {!editing ? (
        <button
          onClick={startEditing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all"
        >
          <Pencil className="w-4 h-4" />
          编辑当前布局
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveInput((v) => !v)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white text-sm rounded-lg transition-all"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
            <button
              onClick={cancelEditing}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-700/80 hover:bg-gray-600 text-gray-200 text-sm rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
              取消
            </button>
          </div>

          {showSaveInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="布局名称"
                autoFocus
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSave}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 吸附设置 */}
          <div className="p-3 bg-gray-800/40 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-gray-300">
                <Magnet className="w-3.5 h-3.5 text-cyan-400" />
                网格吸附
              </span>
              <button
                onClick={() => setSnapEnabled(!snapEnabled)}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  snapEnabled ? 'bg-indigo-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                    snapEnabled ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Grid3x3 className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex-1 flex gap-1">
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setGridSize(size)}
                    className={`flex-1 px-1 py-1 text-xs rounded transition-all ${
                      gridSize === size
                        ? 'bg-indigo-600/80 text-white'
                        : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-gray-500 leading-relaxed">
              <MousePointer2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
              拖动键帽移动 · 拖动角点缩放 · 按住 Shift 对齐其他键
            </p>
          </div>

          {/* 键位检查器 */}
          {selectedKey ? (
            <div className="p-3 bg-gray-800/40 rounded-lg space-y-2">
              <div className="text-xs font-medium text-amber-300">选中键位</div>
              <label className="block">
                <span className="text-[11px] text-gray-500">标签</span>
                <input
                  type="text"
                  value={selectedKey.label}
                  onChange={(e) =>
                    updateDraftKeyMeta(selectedKey.id, { label: e.target.value })
                  }
                  className="mt-0.5 w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-gray-500">键码 (keyCode)</span>
                <input
                  type="text"
                  value={selectedKey.keyCode ?? ''}
                  onChange={(e) =>
                    updateDraftKeyMeta(selectedKey.id, {
                      keyCode: e.target.value || null,
                    })
                  }
                  placeholder="如 KeyA"
                  className="mt-0.5 w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-gray-500">分区</span>
                <div className="relative mt-0.5">
                  <select
                    value={selectedKey.zone}
                    onChange={(e) =>
                      updateDraftKeyMeta(selectedKey.id, { zone: e.target.value as KeyZone })
                    }
                    className="w-full px-2 py-1.5 bg-gray-900/60 border border-gray-700 rounded text-sm text-white appearance-none focus:outline-none focus:border-indigo-500"
                  >
                    {ZONE_LIST.map((z) => (
                      <option key={z} value={z} className="bg-gray-800">
                        {ZONE_CONFIGS[z].name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-gray-500 pt-1 border-t border-gray-700/50">
                <span>
                  ID: <span className="text-gray-400 font-mono">{selectedKey.id}</span>
                </span>
                <span>
                  位置: ({selectedKey.x.toFixed(2)}, {selectedKey.y.toFixed(2)})
                </span>
                <span>
                  尺寸: {selectedKey.width.toFixed(2)} × {selectedKey.height.toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 text-center py-1">
              点击 3D 视图中的键帽查看属性
            </p>
          )}
        </div>
      )}

      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />

      {/* 已保存布局库 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-gray-300">
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            我的布局 ({savedLayouts.length})
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition-all"
              title="导入 JSON"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleExportAll}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition-all"
              title="导出全部"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />

        {importError && (
          <p className="text-[11px] text-red-400 px-2 py-1 bg-red-500/10 rounded-lg">
            {importError}
          </p>
        )}

        {savedLayouts.length === 0 ? (
          <p className="text-[11px] text-gray-500 text-center py-3">
            暂无保存的布局
          </p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {savedLayouts.map((layout) => (
              <div
                key={layout.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                  activeCustomId === layout.id
                    ? 'bg-indigo-600/20 border-indigo-500/50'
                    : 'bg-gray-800/40 border-transparent hover:bg-gray-800/70'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{layout.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {layout.baseType} · {layout.keys.length} 键
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => loadCustomLayout(layout.id)}
                    className="p-1.5 text-gray-400 hover:text-emerald-300 hover:bg-gray-700/60 rounded"
                    title="加载"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleExport(layout.id)}
                    className="p-1.5 text-gray-400 hover:text-cyan-300 hover:bg-gray-700/60 rounded"
                    title="导出 JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteCustomLayout(layout.id)}
                    className="p-1.5 text-gray-400 hover:text-red-300 hover:bg-gray-700/60 rounded"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 恢复默认 */}
      {(effective.isCustom || effective.isDraft) && (
        <>
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
          <button
            onClick={restoreDefault}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 text-sm rounded-xl transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            恢复内置布局
          </button>
        </>
      )}
    </div>
  );
}
