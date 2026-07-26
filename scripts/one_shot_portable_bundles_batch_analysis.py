from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-27-2300-portable-article-bundles-batch-analysis.md')
WORKFLOW = Path('.github/workflows/portable_bundles_batch_analysis_once.yml')
SELF = Path('scripts/one_shot_portable_bundles_batch_analysis.py')

text = INDEX.read_text(encoding='utf-8')


def replace_once(label, old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    text = text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1. Sticky offset: normal mode follows the 64px header; immersive uses top 0.
# ---------------------------------------------------------------------------
replace_once(
    'reader page shell css',
    '''        .reader-page-shell {
            overflow-x: clip;
        }
''',
    '''        .reader-page-shell {
            overflow-x: clip;
            --reader-sticky-top: 64px;
        }

        .reader-page-shell.reader-immersive {
            --reader-sticky-top: 0px;
        }

        .reader-sticky-toolbar {
            top: var(--reader-sticky-top);
        }
'''
)

replace_once(
    'immersive main css',
    '''        .reader-immersive > main {
            margin-top: 0;
        }
''',
    '''        .reader-immersive > main {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }
'''
)

replace_once(
    'side panel sticky geometry',
    '''        .reader-side-panel {
            position: -webkit-sticky;
            position: sticky;
            top: 72px;
            height: calc(100dvh - 80px);
            max-height: calc(100dvh - 80px);
            overflow: hidden;
''',
    '''        .reader-side-panel {
            position: -webkit-sticky;
            position: sticky;
            top: calc(var(--reader-sticky-top) + 8px);
            height: calc(100dvh - var(--reader-sticky-top) - 16px);
            max-height: calc(100dvh - var(--reader-sticky-top) - 16px);
            overflow: hidden;
'''
)

replace_once(
    'article toolbar sticky class',
    'className="reader-article-toolbar w-full sticky top-16 z-30 mb-7 px-3 lg:px-4 py-2.5',
    'className="reader-article-toolbar reader-sticky-toolbar w-full sticky z-30 mb-7 px-3 lg:px-4 py-2.5'
)

# ---------------------------------------------------------------------------
# 2. IndexedDB v3: article bundles and resumable batch jobs.
# ---------------------------------------------------------------------------
replace_once('db version', "const READER_DB_VERSION = 2;", "const READER_DB_VERSION = 3;")
replace_once(
    'db stores',
    '''                if (!db.objectStoreNames.contains('book-imports')) db.createObjectStore('book-imports', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('book-articles')) db.createObjectStore('book-articles', { keyPath: 'key' });
''',
    '''                if (!db.objectStoreNames.contains('book-imports')) db.createObjectStore('book-imports', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('book-articles')) db.createObjectStore('book-articles', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('article-bundles')) db.createObjectStore('article-bundles', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('batch-analysis-jobs')) db.createObjectStore('batch-analysis-jobs', { keyPath: 'key' });
'''
)

replace_once(
    'delete store helper',
    '''        const deleteReaderStore = async (storeName, key) => {
            const db = await openReaderDb();
            if (!db) return false;
            return new Promise(resolve => {
                const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        };
''',
    '''        const deleteReaderStore = async (storeName, key) => {
            const db = await openReaderDb();
            if (!db) return false;
            return new Promise(resolve => {
                const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        };

        const readAllReaderStore = async (storeName) => {
            const db = await openReaderDb();
            if (!db || !db.objectStoreNames.contains(storeName)) return [];
            return new Promise(resolve => {
                const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
                request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
                request.onerror = () => resolve([]);
            });
        };
'''
)

# ---------------------------------------------------------------------------
# 3. Portable Markdown bundle helpers (human-readable + base64 JSON block).
# ---------------------------------------------------------------------------
portable_helpers = r'''
        const ARTICLE_BUNDLE_SCHEMA_VERSION = 1;
        const ARTICLE_BUNDLE_BLOCK_LANGUAGE = 'yang-reader-data';
        const getArticleBundleKey = (articleId) => `article:${articleId}`;

        const inferArticleTitleFromText = (sourceText, fallback = '未命名文章') => {
            const lines = String(sourceText || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
            const candidate = lines.find(line => line.length >= 4 && line.length <= 160 && line.split(/\s+/).length <= 24);
            return candidate || fallback;
        };

        const safeDownloadFileName = (value, fallback = 'yang-reader-article') => {
            const cleaned = String(value || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
            return (cleaned || fallback).slice(0, 100);
        };

        const encodeUtf8Base64 = (value) => {
            const bytes = new TextEncoder().encode(String(value || ''));
            let binary = '';
            for (let offset = 0; offset < bytes.length; offset += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
            }
            return btoa(binary);
        };

        const decodeUtf8Base64 = (value) => {
            const binary = atob(String(value || '').replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            return new TextDecoder().decode(bytes);
        };

        const downloadTextFile = (fileName, content, mimeType = 'text/markdown;charset=utf-8') => {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1200);
        };

        const mindMapToMarkdown = (node, depth = 0) => {
            if (!node) return '';
            const title = [node.nameEn, node.nameZh].filter(Boolean).join(' / ') || '未命名节点';
            const line = `${'  '.repeat(depth)}- ${title}`;
            const children = Array.isArray(node.children) ? node.children : [];
            return [line, ...children.map(child => mindMapToMarkdown(child, depth + 1))].filter(Boolean).join('\n');
        };

        const logicToMarkdown = (logic) => {
            if (!logic) return '';
            const blocks = [];
            if (logic.coreMeaning) blocks.push(`### 核心主旨\n\n${logic.coreMeaning}`);
            if (logic.logicalStructure) blocks.push(`### 逻辑结构\n\n${logic.logicalStructure}`);
            if (Array.isArray(logic.referenceAnalysis) && logic.referenceAnalysis.length) blocks.push(`### 指代与连贯\n\n${logic.referenceAnalysis.map(item => `- ${item}`).join('\n')}`);
            if (Array.isArray(logic.synonymMapping) && logic.synonymMapping.length) blocks.push(`### 同义替换\n\n${logic.synonymMapping.map(item => `- ${item.keyword || ''} → ${item.replacement || ''}`).join('\n')}`);
            if (logic.trapIdentification && logic.trapIdentification !== '无') blocks.push(`### 命题陷阱\n\n${logic.trapIdentification}`);
            return blocks.join('\n\n');
        };

        const quizToMarkdown = (quiz, heading = '练习题') => {
            if (!quiz) return '';
            const options = Array.isArray(quiz.options) ? quiz.options.map(option => `- ${option.id || ''}. ${option.textEn || ''}${option.textZh ? ` / ${option.textZh}` : ''}`).join('\n') : '';
            return [
                `### ${heading}`,
                quiz.questionEn || '',
                quiz.questionZh || '',
                options,
                quiz.correctAnswerId ? `**答案：${quiz.correctAnswerId}**` : '',
                quiz.analysis ? `**解析：** ${quiz.analysis}` : ''
            ].filter(Boolean).join('\n\n');
        };

        const paragraphResultsToMarkdown = (paragraphResults = {}) => Object.entries(paragraphResults)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([index, result]) => {
                const sections = [`### 第 ${Number(index) + 1} 段`, result.sourceText ? `> ${String(result.sourceText).replace(/\n/g, '\n> ')}` : ''];
                if (result.translation) sections.push(`#### 段落翻译\n\n${result.translation}`);
                if (result.analysis) sections.push(`#### 长难句解析\n\n${JSON.stringify(result.analysis, null, 2)}`);
                if (result.quiz) sections.push(quizToMarkdown(result.quiz, '段落练习'));
                return sections.filter(Boolean).join('\n\n');
            })
            .join('\n\n');

        const articleBundleToMarkdown = (bundle, options = {}) => {
            const article = bundle?.article || {};
            const results = bundle?.results || {};
            const notes = bundle?.notes || {};
            const title = article.title || inferArticleTitleFromText(article.sourceText);
            const exportedAt = new Date(options.exportedAt || Date.now()).toLocaleString('zh-CN');
            const translations = Array.isArray(results.fullTranslations) ? results.fullTranslations.join('\n\n') : '';
            const annotations = Array.isArray(notes.annotations) ? notes.annotations : [];
            const annotationMarkdown = annotations.map((item, index) => [
                `### 批注 ${index + 1}`,
                item.anchor?.exact ? `> ${String(item.anchor.exact).replace(/\n/g, '\n> ')}` : '',
                item.note || '',
                item.color ? `颜色：${item.color}` : ''
            ].filter(Boolean).join('\n\n')).join('\n\n');
            const humanReadable = [
                `# ${title}`,
                `> 由“杨的阅读器”导出于 ${exportedAt}。本文档不包含 API Key 与语音数据。`,
                article.sourceName ? `> 来源：${article.sourceName}` : '',
                '## 英文原文',
                article.sourceText || '',
                translations ? '## 全文翻译' : '',
                translations,
                results.globalLogicData ? '## 全文逻辑解析' : '',
                logicToMarkdown(results.globalLogicData),
                results.fullMapData?.mindmap ? '## 全文结构树与思维导图数据' : '',
                results.fullMapData?.mindmap ? mindMapToMarkdown(results.fullMapData.mindmap) : '',
                results.fullQuizData ? '## 全文练习' : '',
                quizToMarkdown(results.fullQuizData, '全文练习'),
                Object.keys(results.paragraphResults || {}).length ? '## 段落解析与练习' : '',
                paragraphResultsToMarkdown(results.paragraphResults || {}),
                notes.documentNote ? '## 全文笔记' : '',
                notes.documentNote || '',
                annotations.length ? '## 批注' : '',
                annotationMarkdown
            ].filter(Boolean).join('\n\n');
            const payload = encodeUtf8Base64(JSON.stringify({ ...bundle, schemaVersion: ARTICLE_BUNDLE_SCHEMA_VERSION }));
            return `${humanReadable}\n\n\`\`\`${ARTICLE_BUNDLE_BLOCK_LANGUAGE}\n${payload}\n\`\`\`\n`;
        };

        const parseYangReaderMarkdown = (markdown) => {
            const results = [];
            const regex = /```yang-reader-data\s*([A-Za-z0-9+/=\s]+?)```/g;
            let match;
            while ((match = regex.exec(String(markdown || '')))) {
                try {
                    const parsed = JSON.parse(decodeUtf8Base64(match[1]));
                    if (parsed?.article?.sourceText) results.push(parsed);
                } catch (error) {
                    console.warn('Markdown bundle parse failed:', error);
                }
            }
            return results;
        };

        const stripYangReaderDataBlocks = (markdown) => String(markdown || '')
            .replace(/```yang-reader-data\s*[A-Za-z0-9+/=\s]+?```/g, '')
            .trim();

'''
replace_once('insert portable helpers', '        const App = () => {\n', portable_helpers + '        const App = () => {\n')

# ---------------------------------------------------------------------------
# 4. Paragraph results flow back to the article bundle and restore on reload.
# ---------------------------------------------------------------------------
replace_once(
    'paragraph signature',
    '''        const Paragraph = ({ text, paragraphIndex, annotations = [], activeAnnotationId, activeDicts, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, onOpenAnalysis, onRequestAnnotation, onFocusAnnotation }) => {
            const [showTranslation, setShowTranslation] = useState(false);
            const [localTranslation, setLocalTranslation] = useState("");
''',
    '''        const Paragraph = ({ text, paragraphIndex, annotations = [], activeAnnotationId, activeDicts, readingMode, highlightMode, translationText, isTransLoading, apiConfig, typographyConfig, savedResults = null, onPersistParagraphResult, onOpenAnalysis, onRequestAnnotation, onFocusAnnotation }) => {
            const [showTranslation, setShowTranslation] = useState(false);
            const [localTranslation, setLocalTranslation] = useState(savedResults?.translation || "");
'''
)
replace_once('analysis initial state', 'const [analysisData, setAnalysisData] = useState(null);', 'const [analysisData, setAnalysisData] = useState(savedResults?.analysis || null);')
replace_once('quiz initial state', 'const [quizData, setQuizData] = useState(null);', 'const [quizData, setQuizData] = useState(savedResults?.quiz || null);')

replace_once(
    'paragraph refs anchor',
    '''            const paragraphRef = useRef(null);
            const textRef = useRef(null);

            const isConsideredParagraph = text.split(/\s+/).filter(Boolean).length >= 15 && /[.,:;]/.test(text);
''',
    '''            const paragraphRef = useRef(null);
            const textRef = useRef(null);

            useEffect(() => {
                setLocalTranslation(savedResults?.translation || "");
                setAnalysisData(savedResults?.analysis || null);
                setQuizData(savedResults?.quiz || null);
                setShowTranslation(false);
                setShowAnalysis(false);
                setShowQuiz(false);
            }, [paragraphIndex, savedResults?.updatedAt]);

            const isConsideredParagraph = text.split(/\s+/).filter(Boolean).length >= 15 && /[.,:;]/.test(text);
'''
)

replace_once(
    'open paragraph result',
    '''            const openParagraphResult = (kind, title, data) => {
                onOpenAnalysis?.({
                    kind,
                    title,
                    paragraphIndex,
                    sourceText: text,
                    data,
                    createdAt: Date.now()
                });
            };
''',
    '''            const openParagraphResult = (kind, title, data) => {
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
'''
)

# ---------------------------------------------------------------------------
# 5. App state for bundles, library selection and batch queue.
# ---------------------------------------------------------------------------
replace_once(
    'history states',
    '''            const [history, setHistory] = useState(localState.history || []);
            const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
            const [currentHistoryId, setCurrentHistoryId] = useState(null);
            const [user, setUser] = useState(null);
''',
    '''            const [history, setHistory] = useState(localState.history || []);
            const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
            const [currentHistoryId, setCurrentHistoryId] = useState(null);
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
'''
)

# Load latest saved batch state for visibility after refresh.
replace_once(
    'fullscreen effect anchor',
    '''            useEffect(() => {
                const handleFullscreenChange = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
''',
    '''            useEffect(() => {
                readAllReaderStore('batch-analysis-jobs').then(jobs => {
                    const latest = jobs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
                    if (latest) setBatchJob(latest);
                });
            }, []);

            useEffect(() => {
                const handleFullscreenChange = () => setIsBrowserFullscreen(Boolean(document.fullscreenElement));
'''
)

# ---------------------------------------------------------------------------
# 6. Bundle persistence, Markdown import/export and batch engine.
# ---------------------------------------------------------------------------
bundle_functions = r'''

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
                downloadTextFile(fileName, articleBundleToMarkdown(bundle));
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
                    ...bundles.map((bundle, index) => `\n\n---\n\n## 备份文章 ${index + 1}\n\n${articleBundleToMarkdown(bundle)}`)
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
                                    if (bundle.results.fullQuizData) job.skippedModules += 1;
                                    else bundle.results.fullQuizData = await callGeminiQuiz(getModelSafeText(sourceText, 10000, '批量全文练习'), apiConfig);
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
'''

save_history_anchor = '''            const handleSaveCustomDict = async () => {
'''
if text.count(save_history_anchor) != 1:
    raise SystemExit('bundle functions insertion anchor not found')
text = text.replace(save_history_anchor, bundle_functions + '\n            const handleSaveCustomDict = async () => {\n', 1)

# ---------------------------------------------------------------------------
# 7. Restore bundle content when opening history, reset on new article.
# ---------------------------------------------------------------------------
old_load = '''            const loadHistoryRecord = async (record) => {
                let text = record.text || "";
                if (!text && record.localArticleKey) {
                    const stored = await readReaderStore('book-articles', record.localArticleKey);
                    text = stored?.text || "";
                }
                if (!text) {
                    window.showToast("这篇文章的本地正文已不存在", "warning");
                    return;
                }
                setInputText(text);
                setFullMapData(record.fullMapData);
                setCollapsedMapNodes(new Set());
                setFullTranslations(record.fullTranslations || []);
                setRightPanelAnalysis(null);
                setRightPanelTab('outline');
                setIsFullTextMenuOpen(false);
                setCurrentHistoryId(record.id);
                setIsReadingMode(true);
                setIsHistoryDrawerOpen(false);
                if (record.sourceType !== 'book-article' && (!record.fullTranslations || record.fullTranslations.length === 0)) {
                    fetchFullTranslation(text, record.id);
                }
            };
'''
new_load = '''            const loadHistoryRecord = async (record) => {
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
'''
replace_once('load history record', old_load, new_load)

replace_once(
    'start reading resets and title',
    '''                setFullTranslations([]);
                setRightPanelAnalysis(null);
                setRightPanelTab('outline');
                setIsFullTextMenuOpen(false);

                const newId = Date.now().toString();
                setCurrentHistoryId(newId);
                const newRecord = { 
                    id: newId, timestamp: new Date().toLocaleString('zh-CN'), 
                    text: finalContent, fullMapData: null, fullTranslations: [], createdAt: Date.now() 
                };
''',
    '''                setFullTranslations([]);
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
'''
)

# Add bundle creation for articles saved from a book import.
replace_once(
    'book article bundle write',
    '''                    await writeReaderStore('book-articles', { key: articleKey, ...article, sourceName: bookImportSession.sourceName, savedAt: createdAt });
                    records.push({
''',
    '''                    await writeReaderStore('book-articles', { key: articleKey, ...article, sourceName: bookImportSession.sourceName, savedAt: createdAt });
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
'''
)
replace_once('book record id', "id: `book-${createdAt}-${index}`,", "id: recordId,")
replace_once('book record bundle key', "localArticleKey: articleKey,\n                        sourceType: 'book-article',", "localArticleKey: articleKey,\n                        bundleKey: articleBundle.key,\n                        sourceType: 'book-article',")

# ---------------------------------------------------------------------------
# 8. Full quiz and right-panel rendering.
# ---------------------------------------------------------------------------
full_quiz_handler = r'''

            const handleFullQuizTool = async () => {
                setIsFullTextMenuOpen(false);
                openRightPanelTab('analysis');
                if (fullQuizData) {
                    setRightPanelAnalysis({ kind: 'document-quiz', title: '全文练习', data: fullQuizData, createdAt: Date.now() });
                    return fullQuizData;
                }
                setIsFullQuizLoading(true);
                setRightPanelAnalysis({ kind: 'loading', title: '全文练习', message: '正在生成全文练习…' });
                try {
                    const data = await callGeminiQuiz(getModelSafeText(inputText || defaultText, 10000, '全文练习'), apiConfig);
                    setFullQuizData(data);
                    setRightPanelAnalysis({ kind: 'document-quiz', title: '全文练习', data, createdAt: Date.now() });
                    return data;
                } catch (error) {
                    setRightPanelAnalysis({ kind: 'error', title: '全文练习', message: error.message });
                    window.showToast(`全文练习生成失败：${error.message}`, 'error');
                    return null;
                } finally {
                    setIsFullQuizLoading(false);
                }
            };
'''
replace_once('insert full quiz handler', '            const handleFullNotesTool = () => {\n', full_quiz_handler + '\n            const handleFullNotesTool = () => {\n')

replace_once(
    'document logic renderer end',
    '''                } else if (result.kind === 'document-logic') {
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
''',
    '''                } else if (result.kind === 'document-logic') {
                    const logic = result.data || {};
                    content = (
                        <div className="space-y-4">
                            {logic.coreMeaning && <div className="p-3 bg-teal-50 dark:bg-teal-900/15 border-l-2 border-teal-500"><div className="text-[11px] font-medium text-teal-700 dark:text-teal-300">核心主旨</div><p className="mt-1 leading-relaxed font-medium">{logic.coreMeaning}</p></div>}
                            {logic.logicalStructure && <div><h4 className="font-semibold text-gray-900 dark:text-gray-100">逻辑结构</h4><p className="mt-2 leading-relaxed text-gray-600 dark:text-gray-300">{logic.logicalStructure}</p></div>}
                            {logic.referenceAnalysis?.length > 0 && <div><h4 className="font-semibold text-gray-900 dark:text-gray-100">指代与连贯</h4><ul className="mt-2 space-y-1.5 list-disc pl-5">{logic.referenceAnalysis.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                            {logic.trapIdentification && logic.trapIdentification !== '无' && <div className="p-3 bg-red-50 dark:bg-red-900/15 border-l-2 border-red-400"><div className="font-semibold text-red-700 dark:text-red-300">命题陷阱</div><p className="mt-1 leading-relaxed">{logic.trapIdentification}</p></div>}
                        </div>
                    );
                } else if (result.kind === 'document-quiz') {
                    const quiz = result.data || {};
                    content = (
                        <div className="space-y-3">
                            <div><p className="font-serif font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{quiz.questionEn}</p><p className="mt-1 text-gray-500 dark:text-gray-400">{quiz.questionZh}</p></div>
                            <div className="space-y-2">{(quiz.options || []).map(option => <div key={option.id} className={`p-2.5 border rounded-sm ${option.id === quiz.correctAnswerId ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/15' : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/30'}`}><span className="font-medium">{option.id}. {option.textEn}</span>{option.textZh && <div className="mt-1 text-[11px] text-gray-500">{option.textZh}</div>}</div>)}</div>
                            {quiz.analysis && <div className="p-3 bg-violet-50 dark:bg-violet-900/15 border-l-2 border-violet-400 leading-relaxed"><span className="font-semibold">解析：</span>{quiz.analysis}</div>}
                        </div>
                    );
                }
'''
)

# ---------------------------------------------------------------------------
# 9. Markdown file input paths.
# ---------------------------------------------------------------------------
replace_once(
    'file upload handler',
    '''            const handleFileUpload = (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const pdfFiles = files.filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
''',
    '''            const handleFileUpload = async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const markdownFiles = files.filter(file => /\.md$/i.test(file.name) || /markdown/i.test(file.type));
                if (markdownFiles.length) {
                    await importMarkdownFiles(markdownFiles);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
                const pdfFiles = files.filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
'''
)
replace_once('home file accept', 'accept="image/*, application/pdf"', 'accept="image/*, application/pdf, text/markdown, .md"')

# Always-available Markdown input at page root.
replace_once(
    'page shell input anchor',
    '''                    <div className={`reader-page-shell min-h-screen bg-[#F9FAFB] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans pb-24 relative transition-colors duration-300 ${isImmersive ? 'reader-immersive' : ''}`}>
                        
''',
    '''                    <div className={`reader-page-shell min-h-screen bg-[#F9FAFB] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans pb-24 relative transition-colors duration-300 ${isImmersive ? 'reader-immersive' : ''}`}>
                        <input ref={markdownInputRef} type="file" accept="text/markdown,.md" multiple className="hidden" onChange={handleMarkdownUpload} />
                        
'''
)

# Header menu gets Markdown import.
replace_once(
    'header menu reading library button',
    '''                                                <button onClick={() => { setIsHistoryDrawerOpen(true); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">阅读库</button>
''',
    '''                                                <button onClick={() => { setIsHistoryDrawerOpen(true); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">阅读库</button>
                                                <button onClick={() => { markdownInputRef.current?.click(); setIsHeaderMenuOpen(false); }} className="w-full min-h-[42px] px-3 flex items-center rounded-sm text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">导入 Markdown 备份</button>
'''
)

# Full-text menu: full quiz and current Markdown download.
replace_once(
    'full text outline menu item',
    '''                                                        <button role="menuitem" onClick={handleFullOutlineTool} disabled={isAnalyzingMap} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文结构 / 思维导图</span><span className="text-[10px] text-gray-400">{isAnalyzingMap ? '生成中' : fullMapData ? '已有结果' : '调用模型'}</span></button>
                                                        <div className="my-1 border-t border-gray-100 dark:border-gray-800"></div>
''',
    '''                                                        <button role="menuitem" onClick={handleFullOutlineTool} disabled={isAnalyzingMap} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文结构 / 思维导图</span><span className="text-[10px] text-gray-400">{isAnalyzingMap ? '生成中' : fullMapData ? '已有结果' : '调用模型'}</span></button>
                                                        <button role="menuitem" onClick={handleFullQuizTool} disabled={isFullQuizLoading} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"><span>全文练习</span><span className="text-[10px] text-gray-400">{isFullQuizLoading ? '生成中' : fullQuizData ? '已有结果' : '调用模型'}</span></button>
                                                        <div className="my-1 border-t border-gray-100 dark:border-gray-800"></div>
'''
)
replace_once(
    'full text notes menu item',
    '''                                                        <button role="menuitem" onClick={handleFullNotesTool} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span>学习笔记</span><span className="text-[10px] text-gray-400">{currentAnnotations.length} 条批注</span></button>
''',
    '''                                                        <button role="menuitem" onClick={handleFullNotesTool} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span>学习笔记</span><span className="text-[10px] text-gray-400">{currentAnnotations.length} 条批注</span></button>
                                                        <button role="menuitem" onClick={downloadCurrentArticleMarkdown} className="w-full min-h-[42px] px-3 flex items-center justify-between gap-3 rounded-sm text-left text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"><span>下载 Markdown</span><span className="text-[10px] text-gray-400">完整备份</span></button>
'''
)

# Paragraph props include restored results and persistence callback.
replace_once(
    'paragraph props insertion',
    '''                                                typographyConfig={typographyConfig}
                                                onOpenAnalysis={(result) => { setRightPanelAnalysis(result); setRightPanelTab('analysis'); setLayoutMode('split'); setRightPanelOpen(true); }}
''',
    '''                                                typographyConfig={typographyConfig}
                                                savedResults={paragraphResults[String(idx)] || null}
                                                onPersistParagraphResult={handlePersistParagraphResult}
                                                onOpenAnalysis={(result) => { setRightPanelAnalysis(result); setRightPanelTab('analysis'); setLayoutMode('split'); setRightPanelOpen(true); }}
'''
)

# ---------------------------------------------------------------------------
# 10. Reading library multi-selection and batch controls.
# ---------------------------------------------------------------------------
replace_once('history drawer width', 'w-full max-w-sm bg-white', 'w-full max-w-xl bg-white')
replace_once(
    'history drawer close button',
    '''                                        <button onClick={() => setIsHistoryDrawerOpen(false)} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
''',
    '''                                        <div className="flex items-center gap-1">
                                            <button onClick={toggleLibrarySelectionMode} className={`min-h-[34px] px-3 text-[12px] rounded-sm border ${librarySelectionMode ? 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>{librarySelectionMode ? '退出多选' : '批量选择'}</button>
                                            <button onClick={() => setIsHistoryDrawerOpen(false)} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                        </div>
'''
)
replace_once(
    'history tip',
    '''                                        💡 提示：点击“进入精读”后，文章会自动保存到本地；如配置了 Firebase 沙盒环境，也会同步至云端。
''',
    '''                                        💡 文章正文与非语音学习结果保存在浏览器 IndexedDB；建议定期导出 Markdown 备份。批量解析默认串行并跳过已有结果。
'''
)
replace_once(
    'history card click',
    '''                                                    <div key={record.id} onClick={() => loadHistoryRecord(record)} className={`p-4 rounded-xl border cursor-pointer group transition-all ${currentHistoryId === record.id ? 'bg-sky-700 dark:bg-gray-800 border-sky-700 dark:border-gray-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-600 shadow-sm'}`}>
''',
    '''                                                    <div key={record.id} onClick={() => librarySelectionMode ? toggleLibrarySelection(record.id) : loadHistoryRecord(record)} className={`p-4 rounded-xl border cursor-pointer group transition-all ${selectedLibraryIds.includes(record.id) ? 'ring-2 ring-sky-300 border-sky-300' : ''} ${currentHistoryId === record.id ? 'bg-sky-700 dark:bg-gray-800 border-sky-700 dark:border-gray-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-600 shadow-sm'}`}>
'''
)
replace_once(
    'history card top row',
    '''                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className={`text-xs font-medium ${currentHistoryId === record.id ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>{record.timestamp}</div>
                                                            <button onClick={(e) => deleteHistoryRecord(record.id, e)} className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${currentHistoryId === record.id ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                                        </div>
''',
    '''                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {librarySelectionMode && <input type="checkbox" checked={selectedLibraryIds.includes(record.id)} onClick={event => event.stopPropagation()} onChange={() => toggleLibrarySelection(record.id)} aria-label={`选择${record.title || '文章'}`} />}
                                                                <div className={`text-xs font-medium truncate ${currentHistoryId === record.id ? 'text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>{record.timestamp}</div>
                                                            </div>
                                                            <button onClick={(e) => deleteHistoryRecord(record.id, e)} className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${currentHistoryId === record.id ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'}`}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                                                        </div>
'''
)
replace_once(
    'history badges',
    '''                                                            {record.fullMapData && <span className={`px-2 py-0.5 rounded-sm flex items-center ${currentHistoryId === record.id ? 'bg-gray-700 text-gray-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'}`}><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path></svg>已保存逻辑树</span>}
                                                            {record.fullTranslations?.length > 0 && <span className={`px-2 py-0.5 rounded-sm flex items-center ${currentHistoryId === record.id ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800'}`}><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>已缓存全局翻译</span>}
''',
    '''                                                            {(record.fullMapData || record.hasFullMap) && <span className={`px-2 py-0.5 rounded-sm flex items-center ${currentHistoryId === record.id ? 'bg-gray-700 text-gray-300' : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'}`}><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path></svg>结构已缓存</span>}
                                                            {(record.fullTranslations?.length > 0 || record.hasFullTranslations) && <span className={`px-2 py-0.5 rounded-sm flex items-center ${currentHistoryId === record.id ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800'}`}><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>翻译已缓存</span>}
                                                            {record.hasGlobalLogic && <span className="px-2 py-0.5 rounded-sm border border-teal-100 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">逻辑已缓存</span>}
                                                            {record.hasFullQuiz && <span className="px-2 py-0.5 rounded-sm border border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">练习已缓存</span>}
'''
)
replace_once(
    'history footer',
    '''                                    {history.length > 0 && <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"><button onClick={clearAllHistory} className="w-full py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">清空阅读记录</button></div>}
''',
    '''                                    {history.length > 0 && (
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
'''
)

# ---------------------------------------------------------------------------
# 11. Batch analysis modal.
# ---------------------------------------------------------------------------
batch_modal = r'''

                        {isBatchAnalysisOpen && (
                            <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5">
                                <button className="absolute inset-0 bg-slate-800/40 dark:bg-black/70 backdrop-blur-sm" onClick={() => { if (!isBatchRunning) setIsBatchAnalysisOpen(false); }} aria-label="关闭批量解析"></button>
                                <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                                        <div><h2 className="text-[16px] font-semibold">批量全文解析</h2><p className="mt-1 text-[11px] text-gray-400">串行处理，逐模块保存，已有结果自动跳过。</p></div>
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
                                                            <input type="checkbox" checked={Boolean(batchModules[key])} onChange={event => setBatchModules(previous => ({ ...previous, [key]: event.target.checked }))} />
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
                                                    <div className="h-2 bg-gray-200 dark:bg-gray-700 overflow-hidden"><div className="h-full bg-sky-600 transition-all" style={{ width: `${batchJob.articleIds?.length ? Math.min(100, ((batchJob.completedArticles?.length || 0) + (batchJob.failedArticles?.length || 0)) / batchJob.articleIds.length * 100) : 0}%` }}></div></div>
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
'''
replace_once('batch modal insertion', '                        {isMapModalOpen && fullMapData && (\n', batch_modal + '\n                        {isMapModalOpen && fullMapData && (\n')

# ---------------------------------------------------------------------------
# 12. Validation markers and task log update.
# ---------------------------------------------------------------------------
required = [
    '--reader-sticky-top: 64px',
    '.reader-page-shell.reader-immersive',
    'reader-sticky-toolbar',
    "const READER_DB_VERSION = 3;",
    "article-bundles",
    "batch-analysis-jobs",
    'ARTICLE_BUNDLE_SCHEMA_VERSION = 1',
    'articleBundleToMarkdown',
    'parseYangReaderMarkdown',
    'downloadCurrentArticleMarkdown',
    'importMarkdownFiles',
    'librarySelectionMode',
    'runBatchAnalysis',
    'downloadSelectedArticlesMarkdown',
    'onPersistParagraphResult',
    'savedResults={paragraphResults[String(idx)] || null}',
    'data-reader-mindmap-panel="true"'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing final markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

INDEX.write_text(text, encoding='utf-8')

log = LOG.read_text(encoding='utf-8')
log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
log = log.replace('## 8. 实际修改\n\n开发中。', '''## 8. 实际修改

- 使用 CSS 变量统一 Header、正文工具栏与学习侧栏的 sticky 偏移；沉浸模式偏移为 0，不再出现顶部空白横条。
- IndexedDB 升级为 v3，新增 `article-bundles` 与 `batch-analysis-jobs`。
- 新增文章 bundle schema v1，保存正文、全文翻译、全文逻辑、结构树/思维导图、全文练习、段落翻译/解析/练习、当前精读结果、批注和全文笔记；明确排除 API Key 与语音数据。
- 段落结果由 `Paragraph` 回传 App，写入当前文章 bundle，并可在重新打开或 Markdown 恢复后显示“已缓存”。
- 全文工具增加“全文练习”和“下载 Markdown”。
- Markdown 同时包含人类可读章节和 base64 编码的 `yang-reader-data` 数据块。
- 支持从主菜单或首页导入单篇/多篇 Markdown；普通 Markdown 也可作为新文章进入阅读库。
- 阅读库增加批量选择、全选、批量全文解析和批量 Markdown 导出。
- 批量模块包括全文翻译、全文逻辑、结构树/思维导图和全文练习；默认串行，逐模块写入，已有结果跳过。
- 批量任务支持暂停、继续、取消、失败原因和进度展示；任务状态保存到 IndexedDB。
- 批量导出生成一个可读且可重新导入多篇文章的 Markdown 文件。''')
log = log.replace('## 9. 测试\n\n待执行。', '''## 9. 测试

- 精确源码锚点替换：通过。
- Sticky 动态偏移标记：通过。
- IndexedDB v3 与新增 store 标记：通过。
- Markdown bundle、导入、单篇/批量导出标记：通过。
- 阅读库多选和批量队列标记：通过。
- 段落结果持久化与恢复标记：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器端真实导出、清缓存后恢复和批量 API 队列：等待用户本地验收。''')
LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
