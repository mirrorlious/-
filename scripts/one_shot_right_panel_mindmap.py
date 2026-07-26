from pathlib import Path

index_path = Path('index.html')
log_path = Path('TASK_LOGS/2026-07-27-2240-right-panel-mindmap.md')
workflow_path = Path('.github/workflows/right_panel_mindmap_once.yml')
script_path = Path('scripts/one_shot_right_panel_mindmap.py')

text = index_path.read_text(encoding='utf-8')

css_anchor = '''        .reader-annotation-mark {
'''
mindmap_css = '''        .reader-mindmap-scroll {
            width: 100%;
            overflow: auto;
            overscroll-behavior: contain;
            padding-bottom: 4px;
        }

        .reader-mindmap-canvas {
            min-width: 620px;
            padding: 22px 18px 26px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 24px;
            background:
                radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.08), transparent 42%),
                linear-gradient(rgba(226, 232, 240, 0.38) 1px, transparent 1px),
                linear-gradient(90deg, rgba(226, 232, 240, 0.38) 1px, transparent 1px);
            background-size: auto, 24px 24px, 24px 24px;
            border: 1px solid rgba(203, 213, 225, 0.9);
        }

        .dark .reader-mindmap-canvas {
            background:
                radial-gradient(circle at 50% 0%, rgba(14, 165, 233, 0.13), transparent 42%),
                linear-gradient(rgba(71, 85, 105, 0.28) 1px, transparent 1px),
                linear-gradient(90deg, rgba(71, 85, 105, 0.28) 1px, transparent 1px);
            background-size: auto, 24px 24px, 24px 24px;
            border-color: rgba(71, 85, 105, 0.9);
        }

        .reader-mindmap-node {
            position: relative;
            border: 1px solid rgba(148, 163, 184, 0.72);
            background: rgba(255, 255, 255, 0.96);
            color: #1f2937;
            box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
        }

        .dark .reader-mindmap-node {
            background: rgba(30, 41, 59, 0.96);
            color: #e5e7eb;
            border-color: rgba(100, 116, 139, 0.86);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
        }

        .reader-mindmap-root {
            width: min(320px, 78%);
            padding: 13px 16px;
            border-color: #0284c7;
            background: #0369a1;
            color: white;
            text-align: center;
        }

        .dark .reader-mindmap-root {
            background: #075985;
            border-color: #38bdf8;
            color: #f0f9ff;
        }

        .reader-mindmap-branches {
            position: relative;
            width: 100%;
            display: grid;
            grid-template-columns: repeat(2, minmax(230px, 1fr));
            gap: 24px 32px;
            padding-top: 16px;
        }

        .reader-mindmap-branches::before {
            content: '';
            position: absolute;
            top: 0;
            left: 25%;
            right: 25%;
            border-top: 1px solid rgba(56, 189, 248, 0.78);
        }

        .reader-mindmap-branch {
            position: relative;
            min-width: 0;
            padding-top: 10px;
        }

        .reader-mindmap-branch::before {
            content: '';
            position: absolute;
            top: -16px;
            left: 50%;
            height: 26px;
            border-left: 1px solid rgba(56, 189, 248, 0.78);
        }

        .reader-mindmap-branch-node {
            padding: 10px 12px;
            border-color: rgba(14, 165, 233, 0.62);
            background: rgba(240, 249, 255, 0.98);
        }

        .dark .reader-mindmap-branch-node {
            background: rgba(8, 47, 73, 0.92);
            border-color: rgba(56, 189, 248, 0.55);
        }

        .reader-mindmap-leaves {
            margin-top: 10px;
            margin-left: 14px;
            padding-left: 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-left: 1px solid rgba(148, 163, 184, 0.58);
        }

        .reader-mindmap-leaf {
            position: relative;
            padding: 8px 10px;
            font-size: 11.5px;
            line-height: 1.45;
        }

        .reader-mindmap-leaf::before {
            content: '';
            position: absolute;
            top: 50%;
            left: -15px;
            width: 14px;
            border-top: 1px solid rgba(148, 163, 184, 0.58);
        }

'''
if text.count(css_anchor) != 1:
    raise SystemExit(f'CSS anchor count: {text.count(css_anchor)}')
text = text.replace(css_anchor, mindmap_css + css_anchor, 1)

component_anchor = '''        const getMindMapBranchPaths = (node, nodePath = 'root') => {
'''
mindmap_components = '''        const MindMapNodeText = ({ node, displayMode = 'bilingual', isRoot = false }) => {
            const en = node?.nameEn || '';
            const zh = node?.nameZh || '';
            if (displayMode === 'en') return <div className={`${isRoot ? 'font-semibold' : 'font-serif font-semibold'} leading-snug break-words`}>{en || zh || 'Untitled'}</div>;
            if (displayMode === 'zh') return <div className="font-medium leading-snug break-words">{zh || en || '未命名节点'}</div>;
            return (
                <div className="min-w-0">
                    <div className={`${isRoot ? 'font-semibold' : 'font-serif font-semibold'} leading-snug break-words`}>{en || zh || 'Untitled'}</div>
                    {zh && en && <div className={`mt-1 break-words ${isRoot ? 'text-sky-100' : 'text-slate-500 dark:text-slate-300'}`}>{zh}</div>}
                </div>
            );
        };

        const MindMapLeafList = ({ nodes = [], displayMode = 'bilingual', depth = 0 }) => {
            if (!Array.isArray(nodes) || nodes.length === 0) return null;
            return (
                <div className="reader-mindmap-leaves" data-depth={depth}>
                    {nodes.map((node, index) => (
                        <div key={`${depth}-${index}`}>
                            <div className="reader-mindmap-node reader-mindmap-leaf">
                                <MindMapNodeText node={node} displayMode={displayMode} />
                            </div>
                            <MindMapLeafList nodes={node.children || []} displayMode={displayMode} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            );
        };

        const MindMapCanvas = ({ mindmap, displayMode = 'bilingual' }) => {
            if (!mindmap) return null;
            const branches = Array.isArray(mindmap.children) ? mindmap.children : [];
            return (
                <div className="reader-mindmap-scroll custom-scrollbar" data-reader-mindmap-canvas="true">
                    <div className="reader-mindmap-canvas">
                        <div className="reader-mindmap-node reader-mindmap-root">
                            <MindMapNodeText node={mindmap} displayMode={displayMode} isRoot={true} />
                        </div>
                        {branches.length > 0 && (
                            <div className="reader-mindmap-branches">
                                {branches.map((branch, index) => (
                                    <div key={index} className="reader-mindmap-branch">
                                        <div className="reader-mindmap-node reader-mindmap-branch-node">
                                            <MindMapNodeText node={branch} displayMode={displayMode} />
                                        </div>
                                        <MindMapLeafList nodes={branch.children || []} displayMode={displayMode} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );
        };

'''
if text.count(component_anchor) != 1:
    raise SystemExit(f'Component anchor count: {text.count(component_anchor)}')
text = text.replace(component_anchor, mindmap_components + component_anchor, 1)

state_old = "const [rightPanelTab, setRightPanelTab] = useState(['outline', 'analysis', 'notes'].includes(savedLayoutState.rightPanelTab) ? savedLayoutState.rightPanelTab : 'outline');"
state_new = "const [rightPanelTab, setRightPanelTab] = useState(['outline', 'mindmap', 'analysis', 'notes'].includes(savedLayoutState.rightPanelTab) ? savedLayoutState.rightPanelTab : 'outline');"
if text.count(state_old) != 1:
    raise SystemExit(f'Right panel state anchor count: {text.count(state_old)}')
text = text.replace(state_old, state_new, 1)

tabs_old = '''                                                    ['outline', '全文结构'],
                                                    ['analysis', '精读结果'],
                                                    ['notes', `学习笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]
'''
tabs_new = '''                                                    ['outline', '全文结构'],
                                                    ['mindmap', '思维导图'],
                                                    ['analysis', '精读结果'],
                                                    ['notes', `学习笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]
'''
if text.count(tabs_old) != 1:
    raise SystemExit(f'Right panel tabs anchor count: {text.count(tabs_old)}')
text = text.replace(tabs_old, tabs_new, 1)

outline_line = '''                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-[11px] text-gray-400">全文结构 · 双语</span><button onClick={openMapEditorModal} className="min-h-[30px] px-2 text-[11px] border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-white dark:hover:bg-gray-800">全屏编辑</button></div><LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode="bilingual" collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} /></div> : isAnalyzingMap ? <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">正在生成全文结构…</p></div> : <div className="py-8 text-center"><p className="text-gray-400 dark:text-gray-500">尚未生成全文结构。</p><button onClick={handleFullOutlineTool} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成思维导图</button></div>)}
'''
mindmap_line = '''                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-[11px] text-gray-400">全文结构 · 双语</span><button onClick={openMapEditorModal} className="min-h-[30px] px-2 text-[11px] border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-white dark:hover:bg-gray-800">全屏编辑</button></div><LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode="bilingual" collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} /></div> : isAnalyzingMap ? <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">正在生成全文结构…</p></div> : <div className="py-8 text-center"><p className="text-gray-400 dark:text-gray-500">尚未生成全文结构。</p><button onClick={handleFullOutlineTool} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成全文结构</button></div>)}
                                                {rightPanelTab === 'mindmap' && (fullMapData?.mindmap ? (
                                                    <div className="space-y-3" data-reader-mindmap-panel="true">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-sm">
                                                                {[
                                                                    ['bilingual', '双语'],
                                                                    ['en', '英'],
                                                                    ['zh', '中']
                                                                ].map(([mode, label]) => (
                                                                    <button key={mode} onClick={() => setMapMode(mode)} className={`min-h-[28px] px-2 text-[11px] rounded-[2px] ${mapMode === mode ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{label}</button>
                                                                ))}
                                                            </div>
                                                            <button onClick={openMapEditorModal} className="min-h-[30px] px-2 text-[11px] border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-white dark:hover:bg-gray-800">全屏编辑</button>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400">与全文结构共用同一份数据，不会重复调用模型。</p>
                                                        <MindMapCanvas mindmap={fullMapData.mindmap} displayMode={mapMode} />
                                                    </div>
                                                ) : isAnalyzingMap ? (
                                                    <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">正在生成思维导图…</p></div>
                                                ) : (
                                                    <div className="py-8 text-center" data-reader-mindmap-empty="true"><p className="text-gray-400 dark:text-gray-500">尚未生成思维导图。</p><button onClick={async () => { setRightPanelTab('mindmap'); await handleGenerateSummary(); }} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成思维导图</button></div>
                                                ))}
'''
if text.count(outline_line) != 1:
    raise SystemExit(f'Outline render anchor count: {text.count(outline_line)}')
text = text.replace(outline_line, mindmap_line, 1)

required = [
    "['outline', 'mindmap', 'analysis', 'notes']",
    "['mindmap', '思维导图']",
    "rightPanelTab === 'mindmap'",
    'data-reader-mindmap-panel="true"',
    'data-reader-mindmap-canvas="true"',
    '<MindMapCanvas mindmap={fullMapData.mindmap} displayMode={mapMode} />',
    '与全文结构共用同一份数据，不会重复调用模型。'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing mind map markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

index_path.write_text(text, encoding='utf-8')

log = log_path.read_text(encoding='utf-8')
log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
log = log.replace('## 7. 实际修改\n\n开发中。', '''## 7. 实际修改

- `rightPanelTab` 新增 `mindmap` 并纳入本地布局状态恢复。
- 右侧顶部标签更新为“全文结构 / 思维导图 / 精读结果 / 学习笔记”。
- 新增 `MindMapCanvas`：中心主题位于上方，一级分支以双列卡片展开，后续节点沿连线递归展示。
- 思维导图与全文结构复用 `fullMapData.mindmap`，切换标签不会产生新的模型调用。
- 思维导图支持双语、英文、中文切换。
- 思维导图标签中可进入现有全屏编辑器。
- 无数据时可直接生成思维导图；生成后结构树和导图都可立即使用。
- 保持侧栏 sticky 与内部滚动结构不变。''')
log = log.replace('## 8. 测试\n\n待执行。', '''## 8. 测试

- 右侧四标签与 `mindmap` 状态检查：通过。
- 思维导图组件、数据复用提示和全屏编辑入口检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器视觉验收：等待用户本地复测。''')
log_path.write_text(log, encoding='utf-8')

for disposable in (workflow_path, script_path):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
