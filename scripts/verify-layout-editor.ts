/* 临时验证脚本：布局编辑核心逻辑 */
import { LAYOUT_CONFIGS } from '@/data/layouts';
import {
  cloneKeys,
  keyWouldOverlap,
  snapValue,
  computeAlignment,
  serializeLayout,
  parseLayoutExport,
  getKeysBounds,
} from '@/lib/layoutUtils';

// localStorage shim（store 的 persist 需要）
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
};

async function main() {
  console.log('== cloneKeys / 内置布局隔离 ==');
  const builtin = LAYOUT_CONFIGS['65%'];
  const snapshot = JSON.stringify(builtin.keys);
  const clone = cloneKeys(builtin.keys);
  clone[0].x = 99;
  clone[1].label = 'HACK';
  assert(JSON.stringify(builtin.keys) === snapshot, '修改副本不影响内置布局');

  console.log('== 重叠检测 ==');
  const keys = cloneKeys(LAYOUT_CONFIGS['60%'].keys);
  const k0 = keys[0]; // Esc at (0,0,1,1)
  const k1 = keys[1]; // '1' at (1.25,0,1,1)
  assert(keyWouldOverlap(keys, k0.id, { x: 1.0, y: 0, w: 1, h: 1 }), '移动到 (1,0) 与 1 键重叠 → 拒绝');
  assert(!keyWouldOverlap(keys, k0.id, { x: 0, y: 0, w: 1, h: 1 }), '原位不判重叠');
  assert(!keyWouldOverlap(keys, k0.id, { x: 0, y: 6, w: 1, h: 1 }), '空白区域不重叠');
  assert(keyWouldOverlap(keys, k1.id, { x: 1.25, y: 0, w: 2, h: 1 }), '加宽到 2u 与 2 键重叠 → 拒绝');
  assert(k0.x === 0 && k1.x === 1.25, '检测本身不修改数据');

  console.log('== 网格吸附 ==');
  assert(snapValue(1.13, 0.05) === 1.1500000000000001 - 0.0000000000000001 || Math.abs(snapValue(1.13, 0.05) - 1.15) < 1e-9, '1.13 → 1.15 (0.05 网格)');
  assert(Math.abs(snapValue(1.13, 0.25) - 1.25) < 1e-9, '1.13 → 1.25 (0.25 网格)');
  assert(snapValue(1.13, 0) === 1.13, '网格为 0 时不吸附');

  console.log('== Shift 对齐 ==');
  // k0 移到靠近 k1 左缘 (1.25) 的位置
  const align = computeAlignment(keys, k0.id, { x: 0.2, y: 0, w: 1, h: 1 });
  assert(Math.abs(align.dx - 0.05) < 1e-9 && align.vertical[0] === 1.25, `右缘吸附到 1 键左缘 (dx=${align.dx})`);
  const alignZ = computeAlignment(keys, k0.id, { x: 0, y: 1.05, w: 1, h: 1 });
  assert(
    Math.abs(Math.abs(alignZ.dz) - 0.05) < 1e-9 && (alignZ.horizontal[0] === 1.1 || alignZ.horizontal[0] === 1),
    `纵向吸附到邻近行边缘 (dz=${alignZ.dz}, line=${alignZ.horizontal[0]})`
  );
  const far = computeAlignment(keys, k0.id, { x: 30, y: 30, w: 1, h: 1 });
  assert(far.vertical.length === 0 && far.horizontal.length === 0, '附近无键位时不产生参考线');

  console.log('== 序列化 / 解析往返 ==');
  const exported = serializeLayout('测试布局', '65%', builtin.keys);
  const json = JSON.stringify(exported);
  const parsed = parseLayoutExport(json);
  assert(parsed.keys.length === builtin.keys.length, '键数一致');
  const orig = builtin.keys.find((k) => k.keyCode === 'Space')!;
  const round = parsed.keys.find((k) => k.id === orig.id)!;
  assert(
    round.id === orig.id && round.keyCode === orig.keyCode && round.label === orig.label && round.zone === orig.zone,
    'id / keyCode / label / zone 完整保留'
  );
  assert(round.x === orig.x && round.width === orig.width, '几何信息保留');
  const bounds = getKeysBounds(parsed.keys);
  assert(parsed.width === bounds.width && parsed.height === bounds.height, '包围盒重算正确');

  console.log('== 非法输入校验 ==');
  const bad = (j: string, msg: string) => {
    try {
      parseLayoutExport(j);
      assert(false, msg);
    } catch {
      assert(true, msg);
    }
  };
  bad('not json', '非 JSON 被拒绝');
  bad('{}', '缺 keys 被拒绝');
  bad(JSON.stringify({ keys: [{ id: 'a' }] }), '缺字段被拒绝');
  bad(JSON.stringify({ keys: [{ id: 'a', label: 'A', zone: 'nope', x: 0, y: 0, width: 1, height: 1 }] }), '非法 zone 被拒绝');
  const dup = exported.keys.slice(0, 2).map((k) => ({ ...k, id: 'same' }));
  bad(JSON.stringify({ keys: dup }), '重复 id 被拒绝');

  console.log('== store 集成 ==');
  const { useKeyboardStore } = await import('@/store/useKeyboardStore');
  const store = useKeyboardStore.getState;
  const beforeBuiltin = JSON.stringify(LAYOUT_CONFIGS['65%'].keys);

  store().enterEditMode();
  assert(store().editMode && store().editingKeys?.length === builtin.keys.length, '进入编辑模式，生成工作副本');

  const esc = store().editingKeys![0]; // Esc: (0, 0, 1, 1)，右侧 0.25u 处是 1 键
  assert(store().updateEditingKey(esc.id, { x: 1.0 }) === false, '重叠移动被拒绝');
  assert(store().editingKeys![0].x === esc.x, '拒绝后保持原位置');
  assert(store().updateEditingKey(esc.id, { x: 0.2 }) === true, '间隙内的合法移动被接受');
  assert(store().updateEditingKey(esc.id, { x: -3 }) === true && store().editingKeys![0].x === 0, '负坐标被钳制到 0');
  assert(store().updateEditingKey(esc.id, { width: 0.1 }) === true && store().editingKeys![0].width === 0.5, '最小尺寸钳制 0.5');

  store().exitEditMode();
  assert(JSON.stringify(LAYOUT_CONFIGS['65%'].keys) === beforeBuiltin, '退出编辑后内置布局零污染');
  assert(store().editingKeys === null && store().selectedKeyId === null, '退出后编辑状态清空');

  store().enterEditMode();
  store().updateEditingKey(store().editingKeys![0].id, { x: 0.2 });
  store().saveCustomLayout('我的布局');
  const saved = store().customLayouts.find((l) => l.name === '我的布局')!;
  assert(!!saved && store().activeCustomLayoutId === saved.id, '保存布局并设为当前');
  assert(saved.keys[0].x === 0.2 && saved.keys[0].keyCode === 'Escape', '保存的布局保留键码与位置');
  store().exitEditMode();

  // 再次编辑已保存布局，修改不应写回已存数据
  store().enterEditMode();
  store().updateEditingKey(store().editingKeys![0].id, { x: 6, y: 6.6 });
  assert(store().editingKeys![0].x === 6, '编辑副本上的修改生效');
  assert(store().customLayouts.find((l) => l.id === saved.id)!.keys[0].x === 0.2, '编辑副本与已存布局隔离');
  store().exitEditMode();

  const exportedJson = store().exportLayoutJson();
  const re = store().importLayoutJson(exportedJson);
  assert(re.ok && store().customLayouts.some((l) => l.name === '我的布局 (导入)'), '导出→导入生成新布局');
  assert(store().importLayoutJson('{"bad":1}').ok === false, '非法导入返回错误');

  store().resetToDefaultLayout();
  assert(store().activeCustomLayoutId === null, '恢复默认清除自定义应用');
  assert(JSON.stringify(LAYOUT_CONFIGS['65%'].keys) === beforeBuiltin, '全流程后内置布局仍未被污染');

  store().deleteCustomLayout(saved.id);
  assert(!store().customLayouts.find((l) => l.id === saved.id), '删除布局生效');

  // 持久化内容包含完整字段
  const persisted = JSON.parse(mem.get('keyboard-studio-layouts')!);
  const pKey = persisted.state.customLayouts[0].keys[0];
  assert(
    'id' in pKey && 'keyCode' in pKey && 'label' in pKey && 'zone' in pKey,
    'localStorage 持久化保留 id/keyCode/label/zone'
  );

  console.log(failures === 0 ? '\n全部通过 ✅' : `\n${failures} 项失败 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
