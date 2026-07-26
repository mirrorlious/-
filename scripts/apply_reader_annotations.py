from pathlib import Path
import re

INDEX = Path("index.html")
LOG = Path("TASK_LOGS/2026-07-27-reader-annotations.md")

source = INDEX.read_text(encoding="utf-8")

def replace_once(old, new, label):
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    source = source.replace(old, new, 1)

def regex_once(pattern, replacement, label, flags=0):
    global source
    source, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, found {count}")

# 1. Annotation visual styles.
replace_once(
'''        .reader-side-panel {
            position: sticky;
            top: 80px;
            max-height: calc(100vh - 104px);
            overflow: auto;
        }
''',
'''        .reader-side-panel {
            position: sticky;
            top: 80px;
            max-height: calc(100vh - 104px);
            overflow: auto;
        }

        .reader-annotation-mark {
            background: rgba(250, 204, 21, 0.16);
            border-bottom: 2px solid rgba(202, 138, 4, 0.62);
            color: inherit;
            border-radius: 2px;
            padding-inline: 1px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            cursor: pointer;
            transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        }

        .reader-annotation-mark:hover,
        .reader-annotation-mark:focus-visible {
            background: rgba(250, 204, 21, 0.28);
            border-bottom-color: rgba(161, 98, 7, 0.9);
            outline: none;
        }

        .reader-annotation-mark-active {
            background: rgba(250, 204, 21, 0.38);
            border-bottom-color: #ca8a04;
            box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.16);
        }

        .dark .reader-annotation-mark {
            background: rgba(202, 138, 4, 0.2);
            border-bottom-color: rgba(250, 204, 21, 0.6);
        }

        .dark .reader-annotation-mark-active {
            background: rgba(202, 138, 4, 0.34);
            border-bottom-color: #fde047;
            box-shadow: 0 0 0 3px rgba(202, 138, 4, 0.2);
        }

        .reader-context-menu {
            position: fixed;
            z-index: 90;
            min-width: 156px;
            padding: 6px;
            border: 1px solid rgba(209, 213, 219, 0.95);
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
            backdrop-filter: blur(12px);
        }

        .dark .reader-context-menu {
            border-color: rgba(75, 85, 99, 0.95);
            background: rgba(17, 24, 39, 0.98);
        }
''',
"annotation CSS"
)

# 2. Add annotation segment helper before Paragraph.
replace_once(
'''        const Paragraph = ({ text, activeDicts, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, onOpenAnalysis }) => {
''',
'''        const splitTextByAnnotations = (segmentText, segmentStart, annotations) => {
            if (!annotations?.length || !segmentText) {
                return [{ text: segmentText, annotationIds: [] }];
            }
            const segmentEnd = segmentStart + segmentText.length;
            const relevant = annotations.filter(annotation => {
                const start = Number(annotation?.anchor?.startOffset);
                const end = Number(annotation?.anchor?.endOffset);
                return Number.isFinite(start) && Number.isFinite(end) && start < segmentEnd && end > segmentStart;
            });
            if (!relevant.length) return [{ text: segmentText, annotationIds: [] }];

            const boundaries = new Set([segmentStart, segmentEnd]);
            relevant.forEach(annotation => {
                boundaries.add(Math.max(segmentStart, Number(annotation.anchor.startOffset)));
                boundaries.add(Math.min(segmentEnd, Number(annotation.anchor.endOffset)));
            });
            const points = Array.from(boundaries).sort((a, b) => a - b);
            const pieces = [];
            for (let index = 0; index < points.length - 1; index += 1) {
                const start = points[index];
                const end = points[index + 1];
                if (end <= start) continue;
                const annotationIds = relevant
                    .filter(annotation => Number(annotation.anchor.startOffset) < end && Number(annotation.anchor.endOffset) > start)
                    .map(annotation => annotation.id);
                pieces.push({
                    text: segmentText.slice(start - segmentStart, end - segmentStart),
                    annotationIds
                });
            }
            return pieces;
        };

        const Paragraph = ({ text, paragraphIndex, annotations = [], activeAnnotationId, activeDicts, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, onOpenAnalysis, onRequestAnnotation, onFocusAnnotation }) => {
''',
"Paragraph signature and helper"
)

# 3. Add selection anchor/context state and text ref.
replace_once(
'''            const [selectedText, setSelectedText] = useState("");
            const [selectionTranslation, setSelectionTranslation] = useState("");
            const [isSelectionTranslating, setIsSelectionTranslating] = useState(false);
            const paragraphRef = useRef(null);
''',
'''            const [selectedText, setSelectedText] = useState("");
            const [selectionAnchor, setSelectionAnchor] = useState(null);
            const [selectionTranslation, setSelectionTranslation] = useState("");
            const [isSelectionTranslating, setIsSelectionTranslating] = useState(false);
            const [contextMenu, setContextMenu] = useState(null);
            const paragraphRef = useRef(null);
            const textRef = useRef(null);
''',
"Paragraph selection states"
)

# 4. Replace selection tracking with offset-aware tracking.
regex_once(
r'''            useEffect\(\(\) => \{\n                const updateSelection = \(\) => \{\n.*?            \}, \[\]\);\n\n            useEffect\(\(\) => \{\n                if \(!showActions\) return undefined;''',
'''            useEffect(() => {
                const updateSelection = () => {
                    const selection = window.getSelection();
                    const root = textRef.current;
                    if (!selection || !root || selection.isCollapsed || !selection.toString().trim()) {
                        setSelectedText("");
                        setSelectionAnchor(null);
                        setContextMenu(null);
                        return;
                    }
                    const range = selection.rangeCount ? selection.getRangeAt(0) : null;
                    if (!range || !root.contains(range.startContainer) || !root.contains(range.endContainer)) {
                        setSelectedText("");
                        setSelectionAnchor(null);
                        setContextMenu(null);
                        return;
                    }

                    const rawExact = range.toString();
                    const exact = rawExact.trim();
                    if (!exact) {
                        setSelectedText("");
                        setSelectionAnchor(null);
                        return;
                    }

                    const preRange = range.cloneRange();
                    preRange.selectNodeContents(root);
                    preRange.setEnd(range.startContainer, range.startOffset);
                    const leadingTrim = rawExact.length - rawExact.trimStart().length;
                    const startOffset = preRange.toString().length + leadingTrim;
                    const endOffset = startOffset + exact.length;
                    const prefix = text.slice(Math.max(0, startOffset - 32), startOffset);
                    const suffix = text.slice(endOffset, Math.min(text.length, endOffset + 32));

                    setSelectedText(exact);
                    setSelectionAnchor({
                        paragraphIndex,
                        startOffset,
                        endOffset,
                        exact,
                        prefix,
                        suffix
                    });
                };
                document.addEventListener('selectionchange', updateSelection);
                document.addEventListener('mouseup', updateSelection);
                document.addEventListener('keyup', updateSelection);
                return () => {
                    document.removeEventListener('selectionchange', updateSelection);
                    document.removeEventListener('mouseup', updateSelection);
                    document.removeEventListener('keyup', updateSelection);
                };
            }, [paragraphIndex, text]);

            useEffect(() => {
                const handleAnnotationShortcut = (event) => {
                    if (!(event.altKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm')) return;
                    if (!selectionAnchor) return;
                    event.preventDefault();
                    onRequestAnnotation?.(selectionAnchor);
                };
                document.addEventListener('keydown', handleAnnotationShortcut);
                return () => document.removeEventListener('keydown', handleAnnotationShortcut);
            }, [selectionAnchor, onRequestAnnotation]);

            useEffect(() => {
                if (!contextMenu) return undefined;
                const closeContextMenu = (event) => {
                    if (!event.target.closest('[data-reader-context-menu]')) setContextMenu(null);
                };
                const closeOnScroll = () => setContextMenu(null);
                const closeOnEscape = (event) => {
                    if (event.key === 'Escape') setContextMenu(null);
                };
                document.addEventListener('pointerdown', closeContextMenu);
                document.addEventListener('scroll', closeOnScroll, true);
                document.addEventListener('keydown', closeOnEscape);
                return () => {
                    document.removeEventListener('pointerdown', closeContextMenu);
                    document.removeEventListener('scroll', closeOnScroll, true);
                    document.removeEventListener('keydown', closeOnEscape);
                };
            }, [contextMenu]);

            useEffect(() => {
                if (!showActions) return undefined;''',
"selection tracking effects",
flags=re.S
)

# 5. Add annotation/context handlers after selection translation.
replace_once(
'''            const handleSelectionTranslation = async () => {
                if (!selectedText || isSelectionTranslating) return;
                setIsSelectionTranslating(true);
                try {
                    const result = await callGeminiTranslation(getModelSafeText(selectedText, 8000, "选区翻译"), apiConfig);
                    setSelectionTranslation(result);
                } catch (e) {
                    window.showToast(`选区翻译异常: ${e.message}`, "error");
                } finally {
                    setIsSelectionTranslating(false);
                }
            };

            const handleToggleQuiz = async (e) => {
''',
'''            const handleSelectionTranslation = async () => {
                if (!selectedText || isSelectionTranslating) return;
                setIsSelectionTranslating(true);
                try {
                    const result = await callGeminiTranslation(getModelSafeText(selectedText, 8000, "选区翻译"), apiConfig);
                    setSelectionTranslation(result);
                } catch (e) {
                    window.showToast(`选区翻译异常: ${e.message}`, "error");
                } finally {
                    setIsSelectionTranslating(false);
                }
            };

            const handleRequestAnnotation = () => {
                if (!selectionAnchor) {
                    window.showToast("请先选择需要批注的文字", "warning");
                    return;
                }
                setContextMenu(null);
                onRequestAnnotation?.(selectionAnchor);
            };

            const handleSelectionContextMenu = (event) => {
                const selection = window.getSelection();
                const root = textRef.current;
                if (!selectionAnchor || !selection || selection.isCollapsed || !root || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) {
                    return;
                }
                event.preventDefault();
                const menuWidth = 172;
                const menuHeight = 190;
                setContextMenu({
                    x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
                    y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8))
                });
            };

            const handleToggleQuiz = async (e) => {
''',
"annotation handlers"
)

# 6. Compute text segment offsets for annotation intersection.
replace_once(
'''            const finalTranslationToShow = translationText || localTranslation;

            return (
''',
'''            let runningTextOffset = 0;
            const offsetTextSegments = textSegments.map(segment => {
                const offsetSegment = { ...segment, startOffset: runningTextOffset };
                runningTextOffset += segment.text.length;
                return offsetSegment;
            });

            const finalTranslationToShow = translationText || localTranslation;

            return (
''',
"offset segments"
)

# 7. Add text ref/context handler and annotation rendering.
replace_once(
'''                    <div 
                        className="text-gray-900 dark:text-gray-200 text-justify break-words relative z-10 transition-all cursor-pointer md:cursor-auto"
                        style={{ fontFamily: typographyConfig.readingFontFamily || typographyConfig.fontFamily, fontSize: `${typographyConfig.fontSize}px`, lineHeight: typographyConfig.lineHeight, marginBottom: `${typographyConfig.paragraphSpacing || 1.05}em` }}
                        onClick={handleParagraphClick}
                    >
                        {textSegments.map((seg, i) => <Fragment key={i}>{renderProcessedText(seg.text, seg.isTarget)}</Fragment>)}
                    </div>
''',
'''                    <div
                        ref={textRef}
                        data-reader-text="true"
                        className="text-gray-900 dark:text-gray-200 text-left break-words relative z-10 transition-all cursor-text"
                        style={{ fontFamily: typographyConfig.readingFontFamily || typographyConfig.fontFamily, fontSize: `${typographyConfig.fontSize}px`, lineHeight: typographyConfig.lineHeight, marginBottom: `${typographyConfig.paragraphSpacing || 1.05}em` }}
                        onClick={handleParagraphClick}
                        onContextMenu={handleSelectionContextMenu}
                    >
                        {offsetTextSegments.map((seg, segmentIndex) => (
                            <Fragment key={segmentIndex}>
                                {splitTextByAnnotations(seg.text, seg.startOffset, annotations).map((piece, pieceIndex) => {
                                    const content = renderProcessedText(piece.text, seg.isTarget);
                                    if (!piece.annotationIds.length) return <Fragment key={pieceIndex}>{content}</Fragment>;
                                    const primaryAnnotationId = piece.annotationIds[0];
                                    const isActiveAnnotation = piece.annotationIds.includes(activeAnnotationId);
                                    return (
                                        <mark
                                            key={pieceIndex}
                                            tabIndex="0"
                                            data-annotation-id={primaryAnnotationId}
                                            className={`reader-annotation-mark ${isActiveAnnotation ? 'reader-annotation-mark-active' : ''}`}
                                            title={`${piece.annotationIds.length} 条批注`}
                                            onClick={(event) => { event.stopPropagation(); onFocusAnnotation?.(primaryAnnotationId); }}
                                            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFocusAnnotation?.(primaryAnnotationId); } }}
                                        >
                                            {content}
                                        </mark>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </div>
''',
"annotated text render"
)

# 8. Replace selection toolbar with Chinese controls and annotation.
replace_once(
'''                    {selectedText && (
                        <div role="toolbar" aria-label="Text selection actions" className="absolute left-0 right-0 top-full z-30 mt-2 flex flex-wrap items-center gap-1.5 p-2 bg-gray-900 text-white rounded-sm shadow-lg animate-fade-in">
                            <span className="px-2 text-[11px] text-gray-300 truncate max-w-[180px]" title={selectedText}>{selectedText}</span>
                            <button onClick={() => navigator.clipboard?.writeText(selectedText)} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">Copy</button>
                            <button onClick={handleSelectionTranslation} disabled={isSelectionTranslating} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20 disabled:opacity-50">{isSelectionTranslating ? 'Translating…' : 'Translate'}</button>
                            <button onClick={handleSelectionSpeech} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">Speak</button>
                            <button onClick={() => setIsInteracting(true)} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">More</button>
                        </div>
                    )}

                    {selectionTranslation && selectedText && <div className="mt-3 border-l-2 border-blue-400 pl-3 text-[13px] text-gray-700 dark:text-gray-300">{selectionTranslation}</div>}
''',
'''                    {selectedText && (
                        <div role="toolbar" aria-label="文字选区操作" onMouseDown={(event) => event.preventDefault()} className="absolute left-0 right-0 top-full z-30 mt-2 flex flex-wrap items-center gap-1.5 p-2 bg-gray-900 text-white rounded-sm shadow-lg animate-fade-in">
                            <span className="px-2 text-[11px] text-gray-300 truncate max-w-[180px]" title={selectedText}>{selectedText}</span>
                            <button onClick={() => navigator.clipboard?.writeText(selectedText)} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">复制</button>
                            <button onClick={handleSelectionTranslation} disabled={isSelectionTranslating} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20 disabled:opacity-50">{isSelectionTranslating ? '翻译中…' : '翻译'}</button>
                            <button onClick={handleSelectionSpeech} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">朗读</button>
                            <button onClick={handleRequestAnnotation} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-amber-500/90 hover:bg-amber-500 text-gray-950 font-medium">批注</button>
                            <button onClick={() => setIsInteracting(true)} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">更多</button>
                        </div>
                    )}

                    {contextMenu && (
                        <div data-reader-context-menu="true" role="menu" aria-label="选区快捷操作" className="reader-context-menu rounded-sm text-[12px] text-gray-700 dark:text-gray-200" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} onMouseDown={(event) => event.preventDefault()}>
                            <button role="menuitem" onClick={handleRequestAnnotation} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-medium">添加批注</button>
                            <button role="menuitem" onClick={() => { setContextMenu(null); handleSelectionTranslation(); }} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800">翻译选中内容</button>
                            <button role="menuitem" onClick={() => { setContextMenu(null); handleSelectionSpeech(); }} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800">朗读选中内容</button>
                            <button role="menuitem" onClick={() => { navigator.clipboard?.writeText(selectedText); setContextMenu(null); }} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800">复制</button>
                            <div className="px-3 pt-1 text-[10px] text-gray-400">快捷键 Ctrl/⌘ + Alt + M</div>
                        </div>
                    )}

                    {selectionTranslation && selectedText && <div className="mt-3 border-l-2 border-blue-400 pl-3 text-[13px] text-gray-700 dark:text-gray-300">{selectionTranslation}</div>}
''',
"selection toolbar and context menu"
)

# 9. Add app note states after layout state.
replace_once(
'''            const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);
            const [isImmersive, setIsImmersive] = useState(false);
            const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
''',
'''            const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);
            const restoredReadingNotes = localState.readingNotes && typeof localState.readingNotes === 'object'
                ? localState.readingNotes
                : { version: 1, articles: {} };
            const [readingNotes, setReadingNotes] = useState({
                version: 1,
                articles: restoredReadingNotes.articles && typeof restoredReadingNotes.articles === 'object' ? restoredReadingNotes.articles : {}
            });
            const [notesView, setNotesView] = useState('annotations');
            const [annotationComposer, setAnnotationComposer] = useState(null);
            const [annotationDraft, setAnnotationDraft] = useState("");
            const [editingAnnotationId, setEditingAnnotationId] = useState(null);
            const [activeAnnotationId, setActiveAnnotationId] = useState(null);
            const [isImmersive, setIsImmersive] = useState(false);
            const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
''',
"app annotation states"
)

# 10. Add app note helpers before history save.
replace_once(
'''            const saveHistoryToCloud = async (record) => {
''',
'''            const updateArticleNotes = (articleId, updater) => {
                if (!articleId) return;
                setReadingNotes(previous => {
                    const currentArticle = previous.articles?.[articleId] || { documentNote: "", annotations: [] };
                    const nextArticle = typeof updater === 'function' ? updater(currentArticle) : updater;
                    const nextState = {
                        version: 1,
                        articles: {
                            ...(previous.articles || {}),
                            [articleId]: {
                                documentNote: nextArticle.documentNote || "",
                                annotations: Array.isArray(nextArticle.annotations) ? nextArticle.annotations : []
                            }
                        }
                    };
                    persistLocalState({ readingNotes: nextState });
                    return nextState;
                });
            };

            const openAnnotationComposer = (anchor, existingAnnotation = null) => {
                if (!currentHistoryId) {
                    window.showToast("请先进入精读并保存当前文章", "warning");
                    return;
                }
                const normalizedAnchor = existingAnnotation?.anchor || anchor;
                if (!normalizedAnchor?.exact) return;
                setAnnotationComposer({ anchor: normalizedAnchor });
                setAnnotationDraft(existingAnnotation?.note || "");
                setEditingAnnotationId(existingAnnotation?.id || null);
                setNotesView('annotations');
                setRightPanelTab('notes');
                setLayoutMode('split');
                setRightPanelOpen(true);
            };

            const saveAnnotation = () => {
                if (!currentHistoryId || !annotationComposer?.anchor) return;
                const note = annotationDraft.trim();
                if (!note) {
                    window.showToast("请输入批注内容", "warning");
                    return;
                }
                const now = Date.now();
                updateArticleNotes(currentHistoryId, article => {
                    const annotations = [...(article.annotations || [])];
                    if (editingAnnotationId) {
                        const index = annotations.findIndex(item => item.id === editingAnnotationId);
                        if (index >= 0) {
                            annotations[index] = { ...annotations[index], note, updatedAt: now };
                        }
                    } else {
                        annotations.unshift({
                            id: `annotation-${now}-${Math.random().toString(36).slice(2, 8)}`,
                            anchor: annotationComposer.anchor,
                            note,
                            createdAt: now,
                            updatedAt: now
                        });
                    }
                    return { ...article, annotations };
                });
                setAnnotationComposer(null);
                setAnnotationDraft("");
                setEditingAnnotationId(null);
                window.getSelection()?.removeAllRanges();
                window.showToast(editingAnnotationId ? "批注已更新" : "批注已保存到当前设备", "success");
            };

            const deleteAnnotation = (annotationId) => {
                if (!currentHistoryId) return;
                updateArticleNotes(currentHistoryId, article => ({
                    ...article,
                    annotations: (article.annotations || []).filter(item => item.id !== annotationId)
                }));
                if (activeAnnotationId === annotationId) setActiveAnnotationId(null);
                if (editingAnnotationId === annotationId) {
                    setAnnotationComposer(null);
                    setAnnotationDraft("");
                    setEditingAnnotationId(null);
                }
            };

            const focusAnnotation = (annotationId) => {
                setActiveAnnotationId(annotationId);
                setNotesView('annotations');
                setRightPanelTab('notes');
                setLayoutMode('split');
                setRightPanelOpen(true);
                window.requestAnimationFrame(() => {
                    document.querySelector(`[data-annotation-id="${annotationId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                window.setTimeout(() => setActiveAnnotationId(current => current === annotationId ? null : current), 1800);
            };

            const saveHistoryToCloud = async (record) => {
''',
"app note helpers"
)

# 11. Add current article notes after paragraphs memo.
replace_once(
'''            const paragraphs = useMemo(() => inputText.split(/\n+/).filter(p => p.trim() !== ''), [inputText]);

            return (
''',
'''            const paragraphs = useMemo(() => inputText.split(/\n+/).filter(p => p.trim() !== ''), [inputText]);
            const currentArticleNotes = currentHistoryId
                ? (readingNotes.articles?.[currentHistoryId] || { documentNote: "", annotations: [] })
                : { documentNote: "", annotations: [] };
            const currentAnnotations = Array.isArray(currentArticleNotes.annotations) ? currentArticleNotes.annotations : [];

            return (
''',
"current article notes"
)

# 12. Chinese layout labels.
replace_once(
'''                                            {['standard', 'split', 'focus'].map((mode) => (
                                                <button key={mode} onClick={() => setLayoutMode(mode)} className={`min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium transition-all ${layoutMode === mode ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>{mode}</button>
                                            ))}
                                            <button onClick={() => setRightPanelOpen(previous => !previous)} disabled={layoutMode !== 'split'} className="min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">{rightPanelOpen ? 'Hide panel' : 'Show panel'}</button>
                                            <button onClick={toggleBrowserFullscreen} className="min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700">{isBrowserFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
                                            <button onClick={() => setIsImmersive(previous => !previous)} className="min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700">{isImmersive ? 'Exit immersive' : 'Immersive'}</button>
''',
'''                                            {[
                                                ['standard', '标准'],
                                                ['split', '分栏'],
                                                ['focus', '专注']
                                            ].map(([mode, label]) => (
                                                <button key={mode} onClick={() => setLayoutMode(mode)} className={`min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium transition-all ${layoutMode === mode ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>{label}</button>
                                            ))}
                                            <button onClick={() => setRightPanelOpen(previous => !previous)} disabled={layoutMode !== 'split'} className="min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">{rightPanelOpen ? '隐藏侧栏' : '显示侧栏'}</button>
                                            <button onClick={toggleBrowserFullscreen} className="min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700">{isBrowserFullscreen ? '退出全屏' : '全屏'}</button>
                                            <button onClick={() => setIsImmersive(previous => !previous)} className="min-h-[36px] px-3 rounded-[2px] text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700">{isImmersive ? '退出沉浸' : '沉浸'}</button>
''',
"Chinese layout labels"
)

# 13. Pass annotation props to Paragraph.
replace_once(
'''                                                text={p} 
                                                activeDicts={activeDicts} 
''',
'''                                                text={p}
                                                paragraphIndex={idx}
                                                annotations={currentAnnotations.filter(annotation => Number(annotation?.anchor?.paragraphIndex) === idx)}
                                                activeAnnotationId={activeAnnotationId}
                                                onRequestAnnotation={openAnnotationComposer}
                                                onFocusAnnotation={focusAnnotation}
                                                activeDicts={activeDicts} 
''',
"Paragraph annotation props"
)

# 14. Replace right panel with Chinese tabs and structured notes.
old_panel = '''                                            <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
                                                {['outline', 'analysis', 'notes'].map((tab) => (
                                                    <button key={tab} onClick={() => setRightPanelTab(tab)} aria-pressed={rightPanelTab === tab} className={`flex-1 min-h-[38px] px-2 rounded-sm text-[12px] font-medium ${rightPanelTab === tab ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{tab}</button>
                                                ))}
                                                <button onClick={() => setRightPanelOpen(false)} aria-label="Close panel" className="w-8 h-8 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">×</button>
                                            </div>
                                            <div className="p-4 text-[13px] text-gray-700 dark:text-gray-300">
                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? <LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode="bilingual" collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} /> : <p className="text-gray-400 dark:text-gray-500">Generate the outline from the reader actions.</p>)}
                                                {rightPanelTab === 'analysis' && (rightPanelAnalysis ? <div className="space-y-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Paragraph analysis</h3>{rightPanelAnalysis.complexSentences?.map((item, index) => <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-3"><p className="font-medium leading-relaxed">{item.originalSentence}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{item.sentenceTranslation}</p></div>)}</div> : globalLogicData ? <div className="space-y-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">Analysis</h3><p className="leading-relaxed">{globalLogicData.coreMeaning}</p><p className="text-gray-500 dark:text-gray-400">{globalLogicData.logicalStructure}</p></div> : <p className="text-gray-400 dark:text-gray-500">Run full-text analysis to see results here.</p>)}
                                                {rightPanelTab === 'notes' && <textarea className="w-full min-h-[260px] resize-y bg-transparent border border-gray-200 dark:border-gray-700 p-3 outline-none focus:border-gray-500" placeholder="Write local reading notes..." />}
                                            </div>
'''
new_panel = '''                                            <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
                                                {[
                                                    ['outline', '全文结构'],
                                                    ['analysis', '精读结果'],
                                                    ['notes', `笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]
                                                ].map(([tab, label]) => (
                                                    <button key={tab} onClick={() => setRightPanelTab(tab)} aria-pressed={rightPanelTab === tab} className={`flex-1 min-h-[38px] px-2 rounded-sm text-[12px] font-medium ${rightPanelTab === tab ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{label}</button>
                                                ))}
                                                <button onClick={() => setRightPanelOpen(false)} aria-label="关闭侧栏" className="w-8 h-8 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">×</button>
                                            </div>
                                            <div className="p-4 text-[13px] text-gray-700 dark:text-gray-300">
                                                {rightPanelTab === 'outline' && (fullMapData?.mindmap ? <LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode="bilingual" collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} /> : <p className="text-gray-400 dark:text-gray-500">生成全文思维导图后，结构会显示在这里。</p>)}
                                                {rightPanelTab === 'analysis' && (rightPanelAnalysis ? <div className="space-y-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">段落精读</h3>{rightPanelAnalysis.complexSentences?.map((item, index) => <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-3"><p className="font-medium leading-relaxed">{item.originalSentence}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{item.sentenceTranslation}</p></div>)}</div> : globalLogicData ? <div className="space-y-3"><h3 className="font-semibold text-gray-900 dark:text-gray-100">全文分析</h3><p className="leading-relaxed">{globalLogicData.coreMeaning}</p><p className="text-gray-500 dark:text-gray-400">{globalLogicData.logicalStructure}</p></div> : <p className="text-gray-400 dark:text-gray-500">运行段落解构或全文逻辑后，结果会显示在这里。</p>)}
                                                {rightPanelTab === 'notes' && (
                                                    <div className="space-y-4">
                                                        <div className="flex p-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-sm">
                                                            <button onClick={() => setNotesView('annotations')} className={`flex-1 min-h-[34px] px-2 text-[12px] rounded-[2px] ${notesView === 'annotations' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>批注 {currentAnnotations.length}</button>
                                                            <button onClick={() => setNotesView('document')} className={`flex-1 min-h-[34px] px-2 text-[12px] rounded-[2px] ${notesView === 'document' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>全文笔记</button>
                                                        </div>

                                                        {notesView === 'annotations' ? (
                                                            <>
                                                                {annotationComposer && (
                                                                    <div className="p-3 border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/15 rounded-sm">
                                                                        <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300">正在{editingAnnotationId ? '编辑' : '添加'}批注</div>
                                                                        <blockquote className="mt-2 pl-3 border-l-2 border-amber-400 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-4">“{annotationComposer.anchor.exact}”</blockquote>
                                                                        <textarea autoFocus value={annotationDraft} onChange={(event) => setAnnotationDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') saveAnnotation(); }} className="mt-3 w-full min-h-[96px] resize-y bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 outline-none focus:border-amber-500" placeholder="写下你的理解、疑问或考试提示…" />
                                                                        <div className="mt-2 flex justify-end gap-2">
                                                                            <button onClick={() => { setAnnotationComposer(null); setAnnotationDraft(""); setEditingAnnotationId(null); }} className="min-h-[34px] px-3 text-[12px] text-gray-500 hover:bg-white dark:hover:bg-gray-800 rounded-sm">取消</button>
                                                                            <button onClick={saveAnnotation} className="min-h-[34px] px-3 text-[12px] font-medium bg-amber-500 text-gray-950 hover:bg-amber-400 rounded-sm">{editingAnnotationId ? '更新批注' : '保存批注'}</button>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {currentAnnotations.length === 0 && !annotationComposer ? (
                                                                    <div className="py-10 text-center text-gray-400 dark:text-gray-500">
                                                                        <div className="text-[13px]">选择正文后点击“批注”</div>
                                                                        <div className="mt-1 text-[11px]">也可右键或按 Ctrl/⌘ + Alt + M</div>
                                                                        <div className="mt-3 text-[11px]">批注仅保存在当前设备</div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        {currentAnnotations.map(annotation => (
                                                                            <div key={annotation.id} className={`p-3 border rounded-sm transition-colors ${activeAnnotationId === annotation.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40'}`}>
                                                                                <button onClick={() => focusAnnotation(annotation.id)} className="w-full text-left">
                                                                                    <div className="text-[11px] text-amber-700 dark:text-amber-400 line-clamp-2">“{annotation.anchor.exact}”</div>
                                                                                    <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-300">{annotation.note}</div>
                                                                                </button>
                                                                                <div className="mt-3 flex items-center justify-between gap-2">
                                                                                    <span className="text-[10px] text-gray-400">{new Date(annotation.updatedAt || annotation.createdAt).toLocaleString('zh-CN')}</span>
                                                                                    <div className="flex gap-1">
                                                                                        <button onClick={() => focusAnnotation(annotation.id)} className="min-h-[30px] px-2 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm">定位</button>
                                                                                        <button onClick={() => openAnnotationComposer(annotation.anchor, annotation)} className="min-h-[30px] px-2 text-[11px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm">编辑</button>
                                                                                        <button onClick={() => { if (window.confirm('确定删除这条批注吗？')) deleteAnnotation(annotation.id); }} className="min-h-[30px] px-2 text-[11px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-sm">删除</button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div>
                                                                <textarea
                                                                    value={currentArticleNotes.documentNote || ""}
                                                                    onChange={(event) => updateArticleNotes(currentHistoryId, article => ({ ...article, documentNote: event.target.value }))}
                                                                    className="w-full min-h-[300px] resize-y bg-transparent border border-gray-200 dark:border-gray-700 p-3 outline-none focus:border-gray-500"
                                                                    placeholder="记录整篇文章的主旨、结构、复盘或待办…"
                                                                />
                                                                <p className="mt-2 text-[10px] text-gray-400">自动保存到当前设备，不调用模型。</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
'''
replace_once(old_panel, new_panel, "right panel notes")

# 15. Append task completion notes.
log_text = LOG.read_text(encoding="utf-8")
log_text += '''

## 8. 实际修改

- `index.html`：新增句子级批注锚点、选区工具条批注入口、右键菜单、快捷键、原文标记、Notes 双模式、编辑删除定位和本地持久化。
- 阅读布局与右侧面板相关原型英文标签已中文化。
- 未修改 API、OCR、PDF、Firebase 和模型路由。

## 9. 数据结构

`readingNotes.version = 1`，按 `currentHistoryId` 保存：

- `documentNote`：全文笔记
- `annotations[]`：`id`、`anchor`、`note`、`createdAt`、`updatedAt`
- `anchor`：`paragraphIndex`、`startOffset`、`endOffset`、`exact`、`prefix`、`suffix`

批注默认只保存到现有 `localStorage` 状态，不同步 Firebase。

## 10. 验证

- 补丁脚本要求所有源码锚点唯一匹配，否则立即失败。
- GitHub Actions 执行后将运行：
  - Python 补丁脚本
  - `git diff --check`
  - 源码关键标记检查
- 仍需用户在浏览器手工验证：鼠标选区、右键、快捷键、刷新持久化、批注定位和夜间模式。

## 11. 当前状态

状态：远程实现完成，等待分支部署或本地手工验收。

GitHub：已按用户明确授权修改 `feat/reader-annotations-v2`，未合并 `main`。
'''
LOG.write_text(log_text, encoding="utf-8")

INDEX.write_text(source, encoding="utf-8")

required = [
    "reader-annotation-mark",
    "handleRequestAnnotation",
    "readingNotes",
    "批注仅保存在当前设备",
    "全文笔记",
    "Ctrl/⌘ + Alt + M",
    "feat/reader-annotations-v2"
]
combined = source + LOG.read_text(encoding="utf-8")
missing = [item for item in required if item not in combined]
if missing:
    raise RuntimeError(f"missing required markers: {missing}")

print("Reader annotation patch applied successfully.")
