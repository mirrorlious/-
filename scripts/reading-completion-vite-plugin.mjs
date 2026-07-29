function fail(label, detail) {
  throw new Error(`[reading-completion] ${label}: ${detail}`);
}

function replaceOnce(source, oldText, newText, label) {
  const first = source.indexOf(oldText);
  if (first < 0) fail(label, 'marker not found');
  if (source.indexOf(oldText, first + oldText.length) >= 0) fail(label, 'marker is not unique');
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

function replaceRegexInSection(source, sectionStart, sectionEnd, pattern, replacement, label) {
  const start = source.indexOf(sectionStart);
  if (start < 0) fail(label, `section start not found: ${sectionStart}`);
  const end = source.indexOf(sectionEnd, start);
  if (end < 0) fail(label, `section end not found: ${sectionEnd}`);

  const section = source.slice(start, end);
  const matches = [...section.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) fail(label, `expected 1 match, found ${matches.length}`);

  const nextSection = section.replace(pattern, replacement);
  return source.slice(0, start) + nextSection + source.slice(end);
}

const completionHelpers = [
  '    const formatReadingCompletionDate = (value) => {',
  '        const date = new Date(value);',
  "        if (Number.isNaN(date.getTime())) return '';",
  '        const year = String(date.getFullYear()).slice(-2);',
  "        const month = String(date.getMonth() + 1).padStart(2, '0');",
  "        const day = String(date.getDate()).padStart(2, '0');",
  '        return `${year}/${month}/${day}`;',
  '    };',
  '',
  '    const toggleReadingCompletion = async (recordId, event) => {',
  '        event?.stopPropagation();',
  '        if (!recordId) return;',
  '        const record = history.find(item => item.id === recordId);',
  '        if (!record) {',
  "            window.showToast('未找到这篇文章的阅读记录', 'warning');",
  '            return;',
  '        }',
  '',
  '        const completedAt = record.completedAt ? null : Date.now();',
  '        await saveHistoryToCloud({ ...record, completedAt });',
  '',
  '        try {',
  '            const bundleKey = record.bundleKey || getArticleBundleKey(recordId);',
  "            const bundle = await readReaderStore('article-bundles', bundleKey);",
  '            if (bundle) {',
  "                await writeReaderStore('article-bundles', {",
  '                    ...bundle,',
  '                    metadata: {',
  '                        ...(bundle.metadata || {}),',
  '                        completedAt,',
  '                        updatedAt: Date.now()',
  '                    }',
  '                });',
  '            }',
  '        } catch (error) {',
  "            console.warn('Reading completion bundle update failed:', error);",
  '        }',
  '',
  "        window.showToast(completedAt ? '已标记为完成阅读' : '已取消完成阅读', 'success');",
  '    };',
  '',
  ''
].join('\n');

const readerToolbarButton = [
  '                                <button',
  '                                    type="button"',
  '                                    onClick={(event) => toggleReadingCompletion(currentHistoryId, event)}',
  '                                    disabled={!currentHistoryId}',
  "                                    className={`min-h-[36px] shrink-0 px-3 inline-flex items-center gap-1.5 rounded-sm border text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${currentArticleCompletedAt ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-emerald-700 dark:hover:text-emerald-300'}`}",
  '                                    aria-pressed={Boolean(currentArticleCompletedAt)}',
  "                                    title={currentArticleCompletedAt ? `已完成于 ${formatReadingCompletionDate(currentArticleCompletedAt)}，点击取消` : '标记为完成阅读'}",
  '                                >',
  '                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" d="M5 12.5l4 4L19 6.5"></path></svg>',
  "                                    <span>{currentArticleCompletedAt ? '已完成' : '完成阅读'}</span>",
  '                                </button>',
  '',
  '                                <div ref={fullTextMenuContainerRef} className="relative shrink-0">'
].join('\n');

const libraryCompletionLabel = [
  "                                                <div className={`text-[13.5px] leading-relaxed font-serif ${currentHistoryId === record.id ? 'text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>{record.title || window.getExcerpt(record.text || record.preview || '')}</div>",
  '                                                {record.completedAt && (',
  "                                                    <div className={`mt-2 text-[10.5px] font-medium tracking-wide ${currentHistoryId === record.id ? 'text-emerald-200' : 'text-emerald-700 dark:text-emerald-300'}`}>",
  '                                                        ✓ 已完成阅读 {formatReadingCompletionDate(record.completedAt)}',
  '                                                    </div>',
  '                                                )}',
  '                                                <div className="mt-3 flex flex-wrap gap-2 items-center text-[10px] font-medium">'
].join('\n');

const libraryCompletionButton = [
  '                                                    {record.hasFullQuiz && <span className="px-2 py-0.5 rounded-sm border border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">练习已缓存</span>}',
  '                                                    <button',
  '                                                        type="button"',
  '                                                        onClick={(event) => toggleReadingCompletion(record.id, event)}',
  "                                                        className={`ml-auto min-h-[28px] px-2.5 rounded-sm border text-[10px] font-medium transition-colors ${record.completedAt ? (currentHistoryId === record.id ? 'border-emerald-300/60 text-emerald-200 hover:bg-white/10' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300') : (currentHistoryId === record.id ? 'border-white/30 text-white hover:bg-white/10' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300')}`}",
  "                                                        aria-label={`${record.completedAt ? '取消完成' : '完成阅读'}：${record.title || '未命名文章'}`}",
  '                                                    >',
  "                                                        {record.completedAt ? '取消完成' : '完成阅读'}",
  '                                                    </button>',
  '                                                </div>'
].join('\n');

export function applyReadingCompletionTransform(source) {
  let code = source;

  if (!code.includes('const toggleReadingCompletion = async')) {
    const marker = '    const getRecordSourceText = async (record) => {';
    const index = code.indexOf(marker);
    if (index < 0) fail('completion helpers', 'insertion marker not found');
    code = code.slice(0, index) + completionHelpers + code.slice(index);
  }

  if (!code.includes('completedAt: existing?.metadata?.completedAt || record?.completedAt || null')) {
    code = replaceRegexInSection(
      code,
      '    const buildBundleFromRecord = async',
      '    const updateHistoryBundleMeta =',
      /(\s*promptVersion: CACHE_PROMPT_VERSION,\n)(\s*)updatedAt: Date\.now\(\)/,
      '$1$2completedAt: existing?.metadata?.completedAt || record?.completedAt || null,\n$2updatedAt: Date.now()',
      'bundle completion metadata'
    );
  }

  if (!code.includes('completedAt: bundle.metadata?.completedAt || existing.completedAt || null')) {
    code = replaceRegexInSection(
      code,
      '    const updateHistoryBundleMeta =',
      '    const buildCurrentArticleBundle =',
      /(\s*hasFullQuiz: Boolean\(bundle\.results\?\.fullQuizData\),\n)(\s*)updatedAt: Date\.now\(\)/,
      '$1$2completedAt: bundle.metadata?.completedAt || existing.completedAt || null,\n$2updatedAt: Date.now()',
      'history bundle completion metadata'
    );
  }

  if (!code.includes('completedAt: record.completedAt || base.metadata?.completedAt || null')) {
    code = replaceRegexInSection(
      code,
      '    const buildCurrentArticleBundle =',
      '    const persistCurrentArticleBundle =',
      /(\s*promptVersion: CACHE_PROMPT_VERSION,\n)(\s*)updatedAt: Date\.now\(\)/,
      '$1$2completedAt: record.completedAt || base.metadata?.completedAt || null,\n$2updatedAt: Date.now()',
      'current bundle completion metadata'
    );
  }

  if (!code.includes('completedAt: bundle.metadata?.completedAt || null')) {
    code = replaceRegexInSection(
      code,
      '    const importMarkdownFiles = async',
      '    const handleMarkdownUpload = async',
      /(\s*hasFullMap: Boolean\(bundle\.results\.fullMapData\),\n)(\s*)hasFullQuiz: Boolean\(bundle\.results\.fullQuizData\)/,
      '$1$2hasFullQuiz: Boolean(bundle.results.fullQuizData),\n$2completedAt: bundle.metadata?.completedAt || null',
      'markdown completion restore'
    );
  }

  if (!code.includes('const currentArticleCompletedAt =')) {
    code = replaceOnce(
      code,
      [
        '    const currentArticleTitle = currentHistoryId',
        "        ? (history.find(item => item.id === currentHistoryId)?.title || inferArticleTitleFromText(inputText))",
        '        : inferArticleTitleFromText(inputText);'
      ].join('\n'),
      [
        '    const currentHistoryRecord = currentHistoryId',
        '        ? history.find(item => item.id === currentHistoryId)',
        '        : null;',
        '    const currentArticleCompletedAt = currentHistoryRecord?.completedAt || null;',
        '    const currentArticleTitle = currentHistoryId',
        '        ? (currentHistoryRecord?.title || inferArticleTitleFromText(inputText))',
        '        : inferArticleTitleFromText(inputText);'
      ].join('\n'),
      'current completion state'
    );
  }

  if (!code.includes('aria-pressed={Boolean(currentArticleCompletedAt)}')) {
    code = replaceOnce(
      code,
      '                                <div ref={fullTextMenuContainerRef} className="relative shrink-0">',
      readerToolbarButton,
      'reader completion button'
    );
  }

  if (!code.includes('✓ 已完成阅读 {formatReadingCompletionDate(record.completedAt)}')) {
    code = replaceOnce(
      code,
      [
        "                                                <div className={`text-[13.5px] leading-relaxed font-serif ${currentHistoryId === record.id ? 'text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>{record.title || window.getExcerpt(record.text || record.preview || '')}</div>",
        '                                                <div className="mt-3 flex flex-wrap gap-2 items-center text-[10px] font-medium">'
      ].join('\n'),
      libraryCompletionLabel,
      'library completion label'
    );
  }

  if (!code.includes('toggleReadingCompletion(record.id, event)')) {
    code = replaceOnce(
      code,
      [
        '                                                    {record.hasFullQuiz && <span className="px-2 py-0.5 rounded-sm border border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">练习已缓存</span>}',
        '                                                </div>'
      ].join('\n'),
      libraryCompletionButton,
      'library completion button'
    );
  }

  return code;
}

export function readingCompletionPlugin() {
  return {
    name: 'yang-reader-reading-completion',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0];
      if (!normalizedId.endsWith('/src/App.jsx')) return null;
      return {
        code: applyReadingCompletionTransform(source),
        map: null
      };
    }
  };
}
