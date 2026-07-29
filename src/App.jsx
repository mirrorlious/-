import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BASIC_DICT_URL,
  REQUIRED_DICT_URL,
  EXTRA_DICT_URL,
  IELTS_DICT_URL,
  parseDictText,
  fetchVocabularyPack,
  fetchIELTSVocabularyPack,
  fetchAndParseCorpus,
  normalizeMasteredLemmas,
  buildPortableVocabularyPreferences
} from './core/vocabulary.js';
import { CURRENT_GEMINI_TEXT_MODEL, normalizeApiConfig } from './core/api-config.js';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_TYPOGRAPHY_CONFIG,
  TYPOGRAPHY_PRESETS,
  LOCAL_STORAGE_KEY,
  CACHE_PROMPT_VERSION,
  readReaderStore,
  writeReaderStore,
  deleteReaderStore,
  readAllReaderStore,
  hashText,
  hashBytes,
  getStoredApiKey,
  sanitizeApiConfig,
  persistApiKey
} from './core/persistence.js';
import {
  formatFileSize,
  cleanPdfText,
  pdfItemsToLines,
  pdfLinesToParagraphs,
  getModelSafeText,
  splitTextIntoChunks,
  normalizeBookText,
  segmentBookPages
} from './core/pdf-text.js';
import {
  callLLM,
  callGeminiFullTranslation,
  callGeminiReadingAnalysis,
  normalizeQuizQuestions,
  callGeminiFullQuiz,
  callGeminiSummary,
  extractTextFromMedia
} from './services/ai.js';
import {
  LogicTreeNode,
  MindMapCanvas,
  getMindMapBranchPaths,
  cloneJson,
  updateMindMapNodeAtPath,
  removeMindMapNodeAtPath,
  MINDMAP_PREVIEW_DATA
} from './components/MindMap.jsx';
import {
  SingleQuizPractice,
  QuizSetPractice,
  SyntaxBreakdowns,
  ANNOTATION_COLOR_MAP,
  Paragraph,
  waitForPdfJs,
  PdfReader
} from './components/ReaderContent.jsx';
import {
  ARTICLE_BUNDLE_SCHEMA_VERSION,
  getArticleBundleKey,
  inferArticleTitleFromText,
  safeDownloadFileName,
  downloadTextFile,
  articleBundleToMarkdown,
  parseYangReaderMarkdown,
  stripYangReaderDataBlocks
} from './core/article-bundle.js';
import {
  handleArticleVocabularyNavigation,
  handleKeyboardActivation,
  handleTabListNavigation,
  useDialogFocus,
  useMenuNavigation
} from './accessibility/focus.js';
import { AccessibilityFeedback, SkipLinks, notify } from './accessibility/feedback.jsx';

window.apiKey = "";

window.getExcerpt = (text) => {
    if (!text) return "";
    const cleanText = text.replace(/\n/g, ' ');
    return cleanText.length > 60 ? cleanText.substring(0, 60) + '...' : cleanText;
};

window.showToast = notify;

window.safeParseJSON = (text) => {
    if (typeof text !== 'string') return text;
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            const markdownRegex = new RegExp('`{3}(?:json)?\\s*([\\s\\S]*?)\\s*`{3}', 'i');
            const match = text.match(markdownRegex);
            if (match) return JSON.parse(match[1].trim());

            const objMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (objMatch) return JSON.parse(objMatch[1].trim());
        } catch(err) {}
        throw new Error("JSON 解析彻底失败，数据格式不合规");
    }
};

const App = () => {
    const localState = useMemo(() => {
        try {
            return JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || '{}') || {};
        } catch (error) {
            console.warn('Local state restore failed:', error);
            return {};
        }
    }, []);
    const isMindMapPreview = useMemo(() => ['localhost', '127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).has('mindmapPreview'), []);

    const persistLocalState = (patch) => {
        try {
            const previous = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || '{}') || {};
            const safePatch = patch.apiConfig ? { ...patch, apiConfig: sanitizeApiConfig(patch.apiConfig) } : patch;
            window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...previous, ...safePatch }));
        } catch (error) {
            console.warn('Local state save failed:', error);
        }
    };

    const defaultLayoutMode = typeof window !== 'undefined' && window.innerWidth >= 1200 ? 'split' : 'standard';
    const savedLayoutState = localState.layoutState || {};
    const [layoutMode, setLayoutMode] = useState(['standard', 'split', 'focus'].includes(savedLayoutState.layoutMode) ? savedLayoutState.layoutMode : defaultLayoutMode);
    const defaultArticleColumnMode = typeof window !== 'undefined' && window.innerWidth >= 1440 ? 'double' : 'single';
    const [articleColumnMode, setArticleColumnMode] = useState(['single', 'double'].includes(savedLayoutState.articleColumnMode) ? savedLayoutState.articleColumnMode : defaultArticleColumnMode);
    const migratedRightPanelTab = savedLayoutState.rightPanelTab === 'mindmap' ? 'outline' : savedLayoutState.rightPanelTab;
    const [rightPanelTab, setRightPanelTab] = useState(['outline', 'quiz', 'analysis', 'notes'].includes(migratedRightPanelTab) ? migratedRightPanelTab : 'outline');
    const [structureViewMode, setStructureViewMode] = useState(savedLayoutState.structureViewMode === 'mindmap' ? 'mindmap' : 'tree');
    const [rightPanelOpen, setRightPanelOpen] = useState(savedLayoutState.rightPanelOpen !== false);
    const [isLearningPanelWide, setIsLearningPanelWide] = useState(() => typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? true : window.matchMedia('(min-width: 1200px)').matches);
    const [splitRatio, setSplitRatio] = useState(Number.isFinite(savedLayoutState.splitRatio) ? Math.min(70, Math.max(52, savedLayoutState.splitRatio)) : 58);
    const [rightPanelAnalysis, setRightPanelAnalysis] = useState(null);
    const [rightPanelTranslationStack, setRightPanelTranslationStack] = useState([]);
    const [practicePanelResult, setPracticePanelResult] = useState(null);
    const [isFullTextMenuOpen, setIsFullTextMenuOpen] = useState(false);
    const fullTextMenuContainerRef = useRef(null);
    const isLearningPanelDocked = layoutMode === 'split' && rightPanelOpen && isLearningPanelWide;
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
    const [annotationColor, setAnnotationColor] = useState("gold");
    const [editingAnnotationId, setEditingAnnotationId] = useState(null);
    const [activeAnnotationId, setActiveAnnotationId] = useState(null);
    const [bookImportSession, setBookImportSession] = useState(null);
    const [isBookImportOpen, setIsBookImportOpen] = useState(false);
    const [bookImportPreviewId, setBookImportPreviewId] = useState(null);
    const [latestBookImportKey, setLatestBookImportKey] = useState(localState.latestBookImportKey || "");
    const [isImmersive, setIsImmersive] = useState(false);
    const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

    useEffect(() => {
        persistLocalState({ layoutState: { layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode } });
    }, [layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio, structureViewMode]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
        const mediaQuery = window.matchMedia('(min-width: 1200px)');
        const syncLearningPanelWidth = () => {
    const isWide = mediaQuery.matches;
    setIsLearningPanelWide(isWide);
    if (!isWide) {
        setLayoutMode('standard');
        setArticleColumnMode('single');
        setRightPanelOpen(false);
    }
};
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
        const closeOnPointerDown = (event) => {
            if (!fullTextMenuContainerRef.current?.contains(event.target)) setIsFullTextMenuOpen(false);
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

    useEffect(() => {
        readAllReaderStore('batch-analysis-jobs').then(jobs => {
            const latest = jobs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
            if (latest) setBatchJob(latest);
        });
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        if (!isImmersive) return undefined;
        setIsFullTextMenuOpen(false);
        const exitImmersiveOnEscape = (event) => {
            if (event.key === 'Escape') setIsImmersive(false);
        };
        document.addEventListener('keydown', exitImmersiveOnEscape);
        return () => document.removeEventListener('keydown', exitImmersiveOnEscape);
    }, [isImmersive]);

    const toggleBrowserFullscreen = async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
            else setIsImmersive(previous => !previous);
        } catch (error) {
            setIsImmersive(previous => !previous);
        }
    };

    const savedTypographyConfig = localState.typographyConfig || {};
    const initialTypographyConfig = {
        ...DEFAULT_TYPOGRAPHY_CONFIG,
        ...savedTypographyConfig,
        readingFontFamily: savedTypographyConfig.readingFontFamily || savedTypographyConfig.fontFamily || DEFAULT_TYPOGRAPHY_CONFIG.readingFontFamily,
        chineseFontFamily: savedTypographyConfig.chineseFontFamily || '"Noto Serif SC", STSong, serif',
        typographyMigrationVersion: 1,
        lineHeight: savedTypographyConfig.lineHeight === 2.4 ? DEFAULT_TYPOGRAPHY_CONFIG.lineHeight : (savedTypographyConfig.lineHeight ?? DEFAULT_TYPOGRAPHY_CONFIG.lineHeight)
    };

    const initialApiConfig = normalizeApiConfig({ ...DEFAULT_API_CONFIG, ...(localState.apiConfig || {}), key: getStoredApiKey(localState.apiConfig?.key) });
    const [apiConfig, setApiConfig] = useState(initialApiConfig);
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [tempApiConfig, setTempApiConfig] = useState(initialApiConfig);
    const [isTestingApi, setIsTestingApi] = useState(false);

    const [typographyConfig, setTypographyConfig] = useState(initialTypographyConfig);
    const [isTypographyModalOpen, setIsTypographyModalOpen] = useState(false);
    const [tempTypographyConfig, setTempTypographyConfig] = useState(initialTypographyConfig);

    const [inputText, setInputText] = useState(isMindMapPreview ? "Mind map interaction preview." : "");
    const [isReadingMode, setIsReadingMode] = useState(isMindMapPreview);
    const [readingMode, setReadingMode] = useState('intensive');
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

    const [vocabularySource, setVocabularySource] = useState('all');
    const [highlightMode, setHighlightMode] = useState('all');

    const [fullTranslations, setFullTranslations] = useState([]);
    const [isFullTransLoading, setIsFullTransLoading] = useState(false);

    const [showGlobalLogic, setShowGlobalLogic] = useState(false);
    const [globalLogicData, setGlobalLogicData] = useState(null);
    const [isGlobalLogicLoading, setIsGlobalLogicLoading] = useState(false);

    const [isAnalyzingMap, setIsAnalyzingMap] = useState(false);
    const [fullMapData, setFullMapData] = useState(isMindMapPreview ? MINDMAP_PREVIEW_DATA : null);
    const [mapMode, setMapMode] = useState('bilingual');
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [isMapEditing, setIsMapEditing] = useState(false);
    const [mapEditDraft, setMapEditDraft] = useState(null);
    const [mapScale, setMapScale] = useState(1);
    const [collapsedMapNodes, setCollapsedMapNodes] = useState(() => new Set());

    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef(null);
    const [pdfFile, setPdfFile] = useState(null);
    const [pendingPdfFile, setPendingPdfFile] = useState(null);
    const [isPdfMode, setIsPdfMode] = useState(false);
    const [isPdfChoiceOpen, setIsPdfChoiceOpen] = useState(false);
    const [pdfExtractionProgress, setPdfExtractionProgress] = useState({ current: 0, total: 0 });

    const [isDictModalOpen, setIsDictModalOpen] = useState(false);
    const [dictInputText, setDictInputText] = useState("");
    const [customDict, setCustomDict] = useState(localState.customDict || {});
    const [masteredLemmas, setMasteredLemmas] = useState(() => normalizeMasteredLemmas(localState.vocabularyPreferences?.ignoredLemmas));
    const [masteredSearch, setMasteredSearch] = useState("");
    const [masteredUndo, setMasteredUndo] = useState(null);
    const [masteredUndoPaused, setMasteredUndoPaused] = useState(false);

    const [basicDict, setBasicDict] = useState({});
    const [requiredDict, setRequiredDict] = useState({});
    const [extraDict, setExtraDict] = useState({});
    const [ieltsDict, setIeltsDict] = useState({});

    const [history, setHistory] = useState(localState.history || []);
    const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
    const [currentHistoryId, setCurrentHistoryId] = useState(null);
    useEffect(() => {
        setRightPanelTranslationStack([]);
        setPracticePanelResult(null);
    }, [currentHistoryId]);
    const [paragraphResults, setParagraphResults] = useState({});
    const [fullQuizData, setFullQuizData] = useState(null);
    const [isFullQuizLoading, setIsFullQuizLoading] = useState(false);
    const markdownInputRef = useRef(null);
    const [librarySelectionMode, setLibrarySelectionMode] = useState(false);
    const [selectedLibraryIds, setSelectedLibraryIds] = useState([]);
    const [isBatchAnalysisOpen, setIsBatchAnalysisOpen] = useState(false);
    const [batchModules, setBatchModules] = useState({ translation: true, logic: true, outline: true, quiz: false });
    const [batchJob, setBatchJob] = useState(null);
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    const batchControlRef = useRef({ paused: false, cancelled: false });
    const [user, setUser] = useState(null);

    const [dbInstance, setDbInstance] = useState(null);
    const [authInstance, setAuthInstance] = useState(null);
    const [corpusCount, setCorpusCount] = useState(0);

    const activeDicts = useMemo(() => {
    const ieltsSource = { data: ieltsDict, type: 'extended' };
    const kaoyanSources = [
        { data: extraDict, type: 'extra' },
        { data: requiredDict, type: 'required' },
        { data: basicDict, type: 'basic' }
    ];
    const customSource = { data: customDict, type: 'custom' };

    if (vocabularySource === 'ielts') return [ieltsSource, customSource];
    if (vocabularySource === 'kaoyan') return [...kaoyanSources, customSource];
    return [ieltsSource, ...kaoyanSources, customSource];
}, [vocabularySource, ieltsDict, extraDict, requiredDict, basicDict, customDict]);

const handleVocabularySourceChange = (nextSource) => {
    setVocabularySource(nextSource);
    if (nextSource === 'ielts') setHighlightMode('daily');
    else if (nextSource === 'kaoyan') setHighlightMode('exam');
    else setHighlightMode('all');
};
    const masteredLemmaSet = useMemo(() => new Set(masteredLemmas), [masteredLemmas]);

    useEffect(() => {
        if (!masteredUndo || masteredUndoPaused) return undefined;
        const timer = window.setTimeout(() => setMasteredUndo(null), 6000);
        return () => window.clearTimeout(timer);
    }, [masteredUndo, masteredUndoPaused]);

    useEffect(() => {
        fetchAndParseCorpus(setCorpusCount);
        Promise.all([
            fetchVocabularyPack(BASIC_DICT_URL),
            fetchVocabularyPack(REQUIRED_DICT_URL),
            fetchVocabularyPack(EXTRA_DICT_URL),
            fetchIELTSVocabularyPack(IELTS_DICT_URL)
        ]).then(([basic, required, extra, ielts]) => {
            setBasicDict(basic);
            setRequiredDict(required);
            setExtraDict(extra);
            setIeltsDict(ielts);
        }).catch(error => {
            console.error('Error loading vocabulary packs:', error);
            window.showToast('词汇库加载失败，请刷新后重试', 'error');
        });
    }, []);

    useEffect(() => {
        let isMounted = true;
        const checkFirebase = setInterval(() => {
            if (window.firebaseImports && isMounted) {
                clearInterval(checkFirebase);
                const { initializeApp, getAuth, getFirestore } = window.firebaseImports;
                try {
                    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
                    if (Object.keys(firebaseConfig).length > 0) {
                        const app = initializeApp(firebaseConfig);
                        setAuthInstance(getAuth(app));
                        setDbInstance(getFirestore(app));
                    }
                } catch (e) { console.error("Firebase config error"); }
            }
        }, 100);
        return () => { isMounted = false; clearInterval(checkFirebase); };
    }, []);

    useEffect(() => {
        if (!authInstance || !window.firebaseImports) return;
        const { signInWithCustomToken, signInAnonymously, onAuthStateChanged } = window.firebaseImports;
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(authInstance, __initial_auth_token);
                else await signInAnonymously(authInstance);
            } catch(e) {}
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(authInstance, setUser);
        return () => unsubscribe();
    }, [authInstance]);

    useEffect(() => {
        if (!user || !dbInstance || !window.firebaseImports) return;
        const { collection, doc, onSnapshot } = window.firebaseImports;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        const unsubHistory = onSnapshot(collection(dbInstance, 'artifacts', appId, 'users', user.uid, 'history'),
            (snapshot) => {
                const historyData = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
                const sortedHistory = historyData.sort((a, b) => b.createdAt - a.createdAt);
                setHistory(sortedHistory);
                persistLocalState({ history: sortedHistory });
            },
            (error) => { console.error("History sync error:", error); }
        );

        const unsubDict = onSnapshot(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'dictionary'),
            (docSnap) => {
                if (docSnap.exists()) {
                    const vocab = docSnap.data().vocab || {};
                    setCustomDict(vocab);
                    persistLocalState({ customDict: vocab });
                }
            }
        );

        const unsubApi = onSnapshot(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'apiConfig'),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = normalizeApiConfig({ ...DEFAULT_API_CONFIG, ...docSnap.data(), key: getStoredApiKey() });
                    setApiConfig(data);
                    setTempApiConfig(data);
                    persistLocalState({ apiConfig: data });
                }
            }
        );

        const unsubTypography = onSnapshot(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'typography'),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // 确保旧数据也有 theme 字段
                    const fullData = { ...DEFAULT_TYPOGRAPHY_CONFIG, ...data };
                    setTypographyConfig(fullData);
                    setTempTypographyConfig(fullData);
                    persistLocalState({ typographyConfig: fullData });
                }
            }
        );

        return () => { unsubHistory(); unsubDict(); unsubApi(); unsubTypography(); };
    }, [user, dbInstance]);

    const handleToggleTheme = () => {
        const newTheme = typographyConfig.theme === 'dark' ? 'light' : 'dark';
        const newConfig = { ...typographyConfig, theme: newTheme };
        setTypographyConfig(newConfig);
        setTempTypographyConfig(newConfig);
        persistLocalState({ typographyConfig: newConfig });

        if (user && dbInstance && window.firebaseImports) {
            const { doc, setDoc } = window.firebaseImports;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            setDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'typography'), newConfig, { merge: true }).catch(()=>{});
        }
    };

    const handleSaveApiConfig = async () => {
        const normalizedConfig = normalizeApiConfig(tempApiConfig);
        persistApiKey(normalizedConfig);
        setApiConfig(normalizedConfig);
        setTempApiConfig(normalizedConfig);
        persistLocalState({ apiConfig: normalizedConfig });
        setIsApiModalOpen(false);
        if (user && dbInstance && window.firebaseImports) {
            const { doc, setDoc } = window.firebaseImports;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            try {
                await setDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'apiConfig'), sanitizeApiConfig(normalizedConfig), { merge: true });
                window.showToast("API 配置已更新并同步至云端", "success");
            } catch(e) { window.showToast("同步配置失败", "error"); }
        } else {
            window.showToast("API 配置已保存到本地", "success");
        }
    };

    const handleTestApiConfig = async () => {
        const normalizedConfig = normalizeApiConfig(tempApiConfig);
        if (!(normalizedConfig.key || window.apiKey)) {
            window.showToast("请先填写 API Key", "warning");
            return;
        }
        setIsTestingApi(true);
        try {
            await callLLM("Reply with exactly: OK", normalizedConfig, false);
            setTempApiConfig(normalizedConfig);
            window.showToast(`连接成功：${normalizedConfig.model}`, "success");
        } catch (error) {
            window.showToast(`连接测试失败：${error.message}`, "error");
        } finally {
            setIsTestingApi(false);
        }
    };

    const handleSaveTypography = async () => {
        setTypographyConfig(tempTypographyConfig);
        persistLocalState({ typographyConfig: tempTypographyConfig });
        setIsTypographyModalOpen(false);
        if (user && dbInstance && window.firebaseImports) {
            const { doc, setDoc } = window.firebaseImports;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            try {
                await setDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'typography'), tempTypographyConfig, { merge: true });
                window.showToast("排版设置已更新并同步至云端", "success");
            } catch(e) { window.showToast("排版同步失败", "error"); }
        } else {
            window.showToast("排版设置已保存到本地", "success");
        }
    };

    const updateArticleNotes = (articleId, updater) => {
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
        setAnnotationColor(existingAnnotation?.color || "gold");
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
                    annotations[index] = { ...annotations[index], note, color: annotationColor || "gold", updatedAt: now };
                }
            } else {
                annotations.unshift({
                    id: `annotation-${now}-${Math.random().toString(36).slice(2, 8)}`,
                    anchor: annotationComposer.anchor,
                    note,
                    color: annotationColor || "gold",
                    createdAt: now,
                    updatedAt: now
                });
            }
            return { ...article, annotations };
        });
        setAnnotationComposer(null);
        setAnnotationDraft("");
        setAnnotationColor("gold");
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
            setAnnotationColor("gold");
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
        const normalizedRecord = { ...record, createdAt: record.createdAt || Date.now() };
        setHistory(prevHistory => {
            const nextHistory = [normalizedRecord, ...prevHistory.filter(item => item.id !== normalizedRecord.id)]
                .sort((a, b) => b.createdAt - a.createdAt);
            persistLocalState({ history: nextHistory });
            return nextHistory;
        });

        if (!user || !dbInstance || !window.firebaseImports) return;
        const { doc, setDoc } = window.firebaseImports;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        try { await setDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'history', normalizedRecord.id), normalizedRecord, { merge: true }); } catch(e) {}
    };



    const getRecordSourceText = async (record) => {
        if (!record) return '';
        const bundleKey = record.bundleKey || getArticleBundleKey(record.id);
        const bundle = await readReaderStore('article-bundles', bundleKey);
        if (bundle?.article?.sourceText) return bundle.article.sourceText;
        if (record.text) return record.text;
        if (record.localArticleKey) {
            const stored = await readReaderStore('book-articles', record.localArticleKey);
            return stored?.text || '';
        }
        return '';
    };

    const buildBundleFromRecord = async (record, sourceTextOverride = '') => {
        const sourceText = sourceTextOverride || await getRecordSourceText(record);
        const existing = await readReaderStore('article-bundles', record?.bundleKey || getArticleBundleKey(record?.id));
        const articleId = existing?.article?.id || record?.id || `article-${Date.now()}`;
        const title = existing?.article?.title || record?.title || inferArticleTitleFromText(sourceText, `文章 ${articleId}`);
        return {
            key: getArticleBundleKey(articleId),
            schemaVersion: ARTICLE_BUNDLE_SCHEMA_VERSION,
            article: {
                id: articleId,
                title,
                sourceText,
                sourceType: existing?.article?.sourceType || record?.sourceType || 'reader',
                sourceName: existing?.article?.sourceName || record?.sourceName || '',
                createdAt: existing?.article?.createdAt || record?.createdAt || Date.now(),
                updatedAt: Date.now(),
                contentHash: sourceText ? await hashText(sourceText) : ''
            },
            results: {
                fullTranslations: existing?.results?.fullTranslations || record?.fullTranslations || [],
                globalLogicData: existing?.results?.globalLogicData || record?.globalLogicData || null,
                fullMapData: existing?.results?.fullMapData || record?.fullMapData || null,
                fullQuizData: existing?.results?.fullQuizData || record?.fullQuizData || null,
                paragraphResults: existing?.results?.paragraphResults || {},
                activeAnalysis: existing?.results?.activeAnalysis || null
            },
            notes: existing?.notes || readingNotes.articles?.[articleId] || { documentNote: '', annotations: [] },
            metadata: {
                exportedBy: 'yang-reader',
                model: apiConfig.model || '',
                apiType: apiConfig.apiType || '',
                promptVersion: CACHE_PROMPT_VERSION,
                updatedAt: Date.now()
            }
        };
    };

    const updateHistoryBundleMeta = (articleId, bundle) => {
        setHistory(previous => {
            const existing = previous.find(item => item.id === articleId) || {
                id: articleId,
                timestamp: new Date().toLocaleString('zh-CN'),
                createdAt: bundle.article?.createdAt || Date.now()
            };
            const record = {
                ...existing,
                title: bundle.article?.title || existing.title,
                preview: String(bundle.article?.sourceText || '').slice(0, 180),
                bundleKey: bundle.key,
                hasFullTranslations: Boolean(bundle.results?.fullTranslations?.length),
                hasGlobalLogic: Boolean(bundle.results?.globalLogicData),
                hasFullMap: Boolean(bundle.results?.fullMapData),
                hasFullQuiz: Boolean(bundle.results?.fullQuizData),
                updatedAt: Date.now()
            };
            const next = [record, ...previous.filter(item => item.id !== articleId)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            persistLocalState({ history: next });
            return next;
        });
    };

    const buildCurrentArticleBundle = async () => {
        if (!currentHistoryId) return null;
        const record = history.find(item => item.id === currentHistoryId) || { id: currentHistoryId, createdAt: Date.now() };
        const sourceText = inputText || await getRecordSourceText(record);
        const base = await buildBundleFromRecord(record, sourceText);
        const notes = readingNotes.articles?.[currentHistoryId] || { documentNote: '', annotations: [] };
        return {
            ...base,
            article: {
                ...base.article,
                title: record.title || base.article.title || inferArticleTitleFromText(sourceText),
                sourceText,
                updatedAt: Date.now(),
                contentHash: sourceText ? await hashText(sourceText) : ''
            },
            results: {
                fullTranslations,
                globalLogicData,
                fullMapData,
                fullQuizData,
                paragraphResults,
                activeAnalysis: rightPanelAnalysis?.kind === 'loading' ? null : rightPanelAnalysis
            },
            notes: {
                documentNote: notes.documentNote || '',
                annotations: Array.isArray(notes.annotations) ? notes.annotations : []
            },
            metadata: {
                ...(base.metadata || {}),
                model: apiConfig.model || '',
                apiType: apiConfig.apiType || '',
                promptVersion: CACHE_PROMPT_VERSION,
                updatedAt: Date.now()
            }
        };
    };

    const persistCurrentArticleBundle = async (options = {}) => {
        const bundle = await buildCurrentArticleBundle();
        if (!bundle) return null;
        await writeReaderStore('article-bundles', bundle);
        if (!options.skipHistoryMeta) updateHistoryBundleMeta(bundle.article.id, bundle);
        return bundle;
    };

    const handlePersistParagraphResult = (result) => {
        if (!result || !Number.isFinite(result.paragraphIndex)) return;
        setParagraphResults(previous => {
            const index = String(result.paragraphIndex);
            const current = previous[index] || { sourceText: result.sourceText || '' };
            const next = { ...current, sourceText: result.sourceText || current.sourceText || '', updatedAt: Date.now() };
            if (result.kind === 'paragraph-translation') next.translation = result.data?.translation || '';
            if (result.kind === 'paragraph-analysis') next.analysis = result.data || null;
            if (result.kind === 'paragraph-quiz') next.quiz = result.data || null;
            return { ...previous, [index]: next };
        });
    };

    useEffect(() => {
        if (!currentHistoryId || !isReadingMode) return undefined;
        const timer = window.setTimeout(() => {
            persistCurrentArticleBundle().catch(error => console.warn('Article bundle save failed:', error));
        }, 450);
        return () => window.clearTimeout(timer);
    }, [currentHistoryId, isReadingMode, inputText, fullTranslations, globalLogicData, fullMapData, fullQuizData, paragraphResults, readingNotes, rightPanelAnalysis]);

    const restoreBundleNotes = (articleId, notes) => {
        if (!articleId || !notes) return;
        setReadingNotes(previous => {
            const next = {
                version: 1,
                articles: {
                    ...(previous.articles || {}),
                    [articleId]: {
                        documentNote: notes.documentNote || '',
                        annotations: Array.isArray(notes.annotations) ? notes.annotations : []
                    }
                }
            };
            persistLocalState({ readingNotes: next });
            return next;
        });
    };

    const downloadCurrentArticleMarkdown = async () => {
        setIsFullTextMenuOpen(false);
        const bundle = await persistCurrentArticleBundle();
        if (!bundle) {
            window.showToast('请先进入一篇文章', 'warning');
            return;
        }
        const fileName = `${safeDownloadFileName(bundle.article.title)}.md`;
        downloadTextFile(fileName, articleBundleToMarkdown(bundle, {
            portablePreferences: buildPortableVocabularyPreferences(masteredLemmas)
        }));
        window.showToast('当前文章及全部非语音学习结果已导出', 'success');
    };

    const importMarkdownFiles = async (files) => {
        const markdownFiles = Array.from(files || []).filter(file => /\.md$/i.test(file.name) || /markdown/i.test(file.type));
        if (!markdownFiles.length) return;
        const importedBundles = [];
        for (let fileIndex = 0; fileIndex < markdownFiles.length; fileIndex += 1) {
            const file = markdownFiles[fileIndex];
            const markdown = await file.text();
            const parsedBundles = parseYangReaderMarkdown(markdown);
            if (parsedBundles.length) {
                importedBundles.push(...parsedBundles);
            } else {
                const sourceText = stripYangReaderDataBlocks(markdown)
                    .replace(/^---[\s\S]*?---\s*/m, '')
                    .replace(/^#\s+.+$/m, '')
                    .trim();
                if (!sourceText) continue;
                const id = `md-${Date.now()}-${fileIndex}`;
                importedBundles.push({
                    key: getArticleBundleKey(id),
                    schemaVersion: ARTICLE_BUNDLE_SCHEMA_VERSION,
                    article: {
                        id,
                        title: (markdown.match(/^#\s+(.+)$/m)?.[1] || file.name.replace(/\.md$/i, '') || inferArticleTitleFromText(sourceText)).trim(),
                        sourceText,
                        sourceType: 'markdown',
                        sourceName: file.name,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        contentHash: await hashText(sourceText)
                    },
                    results: { fullTranslations: [], globalLogicData: null, fullMapData: null, fullQuizData: null, paragraphResults: {}, activeAnalysis: null },
                    notes: { documentNote: '', annotations: [] },
                    metadata: { importedAt: Date.now(), promptVersion: CACHE_PROMPT_VERSION }
                });
            }
        }
        if (!importedBundles.length) {
            window.showToast('Markdown 中没有可恢复的文章内容', 'warning');
            return;
        }

        const importedPreferenceLemmas = normalizeMasteredLemmas(importedBundles.flatMap(bundle =>
            bundle?.portablePreferences?.vocabulary?.ignoredLemmas || []
        ));
        const newPreferenceLemmas = importedPreferenceLemmas.filter(lemma => !masteredLemmaSet.has(lemma));
        const shouldMergeVocabularyPreferences = newPreferenceLemmas.length > 0 && window.confirm(
            `该备份包含 ${importedPreferenceLemmas.length} 个已掌握词，其中 ${newPreferenceLemmas.length} 个尚未记录在本设备。\n\n确定：合并个人词汇设置；取消：只恢复文章。`
        );

        const records = [];
        const notePatches = {};
        for (let index = 0; index < importedBundles.length; index += 1) {
            const source = importedBundles[index];
            const originalId = source.article?.id || `md-${Date.now()}-${index}`;
            const conflict = history.some(item => item.id === originalId);
            let articleId = originalId;
            if (conflict) {
                const replaceExisting = window.confirm(`阅读库中已存在“${source.article?.title || originalId}”。\n确定：替换现有文章；取消：另存为副本。`);
                if (!replaceExisting) articleId = `${originalId}-copy-${Date.now()}-${index}`;
            }
            const bundle = {
                ...source,
                key: getArticleBundleKey(articleId),
                schemaVersion: ARTICLE_BUNDLE_SCHEMA_VERSION,
                article: {
                    ...(source.article || {}),
                    id: articleId,
                    title: source.article?.title || inferArticleTitleFromText(source.article?.sourceText),
                    updatedAt: Date.now(),
                    contentHash: source.article?.contentHash || await hashText(source.article?.sourceText || '')
                },
                results: {
                    fullTranslations: source.results?.fullTranslations || [],
                    globalLogicData: source.results?.globalLogicData || null,
                    fullMapData: source.results?.fullMapData || null,
                    fullQuizData: source.results?.fullQuizData || null,
                    paragraphResults: source.results?.paragraphResults || {},
                    activeAnalysis: source.results?.activeAnalysis || null
                },
                notes: {
                    documentNote: source.notes?.documentNote || '',
                    annotations: Array.isArray(source.notes?.annotations) ? source.notes.annotations : []
                },
                metadata: { ...(source.metadata || {}), importedAt: Date.now() }
            };
            await writeReaderStore('article-bundles', bundle);
            notePatches[articleId] = bundle.notes;
            records.push({
                id: articleId,
                title: bundle.article.title,
                preview: bundle.article.sourceText.slice(0, 180),
                sourceType: 'markdown',
                sourceName: bundle.article.sourceName || '',
                bundleKey: bundle.key,
                timestamp: new Date().toLocaleString('zh-CN'),
                createdAt: bundle.article.createdAt || Date.now() - index,
                hasFullTranslations: Boolean(bundle.results.fullTranslations?.length),
                hasGlobalLogic: Boolean(bundle.results.globalLogicData),
                hasFullMap: Boolean(bundle.results.fullMapData),
                hasFullQuiz: Boolean(bundle.results.fullQuizData)
            });
        }

        setReadingNotes(previous => {
            const next = { version: 1, articles: { ...(previous.articles || {}), ...notePatches } };
            persistLocalState({ readingNotes: next });
            return next;
        });
        setHistory(previous => {
            const recordIds = new Set(records.map(record => record.id));
            const next = [...records, ...previous.filter(item => !recordIds.has(item.id))].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            persistLocalState({ history: next });
            return next;
        });
        if (shouldMergeVocabularyPreferences) {
            saveMasteredLemmas([...masteredLemmas, ...importedPreferenceLemmas]);
        }
        window.showToast(`已从 Markdown 恢复 ${records.length} 篇文章`, 'success');
        if (records[0]) await loadHistoryRecord(records[0]);
    };

    const handleMarkdownUpload = async (event) => {
        try {
            await importMarkdownFiles(event.target.files);
        } catch (error) {
            window.showToast(`Markdown 导入失败：${error.message}`, 'error');
        } finally {
            if (event.target) event.target.value = '';
        }
    };

    const toggleLibrarySelection = (articleId) => {
        setSelectedLibraryIds(previous => previous.includes(articleId) ? previous.filter(id => id !== articleId) : [...previous, articleId]);
    };

    const toggleLibrarySelectionMode = () => {
        setLibrarySelectionMode(previous => {
            if (previous) setSelectedLibraryIds([]);
            return !previous;
        });
    };

    const loadBundleForRecord = async (record) => {
        const stored = await readReaderStore('article-bundles', record.bundleKey || getArticleBundleKey(record.id));
        if (stored?.article?.sourceText) return stored;
        const bundle = await buildBundleFromRecord(record);
        await writeReaderStore('article-bundles', bundle);
        return bundle;
    };

    const downloadSelectedArticlesMarkdown = async () => {
        const records = history.filter(record => selectedLibraryIds.includes(record.id));
        if (!records.length) {
            window.showToast('请先选择文章', 'warning');
            return;
        }
        const bundles = [];
        for (const record of records) bundles.push(await loadBundleForRecord(record));
        const content = [
            '# 杨的阅读器批量备份',
            `> 共 ${bundles.length} 篇，导出时间 ${new Date().toLocaleString('zh-CN')}。每篇均含可无损恢复的数据块。`,
            ...bundles.map((bundle, index) => `\n\n---\n\n## 备份文章 ${index + 1}\n\n${articleBundleToMarkdown(bundle, {
                portablePreferences: buildPortableVocabularyPreferences(masteredLemmas)
            })}`)
        ].join('\n\n');
        downloadTextFile(`杨的阅读器-批量备份-${new Date().toISOString().slice(0, 10)}.md`, content);
        window.showToast(`已导出 ${bundles.length} 篇文章`, 'success');
    };

    const generateFullTranslationForBundle = async (sourceText) => {
        if (sourceText.length > 120000) throw new Error('正文超过 120,000 字符，无法批量全文翻译');
        const chunks = splitTextIntoChunks(sourceText, 12000);
        const translated = [];
        for (const chunk of chunks) translated.push(await callGeminiFullTranslation(chunk, apiConfig));
        return translated.filter(Boolean).join('\n\n').split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
    };

    const waitForBatchControl = async () => {
        while (batchControlRef.current.paused && !batchControlRef.current.cancelled) {
            await new Promise(resolve => window.setTimeout(resolve, 250));
        }
        return !batchControlRef.current.cancelled;
    };

    const runBatchAnalysis = async () => {
        const records = history.filter(record => selectedLibraryIds.includes(record.id));
        const selectedModules = Object.entries(batchModules).filter(([, enabled]) => enabled).map(([key]) => key);
        if (!records.length) {
            window.showToast('请先在阅读库选择文章', 'warning');
            return;
        }
        if (!selectedModules.length) {
            window.showToast('请至少选择一个解析模块', 'warning');
            return;
        }
        batchControlRef.current = { paused: false, cancelled: false };
        setIsBatchRunning(true);
        let job = {
            key: `batch:${Date.now()}`,
            articleIds: records.map(record => record.id),
            selectedModules,
            status: 'running',
            currentIndex: 0,
            currentArticleId: '',
            currentTitle: '',
            currentModule: '',
            completedArticles: [],
            failedArticles: [],
            skippedModules: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const persistJob = async () => {
            job.updatedAt = Date.now();
            setBatchJob({ ...job, completedArticles: [...job.completedArticles], failedArticles: [...job.failedArticles] });
            await writeReaderStore('batch-analysis-jobs', job);
        };
        await persistJob();

        for (let articleIndex = 0; articleIndex < records.length; articleIndex += 1) {
            if (!(await waitForBatchControl())) break;
            const record = records[articleIndex];
            job.currentIndex = articleIndex;
            job.currentArticleId = record.id;
            job.currentTitle = record.title || record.preview || `文章 ${articleIndex + 1}`;
            await persistJob();
            const errors = [];
            try {
                const bundle = await loadBundleForRecord(record);
                const sourceText = bundle.article.sourceText;
                for (const module of selectedModules) {
                    if (!(await waitForBatchControl())) break;
                    job.currentModule = module;
                    await persistJob();
                    try {
                        if (module === 'translation') {
                            if (bundle.results.fullTranslations?.length) job.skippedModules += 1;
                            else bundle.results.fullTranslations = await generateFullTranslationForBundle(sourceText);
                        } else if (module === 'logic') {
                            if (bundle.results.globalLogicData) job.skippedModules += 1;
                            else bundle.results.globalLogicData = await callGeminiReadingAnalysis(getModelSafeText(sourceText, 30000, '批量全文逻辑'), apiConfig);
                        } else if (module === 'outline') {
                            if (bundle.results.fullMapData) job.skippedModules += 1;
                            else bundle.results.fullMapData = await callGeminiSummary(getModelSafeText(sourceText, 30000, '批量结构树'), apiConfig);
                        } else if (module === 'quiz') {
                            if (normalizeQuizQuestions(bundle.results.fullQuizData).length >= 3) job.skippedModules += 1;
                            else bundle.results.fullQuizData = await callGeminiFullQuiz(getModelSafeText(sourceText, 18000, '批量全文练习'), apiConfig);
                        }
                        bundle.article.updatedAt = Date.now();
                        bundle.metadata = { ...(bundle.metadata || {}), updatedAt: Date.now(), model: apiConfig.model || '' };
                        await writeReaderStore('article-bundles', bundle);
                        updateHistoryBundleMeta(record.id, bundle);
                    } catch (moduleError) {
                        errors.push(`${module}: ${moduleError.message}`);
                    }
                }
            } catch (articleError) {
                errors.push(articleError.message);
            }
            if (errors.length) job.failedArticles.push({ id: record.id, title: job.currentTitle, errors });
            else job.completedArticles.push(record.id);
            await persistJob();
        }

        job.currentModule = '';
        job.currentArticleId = '';
        job.currentTitle = '';
        job.status = batchControlRef.current.cancelled ? 'cancelled' : 'completed';
        await persistJob();
        setIsBatchRunning(false);
        window.showToast(job.status === 'completed' ? `批量解析完成：${job.completedArticles.length} 篇成功` : '批量解析已取消', job.failedArticles.length ? 'warning' : 'success');
    };

    const pauseBatchAnalysis = () => {
        batchControlRef.current.paused = true;
        setBatchJob(previous => previous ? { ...previous, status: 'paused', updatedAt: Date.now() } : previous);
    };

    const resumeBatchAnalysis = () => {
        batchControlRef.current.paused = false;
        setBatchJob(previous => previous ? { ...previous, status: 'running', updatedAt: Date.now() } : previous);
    };

    const cancelBatchAnalysis = () => {
        batchControlRef.current.cancelled = true;
        batchControlRef.current.paused = false;
    };

    const saveMasteredLemmas = (values) => {
        const normalized = normalizeMasteredLemmas(values);
        setMasteredLemmas(normalized);
        persistLocalState({
            vocabularyPreferences: {
                version: 1,
                ignoredLemmas: normalized
            }
        });
        return normalized;
    };

    const handleMasterWord = (rawLemma) => {
        const lemma = normalizeMasteredLemmas([rawLemma])[0];
        if (!lemma || masteredLemmaSet.has(lemma)) return;
        saveMasteredLemmas([...masteredLemmas, lemma]);
        setMasteredUndoPaused(false);
        setMasteredUndo({ lemma });
    };

    const handleRestoreMasteredWord = (lemma, options = {}) => {
        saveMasteredLemmas(masteredLemmas.filter(item => item !== lemma));
        if (!options.silent) window.showToast(`已恢复 ${lemma} 的默认标记`, 'success');
    };

    const handleUndoMasteredWord = () => {
        if (!masteredUndo?.lemma) return;
        const lemma = masteredUndo.lemma;
        handleRestoreMasteredWord(lemma, { silent: true });
        setMasteredUndo(null);
        window.showToast(`已撤销：${lemma} 将继续按默认规则标记`, 'success');
    };

    const handleRestoreAllMasteredWords = () => {
        if (!masteredLemmas.length) return;
        if (!window.confirm(`确定恢复全部 ${masteredLemmas.length} 个词的默认标记吗？`)) return;
        saveMasteredLemmas([]);
        setMasteredUndo(null);
        window.showToast('已恢复全部词的默认标记', 'success');
    };

    const handleSaveCustomDict = async () => {
        if (!dictInputText.trim()) return;
        const newVocab = { ...customDict, ...parseDictText(dictInputText) };
        setCustomDict(newVocab);
        persistLocalState({ customDict: newVocab });
        setIsDictModalOpen(false);
        setDictInputText("");
        if (user && dbInstance && window.firebaseImports) {
            const { doc, setDoc } = window.firebaseImports;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            try {
                await setDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'settings', 'dictionary'), { vocab: newVocab }, { merge: true });
                window.showToast("词库已更新并同步至云端", "success");
            } catch(e) { window.showToast("同步词库失败", "error"); }
        } else {
            window.showToast("词库已保存到本地", "success");
        }
    };

    const fetchFullTranslation = async (text, recordId, options = {}) => {
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
    };

    const loadHistoryRecord = async (record) => {
        const bundle = await loadBundleForRecord(record);
        const sourceText = bundle?.article?.sourceText || await getRecordSourceText(record);
        if (!sourceText) {
            window.showToast("这篇文章的本地正文已不存在", "warning");
            return;
        }
        const results = bundle.results || {};
        setInputText(sourceText);
        setFullMapData(results.fullMapData || record.fullMapData || null);
        setCollapsedMapNodes(new Set());
        setFullTranslations(results.fullTranslations || record.fullTranslations || []);
        setGlobalLogicData(results.globalLogicData || null);
        setShowGlobalLogic(false);
        setFullQuizData(results.fullQuizData || null);
        setParagraphResults(results.paragraphResults || {});
        setRightPanelAnalysis(results.activeAnalysis || null);
        setRightPanelTab(results.activeAnalysis ? 'analysis' : 'outline');
        setIsFullTextMenuOpen(false);
        setCurrentHistoryId(record.id);
        restoreBundleNotes(record.id, bundle.notes);
        setIsReadingMode(true);
        setIsHistoryDrawerOpen(false);
        setLibrarySelectionMode(false);
        setSelectedLibraryIds([]);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    };

    const deleteHistoryRecord = async (id, e) => {
        e.stopPropagation();
        setHistory(prevHistory => {
            const nextHistory = prevHistory.filter(record => record.id !== id);
            persistLocalState({ history: nextHistory });
            return nextHistory;
        });
        if (currentHistoryId === id) setCurrentHistoryId(null);

        if (!user || !dbInstance || !window.firebaseImports) return;
        const { doc, deleteDoc } = window.firebaseImports;
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        try {
            await deleteDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'history', id));
        } catch(e) { window.showToast("删除记录失败", "error"); }
    };

    const clearAllHistory = () => {
        const confirmed = window.confirm("确定要清空所有阅读历史吗？");
        if (confirmed) {
            setHistory([]);
            persistLocalState({ history: [] });
            setCurrentHistoryId(null);
        }

        if (confirmed && user && dbInstance && window.firebaseImports) {
            const { doc, deleteDoc } = window.firebaseImports;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            history.forEach(async (record) => {
                await deleteDoc(doc(dbInstance, 'artifacts', appId, 'users', user.uid, 'history', record.id));
            });
            window.showToast("云端记录已清空", "success");
        } else if (confirmed) {
            window.showToast("本地记录已清空", "success");
        }
    };

    const defaultText = `France, which prides itself as the global innovator of fashion, has decided its fashion industry has lost an absolute right to define physical beauty for women. Its lawmakers gave preliminary approval last week to a law that would make it a crime to employ ultra-thin models on runways. The parliament also agreed to ban websites that "incite excessive thinness" by promoting extreme dieting.`;

    const handleStartReading = () => {
        const finalContent = inputText.trim();
        if (!finalContent) {
            window.showToast("请先粘贴文章、上传文件或加载示例", "warning");
            return;
        }
        setInputText(finalContent);
        setIsReadingMode(true);
        setFullMapData(null);
        setCollapsedMapNodes(new Set());
        setShowGlobalLogic(false);
        setGlobalLogicData(null);
        setFullTranslations([]);
        setParagraphResults({});
        setFullQuizData(null);
        setRightPanelAnalysis(null);
        setRightPanelTab('outline');
        setIsFullTextMenuOpen(false);

        const newId = Date.now().toString();
        setCurrentHistoryId(newId);
        const newRecord = {
            id: newId,
            title: inferArticleTitleFromText(finalContent),
            timestamp: new Date().toLocaleString('zh-CN'),
            text: finalContent,
            fullMapData: null,
            fullTranslations: [],
            bundleKey: getArticleBundleKey(newId),
            createdAt: Date.now()
        };
        saveHistoryToCloud(newRecord);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    };

    const extractPdfTextLocally = async (file) => {
        setIsExtracting(true);
        setPdfExtractionProgress({ current: 0, total: 0 });
        let loadingTask = null;
        let pdfDocument = null;
        const diagnostics = {
            cached: 0,
            structuredText: 0,
            rawText: 0,
            ocr: 0,
            ocrFailed: 0,
            empty: 0,
            pageErrors: []
        };

        try {
            const pdfjs = await waitForPdfJs();
            const data = new Uint8Array(await file.arrayBuffer());
            loadingTask = pdfjs.getDocument({ data });
            pdfDocument = await loadingTask.promise;
            setPdfExtractionProgress({ current: 0, total: pdfDocument.numPages });

            const taskKey = `pdf:${await hashText(`${file.name}:${file.size}:${file.lastModified}`)}`;
            const savedTask = await readReaderStore('pdf-tasks', taskKey);
            const cachedPages = new Map(
                (Array.isArray(savedTask?.pages) ? savedTask.pages : [])
                    .filter(page => Number.isFinite(page?.pageNumber))
                    .map(page => [page.pageNumber, page])
            );
            const extractedPages = [];

            for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
                const cachedPage = cachedPages.get(pageNumber);
                const cachedText = normalizeBookText(cachedPage?.text || '');
                const cachedIsUsable = cachedText.length >= 40 && cachedPage?.invalid !== true;

                if (cachedIsUsable) {
                    extractedPages.push({
                        ...cachedPage,
                        pageNumber,
                        text: cachedText,
                        processed: true,
                        extractionMethod: cachedPage.extractionMethod || 'cache'
                    });
                    diagnostics.cached += 1;
                    setPdfExtractionProgress({ current: pageNumber, total: pdfDocument.numPages });
                    continue;
                }

                let page = null;
                let pageText = '';
                let extractionMethod = 'empty';
                let usedOcr = false;
                let pageError = '';

                try {
                    page = await pdfDocument.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 1 });
                    const textContent = await page.getTextContent();
                    const lines = pdfItemsToLines(textContent.items, viewport.width);
                    const structuredText = normalizeBookText(pdfLinesToParagraphs(lines, viewport.width).join('\n\n'));
                    const rawText = normalizeBookText(cleanPdfText(
                        textContent.items
                            .map(item => typeof item.str === 'string' ? item.str : '')
                            .filter(Boolean)
                            .join(' ')
                    ));

                    if (structuredText.length >= 80) {
                        pageText = structuredText;
                        extractionMethod = 'text-structured';
                        diagnostics.structuredText += 1;
                    } else if (rawText.length >= 80) {
                        pageText = rawText;
                        extractionMethod = 'text-raw';
                        diagnostics.rawText += 1;
                    } else {
                        try {
                            const ocrViewport = page.getViewport({ scale: 1.75 });
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d', { alpha: false });
                            canvas.width = Math.ceil(ocrViewport.width);
                            canvas.height = Math.ceil(ocrViewport.height);
                            await page.render({ canvasContext: context, viewport: ocrViewport }).promise;
                            const imageData = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
                            const ocrText = normalizeBookText(await extractTextFromMedia(imageData, 'image/jpeg', apiConfig));
                            canvas.width = 1;
                            canvas.height = 1;
                            usedOcr = true;

                            if (ocrText.length >= 40) {
                                pageText = ocrText;
                                extractionMethod = 'ocr';
                                diagnostics.ocr += 1;
                            } else {
                                pageText = structuredText.length >= rawText.length ? structuredText : rawText;
                                extractionMethod = pageText ? 'text-short' : 'empty';
                                diagnostics.empty += pageText ? 0 : 1;
                            }
                        } catch (ocrError) {
                            diagnostics.ocrFailed += 1;
                            pageError = `OCR失败：${ocrError.message}`;
                            pageText = structuredText.length >= rawText.length ? structuredText : rawText;
                            extractionMethod = pageText ? 'text-short' : 'empty';
                            if (!pageText) diagnostics.empty += 1;
                        }
                    }
                } catch (error) {
                    pageError = error.message || String(error);
                    diagnostics.pageErrors.push({ pageNumber, message: pageError });
                    diagnostics.empty += 1;
                } finally {
                    if (page) {
                        try { page.cleanup(); } catch (error) {}
                    }
                }

                const pageRecord = {
                    pageNumber,
                    text: normalizeBookText(pageText),
                    usedOcr,
                    processed: true,
                    extractionMethod,
                    error: pageError || '',
                    invalid: false
                };
                extractedPages.push(pageRecord);

                await writeReaderStore('pdf-tasks', {
                    key: taskKey,
                    fileName: file.name,
                    fileSize: file.size,
                    fileLastModified: file.lastModified,
                    totalPages: pdfDocument.numPages,
                    completedPages: pageNumber,
                    pages: extractedPages,
                    diagnostics,
                    updatedAt: Date.now()
                });

                setPdfExtractionProgress({ current: pageNumber, total: pdfDocument.numPages });
                if (pageNumber % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0));
            }

            const readablePages = extractedPages.filter(page => normalizeBookText(page.text).length >= 40);
            const totalText = normalizeBookText(readablePages.map(page => page.text).join('\n\n'));

            if (totalText.length < 80) {
                await deleteReaderStore('pdf-tasks', taskKey);
                const details = [
                    `共 ${pdfDocument.numPages} 页`,
                    `可读页 ${readablePages.length}`,
                    `缓存命中 ${diagnostics.cached}`,
                    `OCR成功 ${diagnostics.ocr}`,
                    `OCR失败 ${diagnostics.ocrFailed}`,
                    `空页 ${diagnostics.empty}`,
                    diagnostics.pageErrors.length ? `页面错误 ${diagnostics.pageErrors.length}` : ''
                ].filter(Boolean).join('，');
                throw new Error(`未提取到足够正文（${details}）。已清除无效缓存，请检查PDF文字层或OCR配置后重试。`);
            }

            const sourceHash = await hashText(`${file.name}:${file.size}:${file.lastModified}`);
            const session = await prepareBookImport({ sourceName: file.name, sourceHash, pages: extractedPages });
            setPendingPdfFile(null);
            setIsPdfChoiceOpen(false);
            setIsPdfMode(false);
            setPdfFile(null);
            window.showToast(`已识别 ${session.articles.length} 篇文章，忽略 ${session.ignored.length} 个目录、封面或低信息页`, 'success');
        } catch (error) {
            window.showToast(`PDF 本地提取失败：${error.message}`, 'error');
        } finally {
            setIsExtracting(false);
            setPdfExtractionProgress({ current: 0, total: 0 });
            if (pdfDocument) {
                try { await pdfDocument.destroy(); } catch (error) {}
            } else if (loadingTask) {
                try { await loadingTask.destroy(); } catch (error) {}
            }
        }
    };

    const extractFilesToText = async (files) => {
        for (const file of files) {
            if (file.size > 12 * 1024 * 1024) {
                window.showToast(`文件 ${file.name} 超过 12MB，请压缩或拆分后导入`, "error");
                return;
            }
        }
        setIsExtracting(true);
        try {
            const pages = [];
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const fileBytes = new Uint8Array(await file.arrayBuffer());
                const fileHash = await hashBytes(fileBytes);
                const mediaCacheKey = `media:${fileHash}`;
                const cachedMedia = await readReaderStore('ai-cache', mediaCacheKey);
                let text = cachedMedia?.value || "";
                if (!text) {
                    const base64Data = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(file);
                    });
                    text = await extractTextFromMedia(base64Data, file.type, apiConfig);
                    await writeReaderStore('ai-cache', { key: mediaCacheKey, value: text, createdAt: Date.now(), task: 'ocr' });
                }
                pages.push({ pageNumber: index + 1, text: normalizeBookText(text), usedOcr: true });
            }
            const sourceName = files.length === 1 ? files[0].name : `${files[0].name} 等 ${files.length} 页`;
            const sourceHash = await hashText(files.map(file => `${file.name}:${file.size}:${file.lastModified}`).join('|'));
            const session = await prepareBookImport({ sourceName, sourceHash, pages });
            window.showToast(`已识别 ${session.articles.length} 篇文章，请选择要保存或精读的内容`, "success");
        } catch (error) {
            window.showToast(`识别失败：${error.message}`, "error");
        } finally {
            setIsExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const markdownFiles = files.filter(file => /\.md$/i.test(file.name) || /markdown/i.test(file.type));
        if (markdownFiles.length) {
            await importMarkdownFiles(markdownFiles);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        const pdfFiles = files.filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
        if (pdfFiles.length > 0 && files.length > 1) {
            window.showToast("PDF 请一次导入一份；大文件会在浏览器本地逐页处理", "warning");
            if(fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (pdfFiles.length === 1) {
            setPendingPdfFile(files[0]);
            setIsPdfChoiceOpen(true);
            if(fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        extractFilesToText(files);
    };

    const openPdfNatively = () => {
        if (!pendingPdfFile) return;
        setPdfFile(pendingPdfFile);
        setPendingPdfFile(null);
        setIsPdfChoiceOpen(false);
        setIsReadingMode(false);
        setIsPdfMode(true);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    };

    const extractPendingPdf = () => {
        if (!pendingPdfFile) return;
        extractPdfTextLocally(pendingPdfFile);
    };

    const closePdfReader = () => {
        if (isExtracting) {
            window.showToast("正在本地提取 PDF，请稍候", "warning");
            return;
        }
        setIsPdfMode(false);
        setPdfFile(null);
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    };

    const extractCurrentPdf = () => {
        if (!pdfFile) return;
        extractPdfTextLocally(pdfFile);
    };

    const openMapEditorModal = () => {
        if (!fullMapData?.mindmap) return;
        setMapEditDraft(cloneJson(fullMapData));
        setIsMapEditing(false);
        setIsMapModalOpen(true);
        setMapScale(1);
    };

    const updateMapDraftNode = (nodePath, patch) => {
        setMapEditDraft(previous => previous ? { ...previous, mindmap: updateMindMapNodeAtPath(previous.mindmap, nodePath, node => ({ ...node, ...patch })) } : previous);
    };

    const addMapDraftChild = (nodePath) => {
        setMapEditDraft(previous => previous ? {
            ...previous,
            mindmap: updateMindMapNodeAtPath(previous.mindmap, nodePath, node => ({
                ...node,
                children: [...(node.children || []), { nameEn: 'New branch', nameZh: '新分支', children: [] }]
            }))
        } : previous);
        setCollapsedMapNodes(previous => {
            const next = new Set(previous);
            next.delete(nodePath);
            return next;
        });
    };

    const deleteMapDraftNode = (nodePath) => {
        if (!window.confirm('确定删除这个节点及其子节点吗？')) return;
        setMapEditDraft(previous => previous ? { ...previous, mindmap: removeMindMapNodeAtPath(previous.mindmap, nodePath) } : previous);
    };

    const saveMapEdits = () => {
        if (!mapEditDraft?.mindmap) return;
        setFullMapData(mapEditDraft);
        if (currentHistoryId) {
            const record = history.find(item => item.id === currentHistoryId) || { id: currentHistoryId, text: inputText, createdAt: Date.now() };
            saveHistoryToCloud({ ...record, fullMapData: mapEditDraft });
        }
        setIsMapEditing(false);
        window.showToast('结构树编辑已保存到当前文章', 'success');
    };

    const prepareBookImport = async ({ sourceName, sourceHash, pages }) => {
        const segmented = segmentBookPages(pages);
        if (!segmented.articles.length) throw new Error('没有识别到可阅读的文章，请检查文件清晰度或OCR配置');
        const key = `book-import:${sourceHash || await hashText(`${sourceName}:${Date.now()}`)}`;
        const session = {
            key,
            sourceName,
            createdAt: Date.now(),
            articles: segmented.articles,
            ignored: segmented.ignored,
            pageCount: pages.length
        };
        await writeReaderStore('book-imports', session);
        setBookImportSession(session);
        setBookImportPreviewId(session.articles[0]?.id || null);
        setLatestBookImportKey(key);
        persistLocalState({ latestBookImportKey: key });
        setIsBookImportOpen(true);
        return session;
    };

    const openLatestBookImport = async () => {
        if (!latestBookImportKey) {
            window.showToast('暂无待选择的书籍识别结果', 'warning');
            return;
        }
        const session = await readReaderStore('book-imports', latestBookImportKey);
        if (!session) {
            window.showToast('本地识别结果已被浏览器清理', 'warning');
            return;
        }
        setBookImportSession(session);
        setBookImportPreviewId(session.articles?.[0]?.id || null);
        setIsBookImportOpen(true);
    };

    const saveSelectedBookArticles = async (openFirst = false) => {
        const selected = (bookImportSession?.articles || []).filter(article => article.selected);
        if (!selected.length) {
            window.showToast('请至少选择一篇文章', 'warning');
            return;
        }
        const createdAt = Date.now();
        const records = [];
        for (let index = 0; index < selected.length; index += 1) {
            const article = selected[index];
            const articleKey = `${bookImportSession.key}:article:${article.id}`;
            await writeReaderStore('book-articles', { key: articleKey, ...article, sourceName: bookImportSession.sourceName, savedAt: createdAt });
            const recordId = `book-${createdAt}-${index}`;
            const articleBundle = {
                key: getArticleBundleKey(recordId),
                schemaVersion: ARTICLE_BUNDLE_SCHEMA_VERSION,
                article: { id: recordId, title: article.title, sourceText: article.text, sourceType: 'book-article', sourceName: bookImportSession.sourceName, createdAt: createdAt - index, updatedAt: createdAt, contentHash: await hashText(article.text) },
                results: { fullTranslations: [], globalLogicData: null, fullMapData: null, fullQuizData: null, paragraphResults: {}, activeAnalysis: null },
                notes: { documentNote: '', annotations: [] },
                metadata: { importedAt: createdAt, promptVersion: CACHE_PROMPT_VERSION }
            };
            await writeReaderStore('article-bundles', articleBundle);
            records.push({
                id: recordId,
                title: article.title,
                preview: article.text.slice(0, 180),
                localArticleKey: articleKey,
                bundleKey: articleBundle.key,
                sourceType: 'book-article',
                timestamp: new Date(createdAt).toLocaleString('zh-CN'),
                createdAt: createdAt - index,
                fullMapData: null,
                fullTranslations: []
            });
        }
        setHistory(previous => {
            const next = [...records, ...previous.filter(item => !records.some(record => record.id === item.id))];
            persistLocalState({ history: next });
            return next;
        });
        window.showToast(`已将 ${records.length} 篇文章保存到当前浏览器`, 'success');
        if (openFirst && records[0]) {
            const stored = await readReaderStore('book-articles', records[0].localArticleKey);
            setInputText(stored?.text || '');
            setCurrentHistoryId(records[0].id);
            setIsReadingMode(true);
            setFullMapData(null);
            setFullTranslations([]);
            setIsBookImportOpen(false);
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
        }
    };

    const toggleMapNode = (nodePath) => {
        setCollapsedMapNodes(previous => {
            const next = new Set(previous);
            if (next.has(nodePath)) next.delete(nodePath);
            else next.add(nodePath);
            return next;
        });
    };

    const expandAllMapNodes = () => setCollapsedMapNodes(new Set());

    const collapseAllMapNodes = () => {
        setCollapsedMapNodes(new Set(getMindMapBranchPaths(fullMapData?.mindmap)));
    };

    const handleGenerateSummary = async (options = {}) => {
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
    };

    const handleToggleGlobalLogic = async (options = {}) => {
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



    const handleFullQuizTool = async () => {
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

    const handleFullNotesTool = () => {
        setIsFullTextMenuOpen(false);
        setNotesView('annotations');
        openRightPanelTab('notes');
    };

    const renderPracticePanel = () => {
        const result = practicePanelResult;
        if (result?.kind === 'loading' || (isFullQuizLoading && !result)) {
            return <div role="status" aria-busy="true" className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">{result?.message || '正在生成模拟习题…'}</p></div>;
        }
        if (result?.kind === 'error') {
            return <div role="alert" className="p-3 border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/15 rounded-sm text-red-700 dark:text-red-300"><h3 className="font-semibold">{result.title || '生成失败'}</h3><p className="mt-2 leading-relaxed">{result.message}</p></div>;
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
            currentBlock = <div role="status" aria-busy="true" className="py-10 text-center"><div className="mx-auto w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-3 text-gray-500">{result.message || '正在处理…'}</p></div>;
        } else if (result?.kind === 'error') {
            currentBlock = <div role="alert" className="p-3 border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-900/15 rounded-sm text-red-700 dark:text-red-300"><h3 className="font-semibold">{result.title || '处理失败'}</h3><p className="mt-2 leading-relaxed">{result.message}</p></div>;
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

    const readerToolbarIconClass = (active = false) => `w-9 h-9 shrink-0 grid place-items-center rounded-sm border transition-colors disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 ${active ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-sky-700 dark:hover:text-sky-300'}`;

    const paragraphs = useMemo(() => inputText.split(/\n+/).filter(p => p.trim() !== ''), [inputText]);
    const normalizedMasteredSearch = masteredSearch.trim().toLowerCase();
    const filteredMasteredLemmas = normalizedMasteredSearch
        ? masteredLemmas.filter(lemma => lemma.includes(normalizedMasteredSearch))
        : masteredLemmas;
    const currentArticleNotes = currentHistoryId
        ? (readingNotes.articles?.[currentHistoryId] || { documentNote: "", annotations: [] })
        : { documentNote: "", annotations: [] };
    const currentAnnotations = Array.isArray(currentArticleNotes.annotations) ? currentArticleNotes.annotations : [];
    const currentArticleTitle = currentHistoryId
        ? (history.find(item => item.id === currentHistoryId)?.title || inferArticleTitleFromText(inputText))
        : inferArticleTitleFromText(inputText);

    useEffect(() => {
        document.title = isReadingMode && currentArticleTitle
            ? `${currentArticleTitle} · 杨的外刊阅读器`
            : '杨的外刊阅读器';
        if (!isReadingMode) return undefined;
        const frame = requestAnimationFrame(() => document.querySelector('#reader-article-content')?.focus());
        return () => cancelAnimationFrame(frame);
    }, [isReadingMode, currentHistoryId]);
    const typographyDialogRef = useDialogFocus({
        open: isTypographyModalOpen,
        fallbackFocusSelector: '[aria-controls="header-main-menu"]',
        onClose: () => setIsTypographyModalOpen(false)
    });
    const historyDialogRef = useDialogFocus({
        open: isHistoryDrawerOpen,
        fallbackFocusSelector: '[aria-controls="header-main-menu"]',
        onClose: () => setIsHistoryDrawerOpen(false)
    });
    const dictionaryDialogRef = useDialogFocus({
        open: isDictModalOpen,
        fallbackFocusSelector: '[aria-controls="header-main-menu"]',
        onClose: () => setIsDictModalOpen(false)
    });
    const apiDialogRef = useDialogFocus({
        open: isApiModalOpen,
        fallbackFocusSelector: '[aria-controls="header-main-menu"]',
        onClose: () => setIsApiModalOpen(false)
    });
    const bookImportDialogRef = useDialogFocus({
        open: isBookImportOpen,
        fallbackFocusSelector: '[aria-controls="header-main-menu"]',
        onClose: () => setIsBookImportOpen(false)
    });
    const pdfChoiceDialogRef = useDialogFocus({
        open: isPdfChoiceOpen,
        closeOnEscape: !isExtracting,
        onClose: () => {
            if (!isExtracting) {
                setIsPdfChoiceOpen(false);
                setPendingPdfFile(null);
            }
        }
    });
    const batchDialogRef = useDialogFocus({
        open: isBatchAnalysisOpen,
        closeOnEscape: !isBatchRunning,
        onClose: () => {
            if (!isBatchRunning) setIsBatchAnalysisOpen(false);
        }
    });
    const mapDialogRef = useDialogFocus({
        open: isMapModalOpen && Boolean(fullMapData),
        onClose: () => {
            setIsMapModalOpen(false);
            setIsMapEditing(false);
            setMapEditDraft(null);
        }
    });
    const {
        triggerRef: headerMenuTriggerRef,
        menuRef: headerMenuRef,
        onMenuKeyDown: handleHeaderMenuKeyDown
    } = useMenuNavigation({
        open: isHeaderMenuOpen,
        onClose: () => setIsHeaderMenuOpen(false)
    });
    const {
        triggerRef: fullTextMenuTriggerRef,
        menuRef: fullTextMenuRef,
        onMenuKeyDown: handleFullTextMenuKeyDown
    } = useMenuNavigation({
        open: isFullTextMenuOpen,
        onClose: () => setIsFullTextMenuOpen(false)
    });

    return (
        <div className={`reader-theme-root ${typographyConfig.theme === 'dark' ? 'dark' : ''}`}>
            <div className={`reader-page-shell min-h-screen bg-[#F9FAFB] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans pb-24 relative transition-colors duration-300 ${isImmersive ? 'reader-immersive' : ''}`}>
                <AccessibilityFeedback />
                <SkipLinks showLearningPanel={isReadingMode && rightPanelOpen} />
                <input ref={markdownInputRef} type="file" accept="text/markdown,.md" multiple className="hidden" aria-label="选择 Markdown 备份文件" onChange={handleMarkdownUpload} />

                {masteredUndo && (
                    <div role="status" onMouseEnter={() => setMasteredUndoPaused(true)} onMouseLeave={() => setMasteredUndoPaused(false)} onFocusCapture={() => setMasteredUndoPaused(true)} onBlurCapture={() => setMasteredUndoPaused(false)} className="fixed left-1/2 top-5 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-[13px] text-white shadow-xl dark:bg-slate-100 dark:text-slate-900">
                        <span>已不再标记 {masteredUndo.lemma}</span>
                        <button type="button" onClick={handleUndoMasteredWord} className="font-semibold text-sky-300 underline underline-offset-2 dark:text-sky-700">撤销</button>
                    </div>
                )}

                {/* 排版设置弹窗 */}
                {isTypographyModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <button type="button" className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsTypographyModalOpen(false)} aria-label="关闭阅读排版设置"></button>
                        <div ref={typographyDialogRef} role="dialog" aria-modal="true" aria-labelledby="typography-dialog-title" tabIndex={-1} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto custom-scrollbar relative z-10 p-6 animate-fade-in-down border border-gray-100 dark:border-gray-700 outline-none">
                            <h2 id="typography-dialog-title" className="text-[16px] font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                                <svg className="w-4 h-4 mr-1.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10M9 8h6m-7 4h8m-9 4h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"></path></svg>
                                阅读排版设置
                            </h2>

                            <div className="mb-4">
                                <label htmlFor="typography-preset" className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">阅读预设</label>
                                <select
                                    id="typography-preset"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-blue-400 text-gray-800 dark:text-gray-200"
                                    value={tempTypographyConfig.preset || 'custom'}
                                    onChange={e => setTempTypographyConfig({ ...tempTypographyConfig, preset: e.target.value, ...(TYPOGRAPHY_PRESETS[e.target.value] || {}) })}
                                >
                                    <option value="editorial">Editorial default</option>
                                    <option value="modern">Modern</option>
                                    <option value="classic">Classic</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl mb-5 overflow-hidden flex items-center justify-center min-h-[100px] transition-all duration-300"
                                 style={{
                                     fontFamily: tempTypographyConfig.fontFamily,
                                     fontSize: `${tempTypographyConfig.fontSize}px`,
                                     lineHeight: tempTypographyConfig.lineHeight
                                 }}>
                                 <div className="w-full text-left text-gray-800 dark:text-gray-200">
                                     <p>France, which prides itself as the global innovator of fashion, has decided</p>
                                     <p>its fashion industry has lost an absolute right to define physical beauty.</p>
                                     <p className="mt-2 border-l-2 border-amber-400 pl-2 bg-amber-50/60 dark:bg-amber-900/20">Its lawmakers gave preliminary approval last week to a law.</p>
                                     <p className="mt-2 text-gray-600 dark:text-gray-400" style={{ fontFamily: tempTypographyConfig.chineseFontFamily || '"Noto Serif SC", STSong, serif' }}>法国立法者上周初步批准了一项相关法律。</p>
                                 </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="typography-font-family" className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">字体样式</label>
                                    <select
                                        id="typography-font-family"
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-blue-400 text-gray-800 dark:text-gray-200"
                                        value={tempTypographyConfig.fontFamily}
                                        onChange={e => setTempTypographyConfig({...tempTypographyConfig, preset: 'custom', fontFamily: e.target.value, readingFontFamily: e.target.value})}
                                    >
                                        <option value='"Noto Serif SC", STSong, "Times New Roman", serif'>优雅宋体 (Serif)</option>
                                        <option value='"Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'>现代黑体 (Sans-serif)</option>
                                        <option value="'KaiTi', 'Kaiti SC', STKaiti, serif">护眼楷体 (KaiTi)</option>
                                        <option value="Georgia, serif">经典外刊 (Georgia)</option>
                                        <option value="'Courier New', Courier, monospace">极客等宽 (Monospace)</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="flex justify-between text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <label htmlFor="typography-font-size">字号大小</label>
                                        <span className="text-blue-600 dark:text-blue-400">{tempTypographyConfig.fontSize} px</span>
                                    </div>
                                    <input id="typography-font-size" type="range" min="12" max="30" step="1" className="w-full" value={tempTypographyConfig.fontSize} onChange={e => setTempTypographyConfig({...tempTypographyConfig, fontSize: parseInt(e.target.value)})} />
                                </div>

                                <div>
                                    <div className="flex justify-between text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <label htmlFor="typography-line-height">段落行距</label>
                                        <span className="text-blue-600 dark:text-blue-400">{tempTypographyConfig.lineHeight}</span>
                                    </div>
                                    <input id="typography-line-height" type="range" min="1.2" max="3.5" step="0.1" className="w-full" value={tempTypographyConfig.lineHeight} onChange={e => setTempTypographyConfig({...tempTypographyConfig, lineHeight: parseFloat(e.target.value)})} />
                                </div>

                                <div>
                                    <div className="flex justify-between text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <label htmlFor="typography-padding">左右边距留白</label>
                                        <span className="text-blue-600 dark:text-blue-400">{tempTypographyConfig.paddingX}%</span>
                                    </div>
                                    <input id="typography-padding" type="range" min="0" max="25" step="1" className="w-full" value={tempTypographyConfig.paddingX} onChange={e => setTempTypographyConfig({...tempTypographyConfig, preset: 'custom', paddingX: parseInt(e.target.value)})} />
                                </div>

                                <div>
                                    <div className="flex justify-between text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <label htmlFor="typography-measure">正文 measure</label>
                                        <span className="text-blue-600 dark:text-blue-400">{tempTypographyConfig.measure || 66} ch</span>
                                    </div>
                                    <input id="typography-measure" type="range" min="48" max="78" step="1" className="w-full" value={tempTypographyConfig.measure || 66} onChange={e => setTempTypographyConfig({...tempTypographyConfig, preset: 'custom', measure: parseInt(e.target.value)})} />
                                </div>
                            </div>

                            <div className="flex justify-end mt-8">
                                <button onClick={handleSaveTypography} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-medium hover:bg-blue-700 active:scale-95 transition-transform shadow-sm">
                                    保存并应用排版
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isHistoryDrawerOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <button type="button" className="absolute inset-0 bg-gray-900/30 dark:bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsHistoryDrawerOpen(false)} aria-label="关闭阅读库"></button>
                        <div ref={historyDialogRef} role="dialog" aria-modal="true" aria-labelledby="history-dialog-title" tabIndex={-1} className="w-full max-w-xl bg-white dark:bg-gray-900 h-full shadow-2xl relative flex flex-col animate-slide-in-right border-l border-gray-200 dark:border-gray-800 outline-none">
                            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                <h2 id="history-dialog-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                                    阅读库
                                </h2>
                                <div className="flex items-center gap-1">
                                    <button onClick={toggleLibrarySelectionMode} className={`min-h-[34px] px-3 text-[12px] rounded-sm border ${librarySelectionMode ? 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{librarySelectionMode ? '退出多选' : '批量选择'}</button>
                                    <button onClick={() => setIsHistoryDrawerOpen(false)} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="关闭阅读库"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                </div>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/50 text-[12px] text-blue-800 dark:text-blue-300 leading-relaxed text-justify">
                                💡 文章正文与非语音学习结果保存在浏览器 IndexedDB；建议定期导出 Markdown 备份。批量解析默认串行并跳过已有结果。
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-[#F9FAFB] dark:bg-gray-900">
                                {history.length === 0 ? (
                                    <div className="text-center text-gray-400 mt-20 text-sm">暂无阅读记录，去精读一篇吧</div>
                                ) : (
                                    <div className="space-y-3">
                                        {history.map((record) => (
                                            <div key={record.id} role="button" tabIndex={0} aria-label={`${librarySelectionMode ? '选择' : '打开'}文章：${record.title || '未命名文章'}`} onKeyDown={(event) => handleKeyboardActivation(event, () => librarySelectionMode ? toggleLibrarySelection(record.id) : loadHistoryRecord(record))} onClick={() => librarySelectionMode ? toggleLibrarySelection(record.id) : loadHistoryRecord(record)} className={`p-4 rounded-xl border cursor-pointer group transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selectedLibraryIds.includes(record.id) ? 'ring-2 ring-sky-300 border-sky-300' : ''} ${currentHistoryId === record.id ? 'bg-sky-700 dark:bg-gray-800 border-sky-700 dark:border-gray-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-600 shadow-sm'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        {librarySelectionMode && <input type="checkbox" checked={selectedLibraryIds.includes(record.id)} onClick={event => event.stopPropagation()} onChange={() => toggleLibrarySelection(record.id)} aria-label={`选择${record.title || '文章'}`} />}
                                                        <div className={`text-xs font-medium truncate ${currentHistoryId === record.id ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>{record.timestamp}</div>
                                                    </div>
                                                <button onClick={(e) => deleteHistoryRecord(record.id, e)} aria-label={`删除文章：${record.title || '未命名文章'}`} className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded transition-opacity ${currentHistoryId === record.id ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                                </div>
                                                <div className={`text-[13.5px] leading-relaxed font-serif ${currentHistoryId === record.id ? 'text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>{record.title || window.getExcerpt(record.text || record.preview || '')}</div>
                                                <div className="mt-3 flex flex-wrap gap-2 items-center text-[10px] font-medium">
                                                    {(record.fullMapData || record.hasFullMap) && <span className={`px-2 py-0.5 rounded-sm flex items-center ${currentHistoryId === record.id ? 'bg-gray-700 text-gray-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'}`}><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path></svg>结构已缓存</span>}
                                                    {(record.fullTranslations?.length > 0 || record.hasFullTranslations) && <span className={`px-2 py-0.5 rounded-sm flex items-center ${currentHistoryId === record.id ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800'}`}><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>翻译已缓存</span>}
                                                    {record.hasGlobalLogic && <span className="px-2 py-0.5 rounded-sm border border-teal-100 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">逻辑已缓存</span>}
                                                    {record.hasFullQuiz && <span className="px-2 py-0.5 rounded-sm border border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">练习已缓存</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {history.length > 0 && (
                                <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                                    {librarySelectionMode ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-[12px] text-gray-500"><span>已选择 {selectedLibraryIds.length} 篇</span><button onClick={() => setSelectedLibraryIds(selectedLibraryIds.length === history.length ? [] : history.map(record => record.id))} className="text-sky-700 dark:text-sky-300">{selectedLibraryIds.length === history.length ? '取消全选' : '全选'}</button></div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={() => { if (!selectedLibraryIds.length) return window.showToast('请先选择文章', 'warning'); setIsBatchAnalysisOpen(true); }} className="min-h-[40px] rounded-sm bg-sky-700 text-white text-[12px] font-medium hover:bg-sky-600">批量全文解析</button>
                                                <button onClick={downloadSelectedArticlesMarkdown} className="min-h-[40px] rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] font-medium hover:bg-gray-50 dark:hover:bg-gray-800">批量导出 MD</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={clearAllHistory} className="w-full py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">清空阅读记录</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isDictModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <button type="button" className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsDictModalOpen(false)} aria-label="关闭个人词库"></button>
                        <div ref={dictionaryDialogRef} role="dialog" aria-modal="true" aria-labelledby="dictionary-dialog-title" tabIndex={-1} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 p-6 animate-fade-in-down border border-gray-100 dark:border-gray-700 outline-none">
                            <h2 id="dictionary-dialog-title" className="text-[16px] font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-1.5 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path></svg>
                                自定义个人词库
                            </h2>
                            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">在此添加你自己的专属生词本（支持 单词=释义 格式）。数据只保存在当前浏览器，并可随 Markdown 备份携带。</p>
                            <textarea aria-label="个人词库内容" className="w-full h-40 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-[13px] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 mb-4 outline-none focus:border-amber-400" placeholder="在此粘贴文本..." value={dictInputText} onChange={(e) => setDictInputText(e.target.value)} />
                            <div className="flex justify-between items-center">
                                <span className="text-[12px] text-gray-400 font-medium">已保存词汇: {Object.keys(customDict).length}</span>
                                <button onClick={handleSaveCustomDict} className="px-5 py-2 bg-amber-600 text-white rounded-lg text-[13px] hover:bg-amber-700 active:scale-95 transition-transform">追加并保存</button>
                            </div>

                            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">已掌握词</h3>
                                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">这些词及现有词形匹配能识别的变形不再划线。</p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300">{masteredLemmas.length} 个</span>
                                </div>
                                {masteredLemmas.length > 0 ? (
                                    <>
                                        <input
                                            type="search"
                                            aria-label="搜索已掌握词"
                                            value={masteredSearch}
                                            onChange={event => setMasteredSearch(event.target.value)}
                                            placeholder="搜索已掌握词"
                                            className="mt-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-sky-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                        />
                                        <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 custom-scrollbar">
                                            {filteredMasteredLemmas.length > 0 ? filteredMasteredLemmas.map(lemma => (
                                                <div key={lemma} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 dark:border-gray-700">
                                                    <span className="font-mono text-[13px] text-gray-800 dark:text-gray-200">{lemma}</span>
                                                    <button type="button" onClick={() => handleRestoreMasteredWord(lemma)} className="shrink-0 text-[12px] font-medium text-sky-700 hover:underline dark:text-sky-300">恢复默认标记</button>
                                                </div>
                                            )) : <div className="px-3 py-5 text-center text-[12px] text-gray-400">没有匹配的词</div>}
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                            <button type="button" onClick={handleRestoreAllMasteredWords} className="text-[12px] font-medium text-red-600 hover:underline dark:text-red-400">全部恢复默认</button>
                                        </div>
                                    </>
                                ) : <div className="mt-3 rounded-lg bg-gray-50 px-3 py-4 text-center text-[12px] text-gray-400 dark:bg-gray-900">尚未设置已掌握词</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* API 与模型设定弹窗 */}
                {isApiModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <button type="button" className="absolute inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setIsApiModalOpen(false)} aria-label="关闭模型配置"></button>
                        <div ref={apiDialogRef} role="dialog" aria-modal="true" aria-labelledby="api-dialog-title" tabIndex={-1} className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl relative z-10 p-6 animate-fade-in-down border border-gray-100 dark:border-gray-700 outline-none">
                            <h2 id="api-dialog-title" className="text-[16px] font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-1.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                大模型 API 路由中心
                            </h2>
                            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 text-[12px] leading-relaxed rounded-lg mb-4 border border-purple-100 dark:border-purple-800/50 flex flex-col gap-2">
                                <p>🚀 完全解禁大模型限制。你可以接入自己的 Google API，也可以无缝接入<strong>阿里云 (Qwen)</strong> 等兼容 OpenAI 格式的大模型 API。</p>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={() => setTempApiConfig({ apiType: 'openai', key: '', model: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiVersion: 'v1beta' })}
                                        className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors shadow-sm"
                                    >
                                        ⚡ 一键填入阿里云(Qwen)配置
                                    </button>
                                    <button
                                        onClick={() => setTempApiConfig({ apiType: 'gemini', key: '', model: CURRENT_GEMINI_TEXT_MODEL, baseUrl: 'https://generativelanguage.googleapis.com', apiVersion: 'v1beta' })}
                                        className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors shadow-sm"
                                    >
                                        🇬 一键填入 Google Gemini 配置
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-1/3">
                                        <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">接口协议类型</label>
                                        <select
                                            aria-label="接口协议类型"
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-purple-400 text-gray-800 dark:text-gray-200"
                                            value={tempApiConfig.apiType || 'gemini'}
                                            onChange={e => setTempApiConfig({...tempApiConfig, apiType: e.target.value})}
                                        >
                                            <option value="gemini">Google Gemini 原生协议</option>
                                            <option value="openai">OpenAI 兼容协议 (阿里云等)</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">API Base URL (代理地址)</label>
                                        <input
                                            type="text"
                                            aria-label="API Base URL"
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-purple-400 text-gray-800 dark:text-gray-200"
                                            placeholder={tempApiConfig.apiType === 'openai' ? "https://dashscope.aliyuncs.com/compatible-mode/v1" : "https://generativelanguage.googleapis.com"}
                                            value={tempApiConfig.baseUrl}
                                            onChange={e => setTempApiConfig({...tempApiConfig, baseUrl: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    {tempApiConfig.apiType === 'gemini' && (
                                        <div className="w-1/3">
                                            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">API 版本</label>
                                            <select
                                                aria-label="API 版本"
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-purple-400 text-gray-800 dark:text-gray-200"
                                                value={tempApiConfig.apiVersion || 'v1beta'}
                                                onChange={e => setTempApiConfig({...tempApiConfig, apiVersion: e.target.value})}
                                            >
                                                <option value="v1beta">v1beta (标准)</option>
                                                <option value="v1alpha">v1alpha (实验)</option>
                                                <option value="v1">v1 (正式)</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">模型名称 (Model)</label>
                                        <input
                                            type="text"
                                            aria-label="模型名称"
                                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-purple-400 text-gray-800 dark:text-gray-200"
                                            placeholder={tempApiConfig.apiType === 'openai' ? "如: qwen-plus" : `如: ${CURRENT_GEMINI_TEXT_MODEL}`}
                                            value={tempApiConfig.model}
                                            onChange={e => setTempApiConfig({...tempApiConfig, model: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">大模型 API Key</label>
                                    <input
                                        type="password"
                                        aria-label="大模型 API Key"
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[13px] outline-none focus:border-purple-400 text-gray-800 dark:text-gray-200"
                                        placeholder="sk-..."
                                        value={tempApiConfig.key}
                                        onChange={e => setTempApiConfig({...tempApiConfig, key: e.target.value})}
                                    />
                                    <label className="mt-2 flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                                        <input type="checkbox" aria-label="在此设备记住 API Key" checked={Boolean(tempApiConfig.rememberKey)} onChange={e => setTempApiConfig({...tempApiConfig, rememberKey: e.target.checked})} />
                                        在此设备记住 Key（公共电脑请勿勾选）
                                    </label>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        ['analysis', '内容解析'],
                                        ['ocr', 'OCR'],
                                        ['tts', 'TTS']
                                    ].map(([task, label]) => (
                                        <label key={task} className="block text-[12px] text-gray-600 dark:text-gray-300">
                                            <span className="block mb-1">{label} Model</span>
                                            <input type="text" aria-label={`${label}模型`} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-[12px] outline-none focus:border-purple-400 text-gray-800 dark:text-gray-200" value={tempApiConfig.taskRoutes?.[task]?.model || tempApiConfig.model || ''} onChange={e => setTempApiConfig({...tempApiConfig, taskRoutes: {...(tempApiConfig.taskRoutes || {}), [task]: {...(tempApiConfig.taskRoutes?.[task] || {}), model: e.target.value}}})} />
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={handleTestApiConfig} disabled={isTestingApi} className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait">
                                    {isTestingApi ? "测试中..." : "测试连接"}
                                </button>
                                <button onClick={handleSaveApiConfig} className="px-5 py-2 bg-purple-600 text-white rounded-md text-[13px] font-medium hover:bg-purple-700 active:scale-95 transition-transform shadow-sm">
                                    保存配置
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isBookImportOpen && bookImportSession && (
                    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-5">
                        <button className="absolute inset-0 bg-slate-700/30 dark:bg-black/65 backdrop-blur-sm" onClick={() => setIsBookImportOpen(false)} aria-label="关闭书籍识别结果"></button>
                        <div ref={bookImportDialogRef} role="dialog" aria-modal="true" aria-labelledby="book-import-dialog-title" tabIndex={-1} className="relative w-full max-w-6xl max-h-[92vh] bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-sm shadow-2xl flex flex-col overflow-hidden outline-none">
                            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
                                <div className="min-w-0 flex-1">
                                    <h2 id="book-import-dialog-title" className="text-[16px] font-semibold text-slate-800 dark:text-gray-100">书籍识别结果</h2>
                                    <p className="mt-1 text-[12px] text-slate-500 dark:text-gray-400 truncate">{bookImportSession.sourceName}</p>
                                </div>
                                <div className="text-[12px] text-slate-500 dark:text-gray-400">
                                    识别 {bookImportSession.articles.length} 篇 · 忽略 {bookImportSession.ignored.length} 页 · 共 {bookImportSession.pageCount} 页
                                </div>
                                <button onClick={() => setIsBookImportOpen(false)} className="w-9 h-9 grid place-items-center rounded-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800" aria-label="关闭">×</button>
                            </div>
                            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)]">
                                <div className="min-h-0 border-r border-slate-200 dark:border-gray-700 flex flex-col">
                                    <div className="p-3 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2">
                                        <span className="text-[12px] text-slate-500">选择要保存的文章</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setBookImportSession(session => ({ ...session, articles: session.articles.map(article => ({ ...article, selected: true })) }))} className="px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-50 rounded-sm">全选</button>
                                            <button onClick={() => setBookImportSession(session => ({ ...session, articles: session.articles.map(article => ({ ...article, selected: false })) }))} className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded-sm">取消全选</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
                                        {bookImportSession.articles.map(article => (
                                            <div key={article.id} role="button" tabIndex={0} aria-label={`预览文章：${article.title || '未命名文章'}`} className={`border rounded-sm p-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${bookImportPreviewId === article.id ? 'border-sky-300 bg-sky-50/70 dark:bg-sky-900/20' : 'border-slate-200 dark:border-gray-700 hover:border-sky-200'}`} onKeyDown={(event) => handleKeyboardActivation(event, () => setBookImportPreviewId(article.id))} onClick={() => setBookImportPreviewId(article.id)}>
                                                <div className="flex items-start gap-2">
                                                <input type="checkbox" aria-label={`选择文章：${article.title || '未命名文章'}`} checked={Boolean(article.selected)} onClick={event => event.stopPropagation()} onChange={event => setBookImportSession(session => ({ ...session, articles: session.articles.map(item => item.id === article.id ? { ...item, selected: event.target.checked } : item) }))} className="mt-1" />
                                                    <div className="min-w-0 flex-1">
                                                    <input aria-label="文章标题" value={article.title} onClick={event => event.stopPropagation()} onChange={event => setBookImportSession(session => ({ ...session, articles: session.articles.map(item => item.id === article.id ? { ...item, title: event.target.value } : item) }))} className="w-full bg-transparent text-[13px] font-medium text-slate-800 dark:text-gray-100 border-b border-transparent focus:border-sky-300 outline-none" />
                                                        <div className="mt-1 text-[10px] text-slate-400">第 {article.pageStart}{article.pageEnd !== article.pageStart ? `–${article.pageEnd}` : ''} 页 · {article.wordCount} 词</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="min-h-0 flex flex-col bg-slate-50/50 dark:bg-gray-950/30">
                                    <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-700 text-[12px] text-slate-500">文章预览（仅本地，不调用模型）</div>
                                    <div className="flex-1 overflow-y-auto p-5 sm:p-7 custom-scrollbar">
                                        {(() => {
                                            const article = bookImportSession.articles.find(item => item.id === bookImportPreviewId) || bookImportSession.articles[0];
                                            return article ? (
                                                <div className="max-w-[72ch] mx-auto">
                                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-100">{article.title}</h3>
                                                    <div className="mt-4 whitespace-pre-wrap font-serif text-[15px] leading-[1.75] text-slate-700 dark:text-gray-300">{article.text.slice(0, 12000)}{article.text.length > 12000 ? '\n\n……预览已截断，完整正文会保存在本地。' : ''}</div>
                                                </div>
                                            ) : <div className="text-center text-slate-400">暂无可预览文章</div>;
                                        })()}
                                    </div>
                                </div>
                            </div>
                            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 text-[11px] text-slate-400">目录、封面、插图和低信息页已自动忽略；结果保存在当前浏览器，可稍后继续选择。</div>
                                <button onClick={() => saveSelectedBookArticles(false)} className="min-h-[40px] px-4 rounded-sm border border-sky-200 text-sky-700 bg-white hover:bg-sky-50 text-[13px] font-medium">保存所选到本地</button>
                                <button onClick={() => saveSelectedBookArticles(true)} className="min-h-[40px] px-5 rounded-sm bg-sky-700 text-white hover:bg-sky-600 text-[13px] font-medium">保存并精读第一篇</button>
                            </div>
                        </div>
                    </div>
                )}

                {isPdfChoiceOpen && pendingPdfFile && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <button className="absolute inset-0 bg-gray-900/45 dark:bg-black/65 backdrop-blur-sm" onClick={() => { if (!isExtracting) { setIsPdfChoiceOpen(false); setPendingPdfFile(null); } }} aria-label="关闭 PDF 打开方式选择"></button>
                        <div ref={pdfChoiceDialogRef} role="dialog" aria-modal="true" aria-labelledby="pdf-choice-dialog-title" tabIndex={-1} className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-sm shadow-xl p-5 sm:p-6 animate-fade-in-down outline-none">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 shrink-0 grid place-items-center rounded-md bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v5h5"></path></svg>
                                </div>
                                <div className="min-w-0">
                                    <h2 id="pdf-choice-dialog-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">选择 PDF 打开方式</h2>
                                    <p className="mt-1 truncate text-[13px] text-gray-500 dark:text-gray-400" title={pendingPdfFile.name}>{pendingPdfFile.name}</p>
                                    <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{formatFileSize(pendingPdfFile.size)} · 浏览器本地处理</p>
                                </div>
                            </div>
                            <div className="mt-6 grid gap-3">
                                <button onClick={openPdfNatively} disabled={isExtracting} className="min-h-[64px] px-4 text-left rounded-sm border-2 border-gray-900 dark:border-gray-100 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                    <span className="block text-[14px] font-semibold text-gray-900 dark:text-gray-100">原样阅读</span>
                                    <span className="block mt-1 text-[12px] text-gray-500 dark:text-gray-400">不提取文字，不上传文件</span>
                                </button>
                                <button onClick={extractPendingPdf} disabled={isExtracting} className="min-h-[64px] px-4 text-left rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-wait">
                                    <span className="block text-[14px] font-semibold text-gray-800 dark:text-gray-200">{isExtracting ? `正在本地提取 ${pdfExtractionProgress.current}/${pdfExtractionProgress.total || '-'}` : "智能识别并拆分"}</span>
                                    <span className="block mt-1 text-[12px] text-gray-500 dark:text-gray-400">优先读取文本层；扫描页才按页调用OCR，完成后预览并选择文章</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur sticky top-0 z-40 border-b border-gray-200 dark:border-gray-800 transition-colors">
                    <div className="w-full max-w-none mx-auto h-16 px-4 lg:px-6 xl:px-8 flex items-center gap-3">
                        <div className="relative min-w-0 flex-1 flex items-center gap-2">
                            <button ref={headerMenuTriggerRef} type="button" onClick={() => setIsHeaderMenuOpen(prev => !prev)} className="w-10 h-10 shrink-0 grid place-items-center rounded-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="主菜单" title="主菜单" aria-haspopup="menu" aria-expanded={isHeaderMenuOpen} aria-controls="header-main-menu">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </button>
                            <h1 className="min-w-0 truncate text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">杨的外刊阅读器</h1>
                            {isHeaderMenuOpen && (
                                <>
                                    <button className="fixed inset-0 z-40 cursor-default" onClick={() => setIsHeaderMenuOpen(false)} aria-label="关闭主菜单"></button>
                                    <div ref={headerMenuRef} id="header-main-menu" role="menu" tabIndex={-1} aria-label="主菜单" onKeyDown={handleHeaderMenuKeyDown} className="absolute left-0 top-12 z-50 w-64 p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-sm shadow-lg">
                                        <div className="px-3 py-2 mb-1 text-[11px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                                            {corpusCount} 句真题 · {Object.keys(requiredDict).length} 个预设词 · {Object.keys(extraDict).length} 个生词
                                        </div>
                                        <button role="menuitem" onClick={() => { setIsHistoryDrawerOpen(true); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">阅读库</button>
                                        <button role="menuitem" onClick={() => { markdownInputRef.current?.click(); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">导入 Markdown 备份</button>
                                        <button role="menuitem" onClick={() => { openLatestBookImport(); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">待选书籍{latestBookImportKey ? ' · 已保存' : ''}</button>
                                        <button role="menuitem" onClick={() => { setIsTypographyModalOpen(true); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">阅读排版</button>
                                        <button role="menuitem" onClick={() => { setIsDictModalOpen(true); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">个人词库</button>
                                        <button role="menuitem" onClick={() => { setIsApiModalOpen(true); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">模型配置</button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="hidden lg:flex shrink-0 items-center gap-1">
                            <div className="mr-2 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                <span>{corpusCount} 句真题</span><span className="w-px h-3 bg-gray-200 dark:bg-gray-700"></span><span>{Object.keys(extraDict).length} 个生词</span>
                            </div>
                            <button onClick={() => setIsTypographyModalOpen(true)} className="min-h-[40px] px-3 inline-flex items-center gap-2 rounded-md text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M7 12h10M10 18h4"></path></svg>排版
                            </button>
                            <button onClick={handleToggleTheme} className="w-10 h-10 grid place-items-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={typographyConfig.theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}>
                                {typographyConfig.theme === 'dark' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36l-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0l-1.42-1.42M7.06 7.06L5.64 5.64M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.35 15.35A9 9 0 018.65 3.65a9 9 0 1011.7 11.7z"></path></svg>}
                            </button>
                            {(isReadingMode || isPdfMode) && <button onClick={() => isPdfMode ? closePdfReader() : setIsReadingMode(false)} className="min-h-[40px] px-3 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>退出</button>}
                        </div>
                        <div className="flex lg:hidden shrink-0 items-center gap-1">
                            <button onClick={handleToggleTheme} className="w-10 h-10 grid place-items-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label={typographyConfig.theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}>
                                {typographyConfig.theme === 'dark' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-6.36l-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0l-1.42-1.42M7.06 7.06L5.64 5.64M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.35 15.35A9 9 0 018.65 3.65a9 9 0 1011.7 11.7z"></path></svg>}
                            </button>
                            {(isReadingMode || isPdfMode) && <button onClick={() => isPdfMode ? closePdfReader() : setIsReadingMode(false)} className="w-10 h-10 grid place-items-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="退出当前阅读"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>}
                        </div>
                    </div>
                </header>

                <main id="reader-main-content" tabIndex={-1} aria-busy={isExtracting || isFullTransLoading || isGlobalLogicLoading || isAnalyzingMap || isFullQuizLoading || isBatchRunning} className={`${isReadingMode || isPdfMode ? 'w-full max-w-none my-0 sm:my-0 sm:border-x-0 sm:rounded-none min-h-[calc(100vh-64px)]' : 'max-w-[1200px] sm:my-8'} mx-auto bg-white dark:bg-gray-900 sm:border border-gray-200 dark:border-gray-800 sm:rounded-sm min-h-[85vh] transition-colors ${isReadingMode ? 'overflow-visible' : 'overflow-hidden'}`}>
                    {isPdfMode && pdfFile ? (
                        <PdfReader file={pdfFile} onClose={closePdfReader} onExtract={extractCurrentPdf} isExtractingText={isExtracting} extractionProgress={pdfExtractionProgress} />
                    ) : !isReadingMode ? (
                        <div className="p-5 sm:p-8 md:p-10 space-y-5 animate-fade-in">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
                                 <div>
                                     <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">开始一篇阅读</h2>
                                     <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300">粘贴文章，或从文件导入</p>
                                 </div>
                                 <input type="file" accept="image/*, application/pdf, text/markdown, .md" multiple className="hidden" ref={fileInputRef} aria-label="选择要导入的文件" onChange={handleFileUpload} />
                                 <div className="flex flex-wrap gap-2">
                                     <button onClick={() => setInputText(defaultText)} className="min-h-[42px] px-3 rounded-sm text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">加载示例</button>
                                     <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="min-h-[42px] flex items-center text-[13px] font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 rounded-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                         <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                         {isExtracting ? "解析中..." : "导入文件"}
                                     </button>
                                 </div>
                            </div>
                            <textarea aria-label="英文文章正文" className="w-full h-[48vh] min-h-[320px] p-4 bg-gray-50/60 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-sm outline-none resize-none font-serif text-[15.5px] leading-relaxed text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600 focus:border-gray-500 dark:focus:border-gray-600" placeholder="粘贴英文文章..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
                            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                                <span className="text-[12px] text-gray-600 dark:text-gray-300">{inputText.trim() ? `${inputText.trim().split(/\s+/).length} 词` : "尚未添加内容"}</span>
                                <button onClick={handleStartReading} disabled={isExtracting || !inputText.trim()} className="w-full sm:w-auto min-h-[46px] bg-sky-700 dark:bg-blue-600 text-white px-8 rounded-sm font-medium text-[14px] hover:bg-gray-800 dark:hover:bg-blue-700 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">进入精读</button>
                            </div>
                        </div>
                    ) : (
                        <div className={`reader-workspace ${layoutMode === 'focus' ? 'reader-workspace-focus' : ''} ${layoutMode === 'split' && rightPanelOpen ? 'reader-workspace-split' : ''}`} style={layoutMode === 'split' && rightPanelOpen ? { gridTemplateColumns: `minmax(0, ${splitRatio}fr) minmax(380px, ${100 - splitRatio}fr)` } : undefined}>
                        <article className="reader-main-column reader-article-flow py-6 lg:py-8 animate-fade-in relative transition-all" style={{ '--reader-measure': `${typographyConfig.measure || 66}ch`, paddingLeft: `clamp(18px, 2.4vw, 44px)`, paddingRight: `clamp(18px, 2.4vw, 44px)` }}>
                            <div className="reader-article-toolbar reader-sticky-toolbar w-full sticky z-30 mb-7 px-3 lg:px-4 py-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-end gap-2" role="toolbar" aria-label={isImmersive ? '沉浸模式' : '阅读工具栏'}>
                                {!isImmersive && (
                                <>
                                <div className="flex items-center gap-1 rounded-sm border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70 p-1" role="group" aria-label="阅读模式">
                                    <button type="button" onClick={() => setReadingMode('pure')} className={readerToolbarIconClass(readingMode === 'pure')} aria-pressed={readingMode === 'pure'} aria-label="纯净阅读" title="纯净阅读">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 5.5A2.5 2.5 0 016.5 3H11v16H6.5A2.5 2.5 0 004 21.5v-16zm16 0A2.5 2.5 0 0017.5 3H13v16h4.5a2.5 2.5 0 012.5 2.5v-16z"></path></svg>
                                    </button>
                                    <button type="button" onClick={() => setReadingMode('intensive')} className={readerToolbarIconClass(readingMode === 'intensive')} aria-pressed={readingMode === 'intensive'} aria-label="深度精读" title="深度精读">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 11l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14zM6 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"></path></svg>
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 rounded-sm border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70 p-1" role="group" aria-label="页面布局">
                                    <button type="button" onClick={() => setLayoutMode('standard')} className={readerToolbarIconClass(layoutMode === 'standard')} aria-pressed={layoutMode === 'standard'} aria-label="标准布局" title="标准布局">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5" strokeWidth="1.8"></rect><path strokeLinecap="round" strokeWidth="1.8" d="M8 9h8M8 13h8M8 17h5"></path></svg>
                                    </button>
                                    <button type="button" onClick={() => setLayoutMode('split')} disabled={!isLearningPanelWide} className={`${readerToolbarIconClass(layoutMode === 'split')} disabled:opacity-35 disabled:cursor-not-allowed`} aria-pressed={layoutMode === 'split'} aria-label="正文与侧栏分栏" title={!isLearningPanelWide ? '手机端不支持分栏布局' : '正文与侧栏分栏'}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="1.5" strokeWidth="1.8"></rect><path strokeWidth="1.8" d="M14 5v14"></path></svg>
                                    </button>
                                    <button type="button" onClick={() => setLayoutMode('focus')} className={readerToolbarIconClass(layoutMode === 'focus')} aria-pressed={layoutMode === 'focus'} aria-label="专注布局" title="专注布局">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="16" rx="1.5" strokeWidth="1.8"></rect><path strokeLinecap="round" strokeWidth="1.8" d="M9.5 8h5M9.5 12h5M9.5 16h3"></path></svg>
                                    </button>
                                    <button type="button" onClick={() => setArticleColumnMode(previous => previous === 'double' ? 'single' : 'double')} disabled={!isLearningPanelWide} className={`${readerToolbarIconClass(articleColumnMode === 'double')} disabled:opacity-35 disabled:cursor-not-allowed`} aria-pressed={articleColumnMode === 'double'} aria-label={articleColumnMode === 'double' ? '切换为文章单栏' : '切换为文章双栏'} title={!isLearningPanelWide ? '手机端固定为文章单栏' : articleColumnMode === 'double' ? '文章双栏已开启' : '文章单栏'}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="1.5" strokeWidth="1.8"></rect><path strokeWidth="1.8" d="M12 4v16"></path><path strokeLinecap="round" strokeWidth="1.5" d="M6.5 8h3M6.5 11h3M14.5 8h3M14.5 11h3M6.5 14h3M14.5 14h3"></path></svg>
                                    </button>
                                    <button type="button" onClick={() => setRightPanelOpen(previous => !previous)} disabled={!isLearningPanelWide || layoutMode !== 'split'} className={`${readerToolbarIconClass(layoutMode === 'split' && rightPanelOpen)} disabled:opacity-35 disabled:cursor-not-allowed`} aria-pressed={layoutMode === 'split' && rightPanelOpen} aria-label={rightPanelOpen ? '隐藏学习侧栏' : '显示学习侧栏'} title={!isLearningPanelWide ? '手机端不启用学习侧栏' : layoutMode !== 'split' ? '请先切换到分栏布局' : rightPanelOpen ? '隐藏学习侧栏' : '显示学习侧栏'}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="1.5" strokeWidth="1.8"></rect><path strokeWidth="1.8" d="M15 5v14"></path><path strokeLinecap="round" strokeWidth="1.5" d="M17.5 9h1M17.5 12h1M17.5 15h1"></path></svg>
                                    </button>
                                    <button type="button" onClick={toggleBrowserFullscreen} className={readerToolbarIconClass(isBrowserFullscreen)} aria-pressed={isBrowserFullscreen} aria-label={isBrowserFullscreen ? '退出浏览器全屏' : '浏览器全屏'} title={isBrowserFullscreen ? '退出浏览器全屏' : '浏览器全屏'}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4"></path></svg>
                                    </button>
                                </div>

                                {readingMode === 'intensive' && (
                          <div className="flex items-center gap-1 shrink-0" role="group" aria-label="词汇标注设置">
                              <select value={vocabularySource} onChange={(event) => handleVocabularySourceChange(event.target.value)} aria-label="词汇库来源" title="词汇库来源" className="h-9 w-[72px] sm:w-[82px] px-2 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-sky-400 cursor-pointer">
                                  <option value="all">全部</option>
                                  <option value="ielts">雅思</option>
                                  <option value="kaoyan">考研</option>
                              </select>

                              {vocabularySource === 'all' ? (
                                  <select value={highlightMode} onChange={(event) => setHighlightMode(event.target.value)} aria-label="全部词汇显示范围" title="全部词汇显示范围" className="h-9 w-[104px] sm:w-[116px] px-2 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-sky-400 cursor-pointer">
                                      <option value="all">全部词汇</option>
                                      <option value="none">关闭标注</option>
                                  </select>
                              ) : vocabularySource === 'ielts' ? (
                                  <select value={highlightMode} onChange={(event) => setHighlightMode(event.target.value)} aria-label="雅思词汇显示范围" title="雅思词汇显示范围" className="h-9 w-[112px] sm:w-[126px] px-2 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-sky-400 cursor-pointer">
                                      <option value="daily">核心＋场景</option>
                                      <option value="all">全部雅思词</option>
                                      <option value="core">雅思核心词</option>
                                      <option value="scenario">雅思场景词</option>
                                      <option value="overlap">基础重合词</option>
                                      <option value="extended">雅思扩展词</option>
                                      <option value="none">关闭标注</option>
                                  </select>
                              ) : (
                                  <select value={highlightMode} onChange={(event) => setHighlightMode(event.target.value)} aria-label="考研词汇显示范围" title="考研词汇显示范围" className="h-9 w-[112px] sm:w-[126px] px-2 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-sky-400 cursor-pointer">
                                      <option value="exam">必考＋超纲</option>
                                      <option value="all">全部考研词</option>
                                      <option value="basic">考研基础词</option>
                                      <option value="required">考研必考词</option>
                                      <option value="extra">考研超纲词</option>
                                      <option value="none">关闭标注</option>
                                  </select>
                              )}
                          </div>
                      )}

                                <div ref={fullTextMenuContainerRef} className="relative shrink-0">
                                    <button ref={fullTextMenuTriggerRef} type="button" data-reader-fulltext-trigger="true" onClick={() => setIsFullTextMenuOpen(previous => !previous)} aria-haspopup="menu" aria-expanded={isFullTextMenuOpen} aria-controls="reader-fulltext-menu" className={readerToolbarIconClass(isFullTextMenuOpen)} aria-label="全文工具" title="全文工具">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 12h6M9 16h6"></path><path strokeLinecap="round" strokeWidth="1.5" d="M18.5 11.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z"></path></svg>
                                    </button>
                                    {isFullTextMenuOpen && (
                                        <div ref={fullTextMenuRef} id="reader-fulltext-menu" data-reader-fulltext-menu="true" role="menu" tabIndex={-1} aria-label="全文工具" onKeyDown={handleFullTextMenuKeyDown} className="absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl animate-fade-in-down">
                                            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">全文级操作 · 结果进入右侧面板</div>
                                            <div className="p-1.5">
                                                <button role="menuitem" onClick={handleFullTranslationTool} disabled={isFullTransLoading} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文翻译</span><span className="text-[10px] text-gray-400">{isFullTransLoading ? '处理中' : fullTranslations.length ? '已有结果' : '调用模型'}</span></button>
                                                <button role="menuitem" onClick={handleFullLogicTool} disabled={isGlobalLogicLoading} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文逻辑</span><span className="text-[10px] text-gray-400">{isGlobalLogicLoading ? '分析中' : globalLogicData ? '已有结果' : '调用模型'}</span></button>
                                                <button role="menuitem" onClick={handleFullOutlineTool} disabled={isAnalyzingMap} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文结构 / 思维导图</span><span className="text-[10px] text-gray-400">{isAnalyzingMap ? '生成中' : fullMapData ? '已有结果' : '调用模型'}</span></button>
                                                <button role="menuitem" onClick={handleFullQuizTool} disabled={isFullQuizLoading} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文练习</span><span className="text-[10px] text-gray-400">{isFullQuizLoading ? '生成中' : normalizeQuizQuestions(fullQuizData).length >= 3 ? '已有3题' : fullQuizData ? '升级为3题' : '调用模型'}</span></button>
                                                <div className="my-1 border-t border-gray-100 dark:border-gray-800"></div>
                                                <button role="menuitem" onClick={handleFullNotesTool} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span>学习笔记</span><span className="text-[10px] text-gray-400">{currentAnnotations.length} 条批注</span></button>
                                                <button role="menuitem" onClick={downloadCurrentArticleMarkdown} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span>下载 Markdown</span><span className="text-[10px] text-gray-400">完整备份</span></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </>
                                )}
                                <button type="button" data-reader-immersive-exit={isImmersive ? 'true' : undefined} onClick={() => setIsImmersive(previous => !previous)} className={`${readerToolbarIconClass(isImmersive)} ${isImmersive ? 'w-11 h-11 bg-white/90 dark:bg-gray-900/90 shadow-md' : ''}`} aria-pressed={isImmersive} aria-label={isImmersive ? '退出沉浸模式' : '沉浸模式'} title={isImmersive ? '退出沉浸模式（Esc）' : '沉浸模式'}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.5" strokeWidth="1.8"></circle></svg>
                                </button>
                            </div>

                            <p id="reader-vocabulary-instructions" className="reader-sr-only">词汇导航区。使用方向键浏览划线词，按 Enter 或空格打开释义，按 Tab 离开正文。</p>
                            {/* The named region is intentionally a roving-focus composite for dense inline vocabulary. */}
                            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                            <div
                                id="reader-article-content"
                                tabIndex={0}
                                role="region"
                                aria-label="文章正文与词汇标注"
                                aria-describedby="reader-vocabulary-instructions"
                                data-reader-vocabulary-region="true"
                                onKeyDown={handleArticleVocabularyNavigation}
                                className={`reader-article-body ${articleColumnMode === 'double' ? 'reader-article-body-wide reader-article-columns' : 'space-y-4'} border-b border-gray-100 dark:border-gray-800 pb-16 mb-12`}
                            >
                                {paragraphs.map((p, idx) => (
                                    <Paragraph
                                        key={idx}
                                        text={p}
                                        paragraphIndex={idx}
                                        annotations={currentAnnotations.filter(annotation => Number(annotation?.anchor?.paragraphIndex) === idx)}
                                        activeAnnotationId={activeAnnotationId}
                                        onRequestAnnotation={openAnnotationComposer}
                                        onFocusAnnotation={focusAnnotation}
                                        activeDicts={activeDicts}
                                        masteredLemmaSet={masteredLemmaSet}
                                        onMasterWord={handleMasterWord}
                                        readingMode={readingMode}
                                        highlightMode={highlightMode}
                                        translationText={fullTranslations[idx]}
                                        isTransLoading={isFullTransLoading}
                                        apiConfig={apiConfig}
                                        typographyConfig={typographyConfig}
                                        savedResults={paragraphResults[String(idx)] || null}
                                        inlineResultsEnabled={!isLearningPanelDocked}
                                        compactActionsEnabled={!isLearningPanelWide}
                                        onPersistParagraphResult={handlePersistParagraphResult}
                                        onOpenAnalysis={(result) => {
                                            if (isLearningPanelDocked) {
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
                                        }}
                                    />
                                ))}
                            </div>

                            {showGlobalLogic && globalLogicData && (
                                <div id="global-logic-section" className="mb-12 p-6 md:p-8 bg-teal-50/40 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/50 rounded-2xl animate-fade-in shadow-sm font-sans">
                                    <div className="flex items-center space-x-2 mb-6 border-b border-teal-100/50 dark:border-teal-900/50 pb-4"><span className="bg-teal-600 dark:bg-teal-700 text-white text-[12px] font-bold px-3 py-1.5 rounded uppercase tracking-wider flex items-center"><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>全文考研逻辑解剖</span></div>
                                    <div className="space-y-6">
                                        <div><h4 className="text-[14px] font-bold text-teal-900 dark:text-teal-300 mb-2 flex items-center"><span className="mr-1.5">📌</span> 全局指代与语义连贯</h4><ul className="list-disc list-inside text-[14px] text-gray-700 dark:text-gray-300 space-y-1.5 ml-1 pl-4 marker:text-teal-400">{globalLogicData.referenceAnalysis.map((ref, idx) => <li key={idx} className="leading-relaxed">{ref}</li>)}</ul></div>
                                        <div><h4 className="text-[14px] font-bold text-teal-900 dark:text-teal-300 mb-2 flex items-center"><span className="mr-1.5">🔗</span> 宏观逻辑结构拆解</h4><p className="text-[14px] text-gray-700 dark:text-gray-300 leading-[1.8] text-justify bg-white/70 dark:bg-gray-800/70 p-4 rounded-xl border border-teal-50 dark:border-teal-900">{globalLogicData.logicalStructure}</p></div>
                                        {globalLogicData.synonymMapping?.length > 0 && (
                                            <div><h4 className="text-[14px] font-bold text-teal-900 dark:text-teal-300 mb-3 flex items-center"><span className="mr-1.5">🔄</span> 核心同义替换网络</h4><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{globalLogicData.synonymMapping.map((mapping, idx) => (<div key={idx} className="bg-white dark:bg-gray-800/70 p-3 rounded-xl border border-teal-50 dark:border-teal-900 flex flex-col shadow-sm"><span className="text-[12.5px] text-gray-400 font-mono line-through decoration-red-300 mb-1">{mapping.keyword}</span><span className="text-[14px] font-bold text-teal-700 dark:text-teal-400">{mapping.replacement}</span></div>))}</div></div>
                                        )}
                                        {globalLogicData.trapIdentification && globalLogicData.trapIdentification !== "无" && (
                                            <div><h4 className="text-[14px] font-bold text-red-700 dark:text-red-400 mb-2 flex items-center"><span className="mr-1.5">⚠️</span> 命题人陷阱预警</h4><p className="text-[14px] text-red-800/80 dark:text-red-300 leading-[1.8] bg-red-50/50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50 text-justify">{globalLogicData.trapIdentification}</p></div>
                                        )}
                                        <div className="pt-2"><h4 className="text-[14px] font-bold text-teal-900 dark:text-teal-300 mb-2 flex items-center"><span className="mr-1.5">💡</span> 全文核心主旨 (Core Meaning)</h4><p className="text-[15px] font-bold text-gray-800 dark:text-gray-200 leading-[1.8] bg-teal-100/50 dark:bg-teal-900/30 p-4 rounded-xl border-l-4 border-teal-500">{globalLogicData.coreMeaning}</p></div>
                                    </div>
                                </div>
                            )}

                            {!(layoutMode === 'split' && rightPanelOpen) && (
                            <div data-reader-inline-outline="true" className="flex flex-col items-center">
                                {!fullMapData ? (
                                    <button onClick={handleGenerateSummary} disabled={isAnalyzingMap} className={`flex items-center space-x-2 px-8 py-4 rounded-sm border transition-all ${isAnalyzingMap ? 'bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-wait' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-400 hover:shadow-sm'}`}>
                                        {isAnalyzingMap ? <svg className="animate-spin w-5 h-5 loader-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>}
                                        <span className="text-[15px] font-medium">{isAnalyzingMap ? "正在飞速生成全文逻辑树..." : "提炼全文思维导图"}</span>
                                    </button>
                                ) : (
                                    <div className="w-full space-y-4 animate-fade-in">
                                        <div className="flex flex-col gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                                            <div>
                                                <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100 flex items-center"><svg className="w-4 h-4 mr-2 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>全文结构树</h3>
                                                <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">按分支展开阅读，避免横向拖动</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-sm text-[12px] font-medium border border-gray-200 dark:border-gray-700">
                                                    <button onClick={() => setMapMode('bilingual')} className={`px-2.5 py-1 rounded-[2px] transition-colors ${mapMode === 'bilingual' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>双语</button>
                                                    <button onClick={() => setMapMode('en')} className={`px-2.5 py-1 rounded-[2px] transition-colors ${mapMode === 'en' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>英</button>
                                                    <button onClick={() => setMapMode('zh')} className={`px-2.5 py-1 rounded-[2px] transition-colors ${mapMode === 'zh' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>中</button>
                                                </div>
                                                <button onClick={expandAllMapNodes} className="h-9 px-3 rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] text-gray-600 dark:text-gray-300 hover:border-gray-500">展开全部</button>
                                                <button onClick={collapseAllMapNodes} className="h-9 px-3 rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] text-gray-600 dark:text-gray-300 hover:border-gray-500">收起全部</button>
                                                <button onClick={openMapEditorModal} className="h-9 px-3 rounded-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[12px] font-medium hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">全屏查看</button>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-50/70 dark:bg-gray-950/30 p-2 sm:p-3 border border-gray-200 dark:border-gray-700">
                                            <LogicTreeNode node={fullMapData.mindmap} isRoot={true} displayMode={mapMode} collapsedNodes={collapsedMapNodes} onToggle={toggleMapNode} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            )}
                        </article>
                        {layoutMode === 'split' && rightPanelOpen && (
                            <aside id="reader-learning-panel" tabIndex={-1} className="reader-side-panel p-3 lg:pr-4" aria-label="学习结果">
                                <div className="reader-side-shell border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-950/30 rounded-sm overflow-hidden">
                                    <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80">
                                        <div className="flex min-w-0 flex-1 items-center gap-1" role="tablist" tabIndex={-1} aria-label="学习结果分类" onKeyDown={handleTabListNavigation}>
                                        {[
                                            ['outline', '全文结构'],
                                            ['quiz', '模拟习题'],
                                            ['analysis', '精读结果'],
                                            ['notes', `学习笔记${currentAnnotations.length ? ` ${currentAnnotations.length}` : ''}`]
                                        ].map(([tab, label]) => (
                                            <button key={tab} id={`reader-tab-${tab}`} role="tab" aria-selected={rightPanelTab === tab} aria-controls={`reader-panel-${tab}`} tabIndex={rightPanelTab === tab ? 0 : -1} onClick={() => { setRightPanelTab(tab); notify(`已切换到${label}`, 'info', { duration: 0 }); }} className={`flex-1 min-h-[38px] px-2 rounded-sm text-[12px] font-medium ${rightPanelTab === tab ? 'bg-sky-700 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{label}</button>
                                        ))}
                                        </div>
                                        <button onClick={() => setRightPanelOpen(false)} aria-label="关闭侧栏" className="w-8 h-8 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">×</button>
                                    </div>
                                    <div id={`reader-panel-${rightPanelTab}`} role="tabpanel" aria-labelledby={`reader-tab-${rightPanelTab}`} tabIndex={0} className="reader-side-scroll custom-scrollbar p-4 text-[13px] text-gray-700 dark:text-gray-300">
                                        {rightPanelTab === 'outline' && (fullMapData?.mindmap ? (
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
                                            <div className="py-8 text-center"><p className="text-gray-600 dark:text-gray-300">尚未生成全文结构。</p><button onClick={handleFullOutlineTool} className="mt-4 min-h-[38px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800">生成全文结构</button></div>
                                        ))}
                                        {rightPanelTab === 'quiz' && renderPracticePanel()}
                                        {rightPanelTab === 'analysis' && renderRightPanelAnalysis()}
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
                                                                <div className="mt-3">
                                                                    <div className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">批注颜色</div>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(ANNOTATION_COLOR_MAP).map(([key, palette]) => (
                                                                            <button
                                                                                key={key}
                                                                                type="button"
                                                                                onClick={() => setAnnotationColor(key)}
                                                                                className={`w-7 h-7 rounded-full border-2 transition-transform ${annotationColor === key ? 'scale-110 border-slate-600 dark:border-white' : 'border-white dark:border-gray-700'}`}
                                                                                style={{ background: palette.border }}
                                                                                aria-label={`选择${palette.label}批注`}
                                                                                title={palette.label}
                                                                            ></button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            <textarea autoFocus aria-label="批注内容" value={annotationDraft} onChange={(event) => setAnnotationDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') saveAnnotation(); }} className="mt-3 w-full min-h-[96px] resize-y bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 p-3 outline-none focus:border-sky-500" placeholder="写下你的理解、疑问或考试提示…" />
                                                                <div className="mt-2 flex justify-end gap-2">
                                                                    <button onClick={() => { setAnnotationComposer(null); setAnnotationDraft(""); setAnnotationColor("gold"); setEditingAnnotationId(null); }} className="min-h-[34px] px-3 text-[12px] text-gray-500 hover:bg-white dark:hover:bg-gray-800 rounded-sm">取消</button>
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
                                                                {currentAnnotations.map(annotation => {
                                                                    const palette = ANNOTATION_COLOR_MAP[annotation.color || "gold"] || ANNOTATION_COLOR_MAP.gold;
                                                                    return (
                                                                    <div key={annotation.id} style={{ borderLeftColor: palette.border, borderLeftWidth: "4px" }} className={`p-3 border rounded-sm transition-colors ${activeAnnotationId === annotation.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40'}`}>
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
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div>
                                                        <textarea
                                                            aria-label="全文笔记"
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
                                </div>
                            </aside>
                        )}
                        </div>
                    )}
                </main>



                {isBatchAnalysisOpen && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5">
                        <button className="absolute inset-0 bg-slate-800/40 dark:bg-black/70 backdrop-blur-sm" onClick={() => { if (!isBatchRunning) setIsBatchAnalysisOpen(false); }} aria-label="关闭批量解析"></button>
                        <div ref={batchDialogRef} role="dialog" aria-modal="true" aria-labelledby="batch-dialog-title" tabIndex={-1} className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-sm overflow-hidden outline-none">
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                                <div><h2 id="batch-dialog-title" className="text-[16px] font-semibold">批量全文解析</h2><p className="mt-1 text-[11px] text-gray-400">串行处理，逐模块保存，已有结果自动跳过。</p></div>
                                <button onClick={() => { if (!isBatchRunning) setIsBatchAnalysisOpen(false); }} disabled={isBatchRunning} className="w-8 h-8 text-gray-400 disabled:opacity-30">×</button>
                            </div>
                            <div className="p-5 space-y-5">
                                {!isBatchRunning && batchJob?.status !== 'running' && batchJob?.status !== 'paused' && (
                                    <div>
                                        <div className="mb-2 text-[12px] font-medium text-gray-700 dark:text-gray-200">选择生成内容</div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                ['translation', '全文翻译'],
                                                ['logic', '全文逻辑'],
                                                ['outline', '结构树与思维导图'],
                                                ['quiz', '全文练习']
                                            ].map(([key, label]) => (
                                                <label key={key} className="flex items-center gap-3 min-h-[42px] px-3 border border-gray-200 dark:border-gray-700 rounded-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    <input type="checkbox" aria-label={label} checked={Boolean(batchModules[key])} onChange={event => setBatchModules(previous => ({ ...previous, [key]: event.target.checked }))} />
                                                    <span className="text-[13px]">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-950/30 rounded-sm">
                                    <div className="flex items-center justify-between text-[12px]"><span>已选择文章</span><strong>{selectedLibraryIds.length}</strong></div>
                                    {batchJob && (
                                        <div className="mt-4 space-y-2 text-[12px]">
                                            <div className="h-2 bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-label="批量解析进度" aria-valuemin="0" aria-valuemax={batchJob.articleIds?.length || selectedLibraryIds.length || 1} aria-valuenow={(batchJob.completedArticles?.length || 0) + (batchJob.failedArticles?.length || 0)}><div className="h-full bg-sky-600 transition-all" style={{ width: `${batchJob.articleIds?.length ? Math.min(100, ((batchJob.completedArticles?.length || 0) + (batchJob.failedArticles?.length || 0)) / batchJob.articleIds.length * 100) : 0}%` }}></div></div>
                                            <div className="flex justify-between text-gray-500"><span>{batchJob.status === 'paused' ? '已暂停' : batchJob.status === 'completed' ? '已完成' : batchJob.status === 'cancelled' ? '已取消' : '处理中'}</span><span>{(batchJob.completedArticles?.length || 0) + (batchJob.failedArticles?.length || 0)} / {batchJob.articleIds?.length || selectedLibraryIds.length}</span></div>
                                            {batchJob.currentTitle && <div><span className="text-gray-400">当前文章：</span>{batchJob.currentTitle}</div>}
                                            {batchJob.currentModule && <div><span className="text-gray-400">当前模块：</span>{{translation:'全文翻译',logic:'全文逻辑',outline:'结构树/导图',quiz:'全文练习'}[batchJob.currentModule] || batchJob.currentModule}</div>}
                                            <div className="grid grid-cols-3 gap-2 pt-2 text-center"><div className="p-2 bg-emerald-50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-300">成功<br/><strong>{batchJob.completedArticles?.length || 0}</strong></div><div className="p-2 bg-red-50 dark:bg-red-900/15 text-red-700 dark:text-red-300">失败<br/><strong>{batchJob.failedArticles?.length || 0}</strong></div><div className="p-2 bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-300">跳过模块<br/><strong>{batchJob.skippedModules || 0}</strong></div></div>
                                            {batchJob.failedArticles?.length > 0 && <details className="pt-2"><summary className="cursor-pointer text-red-600">查看失败原因</summary><div className="mt-2 max-h-28 overflow-auto space-y-1 text-[11px] text-red-600">{batchJob.failedArticles.map(item => <div key={item.id}>{item.title}：{(item.errors || []).join('；')}</div>)}</div></details>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-2">
                                {!isBatchRunning ? <button onClick={runBatchAnalysis} className="min-h-[40px] px-5 rounded-sm bg-sky-700 text-white text-[13px] font-medium hover:bg-sky-600">开始解析</button> : batchJob?.status === 'paused' ? <button onClick={resumeBatchAnalysis} className="min-h-[40px] px-4 rounded-sm bg-emerald-600 text-white text-[13px]">继续</button> : <button onClick={pauseBatchAnalysis} className="min-h-[40px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 text-[13px]">暂停</button>}
                                {isBatchRunning && <button onClick={cancelBatchAnalysis} className="min-h-[40px] px-4 rounded-sm border border-red-200 text-red-600 text-[13px]">取消任务</button>}
                                {!isBatchRunning && batchJob?.status === 'completed' && <button onClick={downloadSelectedArticlesMarkdown} className="min-h-[40px] px-4 rounded-sm border border-gray-200 dark:border-gray-700 text-[13px]">导出所选 Markdown</button>}
                            </div>
                        </div>
                    </div>
                )}

                {isMapModalOpen && fullMapData && (
                    <div ref={mapDialogRef} tabIndex={-1} className="fixed inset-0 z-[70] bg-[#F3F4F6] dark:bg-gray-900 flex flex-col animate-fade-in outline-none" role="dialog" aria-modal="true" aria-label="思维导图全屏">
                        <div className="min-h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2 px-3 py-2 md:px-6 shadow-sm shrink-0 z-10 sticky top-0">
                            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-900 p-1 rounded-sm border border-gray-200 dark:border-gray-700">
                                <button onClick={() => setMapScale(s => Math.max(0.5, s - 0.1))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded-[2px] text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-transform shadow-sm" aria-label="缩小导图">−</button>
                                <button onClick={() => setMapScale(1)} className="text-[12px] font-medium w-12 text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200" title="恢复默认大小">{Math.round(mapScale * 100)}%</button>
                                <button onClick={() => setMapScale(s => Math.min(2, s + 0.1))} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-800 rounded-[2px] text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-transform shadow-sm" aria-label="放大导图">+</button>
                            </div>
                            <button onClick={expandAllMapNodes} className="h-9 px-3 rounded-sm border border-gray-200 dark:border-gray-700 text-[12px] text-gray-600 dark:text-gray-300 hover:border-gray-500">展开全部</button>
                            <button onClick={collapseAllMapNodes} className="h-9 px-3 rounded-sm border border-slate-200 dark:border-gray-700 text-[12px] text-slate-600 dark:text-gray-300 hover:border-sky-300">收起全部</button>
                            {!isMapEditing ? (
                                <button onClick={() => setIsMapEditing(true)} className="h-9 px-3 rounded-sm bg-sky-50 border border-sky-200 text-sky-700 text-[12px] font-medium hover:bg-sky-100">编辑内容</button>
                            ) : (
                                <div className="flex gap-2">
                                    <button onClick={() => { setMapEditDraft(cloneJson(fullMapData)); setIsMapEditing(false); }} className="h-9 px-3 rounded-sm border border-slate-200 text-slate-600 text-[12px] hover:bg-slate-50">取消编辑</button>
                                    <button onClick={saveMapEdits} className="h-9 px-3 rounded-sm bg-sky-700 text-white text-[12px] font-medium hover:bg-sky-600">保存编辑</button>
                                </div>
                            )}
                            <div className="ml-auto text-[12px] text-gray-400 hidden md:block">{isMapEditing ? '可修改双语标题、添加或删除分支' : '点击右侧箭头展开或收起'}</div>
                            <button onClick={() => { setIsMapModalOpen(false); setIsMapEditing(false); setMapEditDraft(null); }} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-sm text-[13px] font-medium hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-transform">退出全屏</button>
                        </div>
                        <div className="flex-1 overflow-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-5xl mx-auto transition-transform duration-200 ease-out origin-top" style={{ transform: `scale(${mapScale})` }}>
                                <div className="bg-white dark:bg-gray-800 p-3 md:p-5 border border-gray-200 dark:border-gray-700">
                                    <LogicTreeNode
                                        node={(mapEditDraft || fullMapData).mindmap}
                                        isRoot={true}
                                        displayMode={mapMode}
                                        collapsedNodes={collapsedMapNodes}
                                        onToggle={toggleMapNode}
                                        isEditing={isMapEditing}
                                        onUpdateNode={updateMapDraftNode}
                                        onAddChild={addMapDraftChild}
                                        onDeleteNode={deleteMapDraftNode}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
