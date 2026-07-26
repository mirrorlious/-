from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-27-0450-paragraph-action-menu.md')
WORKFLOW = Path('.github/workflows/apply_paragraph_action_menu_once.yml')
SELF = Path('scripts/one_shot_paragraph_action_menu.py')

text = INDEX.read_text(encoding='utf-8')

state_anchor = '''            const isConsideredParagraph = text.split(/\s+/).filter(Boolean).length >= 15 && /[.,:;]/.test(text);
            const isPanelOpen = showTranslation || showAnalysis || showQuiz || !!activeNote || isTransLoading || isLocalTransLoading || isAnalysisLoading || isAudioLoading || isQuizLoading || !!audioUrl;
            const showActions = isInteracting || isPanelOpen;
'''
state_replacement = '''            const isConsideredParagraph = text.split(/\s+/).filter(Boolean).length >= 15 && /[.,:;]/.test(text);
            const hasParagraphResult = showTranslation || showAnalysis || showQuiz || !!activeNote || !!audioUrl;
'''
if state_anchor not in text:
    raise SystemExit('Paragraph state anchor not found')
text = text.replace(state_anchor, state_replacement, 1)

close_effect_anchor = '''            useEffect(() => {
                if (!showActions) return undefined;
                const closeMenu = (event) => {
                    if (!event.target.closest('[data-reader-paragraph]')) setIsInteracting(false);
                };
                const handleKeyDown = (event) => {
                    if (event.key === 'Escape') setIsInteracting(false);
                };
                document.addEventListener('pointerdown', closeMenu);
                document.addEventListener('keydown', handleKeyDown);
                return () => {
                    document.removeEventListener('pointerdown', closeMenu);
                    document.removeEventListener('keydown', handleKeyDown);
                };
            }, [showActions]);

            const handleParagraphClick = (e) => {
                if (window.getSelection() && window.getSelection().toString().length > 0) return;
                if (!isPanelOpen) setIsInteracting(prev => !prev);
            };
'''
close_effect_replacement = '''            useEffect(() => {
                if (!isInteracting) return undefined;
                const closeMenu = (event) => {
                    if (!paragraphRef.current?.contains(event.target)) setIsInteracting(false);
                };
                const handleKeyDown = (event) => {
                    if (event.key === 'Escape') setIsInteracting(false);
                };
                document.addEventListener('pointerdown', closeMenu);
                document.addEventListener('keydown', handleKeyDown);
                return () => {
                    document.removeEventListener('pointerdown', closeMenu);
                    document.removeEventListener('keydown', handleKeyDown);
                };
            }, [isInteracting]);

            const toggleParagraphMenu = (event) => {
                event.stopPropagation();
                setIsInteracting(previous => !previous);
            };

            const runParagraphAction = (handler) => (event) => {
                handler(event);
                setIsInteracting(false);
            };

            const handleCopyParagraph = async (event) => {
                event.stopPropagation();
                try {
                    await navigator.clipboard?.writeText(text);
                    window.showToast('本段已复制', 'success');
                } catch (error) {
                    window.showToast('复制失败，请手动选择文字复制', 'warning');
                } finally {
                    setIsInteracting(false);
                }
            };
'''
if close_effect_anchor not in text:
    raise SystemExit('Paragraph close effect anchor not found')
text = text.replace(close_effect_anchor, close_effect_replacement, 1)

wrapper_anchor = '''                    className="mb-14 relative group"
                    onMouseEnter={() => setIsInteracting(true)}
                    onMouseLeave={() => setIsInteracting(false)}
                >'''
wrapper_replacement = '''                    className="mb-14 relative group"
                >'''
if wrapper_anchor not in text:
    raise SystemExit('Paragraph hover wrapper anchor not found')
text = text.replace(wrapper_anchor, wrapper_replacement, 1)

click_anchor = '''                        onClick={handleParagraphClick}
                        onContextMenu={handleSelectionContextMenu}'''
click_replacement = '''                        onContextMenu={handleSelectionContextMenu}'''
if click_anchor not in text:
    raise SystemExit('Paragraph click anchor not found')
text = text.replace(click_anchor, click_replacement, 1)

trigger_start = text.index('                    {!showActions && (')
trigger_end = text.index('                    {activeNote && (', trigger_start)
new_trigger = '''                    <button
                        type="button"
                        data-reader-paragraph-trigger="true"
                        onClick={toggleParagraphMenu}
                        aria-haspopup="menu"
                        aria-expanded={isInteracting}
                        aria-label={`打开第 ${paragraphIndex + 1} 段工具`}
                        title="本段工具"
                        className={`absolute top-0 right-0 md:-right-11 z-30 w-9 h-9 grid place-items-center rounded-sm border bg-white/95 dark:bg-gray-800/95 shadow-sm text-gray-500 dark:text-gray-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${isInteracting ? 'opacity-100 border-sky-300 text-sky-700 dark:text-sky-300 dark:border-sky-700' : 'opacity-100 md:opacity-30 border-gray-200 dark:border-gray-700 md:group-hover:opacity-100 hover:text-sky-700 hover:border-sky-200 dark:hover:text-sky-300'}`}
                    >
                        <span aria-hidden="true" className="text-lg leading-none -mt-1">⋯</span>
                        {hasParagraphResult && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-sky-500" aria-label="本段已有学习结果"></span>}
                    </button>

                    {isInteracting && (
                        <div
                            data-reader-paragraph-menu="true"
                            role="menu"
                            aria-label={`第 ${paragraphIndex + 1} 段工具`}
                            className="absolute top-10 right-0 md:-right-2 z-40 w-60 overflow-hidden rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 shadow-xl animate-fade-in-down"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-[11px] text-gray-400 dark:text-gray-500">第 {paragraphIndex + 1} 段 · 本段工具</div>
                            <div className="p-1.5">
                                <button role="menuitem" onClick={runParagraphAction(handleToggleTrans)} disabled={(isTransLoading || isLocalTransLoading) && !finalTranslationToShow} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
                                    <span>{showTranslation ? '收起段落翻译' : '翻译本段'}</span>
                                    {(isTransLoading || isLocalTransLoading) && !finalTranslationToShow ? <span className="text-[10px] text-gray-400">处理中</span> : showTranslation ? <span className="text-sky-600">✓</span> : null}
                                </button>
                                <button role="menuitem" onClick={runParagraphAction(handleToggleAnalysis)} disabled={!isConsideredParagraph || isAnalysisLoading} title={!isConsideredParagraph ? '当前段落较短，暂无复杂句式' : ''} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-45 disabled:cursor-not-allowed">
                                    <span>{showAnalysis ? '收起长难句拆解' : '长难句拆解'}</span>
                                    {isAnalysisLoading ? <span className="text-[10px] text-gray-400">解构中</span> : showAnalysis ? <span className="text-amber-600">✓</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">本段较短</span> : null}
                                </button>
                                <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
                                <button role="menuitem" onClick={runParagraphAction(handleLocalSpeech)} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <span>本地朗读</span><span className="text-[10px] text-gray-400">免费</span>
                                </button>
                                <button role="menuitem" onClick={runParagraphAction(handleToggleAudio)} disabled={isAudioLoading || !!audioUrl} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
                                    <span>{audioUrl ? '外教领读已生成' : '外教领读'}</span>
                                    {isAudioLoading ? <span className="text-[10px] text-gray-400">请求中</span> : audioUrl ? <span className="text-blue-600">✓</span> : <span className="text-[10px] text-gray-400">调用模型</span>}
                                </button>
                                <button role="menuitem" onClick={runParagraphAction(handleToggleQuiz)} disabled={!isConsideredParagraph || isQuizLoading} title={!isConsideredParagraph ? '当前内容不足以生成有效练习' : ''} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-45 disabled:cursor-not-allowed">
                                    <span>{showQuiz ? '收起段落练习' : '生成练习'}</span>
                                    {isQuizLoading ? <span className="text-[10px] text-gray-400">生成中</span> : showQuiz ? <span className="text-violet-600">✓</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">内容不足</span> : null}
                                </button>
                                <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
                                <button role="menuitem" onClick={handleCopyParagraph} className="w-full min-h-[40px] px-3 rounded-sm text-left text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">复制段落</button>
                            </div>
                            {!isConsideredParagraph && <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-[10px] leading-relaxed text-gray-400">本段较短，翻译、朗读和复制仍可使用；长难句与练习暂不建议生成。</div>}
                        </div>
                    )}

'''
text = text[:trigger_start] + new_trigger + text[trigger_end:]

actions_start = text.index('                    <div role="menu" aria-label="Paragraph actions"')
actions_end = text.index('\n\n                    {audioUrl &&', actions_start)
text = text[:actions_start] + text[actions_end:]

required = [
    'data-reader-paragraph-trigger="true"',
    'data-reader-paragraph-menu="true"',
    '本段较短，翻译、朗读和复制仍可使用',
    'const handleCopyParagraph = async',
    'md:group-hover:opacity-100'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing paragraph menu markers: {missing}')
for forbidden in [
    'aria-label="Paragraph actions"',
    'onMouseEnter={() => setIsInteracting(true)}',
    'onMouseLeave={() => setIsInteracting(false)}',
    'handleParagraphClick',
    'const showActions ='
]:
    if forbidden in text:
        raise SystemExit(f'Legacy paragraph action marker still present: {forbidden}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

INDEX.write_text(text, encoding='utf-8')

if LOG.exists():
    log = LOG.read_text(encoding='utf-8')
    log = log.replace('- 状态：审计中', '- 状态：部分完成', 1)
    log = log.replace('## 7. 实际修改\n\n开发中。', '''## 7. 实际修改

- 删除段落 `onMouseEnter/onMouseLeave` 自动展开逻辑，悬停不再改变正文高度。
- 删除段落底部进入文档流的横向大按钮组。
- 每段右侧新增绝对定位 `⋯` 入口；桌面端低透明度，悬停和聚焦时增强，触屏端始终可见。
- 点击入口后打开浮层菜单，菜单不占文档流；点击空白、按 `Esc` 或再次点击入口关闭。
- 外部点击判断改为当前段落 DOM 范围，因此点击另一段入口时旧菜单会关闭。
- 菜单复用现有翻译、长难句、本地朗读、外教领读和出题函数，并新增复制段落。
- 短段落仍保留菜单与基础操作；长难句和生成练习显示为置灰状态并给出原因。
- 已有翻译、句法、练习或音频结果时，右侧入口显示状态圆点。''')
    log = log.replace('## 8. 测试\n\n待执行。', '''## 8. 测试

- 旧 Hover 自动展开标记检查：通过。
- 旧文档流按钮组移除检查：通过。
- 新 `⋯` 入口与浮层菜单标记检查：通过。
- HTML script 标签数量检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器真实交互：等待用户本地验收。''')
    log = log.replace('## 9. 未完成项\n\n开发中。', '''## 9. 未完成项

- 用户本地验收桌面端菜单定位、点击外部关闭和手机端可见性。
- 后续第二阶段再处理选区工具条分级。
- 后续合并阶段处理右侧结果面板与全文工具。
- 未合并到 `main`。''')
    LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
