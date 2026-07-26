from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-28-0200-four-reading-panel-improvements.md')
WORKFLOW = Path('.github/workflows/four_panel_improvements_once.yml')
SELF = Path('scripts/one_shot_four_panel_improvements.py')

text = INDEX.read_text(encoding='utf-8')

# -----------------------------------------------------------------------------
# 1. Add an interactive single-question practice component.
# -----------------------------------------------------------------------------
quiz_set_anchor = '        const QuizSetPractice = ({ quizData }) => {'
if text.count(quiz_set_anchor) != 1:
    raise SystemExit(f'QuizSetPractice anchor count: {text.count(quiz_set_anchor)}')

single_quiz_component = r'''        const SingleQuizPractice = ({ quizData }) => {
            const [selectedAnswer, setSelectedAnswer] = useState('');
            const [submitted, setSubmitted] = useState(false);
            const quiz = quizData || {};
            const options = Array.isArray(quiz.options) ? quiz.options : [];
            const submit = () => {
                if (!selectedAnswer) {
                    window.showToast('请先选择一个答案', 'warning');
                    return;
                }
                setSubmitted(true);
            };
            return (
                <div className="space-y-4" data-reader-single-practice="true">
                    <div>
                        <p className="font-serif font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{quiz.questionEn}</p>
                        {submitted && quiz.questionZh && <p className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{quiz.questionZh}</p>}
                    </div>
                    <div className="space-y-2">
                        {options.map(option => {
                            const isSelected = selectedAnswer === option.id;
                            const isCorrect = submitted && option.id === quiz.correctAnswerId;
                            const isWrong = submitted && isSelected && option.id !== quiz.correctAnswerId;
                            const className = isCorrect
                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                : isWrong
                                    ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20'
                                    : isSelected
                                        ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
                                        : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 hover:border-sky-300';
                            return (
                                <button key={option.id} type="button" disabled={submitted} onClick={() => setSelectedAnswer(option.id)} className={`w-full p-3 border rounded-sm text-left transition-colors ${className}`}>
                                    <div className="font-medium">{option.id}. {option.textEn}</div>
                                    {submitted && option.textZh && <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{option.textZh}</div>}
                                </button>
                            );
                        })}
                    </div>
                    {!submitted ? (
                        <button type="button" onClick={submit} className="min-h-[38px] px-4 rounded-sm bg-sky-700 text-white hover:bg-sky-800">提交答案</button>
                    ) : (
                        <div className="space-y-3">
                            <div className={`font-semibold ${selectedAnswer === quiz.correctAnswerId ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {selectedAnswer === quiz.correctAnswerId ? '回答正确' : `回答错误，正确答案：${quiz.correctAnswerId || '-'}`}
                            </div>
                            {quiz.analysis && <div className="p-3 bg-violet-50 dark:bg-violet-900/15 border-l-2 border-violet-400 leading-relaxed"><span className="font-semibold">解析：</span>{quiz.analysis}</div>}
                            <button type="button" onClick={() => { setSelectedAnswer(''); setSubmitted(false); }} className="min-h-[34px] px-3 border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-800">重新作答</button>
                        </div>
                    )}
                </div>
            );
        };

'''
text = text.replace(quiz_set_anchor, single_quiz_component + quiz_set_anchor, 1)

# -----------------------------------------------------------------------------
# 2. Migrate right panel tabs and add structure view, practice and translation feed state.
# -----------------------------------------------------------------------------
old_tab_state = "            const [rightPanelTab, setRightPanelTab] = useState(['outline', 'mindmap', 'analysis', 'notes'].includes(savedLayoutState.rightPanelTab) ? savedLayoutState.rightPanelTab : 'outline');"
new_tab_state = """            const migratedRightPanelTab = savedLayoutState.rightPanelTab === 'mindmap' ? 'outline' : savedLayoutState.rightPanelTab;
            const [rightPanelTab, setRightPanelTab] = useState(['outline', 'quiz', 'analysis', 'notes'].includes(migratedRightPanelTab) ? migratedRightPanelTab : 'outline');
            const [structureViewMode, setStructureViewMode] = useState(savedLayoutState.structureViewMode === 'mindmap' ? 'mindmap' : 'tree');"""
if text.count(old_tab_state) != 1:
    raise SystemExit(f'Right panel tab state anchor count: {text.count(old_tab_state)}')
text = text.replace(old_tab_state, new_tab_state, 1)

old_analysis_state = "            const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);"
new_analysis_state = """            const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);
            const [rightPanelTranslationStack, setRightPanelTranslationStack] = useState([]);
            const [practicePanelResult, setPracticePanelResult] = useState(null);"""
if text.count(old_analysis_state) != 1:
    raise SystemExit(f'Analysis state anchor count: {text.count(old_analysis_state)}')
text = text.replace(old_analysis_state, new_analysis_state, 1)

old_layout_effect = """            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio } });
            }, [layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio]);"""
new_layout_effect = """            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode } });
            }, [layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode]);"""
if text.count(old_layout_effect) != 1:
    raise SystemExit(f'Layout persistence anchor count: {text.count(old_layout_effect)}')
text = text.replace(old_layout_effect, new_layout_effect, 1)

current_history_anchor = "            const [currentHistoryId, setCurrentHistoryId] = useState(null);"
current_history_replacement = """            const [currentHistoryId, setCurrentHistoryId] = useState(null);
            useEffect(() => {
                setRightPanelTranslationStack([]);
                setPracticePanelResult(null);
            }, [currentHistoryId]);"""
if text.count(current_history_anchor) != 1:
    raise SystemExit(f'Current history anchor count: {text.count(current_history_anchor)}')
text = text.replace(current_history_anchor, current_history_replacement, 1)

# -----------------------------------------------------------------------------
# 3. Route full and paragraph exercises to the dedicated practice tab.
# -----------------------------------------------------------------------------
full_quiz_start = text.index('            const handleFullQuizTool = async () => {')
full_quiz_end = text.index('            const handleFullNotesTool = () => {', full_quiz_start)
new_full_quiz = r'''            const handleFullQuizTool = async () => {
                setIsFullTextMenuOpen(false);
                openRightPanelTab('quiz');
                if (normalizeQuizQuestions(fullQuizData).length >= 3) {
                    const result = { kind: 'document-quiz', title: '全文模拟习题', data: fullQuizData, createdAt: Date.now() };
                    setPracticePanelResult(result);
                    return fullQuizData;
                }
                setIsFullQuizLoading(true);
                setPracticePanelResult({ kind: 'loading', title: '全文模拟习题', message: '正在生成三道全文练习…' });
                try {
                    const data = await callGeminiFullQuiz(getModelSafeText(inputText || defaultText, 18000, '全文练习'), apiConfig);
                    setFullQuizData(data);
                    setPracticePanelResult({ kind: 'document-quiz', title: '全文模拟习题', data, createdAt: Date.now() });
                    return data;
                } catch (error) {
                    setPracticePanelResult({ kind: 'error', title: '全文模拟习题', message: error.message });
                    window.showToast(`全文练习生成失败：${error.message}`, 'error');
                    return null;
                } finally {
                    setIsFullQuizLoading(false);
                }
            };

'''
text = text[:full_quiz_start] + new_full_quiz + text[full_quiz_end:]

# Replace paragraph result routing.
old_open_analysis = r'''                                                onOpenAnalysis={(result) => {
                                                    if (layoutMode === 'split' && rightPanelOpen) {
                                                        setRightPanelAnalysis(result);
                                                        setRightPanelTab('analysis');
                                                    }
                                                }}'''
new_open_analysis = r'''                                                onOpenAnalysis={(result) => {
                                                    if (layoutMode === 'split' && rightPanelOpen) {
                                                        if (result.kind === 'paragraph-quiz') {
                                                            setPracticePanelResult(result);
                                                            setRightPanelTab('quiz');
                                                            return;
                                                        }
                                                        if (result.kind === 'paragraph-translation') {
                                                            setRightPanelTranslationStack(previous => {
                                                                const next = previous.filter(item => item.paragraphIndex !== result.paragraphIndex);
                                                                return [...next, result].sort((a, b) => a.paragraphIndex - b.paragraphIndex);
                                                            });
                                                            setRightPanelTab('analysis');
                                                            return;
                                                        }
                                                        setRightPanelAnalysis(result);
                                                        setRightPanelTab('analysis');
                                                    }
                                                }}'''
if text.count(old_open_analysis) != 1:
    raise SystemExit(f'Paragraph open analysis anchor count: {text.count(old_open_analysis)}')
text = text.replace(old_open_analysis, new_open_analysis, 1)

# -----------------------------------------------------------------------------
# 4. Add practice renderer and replace the analysis renderer with translation stacking.
# -----------------------------------------------------------------------------
analysis_renderer_start = text.index('            const renderRightPanelAnalysis = () => {')
analysis_renderer_end = text.index('            const readerToolbarIconClass =', analysis_renderer_start)
new_renderers = r'''            const renderPracticePanel = () => {
                const result = practicePanelResult;
                if (result?.kind === 'loading' || (isFullQuizLoading && !result)) {
                    return <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">{result?.message || '正在生成模拟习题…'}</p></div>;
                }
                if (result?.kind === 'error') {
                    return <div className="p-3 border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/15 rounded-sm text-red-700 dark:text-red-300"><h3 className="font-semibold">{result.title || '生成失败'}</h3><p className="mt-2 leading-relaxed">{result.message}</p></div>;
                }
                if (result?.kind === 'paragraph-quiz') {
                    return (
                        <div className="space-y-4" data-reader-practice-panel="paragraph">
                            <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between gap-3">
                                    <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">{result.title || '段落模拟习题'}</h3><p className="mt-1 text-[11px] text-gray-400">第 {result.paragraphIndex + 1} 段</p></div>
                                    <button onClick={() => setPracticePanelResult(null)} className="w-7 h-7 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="关闭当前段落练习">×</button>
                                </div>
                                {result.sourceText && <blockquote className="mt-3 pl-3 border-l-2 border-violet-300 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-4">“{result.sourceText}”</blockquote>}
                            </div>
                            <SingleQuizPractice quizData={result.data} />
                            {normalizeQuizQuestions(fullQuizData).length >= 3 && <button type="button" onClick={() => setPracticePanelResult({ kind: 'document-quiz', title: '全文模拟习题', data: fullQuizData, createdAt: Date.now() })} className="min-h-[34px] px-3 border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-800">查看全文三题</button>}
                        </div>
                    );
                }
                const quizData = result?.kind === 'document-quiz' ? result.data : fullQuizData;
                if (normalizeQuizQuestions(quizData).length) {
                    return (
                        <div className="space-y-4" data-reader-practice-panel="document">
                            <div className="pb-3 border-b border-gray-200 dark:border-gray-700"><h3 className="font-semibold text-gray-900 dark:text-gray-100">全文模拟习题</h3><p className="mt-1 text-[11px] text-gray-400">完成三题后提交，随后显示答案与解析。</p></div>
                            <QuizSetPractice quizData={quizData} />
                        </div>
                    );
                }
                return (
                    <div className="py-8 text-center" data-reader-practice-empty="true">
                        <p className="text-[13px] text-gray-400 dark:text-gray-500">尚未生成模拟习题。</p>
                        <button onClick={handleFullQuizTool} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成全文三题</button>
                    </div>
                );
            };

            const renderRightPanelAnalysis = () => {
                const result = rightPanelAnalysis;
                const translations = rightPanelTranslationStack;
                const translationCards = translations.length ? (
                    <section className="space-y-3" data-reader-translation-stack="true">
                        <div className="flex items-center justify-between gap-3">
                            <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">段落翻译</h3><p className="mt-1 text-[11px] text-gray-400">已保留 {translations.length} 个段落结果</p></div>
                            <button type="button" onClick={() => setRightPanelTranslationStack([])} className="min-h-[30px] px-2 text-[11px] border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-white dark:hover:bg-gray-800">全部清空</button>
                        </div>
                        {translations.map(item => (
                            <article key={`translation-${item.paragraphIndex}`} className="p-3 border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/30 rounded-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="text-[11px] font-medium text-sky-700 dark:text-sky-300">第 {item.paragraphIndex + 1} 段</div>
                                    <button type="button" onClick={() => setRightPanelTranslationStack(previous => previous.filter(entry => entry.paragraphIndex !== item.paragraphIndex))} className="w-6 h-6 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label={`移除第 ${item.paragraphIndex + 1} 段翻译`}>×</button>
                                </div>
                                {item.sourceText && <blockquote className="mt-2 pl-3 border-l-2 border-sky-200 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-3">“{item.sourceText}”</blockquote>}
                                <div className="mt-3 whitespace-pre-wrap leading-[1.8] text-[14px]">{item.data?.translation || '暂无翻译结果'}</div>
                            </article>
                        ))}
                    </section>
                ) : null;

                if (!result && !translations.length) {
                    return (
                        <div className="py-8 text-center">
                            <p className="text-[13px] text-gray-400 dark:text-gray-500">段落翻译、长难句和全文分析会集中显示在这里。</p>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <button onClick={handleFullTranslationTool} className="min-h-[38px] rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] hover:bg-white dark:hover:bg-gray-800">全文翻译</button>
                                <button onClick={handleFullLogicTool} className="min-h-[38px] rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] hover:bg-white dark:hover:bg-gray-800">全文逻辑</button>
                            </div>
                        </div>
                    );
                }

                let currentBlock = null;
                if (result?.kind === 'loading') {
                    currentBlock = <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">{result.message || '正在处理…'}</p></div>;
                } else if (result?.kind === 'error') {
                    currentBlock = <div className="p-3 border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/15 rounded-sm text-red-700 dark:text-red-300"><h3 className="font-semibold">{result.title || '处理失败'}</h3><p className="mt-2 leading-relaxed">{result.message}</p></div>;
                } else if (result) {
                    let content = null;
                    if (result.kind === 'paragraph-analysis') {
                        content = result.data?.complexSentences?.length ? <SyntaxBreakdowns data={result.data} /> : <p className="text-gray-400">当前段落未识别到复杂句。</p>;
                    } else if (result.kind === 'document-translation') {
                        content = <div className="space-y-3">{(result.data?.translations || []).map((paragraph, index) => <p key={index} className="leading-[1.8] text-[14px]">{paragraph}</p>)}</div>;
                    } else if (result.kind === 'document-logic') {
                        const logic = result.data || {};
                        content = (
                            <div className="space-y-4">
                                {logic.coreMeaning && <div className="p-3 bg-teal-50 dark:bg-teal-900/15 border-l-2 border-teal-500"><div className="text-[11px] font-medium text-teal-700 dark:text-teal-300">核心主旨</div><p className="mt-1 leading-relaxed font-medium">{logic.coreMeaning}</p></div>}
                                {logic.logicalStructure && <div><h4 className="font-semibold text-gray-900 dark:text-gray-100">逻辑结构</h4><p className="mt-2 leading-relaxed text-gray-600 dark:text-gray-300">{logic.logicalStructure}</p></div>}
                                {logic.referenceAnalysis?.length > 0 && <div><h4 className="font-semibold text-gray-900 dark:text-gray-100">指代与连贯</h4><ul className="mt-2 space-y-1.5 list-disc pl-5">{logic.referenceAnalysis.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                                {logic.trapIdentification && logic.trapIdentification !== '无' && <div className="p-3 bg-red-50 dark:bg-red-900/15 border-l-2 border-red-400"><div className="font-semibold text-red-700 dark:text-red-300">命题陷阱</div><p className="mt-1 leading-relaxed">{logic.trapIdentification}</p></div>}
                            </div>
                        );
                    }
                    currentBlock = (
                        <section className="space-y-4">
                            <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between gap-3">
                                    <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">{result.title || '精读结果'}</h3><p className="mt-1 text-[11px] text-gray-400">{Number.isFinite(result.paragraphIndex) ? `第 ${result.paragraphIndex + 1} 段` : '全文'} · 当前结果</p></div>
                                    <button onClick={() => setRightPanelAnalysis(null)} className="w-7 h-7 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="清空当前精读结果">×</button>
                                </div>
                                {result.sourceText && <blockquote className="mt-3 pl-3 border-l-2 border-sky-300 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-4">“{result.sourceText}”</blockquote>}
                            </div>
                            {content || <p className="text-gray-400">暂无可显示结果。</p>}
                        </section>
                    );
                }

                return <div className="space-y-6">{translationCards}{currentBlock}</div>;
            };

'''
text = text[:analysis_renderer_start] + new_renderers + text[analysis_renderer_end:]

# -----------------------------------------------------------------------------
# 5. Merge outline and mindmap into one tab, make second tab practice.
# -----------------------------------------------------------------------------
tabs_old = """                                                    ['outline', '全文结构'],
                                                    ['mindmap', '思维导图'],
                                                    ['analysis', '精读结果'],
                                                    ['notes', `学习笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]"""
tabs_new = """                                                    ['outline', '全文结构'],
                                                    ['quiz', '模拟习题'],
                                                    ['analysis', '精读结果'],
                                                    ['notes', `学习笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]"""
if text.count(tabs_old) != 1:
    raise SystemExit(f'Right panel tabs anchor count: {text.count(tabs_old)}')
text = text.replace(tabs_old, tabs_new, 1)

panel_start = text.index("                                                {rightPanelTab === 'outline' && (")
panel_end_marker = "                                                {rightPanelTab === 'analysis' && renderRightPanelAnalysis()}"
panel_end = text.index(panel_end_marker, panel_start) + len(panel_end_marker)
new_panel_views = r'''                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? (
                                                    <div className="space-y-3" data-reader-structure-combined="true">
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
                                                            <div className="flex items-center gap-1">
                                                                <button type="button" data-reader-structure-view-toggle="true" onClick={() => setStructureViewMode(previous => previous === 'tree' ? 'mindmap' : 'tree')} className={`w-8 h-8 grid place-items-center border rounded-sm ${structureViewMode === 'mindmap' ? 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-white dark:hover:bg-gray-800'}`} title={structureViewMode === 'tree' ? '切换为思维导图' : '切换为结构树'} aria-label={structureViewMode === 'tree' ? '切换为思维导图' : '切换为结构树'}>
                                                                    {structureViewMode === 'tree' ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 7v4M6 16v-2h12v2M12 11H6M12 11h6"/></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 5h7v4H4zM13 15h7v4h-7zM13 5h7v4h-7zM4 15h7v4H4zM11 7h2M11 17h2M8 9v6M16 9v6"/></svg>}
                                                                </button>
                                                                <button onClick={openMapEditorModal} className="min-h-[30px] px-2 text-[11px] border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-white dark:hover:bg-gray-800">全屏编辑</button>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-gray-400">结构树与思维导图共用同一份数据，切换不会重复调用模型。</p>
                                                        {structureViewMode === 'tree'
                                                            ? <LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode={mapMode} collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} />
                                                            : <MindMapCanvas mindmap={fullMapData.mindmap} displayMode={mapMode} />}
                                                    </div>
                                                ) : isAnalyzingMap ? (
                                                    <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">正在生成全文结构…</p></div>
                                                ) : (
                                                    <div className="py-8 text-center"><p className="text-gray-400 dark:text-gray-500">尚未生成全文结构。</p><button onClick={handleFullOutlineTool} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成全文结构</button></div>
                                                ))}
                                                {rightPanelTab === 'quiz' && renderPracticePanel()}
                                                {rightPanelTab === 'analysis' && renderRightPanelAnalysis()}'''
text = text[:panel_start] + new_panel_views + text[panel_end:]

# -----------------------------------------------------------------------------
# 6. Productize selection annotations as notes and add paragraph-end flags.
# -----------------------------------------------------------------------------
text = text.replace('window.showToast("请先选择需要批注的文字", "warning");', 'window.showToast("请先选择需要添加笔记的文字", "warning");', 1)
text = text.replace('>批注</button>', '>添加笔记</button>', 1)
text = text.replace('>添加批注</button>', '>添加选区笔记</button>', 1)

flag_anchor = '''                    </div>

                    {selectedText && (
'''
flag_markup = r'''                    </div>

                    {annotations.length > 0 && (
                        <button
                            type="button"
                            data-reader-note-flag="true"
                            onClick={(event) => { event.stopPropagation(); onFocusAnnotation?.(annotations[0].id); }}
                            className="absolute right-0 md:-right-10 bottom-0 z-20 min-w-[30px] h-8 px-1.5 inline-flex items-center justify-center gap-1 rounded-sm border border-amber-200 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300 shadow-sm hover:border-amber-400"
                            title={`本段有 ${annotations.length} 条选区笔记`}
                            aria-label={`打开第 ${paragraphIndex + 1} 段的 ${annotations.length} 条选区笔记`}
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3a1 1 0 011-1h9.5a1 1 0 01.8 1.6L15 7l2.3 3.4a1 1 0 01-.8 1.6H8v9a1 1 0 11-2 0V3z"/></svg>
                            <span className="text-[10px] font-semibold">{annotations.length}</span>
                        </button>
                    )}

                    {selectedText && (
'''
if text.count(flag_anchor) < 1:
    raise SystemExit('Paragraph flag anchor not found')
# Use the first matching anchor in Paragraph.
text = text.replace(flag_anchor, flag_markup, 1)

# -----------------------------------------------------------------------------
# Validate markers and update log.
# -----------------------------------------------------------------------------
required = [
    "['outline', 'quiz', 'analysis', 'notes']",
    "['quiz', '模拟习题']",
    'data-reader-structure-view-toggle="true"',
    "structureViewMode === 'tree' ? 'mindmap' : 'tree'",
    "rightPanelTab === 'quiz' && renderPracticePanel()",
    'data-reader-practice-panel="document"',
    'data-reader-translation-stack="true"',
    'setRightPanelTranslationStack(previous =>',
    '>添加笔记</button>',
    'data-reader-note-flag="true"'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing four-improvement markers: {missing}')
if "['mindmap', '思维导图']" in text:
    raise SystemExit('Legacy separate mindmap tab still present')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

INDEX.write_text(text, encoding='utf-8')

log = LOG.read_text(encoding='utf-8')
log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
log = log.replace('## 5. 实际修改\n\n开发中。', '''## 5. 实际修改

### 第一项

- 删除独立“思维导图”侧栏标签。
- “全文结构”中加入 `structureViewMode`，结构树与思维导图共用一个内容区域。
- 图形切换按钮位于“全屏编辑”左侧，提供标题和无障碍名称。
- 旧布局状态中的 `mindmap` 标签自动迁移到 `outline`。

### 第二项

- 第二个侧栏标签改为“模拟习题”。
- 全文三题和段落单题均路由到模拟习题标签。
- 新增可提交后再显示答案的单题组件；全文继续使用三题提交组件。
- 精读结果不再渲染 `paragraph-quiz` 或 `document-quiz`。

### 第三项

- 新增段落翻译堆积列表，同一段按段落编号更新，不生成重复卡片。
- 支持逐条移除和全部清空。
- 长难句和全文逻辑可继续显示在翻译列表下方。
- 切换文章时清空当前侧栏堆积，避免文章之间串联。

### 第四项

- 选区工具条文案改为“添加笔记”，右键菜单改为“添加选区笔记”。
- 保留现有精确选区锚点、颜色、编辑、删除与本地保存机制。
- 有选区笔记的段落末端显示小旗及数量；点击后打开学习笔记并定位第一条笔记。''')
log = log.replace('## 6. 测试\n\n待执行。', '''## 6. 测试

- 四标签顺序与旧 `mindmap` 标签移除检查：通过。
- 结构树/思维导图切换按钮位置与状态标记检查：通过。
- 全文/段落练习独立路由检查：通过。
- 段落翻译堆积、更新和清空标记检查：通过。
- 选区笔记按钮与段末小旗标记检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器真实交互：等待用户本地复测。''')
LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
