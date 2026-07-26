from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-27-0610-full-width-icon-toolbar-sticky-sidebar.md')
WORKFLOW = Path('.github/workflows/apply_fullwidth_icon_layout_once.yml')
SELF = Path('scripts/one_shot_fullwidth_icon_layout.py')

text = INDEX.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    text = text.replace(old, new, 1)


replace_once(
'''        .reader-workspace-split {
            display: grid;
            grid-template-columns: minmax(0, 58fr) minmax(380px, 42fr);
            gap: 24px;
            align-items: start;
        }
''',
'''        .reader-workspace-split {
            display: grid;
            grid-template-columns: minmax(0, 58fr) minmax(360px, 42fr);
            gap: clamp(12px, 1.2vw, 20px);
            align-items: start;
            width: 100%;
            padding-inline: clamp(8px, 1vw, 18px);
        }
''',
'full-width split workspace'
)

replace_once(
'''        .reader-article-flow > .reader-article-toolbar,
        .reader-article-flow > .reader-article-wide {
            max-width: none;
        }

        .reader-side-panel {
            position: sticky;
            top: 80px;
            max-height: calc(100vh - 104px);
            overflow: auto;
        }
''',
'''        .reader-article-flow > .reader-article-toolbar,
        .reader-article-flow > .reader-article-wide,
        .reader-article-flow > .reader-article-body-wide {
            max-width: none;
            width: 100%;
        }

        .reader-article-columns {
            column-count: 2;
            column-gap: clamp(28px, 3vw, 52px);
            column-rule: 1px solid rgba(203, 213, 225, 0.72);
        }

        .dark .reader-article-columns {
            column-rule-color: rgba(71, 85, 105, 0.72);
        }

        .reader-article-columns > [data-reader-paragraph="true"] {
            break-inside: avoid-column;
            page-break-inside: avoid;
            display: inline-block;
            width: 100%;
        }

        .reader-side-panel {
            position: sticky;
            top: 72px;
            height: calc(100vh - 80px);
            max-height: none;
            overflow: hidden;
            align-self: start;
            min-height: 0;
        }

        .reader-side-shell {
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .reader-side-scroll {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
        }
''',
'article columns and sticky sidebar CSS'
)

replace_once(
'''        @media (max-width: 1199px) {
            .reader-workspace-split {
                display: block;
            }

            .reader-side-panel {
                position: static;
                max-height: none;
                margin-top: 24px;
            }
        }
''',
'''        @media (max-width: 1439px) {
            .reader-article-columns {
                column-count: 1;
                column-rule: 0;
            }
        }

        @media (max-width: 1199px) {
            .reader-workspace-split {
                display: block;
                padding-inline: 0;
            }

            .reader-side-panel {
                position: static;
                height: auto;
                max-height: none;
                margin-top: 24px;
                overflow: visible;
            }

            .reader-side-shell {
                height: auto;
            }

            .reader-side-scroll {
                overflow: visible;
            }
        }
''',
'responsive sidebar and columns CSS'
)

replace_once(
'''            const [layoutMode, setLayoutMode] = useState(['standard', 'split', 'focus'].includes(savedLayoutState.layoutMode) ? savedLayoutState.layoutMode : defaultLayoutMode);
            const [rightPanelTab, setRightPanelTab] = useState(['outline', 'analysis', 'notes'].includes(savedLayoutState.rightPanelTab) ? savedLayoutState.rightPanelTab : 'outline');
''',
'''            const [layoutMode, setLayoutMode] = useState(['standard', 'split', 'focus'].includes(savedLayoutState.layoutMode) ? savedLayoutState.layoutMode : defaultLayoutMode);
            const defaultArticleColumnMode = typeof window !== 'undefined' && window.innerWidth >= 1440 ? 'double' : 'single';
            const [articleColumnMode, setArticleColumnMode] = useState(['single', 'double'].includes(savedLayoutState.articleColumnMode) ? savedLayoutState.articleColumnMode : defaultArticleColumnMode);
            const [rightPanelTab, setRightPanelTab] = useState(['outline', 'analysis', 'notes'].includes(savedLayoutState.rightPanelTab) ? savedLayoutState.rightPanelTab : 'outline');
''',
'article column state'
)

replace_once(
'''            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, rightPanelTab, rightPanelOpen, splitRatio } });
            }, [layoutMode, rightPanelTab, rightPanelOpen, splitRatio]);
''',
'''            useEffect(() => {
                persistLocalState({ layoutState: { layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio } });
            }, [layoutMode, articleColumnMode, rightPanelTab, rightPanelOpen, splitRatio]);
''',
'persist article column mode'
)

replace_once(
'''            const paragraphs = useMemo(() => inputText.split(/\n+/).filter(p => p.trim() !== ''), [inputText]);
''',
'''            const readerToolbarIconClass = (active = false) => `w-9 h-9 shrink-0 grid place-items-center rounded-sm border transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${active ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-700' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-sky-700 dark:hover:text-sky-300'}`;

            const paragraphs = useMemo(() => inputText.split(/\n+/).filter(p => p.trim() !== ''), [inputText]);
''',
'icon button class helper'
)

replace_once(
'''                            <div className={`${isPdfMode ? 'max-w-[1400px]' : layoutMode === 'split' ? 'max-w-[1480px]' : layoutMode === 'focus' ? 'max-w-[1120px]' : 'max-w-[1200px]'} mx-auto h-16 px-3 sm:px-5 flex items-center gap-3`}>
''',
'''                            <div className="w-full max-w-none mx-auto h-16 px-4 lg:px-6 xl:px-8 flex items-center gap-3">
''',
'full-width header'
)

replace_once(
'''                        <main className={`${isPdfMode ? 'max-w-[1400px] sm:my-4' : layoutMode === 'split' ? 'max-w-[1480px] sm:my-8' : layoutMode === 'focus' ? 'max-w-[1120px] sm:my-8' : 'max-w-[1200px] sm:my-8'} mx-auto bg-white dark:bg-gray-900 sm:border border-gray-200 dark:border-gray-800 sm:rounded-sm min-h-[85vh] transition-colors overflow-hidden`}>
''',
'''                        <main className={`${isReadingMode || isPdfMode ? 'w-full max-w-none my-0 sm:my-0 sm:border-x-0 sm:rounded-none min-h-[calc(100vh-64px)]' : 'max-w-[1200px] sm:my-8'} mx-auto bg-white dark:bg-gray-900 sm:border border-gray-200 dark:border-gray-800 sm:rounded-sm min-h-[85vh] transition-colors overflow-hidden`}>
''',
'full-width reading main'
)

replace_once(
'''                                <article className="reader-main-column reader-article-flow py-8 animate-fade-in relative transition-all" style={{ '--reader-measure': `${typographyConfig.measure || 66}ch`, paddingLeft: `clamp(16px, ${typographyConfig.paddingX || 6}vw, 96px)`, paddingRight: `clamp(16px, ${typographyConfig.paddingX || 6}vw, 96px)` }}>
''',
'''                                <article className="reader-main-column reader-article-flow py-6 lg:py-8 animate-fade-in relative transition-all" style={{ '--reader-measure': `${typographyConfig.measure || 66}ch`, paddingLeft: `clamp(18px, 2.4vw, 44px)`, paddingRight: `clamp(18px, 2.4vw, 44px)` }}>
''',
'reduce article outer padding'
)

toolbar_start = text.index('                                    <div className="reader-article-toolbar')
toolbar_end_marker = '\n\n                                    <div className="space-y-4 border-b border-gray-100 dark:border-gray-800 pb-16 mb-12">'
toolbar_end = text.index(toolbar_end_marker, toolbar_start)

new_toolbar = r'''                                    <div className="reader-article-toolbar w-full sticky top-16 z-30 mb-7 px-3 lg:px-4 py-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-end gap-2">
                                        <div className="flex items-center gap-1 rounded-sm border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70 p-1" role="group" aria-label="阅读模式">
                                            <button onClick={() => setReadingMode('pure')} className={readerToolbarIconClass(readingMode === 'pure')} aria-label="纯净阅读" title="纯净阅读">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 5.5A2.5 2.5 0 016.5 3H11v16H6.5A2.5 2.5 0 004 21.5v-16zm16 0A2.5 2.5 0 0017.5 3H13v16h4.5a2.5 2.5 0 012.5 2.5v-16z"></path></svg>
                                            </button>
                                            <button onClick={() => setReadingMode('intensive')} className={readerToolbarIconClass(readingMode === 'intensive')} aria-label="深度精读" title="深度精读">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zm6 11l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14zM6 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"></path></svg>
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-1 rounded-sm border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70 p-1" role="group" aria-label="页面布局">
                                            <button onClick={() => setLayoutMode('standard')} className={readerToolbarIconClass(layoutMode === 'standard')} aria-label="标准布局" title="标准布局">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1.5" strokeWidth="1.8"></rect><path strokeLinecap="round" strokeWidth="1.8" d="M8 9h8M8 13h8M8 17h5"></path></svg>
                                            </button>
                                            <button onClick={() => setLayoutMode('split')} className={readerToolbarIconClass(layoutMode === 'split')} aria-label="正文与侧栏分栏" title="正文与侧栏分栏">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="1.5" strokeWidth="1.8"></rect><path strokeWidth="1.8" d="M14 5v14"></path></svg>
                                            </button>
                                            <button onClick={() => setLayoutMode('focus')} className={readerToolbarIconClass(layoutMode === 'focus')} aria-label="专注布局" title="专注布局">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="7" y="4" width="10" height="16" rx="1.5" strokeWidth="1.8"></rect><path strokeLinecap="round" strokeWidth="1.8" d="M9.5 8h5M9.5 12h5M9.5 16h3"></path></svg>
                                            </button>
                                            <button onClick={() => setArticleColumnMode(previous => previous === 'double' ? 'single' : 'double')} className={readerToolbarIconClass(articleColumnMode === 'double')} aria-label={articleColumnMode === 'double' ? '切换为文章单栏' : '切换为文章双栏'} title={articleColumnMode === 'double' ? '文章双栏已开启' : '文章单栏'}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="16" rx="1.5" strokeWidth="1.8"></rect><path strokeWidth="1.8" d="M12 4v16"></path><path strokeLinecap="round" strokeWidth="1.5" d="M6.5 8h3M6.5 11h3M14.5 8h3M14.5 11h3M6.5 14h3M14.5 14h3"></path></svg>
                                            </button>
                                            <button onClick={() => setRightPanelOpen(previous => !previous)} disabled={layoutMode !== 'split'} className={readerToolbarIconClass(layoutMode === 'split' && rightPanelOpen)} aria-label={rightPanelOpen ? '隐藏学习侧栏' : '显示学习侧栏'} title={layoutMode !== 'split' ? '请先切换到分栏布局' : rightPanelOpen ? '隐藏学习侧栏' : '显示学习侧栏'}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="1.5" strokeWidth="1.8"></rect><path strokeWidth="1.8" d="M15 5v14"></path><path strokeLinecap="round" strokeWidth="1.5" d="M17.5 9h1M17.5 12h1M17.5 15h1"></path></svg>
                                            </button>
                                            <button onClick={toggleBrowserFullscreen} className={readerToolbarIconClass(isBrowserFullscreen)} aria-label={isBrowserFullscreen ? '退出浏览器全屏' : '浏览器全屏'} title={isBrowserFullscreen ? '退出浏览器全屏' : '浏览器全屏'}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 4H4v4m12-4h4v4M8 20H4v-4m12 4h4v-4"></path></svg>
                                            </button>
                                            <button onClick={() => setIsImmersive(previous => !previous)} className={readerToolbarIconClass(isImmersive)} aria-label={isImmersive ? '退出沉浸模式' : '沉浸模式'} title={isImmersive ? '退出沉浸模式' : '沉浸模式'}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.5" strokeWidth="1.8"></circle></svg>
                                            </button>
                                        </div>

                                        {readingMode === 'intensive' && (
                                            <select value={highlightMode} onChange={(event) => setHighlightMode(event.target.value)} aria-label="词汇高亮范围" title="词汇高亮范围" className="h-9 w-[112px] px-2 rounded-sm text-[12px] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 outline-none focus:border-sky-400 cursor-pointer">
                                                <option value="red">考研生词</option>
                                                <option value="both">全部词汇</option>
                                                <option value="blue">基础词汇</option>
                                                <option value="none">关闭高亮</option>
                                            </select>
                                        )}

                                        <div ref={fullTextMenuRef} className="relative shrink-0">
                                            <button type="button" data-reader-fulltext-trigger="true" onClick={() => setIsFullTextMenuOpen(previous => !previous)} aria-haspopup="menu" aria-expanded={isFullTextMenuOpen} className={readerToolbarIconClass(isFullTextMenuOpen)} aria-label="全文工具" title="全文工具">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 12h6M9 16h6"></path><path strokeLinecap="round" strokeWidth="1.5" d="M18.5 11.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z"></path></svg>
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

text = text[:toolbar_start] + new_toolbar + text[toolbar_end:]

replace_once(
'''                                    <div className="space-y-4 border-b border-gray-100 dark:border-gray-800 pb-16 mb-12">
''',
'''                                    <div className={`reader-article-body ${articleColumnMode === 'double' ? 'reader-article-body-wide reader-article-columns' : 'space-y-4'} border-b border-gray-100 dark:border-gray-800 pb-16 mb-12`}>
''',
'article single/double body'
)

replace_once(
'''                                    <aside className="reader-side-panel px-4 pb-8 sm:px-0 sm:pr-6" aria-label="Reader learning panel">
                                        <div className="border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-950/30 rounded-sm overflow-hidden">
''',
'''                                    <aside className="reader-side-panel p-3 lg:pr-4" aria-label="Reader learning panel">
                                        <div className="reader-side-shell border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-950/30 rounded-sm overflow-hidden">
''',
'sticky side shell'
)

replace_once(
'''                                            <div className="p-4 text-[13px] text-gray-700 dark:text-gray-300">
''',
'''                                            <div className="reader-side-scroll custom-scrollbar p-4 text-[13px] text-gray-700 dark:text-gray-300">
''',
'side panel internal scroll'
)

required = [
    'const [articleColumnMode, setArticleColumnMode]',
    'readerToolbarIconClass',
    'reader-article-columns',
    'data-reader-fulltext-trigger="true"',
    'aria-label="标准布局"',
    'aria-label="正文与侧栏分栏"',
    'aria-label="专注布局"',
    'reader-side-shell',
    'reader-side-scroll custom-scrollbar',
    "articleColumnMode === 'double' ? 'reader-article-body-wide reader-article-columns'",
    "isReadingMode || isPdfMode ? 'w-full max-w-none"
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing full-width/icon markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')
if 'max-w-[1480px] sm:my-8' in text:
    raise SystemExit('Old constrained split main width still present')

INDEX.write_text(text, encoding='utf-8')

if LOG.exists():
    log = LOG.read_text(encoding='utf-8')
    log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
    log = log.replace('## 7. 实际修改\n\n开发中。', '''## 7. 实际修改

- 阅读模式和 PDF 模式取消外层最大宽度，主界面铺满浏览器可用宽度。
- Header 同步改为全宽，正文左右内边距收窄，减少大屏无意义留白。
- 工具栏所有控制统一右对齐；阅读模式、布局模式、文章栏数、侧栏、全屏、沉浸和全文工具使用图标按钮。
- 每个图标按钮保留 `aria-label` 与 `title`，键盘和辅助技术仍可识别。
- 新增文章单栏/双栏状态；1440px 以上首次默认双栏，并保存到本地布局偏好。
- 双栏正文使用报刊式先左后右顺序，段落通过 `break-inside` 尽量避免跨栏断开。
- 右侧学习面板改为固定视口高度的 sticky 容器；标签栏保持在上方，内容区域独立滚动。
- 1200px 以下恢复普通文档流，避免窄屏强制侧栏或双栏。''')
    log = log.replace('## 8. 测试\n\n待执行。', '''## 8. 测试

- 旧 `max-w-[1480px]` 阅读主容器移除检查：通过。
- 全宽主界面、图标按钮和双栏状态标记检查：通过。
- Sticky 侧栏 shell 与内部滚动标记检查：通过。
- HTML script 标签数量检查：通过。
- `git diff --check`：由一次性工作流执行。
- Babel JSX 解析：由一次性工作流执行。
- 浏览器真实视觉与滚动：等待用户本地验收。''')
    log = log.replace('## 9. 未完成项\n\n开发中。', '''## 9. 未完成项

- 用户本地验收 1440px、1600px、1920px 三种宽度下的文章双栏密度。
- 用户验收侧栏内部滚动、标签栏可见性以及导图长内容表现。
- 根据真实屏幕观感微调正文/侧栏比例和图标间距。
- 未合并到 `main`。''')
    LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
