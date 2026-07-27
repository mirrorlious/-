from pathlib import Path

index_path = Path('index.html')
log_path = Path('TASK_LOGS/2026-07-27-2358-mobile-inline-paragraph-results.md')
workflow_path = Path('.github/workflows/mobile_inline_paragraph_results_once.yml')
script_path = Path('scripts/one_shot_mobile_inline_paragraph_results.py')

text = index_path.read_text(encoding='utf-8')

state_anchor = '''            const [rightPanelOpen, setRightPanelOpen] = useState(savedLayoutState.rightPanelOpen !== false);
            const [splitRatio, setSplitRatio] = useState(Number.isFinite(savedLayoutState.splitRatio) ? Math.min(70, Math.max(52, savedLayoutState.splitRatio)) : 58);
'''
state_replacement = '''            const [rightPanelOpen, setRightPanelOpen] = useState(savedLayoutState.rightPanelOpen !== false);
            const [isLearningPanelWide, setIsLearningPanelWide] = useState(() => typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? true : window.matchMedia('(min-width: 1200px)').matches);
            const [splitRatio, setSplitRatio] = useState(Number.isFinite(savedLayoutState.splitRatio) ? Math.min(70, Math.max(52, savedLayoutState.splitRatio)) : 58);
'''
if text.count(state_anchor) != 1:
    raise SystemExit(f'Learning panel state anchor count: {text.count(state_anchor)}')
text = text.replace(state_anchor, state_replacement, 1)

derived_anchor = '''            const [isFullTextMenuOpen, setIsFullTextMenuOpen] = useState(false);
            const fullTextMenuRef = useRef(null);
'''
derived_replacement = '''            const [isFullTextMenuOpen, setIsFullTextMenuOpen] = useState(false);
            const fullTextMenuRef = useRef(null);
            const isLearningPanelDocked = layoutMode === 'split' && rightPanelOpen && isLearningPanelWide;
'''
if text.count(derived_anchor) != 1:
    raise SystemExit(f'Derived state anchor count: {text.count(derived_anchor)}')
text = text.replace(derived_anchor, derived_replacement, 1)

persistence_anchor = '''            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode } });
            }, [layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode]);

            useEffect(() => {
                if (!isFullTextMenuOpen) return undefined;
'''
persistence_replacement = '''            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode } });
            }, [layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode]);

            useEffect(() => {
                if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
                const mediaQuery = window.matchMedia('(min-width: 1200px)');
                const syncLearningPanelWidth = () => setIsLearningPanelWide(mediaQuery.matches);
                syncLearningPanelWidth();
                if (typeof mediaQuery.addEventListener === 'function') {
                    mediaQuery.addEventListener('change', syncLearningPanelWidth);
                    return () => mediaQuery.removeEventListener('change', syncLearningPanelWidth);
                }
                mediaQuery.addListener(syncLearningPanelWidth);
                return () => mediaQuery.removeListener(syncLearningPanelWidth);
            }, []);

            useEffect(() => {
                if (!isFullTextMenuOpen) return undefined;
'''
if text.count(persistence_anchor) != 1:
    raise SystemExit(f'Media effect anchor count: {text.count(persistence_anchor)}')
text = text.replace(persistence_anchor, persistence_replacement, 1)

inline_anchor = "                                                inlineResultsEnabled={!(layoutMode === 'split' && rightPanelOpen)}"
inline_replacement = "                                                inlineResultsEnabled={!isLearningPanelDocked}"
if text.count(inline_anchor) != 1:
    raise SystemExit(f'Inline result prop anchor count: {text.count(inline_anchor)}')
text = text.replace(inline_anchor, inline_replacement, 1)

route_anchor = '''                                                onOpenAnalysis={(result) => {
                                                    if (layoutMode === 'split' && rightPanelOpen) {
'''
route_replacement = '''                                                onOpenAnalysis={(result) => {
                                                    if (isLearningPanelDocked) {
'''
if text.count(route_anchor) != 1:
    raise SystemExit(f'Paragraph route anchor count: {text.count(route_anchor)}')
text = text.replace(route_anchor, route_replacement, 1)

required = [
    "window.matchMedia('(min-width: 1200px)')",
    "const isLearningPanelDocked = layoutMode === 'split' && rightPanelOpen && isLearningPanelWide;",
    'inlineResultsEnabled={!isLearningPanelDocked}',
    'if (isLearningPanelDocked) {',
    'inlineResultsEnabled && showTranslation && finalTranslationToShow',
    'inlineResultsEnabled && showAnalysis && analysisData && <SyntaxBreakdowns data={analysisData} />'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing responsive inline markers: {missing}')
if text.count('inlineResultsEnabled={!isLearningPanelDocked}') != 1:
    raise SystemExit('Unexpected inline result prop count')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

index_path.write_text(text, encoding='utf-8')

log = log_path.read_text(encoding='utf-8')
log = log.replace('- 状态：审计中', '- 状态：部分完成', 1)
log = log.replace('## 8. 实际修改\n\n待执行。', '''## 8. 实际修改

- 新增 `isLearningPanelWide`，通过 `matchMedia('(min-width: 1200px)')` 与现有 CSS 断点保持同步。
- 新增 `isLearningPanelDocked`：只有宽屏、分栏布局并且侧栏开启时才视为真正的右侧停靠面板。
- `Paragraph.inlineResultsEnabled` 改为 `!isLearningPanelDocked`。
- 段落结果只在 `isLearningPanelDocked` 为真时进入右侧学习面板。
- 侧栏关闭、标准/专注布局或小于 1200px 时，段落翻译与完整长难句拆解直接显示在对应段落下方。
- 视口尺寸变化会实时更新；从桌面缩小到手机尺寸时，已展开结果会自动回到段落下方。
- 全文级结构、练习、笔记和全文分析的侧栏行为未修改。''')
log = log.replace('### 自动测试\n\n待执行。', '''### 自动测试

- 精确源码锚点与响应式条件检查：通过。
- 段落翻译和 `SyntaxBreakdowns` 内联渲染标记检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。''')
log = log.replace('## 12. 未完成项\n\n待执行。', '''## 12. 未完成项

- 浏览器桌面宽屏与手机尺寸的真实交互验收等待用户复测。
- 未合并到 `main`。''')
log = log.replace('## 14. 最终结论\n\n待执行。', '''## 14. 最终结论

功能补丁已完成并进入自动验证。验证通过后提交到 `feat/reader-annotations-v2`。''')
log_path.write_text(log, encoding='utf-8')

for disposable in (workflow_path, script_path):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
