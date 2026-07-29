import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  callGeminiIntensiveAnalysis,
  callGeminiQuiz,
  callGeminiTranslation,
  callGeminiTTS,
  callGeminiWordDisambiguation
} from '../services/ai.js';
import { getModelSafeText } from '../core/pdf-text.js';
import { getLemmaMatches, PHRASE_DB } from '../core/vocabulary.js';
import { SyntaxBreakdowns } from './PracticePanels.jsx';
import {
  handleArticleVocabularyNavigation,
  handleKeyboardActivation,
  useMenuNavigation
} from '../accessibility/focus.js';

const VOCAB_TYPE_META = {
    basic: {
        label: '基础词',
        underline: 'decoration-green-600 dark:decoration-green-400',
        badge: 'bg-green-600 dark:bg-green-700',
        text: 'text-green-700 dark:text-green-400'
    },
    required: {
        label: '必考词',
        underline: 'decoration-sky-600 dark:decoration-sky-400',
        badge: 'bg-sky-600 dark:bg-sky-700',
        text: 'text-sky-700 dark:text-sky-300'
    },
    extra: {
        label: '超纲词',
        underline: 'decoration-red-600 dark:decoration-red-400',
        badge: 'bg-red-600 dark:bg-red-700',
        text: 'text-red-700 dark:text-red-400'
    },
    custom: {
        label: '个人词库',
        underline: 'decoration-amber-500 dark:decoration-amber-400 decoration-dotted',
        badge: 'bg-amber-600 dark:bg-amber-700',
        text: 'text-amber-700 dark:text-amber-400'
    },
    phrase: {
        label: '语法与佳句',
        underline: 'decoration-violet-500 dark:decoration-violet-400 decoration-dashed',
        badge: 'bg-violet-600 dark:bg-violet-700',
        text: 'text-violet-700 dark:text-violet-300'
    }
};

const shouldShowVocabType = (type, highlightMode) => {
    if (highlightMode === 'none') return false;
    if (highlightMode === 'all') return true;
    if (highlightMode === 'exam') return type === 'required' || type === 'extra';
    return highlightMode === type;
};

const WordHighlighter = ({ text, activeDicts, highlightMode, masteredLemmaSet, onWordClick }) => {
    const parts = text.split(/([a-zA-Z]+-?[a-zA-Z]*)/g);
    return (
        <Fragment>
            {parts.map((part, index) => {
                const match = getLemmaMatches(part, activeDicts);
                if (match && !masteredLemmaSet?.has(match.word) && part.trim().length > 0 && shouldShowVocabType(match.type, highlightMode)) {
                    const { translation, type, word: lemma, category, memo } = match;
                    const meta = VOCAB_TYPE_META[type] || VOCAB_TYPE_META.custom;
                    return (
                        <span
                            key={index}
                            role="button"
                            tabIndex={-1}
                            data-reader-vocabulary="true"
                            aria-label={`查看单词 ${part} 的释义`}
                            onClick={(event) => {
                                event.stopPropagation();
                                event.currentTarget.focus();
                                onWordClick({ word: part, lemma, translation, type, category, memo, note: memo }, event.currentTarget);
                            }}
                            onKeyDown={(event) => {
                                if (handleArticleVocabularyNavigation(event)) return;
                                handleKeyboardActivation(event, () => onWordClick({ word: part, lemma, translation, type, category, memo, note: memo }, event.currentTarget));
                            }}
                            className={`mx-[1px] cursor-pointer underline decoration-2 underline-offset-[3px] decoration-skip-ink-auto transition-[text-decoration-thickness,opacity] hover:decoration-[3px] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${meta.underline}`}
                        >
                            {part}
                        </span>
                    );
                }
                return <span key={index} className="transition-all">{part}</span>;
            })}
        </Fragment>
    );
};

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const ANNOTATION_COLOR_MAP = {
    gold: { label: '深金', bg: 'rgba(166, 118, 10, 0.28)', hover: 'rgba(166, 118, 10, 0.40)', active: 'rgba(166, 118, 10, 0.52)', border: '#846008', strong: '#634705', ring: 'rgba(132, 96, 8, 0.18)', darkBg: 'rgba(202, 138, 4, 0.30)', darkActive: 'rgba(202, 138, 4, 0.48)', darkBorder: '#facc15', darkRing: 'rgba(202, 138, 4, 0.22)' },
    blue: { label: '蓝', bg: 'rgba(56, 132, 196, 0.20)', hover: 'rgba(56, 132, 196, 0.32)', active: 'rgba(56, 132, 196, 0.42)', border: '#2f76ad', strong: '#235c89', ring: 'rgba(47, 118, 173, 0.16)', darkBg: 'rgba(56, 132, 196, 0.28)', darkActive: 'rgba(56, 132, 196, 0.44)', darkBorder: '#7dd3fc', darkRing: 'rgba(56, 189, 248, 0.18)' },
    rose: { label: '玫红', bg: 'rgba(190, 75, 105, 0.18)', hover: 'rgba(190, 75, 105, 0.30)', active: 'rgba(190, 75, 105, 0.40)', border: '#b44b68', strong: '#8d3851', ring: 'rgba(180, 75, 104, 0.16)', darkBg: 'rgba(190, 75, 105, 0.28)', darkActive: 'rgba(190, 75, 105, 0.44)', darkBorder: '#fda4af', darkRing: 'rgba(251, 113, 133, 0.18)' },
    green: { label: '绿', bg: 'rgba(49, 139, 107, 0.18)', hover: 'rgba(49, 139, 107, 0.30)', active: 'rgba(49, 139, 107, 0.40)', border: '#2f8064', strong: '#23604b', ring: 'rgba(47, 128, 100, 0.16)', darkBg: 'rgba(49, 139, 107, 0.28)', darkActive: 'rgba(49, 139, 107, 0.44)', darkBorder: '#6ee7b7', darkRing: 'rgba(52, 211, 153, 0.18)' },
    violet: { label: '紫', bg: 'rgba(124, 91, 190, 0.18)', hover: 'rgba(124, 91, 190, 0.30)', active: 'rgba(124, 91, 190, 0.40)', border: '#7352b0', strong: '#583d89', ring: 'rgba(115, 82, 176, 0.16)', darkBg: 'rgba(124, 91, 190, 0.28)', darkActive: 'rgba(124, 91, 190, 0.44)', darkBorder: '#c4b5fd', darkRing: 'rgba(167, 139, 250, 0.18)' }
};

const annotationCssVariables = (colorKey) => {
    const palette = ANNOTATION_COLOR_MAP[colorKey] || ANNOTATION_COLOR_MAP.gold;
    return {
        '--annotation-bg': palette.bg,
        '--annotation-hover': palette.hover,
        '--annotation-active': palette.active,
        '--annotation-border': palette.border,
        '--annotation-strong': palette.strong,
        '--annotation-ring': palette.ring,
        '--annotation-dark-bg': palette.darkBg,
        '--annotation-dark-active': palette.darkActive,
        '--annotation-dark-border': palette.darkBorder,
        '--annotation-dark-ring': palette.darkRing
    };
};

const splitTextByAnnotations = (segmentText, segmentStart, annotations) => {
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

const Paragraph = ({ text, paragraphIndex, annotations = [], activeAnnotationId, activeDicts, masteredLemmaSet, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, savedResults = null, inlineResultsEnabled = true, onPersistParagraphResult, onOpenAnalysis, onRequestAnnotation, onFocusAnnotation, onMasterWord }) => {
    const [showTranslation, setShowTranslation] = useState(false);
    const [localTranslation, setLocalTranslation] = useState(savedResults?.translation || "");
    const [isLocalTransLoading, setIsLocalTransLoading] = useState(false);

    const [showAnalysis, setShowAnalysis] = useState(false);
    const [analysisData, setAnalysisData] = useState(savedResults?.analysis || null);
    const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

    const [audioUrl, setAudioUrl] = useState(null);
    const [isAudioLoading, setIsAudioLoading] = useState(false);

    const [showQuiz, setShowQuiz] = useState(false);
    const [quizData, setQuizData] = useState(savedResults?.quiz || null);
    const [isQuizLoading, setIsQuizLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);

    const [activeNote, setActiveNote] = useState(null);
    const activeNoteTriggerRef = useRef(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [selectionTranslation, setSelectionTranslation] = useState("");
    const [isSelectionTranslating, setIsSelectionTranslating] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const paragraphRef = useRef(null);
    const textRef = useRef(null);
    const {
        triggerRef: paragraphMenuTriggerRef,
        menuRef: paragraphMenuRef,
        onMenuKeyDown: handleParagraphMenuKeyDown
    } = useMenuNavigation({
        open: isInteracting,
        onClose: () => setIsInteracting(false)
    });
    const {
        menuRef: contextMenuRef,
        onMenuKeyDown: handleContextMenuKeyDown
    } = useMenuNavigation({
        open: Boolean(contextMenu),
        onClose: () => setContextMenu(null)
    });

    useEffect(() => {
        setLocalTranslation(savedResults?.translation || "");
        setAnalysisData(savedResults?.analysis || null);
        setQuizData(savedResults?.quiz || null);
        setShowTranslation(false);
        setShowAnalysis(false);
        setShowQuiz(false);
    }, [paragraphIndex, savedResults?.updatedAt]);

    const isConsideredParagraph = text.split(/\s+/).filter(Boolean).length >= 15 && /[.,:;]/.test(text);
    const hasParagraphResult = showTranslation || showAnalysis || showQuiz || !!activeNote || !!audioUrl;

    useEffect(() => {
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
        document.addEventListener('pointerdown', closeContextMenu);
        document.addEventListener('scroll', closeOnScroll, true);
        return () => {
            document.removeEventListener('pointerdown', closeContextMenu);
            document.removeEventListener('scroll', closeOnScroll, true);
        };
    }, [contextMenu]);

    useEffect(() => {
        if (!isInteracting) return undefined;
        const closeMenu = (event) => {
            if (!paragraphRef.current?.contains(event.target)) setIsInteracting(false);
        };
        document.addEventListener('pointerdown', closeMenu);
        return () => {
            document.removeEventListener('pointerdown', closeMenu);
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

    const openParagraphResult = (kind, title, data) => {
        const result = {
            kind,
            title,
            paragraphIndex,
            sourceText: text,
            data,
            createdAt: Date.now()
        };
        onPersistParagraphResult?.(result);
        onOpenAnalysis?.(result);
    };

    const phraseRegex = useMemo(() => {
        const customPhrases = activeDicts
            .flatMap(d => Object.keys(d.data || {}))
            .filter(k => k.includes(' '));
        const allPhrases = [...Object.keys(PHRASE_DB), ...customPhrases].sort((a, b) => b.length - a.length);
        if (allPhrases.length === 0) return null;
        return new RegExp(`\\b(${allPhrases.join('|')})\\b`, 'gi');
    }, [activeDicts]);

    const handleToggleTrans = async (e) => {
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
    };

    const handleToggleAnalysis = async (e) => {
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
    };

    const handleToggleAudio = async (e) => {
        e.stopPropagation();
        if (audioUrl) return;
        setIsAudioLoading(true);
        try {
            const url = await callGeminiTTS(getModelSafeText(text, 4000, "外教领读"), apiConfig);
            setAudioUrl(url);
        } catch (e) {
            window.showToast(`语音合成异常: ${e.message}`, "error");
        } finally {
            setIsAudioLoading(false);
        }
    };

    const handleLocalSpeech = (e) => {
        e.stopPropagation();
        if (!window.speechSynthesis) {
            window.showToast('当前浏览器不支持本地朗读', 'warning');
            return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    };

    const handleSelectionSpeech = () => {
        if (!selectedText || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(selectedText);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
    };

    const handleSelectionTranslation = async () => {
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
            window.showToast("请先选择需要添加笔记的文字", "warning");
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
    };

    const focusActiveNoteTrigger = () => requestAnimationFrame(() => {
        const target = activeNoteTriggerRef.current?.isConnected
            ? activeNoteTriggerRef.current
            : document.querySelector('[data-reader-vocabulary-region="true"]');
        target?.focus?.();
    });

    const closeActiveNote = () => {
        setActiveNote(null);
        focusActiveNoteTrigger();
    };

    const handleWordClick = (wordInfo, trigger) => {
        activeNoteTriggerRef.current = trigger || document.activeElement;
        setActiveNote({ ...wordInfo, isPhrase: false, contextSentence: text });
    };

    useEffect(() => {
        if (!activeNote) return undefined;
        const handleEscape = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeActiveNote();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [Boolean(activeNote)]);

    const handleDisambiguate = async (noteInfo) => {
        setActiveNote(prev => ({ ...prev, isDisambiguating: true }));
        try {
            const aiResult = await callGeminiWordDisambiguation(noteInfo.lemma || noteInfo.word, noteInfo.contextSentence, noteInfo.translation, apiConfig);
            setActiveNote(prev => ({ ...prev, aiContextMeaning: aiResult }));
        } catch (e) {
            window.showToast(`精准释义超时`, "error");
        } finally {
            setActiveNote(prev => ({ ...prev, isDisambiguating: false }));
        }
    };

    if (!text.trim()) return null;

    if (readingMode === 'pure') {
        return (
            <div className="mb-8">
                <div className="text-gray-900 dark:text-gray-200 text-left break-words" style={{ fontFamily: typographyConfig.readingFontFamily || typographyConfig.fontFamily, fontSize: `${typographyConfig.fontSize}px`, lineHeight: typographyConfig.lineHeight, marginBottom: `${typographyConfig.paragraphSpacing || 1.05}em` }}>
                    {text}
                </div>
            </div>
        );
    }

    let textSegments = [{ text: text, isTarget: false }];
    if (showAnalysis && analysisData?.complexSentences?.length > 0) {
        analysisData.complexSentences.forEach(compObj => {
            let target = compObj.originalSentence?.trim();
            if (!target) return;
            let newSegments = [];
            textSegments.forEach(seg => {
                if (seg.isTarget) {
                    newSegments.push(seg);
                } else {
                    let idx = seg.text.indexOf(target);
                    let matchedText = target;

                    if (idx === -1) {
                        const escaped = escapeRegExp(target);
                        const flexStr = escaped.replace(/\s+/g, '\\s+').replace(/['’`]/g, "['’`]");
                        try {
                            const flexRegex = new RegExp(flexStr, 'i');
                            const match = seg.text.match(flexRegex);
                            if (match) {
                                idx = match.index;
                                matchedText = match[0];
                            }
                        } catch(e){}
                    }

                    if (idx === -1 && compObj.chunks && compObj.chunks.length > 0) {
                        const firstChunk = compObj.chunks[0].text.trim();
                        const lastChunk = compObj.chunks[compObj.chunks.length - 1].text.trim();
                        if (firstChunk && lastChunk) {
                            try {
                                const flexFirst = new RegExp(escapeRegExp(firstChunk).replace(/\s+/g, '\\s+').replace(/['’`]/g, "['’`]"), 'i');
                                const flexLast = new RegExp(escapeRegExp(lastChunk).replace(/\s+/g, '\\s+').replace(/['’`]/g, "['’`]"), 'i');

                                const matchFirst = seg.text.match(flexFirst);
                                if (matchFirst) {
                                    const startIdx = matchFirst.index;
                                    const remainingText = seg.text.substring(startIdx);
                                    const matchLast = remainingText.match(flexLast);
                                    if (matchLast) {
                                        const endIdx = startIdx + matchLast.index + matchLast[0].length;
                                        matchedText = seg.text.substring(startIdx, endIdx);
                                        idx = startIdx;
                                    }
                                }
                            } catch(e){}
                        }
                    }

                    if (idx !== -1) {
                        newSegments.push({ text: seg.text.substring(0, idx), isTarget: false });
                        newSegments.push({ text: seg.text.substring(idx, idx + matchedText.length), isTarget: true });
                        newSegments.push({ text: seg.text.substring(idx + matchedText.length), isTarget: false });
                    } else {
                        newSegments.push(seg);
                    }
                }
            });
            textSegments = newSegments;
        });
    }

    const renderProcessedText = (segmentText, isTarget) => {
        let chunks = phraseRegex ? segmentText.split(phraseRegex) : [segmentText];

        const content = chunks.map((chunk, index) => {
            const lowerChunk = chunk.toLowerCase();
            let phraseData = PHRASE_DB[lowerChunk];

            if (!phraseData) {
                for (const dict of activeDicts) {
                    const entry = dict.data?.[lowerChunk];
                    if (entry) {
                        phraseData = typeof entry === 'string'
                            ? { trans: entry, type: dict.type }
                            : {
                                trans: entry.translation || entry.zh || '',
                                note: entry.memo || '',
                                category: entry.category || '',
                                type: dict.type
                            };
                        break;
                    }
                }
            }
            if (phraseData && lowerChunk.includes(' ')) {
                const phraseType = phraseData.type || 'phrase';
                if (!shouldShowVocabType(phraseType, highlightMode)) return <span key={index}>{chunk}</span>;

                const isActive = activeNote && activeNote.word === chunk && activeNote.isPhrase;
                const meta = VOCAB_TYPE_META[phraseType] || VOCAB_TYPE_META.phrase;
                return (
                    <span
                        key={index}
                        role="button"
                        tabIndex={-1}
                        data-reader-vocabulary="true"
                        aria-label={`查看短语 ${chunk} 的释义`}
                        onClick={(event) => {
                            event.stopPropagation();
                            event.currentTarget.focus();
                            activeNoteTriggerRef.current = event.currentTarget;
                            setActiveNote({
                                word: chunk,
                                isPhrase: true,
                                trans: phraseData.trans || phraseData.translation,
                                note: phraseData.note,
                                category: phraseData.category,
                                type: phraseType
                            });
                        }}
                        onKeyDown={(event) => {
                            if (handleArticleVocabularyNavigation(event)) return;
                            handleKeyboardActivation(event, () => {
                                activeNoteTriggerRef.current = event.currentTarget;
                                setActiveNote({
                                    word: chunk,
                                    isPhrase: true,
                                    trans: phraseData.trans || phraseData.translation,
                                    note: phraseData.note,
                                    category: phraseData.category,
                                    type: phraseType
                                });
                            });
                        }}
                        className={`cursor-pointer mx-0.5 underline decoration-2 underline-offset-[3px] decoration-skip-ink-auto transition-[text-decoration-thickness,opacity] hover:decoration-[3px] hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${meta.underline} ${isActive ? 'decoration-[3px]' : ''}`}
                    >
                        {chunk}
                    </span>
                );
            }
            return <WordHighlighter key={index} text={chunk} activeDicts={activeDicts} highlightMode={highlightMode} masteredLemmaSet={masteredLemmaSet} onWordClick={handleWordClick} />;
        });
        return isTarget ? <span className="bg-amber-200/50 dark:bg-amber-900/40 border-b-[2px] border-amber-300/80 dark:border-amber-700 px-[2px] rounded-sm transition-all duration-500 shadow-[0_0_10px_rgba(253,230,138,0.4)] dark:shadow-none">{content}</span> : content;
    };

    let runningTextOffset = 0;
    const offsetTextSegments = textSegments.map(segment => {
        const offsetSegment = { ...segment, startOffset: runningTextOffset };
        runningTextOffset += segment.text.length;
        return offsetSegment;
    });

    const finalTranslationToShow = translationText || localTranslation;

    return (
            <div
                ref={paragraphRef}
                data-reader-paragraph="true"
            className="mb-14 relative group"
        >
            <div
                ref={textRef}
                data-reader-text="true"
                className="text-gray-900 dark:text-gray-200 text-left break-words relative z-10 transition-all cursor-text"
                style={{ fontFamily: typographyConfig.readingFontFamily || typographyConfig.fontFamily, fontSize: `${typographyConfig.fontSize}px`, lineHeight: typographyConfig.lineHeight, marginBottom: `${typographyConfig.paragraphSpacing || 1.05}em` }}
                onContextMenu={handleSelectionContextMenu}
            >
                {offsetTextSegments.map((seg, segmentIndex) => (
                    <Fragment key={segmentIndex}>
                        {splitTextByAnnotations(seg.text, seg.startOffset, annotations).map((piece, pieceIndex) => {
                            const content = renderProcessedText(piece.text, seg.isTarget);
                            if (!piece.annotationIds.length) return <Fragment key={pieceIndex}>{content}</Fragment>;
                            const primaryAnnotationId = piece.annotationIds[0];
                            const primaryAnnotation = annotations.find(item => item.id === primaryAnnotationId);
                            const isActiveAnnotation = piece.annotationIds.includes(activeAnnotationId);
                            return (
                                <span
                                    key={pieceIndex}
                                    role="button"
                                    tabIndex="0"
                                    data-annotation-id={primaryAnnotationId}
                                    className={`reader-annotation-mark ${isActiveAnnotation ? 'reader-annotation-mark-active' : ''}`}
                                    style={annotationCssVariables(primaryAnnotation?.color || 'gold')}
                                    title={`${piece.annotationIds.length} 条批注`}
                                    onClick={(event) => { event.stopPropagation(); onFocusAnnotation?.(primaryAnnotationId); }}
                                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onFocusAnnotation?.(primaryAnnotationId); } }}
                                >
                                    {content}
                                </span>
                            );
                        })}
                    </Fragment>
                ))}
            </div>

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
                <div role="toolbar" aria-label="文字选区操作" onMouseDown={(event) => event.preventDefault()} className="absolute left-0 right-0 top-full z-30 mt-2 flex flex-wrap items-center gap-1.5 p-2 bg-sky-700 text-white rounded-sm shadow-lg animate-fade-in">
                    <span className="px-2 text-[11px] text-gray-300 truncate max-w-[180px]" title={selectedText}>{selectedText}</span>
                    <button onClick={() => navigator.clipboard?.writeText(selectedText)} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">复制</button>
                    <button onClick={handleSelectionTranslation} disabled={isSelectionTranslating} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20 disabled:opacity-50">{isSelectionTranslating ? '翻译中…' : '翻译'}</button>
                    <button onClick={handleSelectionSpeech} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">朗读</button>
                    <button onClick={handleRequestAnnotation} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-amber-500/90 hover:bg-amber-500 text-gray-950 font-medium">添加笔记</button>
                    <button onClick={() => setIsInteracting(true)} className="min-h-[32px] px-2.5 text-[11px] rounded-sm bg-white/10 hover:bg-white/20">更多</button>
                </div>
            )}

            {contextMenu && (
                <div ref={contextMenuRef} data-reader-context-menu="true" role="menu" tabIndex={-1} aria-label="选区快捷操作" onKeyDown={handleContextMenuKeyDown} className="reader-context-menu rounded-sm text-[12px] text-gray-700 dark:text-gray-200" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} onMouseDown={(event) => event.preventDefault()}>
                    <button role="menuitem" onClick={handleRequestAnnotation} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-medium">添加选区笔记</button>
                    <button role="menuitem" onClick={() => { setContextMenu(null); handleSelectionTranslation(); }} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800">翻译选中内容</button>
                    <button role="menuitem" onClick={() => { setContextMenu(null); handleSelectionSpeech(); }} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800">朗读选中内容</button>
                    <button role="menuitem" onClick={() => { navigator.clipboard?.writeText(selectedText); setContextMenu(null); }} className="w-full min-h-[36px] px-3 text-left rounded-sm hover:bg-gray-100 dark:hover:bg-gray-800">复制</button>
                    <div className="px-3 pt-1 text-[10px] text-gray-400">快捷键 Ctrl/⌘ + Alt + M</div>
                </div>
            )}

            {selectionTranslation && selectedText && <div className="mt-3 border-l-2 border-blue-400 pl-3 text-[13px] text-gray-700 dark:text-gray-300">{selectionTranslation}</div>}

            <button
                ref={paragraphMenuTriggerRef}
                type="button"
                data-reader-paragraph-trigger="true"
                onClick={toggleParagraphMenu}
                aria-haspopup="menu"
                aria-expanded={isInteracting}
                aria-controls={`paragraph-menu-${paragraphIndex}`}
                aria-label={`打开第 ${paragraphIndex + 1} 段工具`}
                title="本段工具"
                className={`absolute top-0 right-0 md:-right-11 z-30 w-9 h-9 grid place-items-center rounded-sm border bg-white/95 dark:bg-gray-800/95 shadow-sm text-gray-500 dark:text-gray-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${isInteracting ? 'opacity-100 border-sky-300 text-sky-700 dark:text-sky-300 dark:border-sky-700' : 'opacity-100 md:opacity-30 border-gray-200 dark:border-gray-700 md:group-hover:opacity-100 hover:text-sky-700 hover:border-sky-200 dark:hover:text-sky-300'}`}
            >
                <span aria-hidden="true" className="text-lg leading-none -mt-1">⋯</span>
                {hasParagraphResult && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-sky-500" aria-label="本段已有学习结果"></span>}
            </button>

            {isInteracting && (
                <div
                    ref={paragraphMenuRef}
                    id={`paragraph-menu-${paragraphIndex}`}
                    data-reader-paragraph-menu="true"
                    role="menu"
                    tabIndex={-1}
                    aria-label={`第 ${paragraphIndex + 1} 段工具`}
                    onKeyDown={handleParagraphMenuKeyDown}
                    className="absolute top-10 right-0 md:-right-2 z-40 w-60 overflow-hidden rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 shadow-xl animate-fade-in-down"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-[11px] text-gray-400 dark:text-gray-500">第 {paragraphIndex + 1} 段 · 本段工具</div>
                    <div className="p-1.5">
                        <button role="menuitem" onClick={runParagraphAction(handleToggleTrans)} disabled={(isTransLoading || isLocalTransLoading) && !finalTranslationToShow} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
                            <span>{showTranslation ? '收起段落翻译' : '翻译本段'}</span>
                            {(isTransLoading || isLocalTransLoading) && !finalTranslationToShow ? <span className="text-[10px] text-gray-400">处理中</span> : finalTranslationToShow ? <span className="text-[10px] text-sky-600 dark:text-sky-400">已缓存</span> : null}
                        </button>
                        <button role="menuitem" onClick={runParagraphAction(handleToggleAnalysis)} disabled={!isConsideredParagraph || isAnalysisLoading} title={!isConsideredParagraph ? '当前段落较短，暂无复杂句式' : ''} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-45 disabled:cursor-not-allowed">
                            <span>{showAnalysis ? '收起长难句拆解' : '长难句拆解'}</span>
                            {isAnalysisLoading ? <span className="text-[10px] text-gray-400">解构中</span> : analysisData ? <span className="text-[10px] text-amber-600 dark:text-amber-400">已缓存</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">本段较短</span> : null}
                        </button>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
                        <button role="menuitem" onClick={runParagraphAction(handleLocalSpeech)} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <span>本地朗读</span><span className="text-[10px] text-gray-400">免费</span>
                        </button>
                        <button role="menuitem" onClick={runParagraphAction(handleToggleAudio)} disabled={isAudioLoading || !!audioUrl} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50">
                            <span>{audioUrl ? '外教领读已生成' : '外教领读'}</span>
                            {isAudioLoading ? <span className="text-[10px] text-gray-400">请求中</span> : audioUrl ? <span className="text-[10px] text-blue-600 dark:text-blue-400">已缓存</span> : <span className="text-[10px] text-gray-400">调用模型</span>}
                        </button>
                        <button role="menuitem" onClick={runParagraphAction(handleToggleQuiz)} disabled={!isConsideredParagraph || isQuizLoading} title={!isConsideredParagraph ? '当前内容不足以生成有效练习' : ''} className="w-full min-h-[40px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-45 disabled:cursor-not-allowed">
                            <span>{showQuiz ? '收起段落练习' : '生成练习'}</span>
                            {isQuizLoading ? <span className="text-[10px] text-gray-400">生成中</span> : quizData ? <span className="text-[10px] text-violet-600 dark:text-violet-400">已缓存</span> : !isConsideredParagraph ? <span className="text-[10px] text-gray-400">内容不足</span> : null}
                        </button>
                        <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
                        <button role="menuitem" onClick={handleCopyParagraph} className="w-full min-h-[40px] px-3 rounded-sm text-left text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">复制段落</button>
                    </div>
                    {!isConsideredParagraph && <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-[10px] leading-relaxed text-gray-400">本段较短，翻译、朗读和复制仍可使用；长难句与练习暂不建议生成。</div>}
                </div>
            )}

            {activeNote && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl animate-fade-in-down relative shadow-lg z-20">
                    <button onClick={closeActiveNote} aria-label="关闭词汇释义" className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full p-1 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    <div className="flex items-center space-x-2 mb-2">
                        <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wider ${(VOCAB_TYPE_META[activeNote.type] || VOCAB_TYPE_META.custom).badge}`}>{activeNote.isPhrase ? "语法与佳句" : (VOCAB_TYPE_META[activeNote.type] || VOCAB_TYPE_META.custom).label}</span>
                        <span className={`font-serif font-bold text-[15px] ${(VOCAB_TYPE_META[activeNote.type] || VOCAB_TYPE_META.custom).text}`}>{activeNote.word}</span>
                        {activeNote.lemma && activeNote.lemma !== activeNote.word.toLowerCase() && <span className="text-[12px] text-gray-400 dark:text-gray-500 font-mono">({activeNote.lemma})</span>}
                    </div>
                    <div className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap">{activeNote.translation || activeNote.trans}</div>
                    {activeNote.category && <div className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">{activeNote.category}</div>}
                    {activeNote.note && <div className="text-[13.5px] text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700">{activeNote.note}</div>}

                    {!activeNote.isPhrase && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    onMasterWord?.(activeNote.lemma || activeNote.word);
                                    setActiveNote(null);
                                    focusActiveNoteTrigger();
                                }}
                                className="mb-2 flex items-center text-[12px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors active:scale-95"
                            >
                                这个词太简单，不再划线
                            </button>
                            <button onClick={() => handleDisambiguate(activeNote)} disabled={activeNote.isDisambiguating} className="flex items-center text-[12px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-3 py-1.5 rounded-lg transition-colors active:scale-95">
                                {activeNote.isDisambiguating ? "AI 分析语境中..." : "🤖 结合语境精判该词意思"}
                            </button>
                            {activeNote.aiContextMeaning && <div className="mt-3 p-3 bg-purple-50/60 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/50 rounded-lg text-[13px] text-purple-900 dark:text-purple-200 leading-relaxed animate-fade-in"><span className="font-bold mr-1">精准释义：</span>{activeNote.aiContextMeaning}</div>}
                        </div>
                    )}
                </div>
            )}



            {audioUrl && <div className="mt-3 animate-fade-in-down w-full max-w-sm"><audio src={audioUrl} controls className="h-9 w-full rounded-full" autoPlay /></div>}

            {inlineResultsEnabled && showTranslation && finalTranslationToShow && <div className="mt-4 text-gray-800 dark:text-gray-300 animate-fade-in-down whitespace-pre-wrap border-l-[3px] border-gray-300 dark:border-gray-600 pl-4 py-1 bg-gray-50/50 dark:bg-gray-800/50 rounded-r-lg" style={{ fontFamily: typographyConfig.chineseFontFamily || '"Noto Serif SC", STSong, serif', fontSize: `${Math.max(14, typographyConfig.fontSize - 2)}px`, lineHeight: typographyConfig.lineHeight }}>{finalTranslationToShow}</div>}

            {inlineResultsEnabled && showAnalysis && analysisData && <SyntaxBreakdowns data={analysisData} />}
            {inlineResultsEnabled && showQuiz && quizData && (
                <div className="mt-4 p-5 bg-purple-50/60 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/50 rounded-2xl animate-fade-in-down shadow-sm">
                     <div className="flex items-center space-x-2 mb-4"><span className="bg-purple-600 text-white text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Reading Comprehension</span></div>
                     <p className="text-[15px] font-serif font-bold text-gray-900 dark:text-gray-100 mb-1">{quizData.questionEn}</p>
                     <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-5">{quizData.questionZh}</p>
                     <div className="space-y-2">
                         {quizData.options.map((opt) => {
                             const showStatus = selectedOption !== null;
                             let btnClass = "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20";
                             if (showStatus) {
                                 if (opt.id === quizData.correctAnswerId) btnClass = "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-300";
                                 else if (selectedOption === opt.id) btnClass = "border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300";
                                 else btnClass = "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600";
                             }
                             return (
                                 <button key={opt.id} onClick={() => !showStatus && setSelectedOption(opt.id)} disabled={showStatus} className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex flex-col ${btnClass}`}>
                                     <span className="text-[14px] font-serif font-medium">{opt.id}. {opt.textEn}</span>
                                     {showStatus && <span className="text-[12px] mt-1 opacity-80">{opt.textZh}</span>}
                                 </button>
                             );
                         })}
                     </div>
                     {selectedOption && (
                         <div className="mt-5 p-4 bg-white dark:bg-gray-800 rounded-xl border border-purple-100 dark:border-purple-900/50 animate-fade-in-down">
                                <div className="flex items-center space-x-2 mb-2">
                                     {selectedOption === quizData.correctAnswerId ? <span className="text-green-600 dark:text-green-400 font-bold text-[14px]">✅ 回答正确</span> : <span className="text-red-500 dark:text-red-400 font-bold text-[14px]">❌ 回答错误 (正确答案: {quizData.correctAnswerId})</span>}
                                </div>
                                <div className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed text-justify"><span className="font-bold text-purple-700 dark:text-purple-400 mr-1">名师解析：</span>{quizData.analysis}</div>
                         </div>
                     )}
                </div>
            )}
        </div>
    );
};

export {
  ANNOTATION_COLOR_MAP,
  Paragraph
};
