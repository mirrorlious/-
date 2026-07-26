from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-27-0520-reader-results-and-fulltext-tools.md')
WORKFLOW = Path('.github/workflows/apply_reader_results_fulltext_tools.yml')
SELF = Path('scripts/one_shot_results_fulltext_tools.py')

text = INDEX.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'Anchor not found: {label}')
    text = text.replace(old, new, 1)


# 1. App-level menu state and outside-close behavior.
replace_once(
    "            const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);\n",
    "            const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);\n            const [isFullTextMenuOpen, setIsFullTextMenuOpen] = useState(false);\n            const fullTextMenuRef = useRef(null);\n",
    'full-text menu state'
)

layout_effect = '''            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, rightPanelTab, rightPanelOpen, splitRatio } });
            }, [layoutMode, rightPanelTab, rightPanelOpen, splitRatio]);
'''
menu_effect = '''
            useEffect(() => {
                if (!isFullTextMenuOpen) return undefined;
                const closeOnPointerDown = (event) => {
                    if (!fullTextMenuRef.current?.contains(event.target)) setIsFullTextMenuOpen(false);
                };
                const closeOnEscape = (event) => {
                    if (event.key === 'Escape') setIsFullTextMenuOpen(false);
                };
                document.addEventListener('pointerdown', closeOnPointerDown);
                document.addEventListener('keydown', closeOnEscape);
                return () => {
                    document.removeEventListener('pointerdown', closeOnPointerDown);
                    document.removeEventListener('keydown', closeOnEscape);
                };
            }, [isFullTextMenuOpen]);
'''
if 'const closeOnPointerDown = (event) =>' not in text:
    replace_once(layout_effect, layout_effect + menu_effect, 'full-text menu close effect')

# 2. Paragraph results now publish structured payloads to the right panel.
copy_anchor = '''            const handleCopyParagraph = async (event) => {
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
result_helper = '''
            const openParagraphResult = (kind, title, data) => {
                onOpenAnalysis?.({
                    kind,
                    title,
                    paragraphIndex,
                    sourceText: text,
                    data,
                    createdAt: Date.now()
                });
            };
'''
if 'const openParagraphResult = (kind, title, data) =>' not in text:
    replace_once(copy_anchor, copy_anchor + result_helper, 'paragraph result helper')

start = text.index('            const handleToggleTrans = async (e) => {')
end = text.index('\n\n            const handleToggleAnalysis = async (e) => {', start)
text = text[:start] + '''            const handleToggleTrans = async (e) => {
                e.stopPropagation();
                if (showTranslation) { setShowTranslation(false); return; }
                const existingTranslation = translationText || localTranslation;
                if (existingTranslation) {
                    setShowTranslation(true);
                    openParagraphResult('paragraph-translation', `第 ${paragraphIndex + 1} 段 · 段落翻译`, { translation: existingTranslation });
                    return;
                }

                setIsLocalTransLoading(true);
                try {
                    const trans = await callGeminiTranslation(getModelSafeText(text, 12000, "段落精翻"), apiConfig);
                    setLocalTranslation(trans);
                    setShowTranslation(true);
                    openParagraphResult('paragraph-translation', `第 ${paragraphIndex + 1} 段 · 段落翻译`, { translation: trans });
                } catch (e) {
                    window.showToast(`翻译异常: ${e.message}`, "error");
                } finally {
                    setIsLocalTransLoading(false);
                }
            };''' + text[end:]

start = text.index('            const handleToggleAnalysis = async (e) => {')
end = text.index('\n\n            const handleToggleAudio = async (e) => {', start)
text = text[:start] + '''            const handleToggleAnalysis = async (e) => {
                e.stopPropagation();
                if (showAnalysis) { setShowAnalysis(false); return; }
                if (analysisData) {
                    setShowAnalysis(true);
                    openParagraphResult('paragraph-analysis', `第 ${paragraphIndex + 1} 段 · 长难句拆解`, analysisData);
                    return;
                }

                setIsAnalysisLoading(true);
                try {
                    const data = await callGeminiIntensiveAnalysis(getModelSafeText(text, 10000, "长难句解构"), apiConfig);
                    setAnalysisData(data);
                    setShowAnalysis(true);
                    openParagraphResult('paragraph-analysis', `第 ${paragraphIndex + 1} 段 · 长难句拆解`, data);
                } catch (e) {
                    window.showToast(`句法解构异常: ${e.message}`, "error");
                } finally {
                    setIsAnalysisLoading(false);
                }
            };''' + text[end:]

start = text.index('            const handleToggleQuiz = async (e) => {')
end = text.index('\n\n            const handleWordClick =', start)
text = text[:start] + '''            const handleToggleQuiz = async (e) => {
                e.stopPropagation();
                if (showQuiz) { setShowQuiz(false); return; }
                if (quizData) {
                    setShowQuiz(true);
                    openParagraphResult('paragraph-quiz', `第 ${paragraphIndex + 1} 段 · 段落练习`, quizData);
                    return;
                }

                setIsQuizLoading(true);
                try {
                    const data = await callGeminiQuiz(getModelSafeText(text, 8000, "出题测试"), apiConfig);
                    setQuizData(data);
                    setShowQuiz(true);
                    openParagraphResult('paragraph-quiz', `第 ${paragraphIndex + 1} 段 · 段落练习`, data);
                } catch (e) {
                    window.showToast(`出题系统异常: ${e.message}`, "error");
                } finally {
                    setIsQuizLoading(false);
                }
            };''' + text[end:]

# 3. Full translation returns data and can publish it to the right panel.
start = text.index('            const fetchFullTranslation = async (text, recordId) => {')
end = text.index('\n\n            const loadHistoryRecord = async (record) => {', start)
text = text[:start] + '''            const fetchFullTranslation = async (text, recordId, options = {}) => {
                if (text.length > 120000) {
                    window.showToast("整本文本过长，已跳过一次性全文翻译；可按段展开精翻", "warning");
                    if (options.openPanel) {
                        setRightPanelAnalysis({ kind: 'error', title: '全文翻译', message: '正文超过 120,000 字符，请使用段落翻译。' });
                    }
                    return [];
                }
                setIsFullTransLoading(true);
                try {
                    const chunks = splitTextIntoChunks(text, 12000);
                    const translatedChunks = [];
                    for (let i = 0; i < chunks.length; i++) {
                        window.showToast(`正在处理全文翻译 ${i + 1}/${chunks.length}`, 'info');
                        translatedChunks.push(await callGeminiFullTranslation(chunks[i], apiConfig));
                    }
                    const res = translatedChunks.filter(Boolean).join('\n\n');
                    const transArray = res ? res.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) : [];
                    if (transArray.length) {
                        setFullTranslations(transArray);
                        if (recordId) {
                            const recordToUpdate = history.find(item => item.id === recordId) || { id: recordId, text };
                            saveHistoryToCloud({ ...recordToUpdate, fullTranslations: transArray });
                        }
                        if (options.openPanel) {
                            setRightPanelAnalysis({ kind: 'document-translation', title: '全文翻译', data: { translations: transArray }, createdAt: Date.now() });
                        }
                    }
                    return transArray;
                } catch (e) {
                    window.showToast(`全局翻译被拦截，可点击段落独立精翻。\n(${e.message})`, "warning");
                    if (options.openPanel) setRightPanelAnalysis({ kind: 'error', title: '全文翻译', message: e.message });
                    return [];
                } finally {
                    setIsFullTransLoading(false);
                }
            };''' + text[end:]

# Reset panel context when loading or starting another article.
replace_once(
    "                setFullTranslations(record.fullTranslations || []);\n                setCurrentHistoryId(record.id);",
    "                setFullTranslations(record.fullTranslations || []);\n                setRightPanelAnalysis(null);\n                setRightPanelTab('outline');\n                setIsFullTextMenuOpen(false);\n                setCurrentHistoryId(record.id);",
    'history panel reset'
)
replace_once(
    "                setFullTranslations([]); \n\n                const newId = Date.now().toString();",
    "                setFullTranslations([]);\n                setRightPanelAnalysis(null);\n                setRightPanelTab('outline');\n                setIsFullTextMenuOpen(false);\n\n                const newId = Date.now().toString();",
    'new article panel reset'
)

# 4. Full document actions and unified right-panel renderer.
start = text.index('            const handleGenerateSummary = async () => {')
end = text.index('\n\n            const handleToggleGlobalLogic = async () => {', start)
text = text[:start] + '''            const handleGenerateSummary = async (options = {}) => {
                setIsAnalyzingMap(true);
                try {
                    const sourceText = getModelSafeText(inputText || defaultText, 30000, "全文思维导图");
                    const data = await callGeminiSummary(sourceText, apiConfig);
                    setFullMapData(data);
                    setCollapsedMapNodes(new Set());
                    if (currentHistoryId) {
                        const recordToUpdate = history.find(item => item.id === currentHistoryId) || {
                            id: currentHistoryId,
                            timestamp: new Date().toLocaleString('zh-CN'),
                            text: inputText || defaultText,
                            fullTranslations,
                            createdAt: Date.now()
                        };
                        saveHistoryToCloud({ ...recordToUpdate, fullMapData: data });
                    }
                    if (options.openPanel) {
                        setRightPanelTab('outline');
                        setLayoutMode('split');
                        setRightPanelOpen(true);
                    }
                    window.showToast(user && dbInstance ? "已自动保存导图至云端" : "已自动保存导图到本地", "success");
                    return data;
                } catch (e) {
                    window.showToast(`导图解析失败: ${e.message}`, "error");
                    return null;
                } finally {
                    setIsAnalyzingMap(false);
                }
            };''' + text[end:]

start = text.index('            const handleToggleGlobalLogic = async () => {')
end = text.index('\n\n            const paragraphs = useMemo', start)
new_document_block = '''            const handleToggleGlobalLogic = async (options = {}) => {
                const shouldOpenPanel = Boolean(options.openPanel);
                if (showGlobalLogic && !shouldOpenPanel) { setShowGlobalLogic(false); return; }
                if (globalLogicData) {
                    setShowGlobalLogic(true);
                    if (shouldOpenPanel) {
                        setRightPanelAnalysis({ kind: 'document-logic', title: '全文逻辑', data: globalLogicData, createdAt: Date.now() });
                        setRightPanelTab('analysis');
                        setLayoutMode('split');
                        setRightPanelOpen(true);
                    }
                    return globalLogicData;
                }
                setIsGlobalLogicLoading(true);
                try {
                    const sourceText = getModelSafeText(inputText || defaultText, 30000, "全文逻辑分析");
                    const data = await callGeminiReadingAnalysis(sourceText, apiConfig);
                    setGlobalLogicData(data);
                    setShowGlobalLogic(true);
                    if (shouldOpenPanel) {
                        setRightPanelAnalysis({ kind: 'document-logic', title: '全文逻辑', data, createdAt: Date.now() });
                        setRightPanelTab('analysis');
                        setLayoutMode('split');
                        setRightPanelOpen(true);
                    }
                    return data;
                } catch (e) {
                    window.showToast(`全文逻辑剖析失败: ${e.message}`, "error");
                    if (shouldOpenPanel) setRightPanelAnalysis({ kind: 'error', title: '全文逻辑', message: e.message });
                    return null;
                } finally {
                    setIsGlobalLogicLoading(false);
                }
            };

            const openRightPanelTab = (tab) => {
                setRightPanelTab(tab);
                setLayoutMode('split');
                setRightPanelOpen(true);
            };

            const handleFullTranslationTool = async () => {
                setIsFullTextMenuOpen(false);
                openRightPanelTab('analysis');
                if (fullTranslations.length) {
                    setRightPanelAnalysis({ kind: 'document-translation', title: '全文翻译', data: { translations: fullTranslations }, createdAt: Date.now() });
                    return;
                }
                setRightPanelAnalysis({ kind: 'loading', title: '全文翻译', message: '正在分段翻译全文…' });
                await fetchFullTranslation(inputText || defaultText, currentHistoryId, { openPanel: true });
            };

            const handleFullLogicTool = async () => {
                setIsFullTextMenuOpen(false);
                openRightPanelTab('analysis');
                if (!globalLogicData) setRightPanelAnalysis({ kind: 'loading', title: '全文逻辑', message: '正在分析全文结构与命题逻辑…' });
                await handleToggleGlobalLogic({ openPanel: true });
            };

            const handleFullOutlineTool = async () => {
                setIsFullTextMenuOpen(false);
                openRightPanelTab('outline');
                if (!fullMapData) await handleGenerateSummary({ openPanel: true });
            };

            const handleFullNotesTool = () => {
                setIsFullTextMenuOpen(false);
                setNotesView('annotations');
                openRightPanelTab('notes');
            };

            const renderRightPanelAnalysis = () => {
                const result = rightPanelAnalysis;
                if (!result) {
                    return (
                        <div className="py-8 text-center">
                            <p className="text-[13px] text-gray-400 dark:text-gray-500">段落翻译、长难句、练习和全文分析会集中显示在这里。</p>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <button onClick={handleFullTranslationTool} className="min-h-[38px] rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] hover:bg-white dark:hover:bg-gray-800">全文翻译</button>
                                <button onClick={handleFullLogicTool} className="min-h-[38px] rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] hover:bg-white dark:hover:bg-gray-800">全文逻辑</button>
                            </div>
                        </div>
                    );
                }

                if (result.kind === 'loading') {
                    return <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">{result.message || '正在处理…'}</p></div>;
                }
                if (result.kind === 'error') {
                    return <div className="p-3 border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/15 rounded-sm text-red-700 dark:text-red-300"><h3 className="font-semibold">{result.title || '处理失败'}</h3><p className="mt-2 leading-relaxed">{result.message}</p></div>;
                }

                let content = null;
                if (result.kind === 'paragraph-translation') {
                    content = <div className="whitespace-pre-wrap leading-[1.8] text-[14px]">{result.data?.translation || '暂无翻译结果'}</div>;
                } else if (result.kind === 'paragraph-analysis') {
                    const sentences = result.data?.complexSentences || [];
                    content = sentences.length ? (
                        <div className="space-y-4">
                            {sentences.map((item, index) => (
                                <div key={index} className="pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0">
                                    <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">核心难句 {index + 1}</div>
                                    <p className="mt-2 font-serif font-medium leading-relaxed text-gray-900 dark:text-gray-100">{item.originalSentence}</p>
                                    <p className="mt-2 leading-relaxed text-gray-500 dark:text-gray-400">{item.sentenceTranslation}</p>
                                    {item.chunks?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.chunks.map((chunk, chunkIndex) => <span key={chunkIndex} className="px-2 py-1 rounded-sm bg-gray-100 dark:bg-gray-800 text-[11px]">{chunk.type} · {chunk.text}</span>)}</div>}
                                    {item.writingTip && <p className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/15 border-l-2 border-amber-400 text-[12px] leading-relaxed">{item.writingTip}</p>}
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-gray-400">当前段落未识别到复杂句。</p>;
                } else if (result.kind === 'paragraph-quiz') {
                    const quiz = result.data || {};
                    content = (
                        <div className="space-y-3">
                            <div><p className="font-serif font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{quiz.questionEn}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{quiz.questionZh}</p></div>
                            <div className="space-y-2">{(quiz.options || []).map(option => <div key={option.id} className={`p-2.5 border rounded-sm ${option.id === quiz.correctAnswerId ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/15' : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30'}`}><span className="font-medium">{option.id}. {option.textEn}</span>{option.textZh && <div className="mt-1 text-[11px] text-gray-500">{option.textZh}</div>}</div>)}</div>
                            {quiz.analysis && <div className="p-3 bg-violet-50 dark:bg-violet-900/15 border-l-2 border-violet-400 leading-relaxed"><span className="font-semibold">解析：</span>{quiz.analysis}</div>}
                        </div>
                    );
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

                return (
                    <div className="space-y-4">
                        <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between gap-3">
                                <div><h3 className="font-semibold text-gray-900 dark:text-gray-100">{result.title || '精读结果'}</h3><p className="mt-1 text-[11px] text-gray-400">{Number.isFinite(result.paragraphIndex) ? `第 ${result.paragraphIndex + 1} 段` : '全文'} · 当前结果</p></div>
                                <button onClick={() => setRightPanelAnalysis(null)} className="w-7 h-7 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" aria-label="清空当前精读结果">×</button>
                            </div>
                            {result.sourceText && <blockquote className="mt-3 pl-3 border-l-2 border-sky-300 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-4">“{result.sourceText}”</blockquote>}
                        </div>
                        {content || <p className="text-gray-400">暂无可显示结果。</p>}
                    </div>
                );
            };'''
text = text[:start] + new_document_block + text[end:]

# 5. Replace the standalone global-logic control with a stable full-text tools menu.
old_toolbar = '''                                        {readingMode === 'intensive' && (
                                            <div className="w-full sm:w-auto flex items-center gap-2 animate-fade-in">
                                                <select
                                                    value={highlightMode}
                                                    onChange={(e) => setHighlightMode(e.target.value)}
                                                    className="min-w-0 flex-1 sm:w-auto h-10 px-3 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-gray-500 cursor-pointer"
                                                >
                                                    <option value="red">考研生词</option>
                                                    <option value="both">全部词汇</option>
                                                    <option value="blue">基础词汇</option>
                                                    <option value="none">关闭高亮</option>
                                                </select>
                                                <button onClick={handleToggleGlobalLogic} disabled={isGlobalLogicLoading} className={`min-h-[40px] shrink-0 flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium border px-3 rounded-sm transition-all ${showGlobalLogic ? 'bg-teal-600 dark:bg-gray-100 text-white dark:text-gray-900 border-teal-600 dark:border-gray-100' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                                    {isGlobalLogicLoading ? <svg className="animate-spin w-3.5 h-3.5 loader-spin text-teal-600 dark:text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className={`w-3.5 h-3.5 ${showGlobalLogic ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> }
                                                    <span>{isGlobalLogicLoading ? "分析中..." : showGlobalLogic ? "收起逻辑" : "全文逻辑"}</span>
                                                </button>
                                            </div>
                                        )}'''
new_toolbar = '''                                        <div className="w-full sm:w-auto flex items-center justify-center gap-2 animate-fade-in">
                                            {readingMode === 'intensive' && (
                                                <select
                                                    value={highlightMode}
                                                    onChange={(e) => setHighlightMode(e.target.value)}
                                                    className="min-w-0 flex-1 sm:w-auto h-10 px-3 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-gray-500 cursor-pointer"
                                                >
                                                    <option value="red">考研生词</option>
                                                    <option value="both">全部词汇</option>
                                                    <option value="blue">基础词汇</option>
                                                    <option value="none">关闭高亮</option>
                                                </select>
                                            )}
                                            <div ref={fullTextMenuRef} className="relative shrink-0">
                                                <button
                                                    type="button"
                                                    data-reader-fulltext-trigger="true"
                                                    onClick={() => setIsFullTextMenuOpen(previous => !previous)}
                                                    aria-haspopup="menu"
                                                    aria-expanded={isFullTextMenuOpen}
                                                    className={`min-h-[40px] flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium border px-3 rounded-sm transition-colors ${isFullTextMenuOpen ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                >
                                                    <span>全文工具</span>
                                                    <svg className={`w-3.5 h-3.5 transition-transform ${isFullTextMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 9l6 6 6-6"></path></svg>
                                                </button>
                                                {isFullTextMenuOpen && (
                                                    <div data-reader-fulltext-menu="true" role="menu" aria-label="全文工具" className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl animate-fade-in-down">
                                                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">全文级操作 · 结果进入右侧面板</div>
                                                        <div className="p-1.5">
                                                            <button role="menuitem" onClick={handleFullTranslationTool} disabled={isFullTransLoading} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文翻译</span><span className="text-[10px] text-gray-400">{isFullTransLoading ? '处理中' : fullTranslations.length ? '已有结果' : '调用模型'}</span></button>
                                                            <button role="menuitem" onClick={handleFullLogicTool} disabled={isGlobalLogicLoading} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文逻辑</span><span className="text-[10px] text-gray-400">{isGlobalLogicLoading ? '分析中' : globalLogicData ? '已有结果' : '调用模型'}</span></button>
                                                            <button role="menuitem" onClick={handleFullOutlineTool} disabled={isAnalyzingMap} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文结构 / 思维导图</span><span className="text-[10px] text-gray-400">{isAnalyzingMap ? '生成中' : fullMapData ? '已有结果' : '调用模型'}</span></button>
                                                            <div className="my-1 border-t border-gray-100 dark:border-gray-800"></div>
                                                            <button role="menuitem" onClick={handleFullNotesTool} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span>学习笔记</span><span className="text-[10px] text-gray-400">{currentAnnotations.length} 条批注</span></button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>'''
replace_once(old_toolbar, new_toolbar, 'full-text toolbar menu')

# 6. Structured paragraph callback and right-panel content.
replace_once(
    "                                                onOpenAnalysis={(data) => { setRightPanelAnalysis(data); setRightPanelTab('analysis'); setLayoutMode('split'); setRightPanelOpen(true); }}",
    "                                                onOpenAnalysis={(result) => { setRightPanelAnalysis(result); setRightPanelTab('analysis'); setLayoutMode('split'); setRightPanelOpen(true); }}",
    'structured paragraph callback'
)
replace_once(
    "                                                    ['notes', `笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]",
    "                                                    ['notes', `学习笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]",
    'learning notes tab label'
)

old_analysis_line = '''                                                {rightPanelTab === 'analysis' && (rightPanelAnalysis ? <div className="space-y-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">段落精读</h3>{rightPanelAnalysis.complexSentences?.map((item, index) => <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-3"><p className="font-medium leading-relaxed">{item.originalSentence}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{item.sentenceTranslation}</p></div>)}</div> : globalLogicData ? <div className="space-y-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">全文分析</h3><p className="leading-relaxed">{globalLogicData.coreMeaning}</p><p className="text-gray-500 dark:text-gray-400">{globalLogicData.logicalStructure}</p></div> : <p className="text-gray-400 dark:text-gray-500">运行段落解构或全文逻辑后，结果会显示在这里。</p>)}'''
replace_once(old_analysis_line, "                                                {rightPanelTab === 'analysis' && renderRightPanelAnalysis()}", 'unified right-panel result')

# Improve outline loading/empty guidance.
old_outline_line = '''                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? <LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode="bilingual" collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} /> : <p className="text-gray-400 dark:text-gray-500">生成全文思维导图后，结构会显示在这里。</p>)}'''
new_outline_line = '''                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? <div className="space-y-3"><div className="flex items-center justify-between"><span className="text-[11px] text-gray-400">全文结构 · 双语</span><button onClick={openMapEditorModal} className="min-h-[30px] px-2 text-[11px] border border-gray-200 dark:border-gray-700 rounded-sm hover:bg-white dark:hover:bg-gray-800">全屏编辑</button></div><LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode="bilingual" collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} /></div> : isAnalyzingMap ? <div className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">正在生成全文结构…</p></div> : <div className="py-8 text-center"><p className="text-gray-400 dark:text-gray-500">尚未生成全文结构。</p><button onClick={handleFullOutlineTool} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成思维导图</button></div>)}'''
replace_once(old_outline_line, new_outline_line, 'outline panel guidance')

# Static validation.
required = [
    'data-reader-fulltext-trigger="true"',
    'data-reader-fulltext-menu="true"',
    "kind: 'paragraph-translation'",
    "kind: 'paragraph-quiz'",
    "kind: 'document-translation'",
    "kind: 'document-logic'",
    'renderRightPanelAnalysis()',
    '学习笔记${currentAnnotations.length',
    "setRightPanelTab('outline')"
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing result/full-text markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')
if 'onClick={handleToggleGlobalLogic} disabled={isGlobalLogicLoading}' in text:
    raise SystemExit('Standalone global logic toolbar button still present')

INDEX.write_text(text, encoding='utf-8')

if LOG.exists():
    log = LOG.read_text(encoding='utf-8')
    log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
    log = log.replace('## 7. 实际修改\n\n开发中。', '''## 7. 实际修改

- 顶部独立“全文逻辑”按钮改为稳定的“全文工具”下拉菜单。
- 全文工具集中全文翻译、全文逻辑、全文结构/思维导图和学习笔记。
- 菜单支持再次点击、点击空白和 Esc 关闭；状态显示“已有结果 / 调用模型 / 处理中”。
- 已生成全文结果优先复用，不重复调用模型。
- 段落翻译、长难句拆解和段落练习均发布为统一结构化结果，并自动打开右侧“精读结果”。
- 右侧精读结果可显示操作标题、段落编号、原文片段、翻译、句法拆解、练习、全文翻译和全文逻辑。
- 右侧标签统一为“全文结构 / 精读结果 / 学习笔记”。
- 全文结构空状态可直接生成思维导图，已有结构可直接进入全屏编辑。
- 加载新文章或历史文章时清空旧的右侧结果上下文，避免串文。''')
    log = log.replace('## 8. 测试\n\n待执行。', '''## 8. 测试

- 关键菜单与结果类型标记检查：通过。
- 旧顶部独立“全文逻辑”按钮移除检查：通过。
- HTML script 标签数量检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器真实交互：等待用户本地验收。''')
    log = log.replace('## 9. 未完成项\n\n开发中。', '''## 9. 未完成项

- 用户本地验收全文工具菜单定位、外部关闭和右侧面板滚动表现。
- 用户验收段落翻译、句法和练习在正文与右侧同时显示时的视觉密度。
- 选区工具条分级仍作为下一阶段。
- 未合并到 `main`。''')
    LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
