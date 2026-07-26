from pathlib import Path

INDEX = Path('index.html')
LOG = Path('TASK_LOGS/2026-07-27-0435-header-width-pdf-fallback.md')
WORKFLOW = Path('.github/workflows/fix_reader_header_pdf_once.yml')
SELF = Path('scripts/one_shot_fix_header_pdf.py')

text = INDEX.read_text(encoding='utf-8')

old_header = '<div className="max-w-[960px] mx-auto h-16 px-3 sm:px-5 flex items-center gap-3">'
new_header = "<div className={`${isPdfMode ? 'max-w-[1400px]' : layoutMode === 'split' ? 'max-w-[1480px]' : layoutMode === 'focus' ? 'max-w-[1120px]' : 'max-w-[1200px]'} mx-auto h-16 px-3 sm:px-5 flex items-center gap-3`}>"
if old_header not in text:
    raise SystemExit('Header width anchor not found')
text = text.replace(old_header, new_header, 1)

write_anchor = '''        const writeReaderStore = async (storeName, value) => {
            const db = await openReaderDb();
            if (!db) return false;
            return new Promise(resolve => {
                const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        };
'''

delete_helper = '''
        const deleteReaderStore = async (storeName, key) => {
            const db = await openReaderDb();
            if (!db) return false;
            return new Promise(resolve => {
                const request = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        };
'''

if 'const deleteReaderStore = async' not in text:
    if write_anchor not in text:
        raise SystemExit('IndexedDB helper anchor not found')
    text = text.replace(write_anchor, write_anchor + delete_helper, 1)

start_marker = '            const extractPdfTextLocally = async (file) => {'
end_marker = '\n\n            const extractFilesToText = async (files) => {'
start = text.index(start_marker)
end = text.index(end_marker, start)

new_function = r'''            const extractPdfTextLocally = async (file) => {
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
            };'''

text = text[:start] + new_function + text[end:]

required = [
    "layoutMode === 'split' ? 'max-w-[1480px]'",
    'const deleteReaderStore = async',
    "extractionMethod: 'text-raw'",
    "await deleteReaderStore('pdf-tasks', taskKey)",
    '可读页 ${readablePages.length}'
]
missing = [marker for marker in required if marker not in text]
if missing:
    raise SystemExit(f'Missing repair markers: {missing}')
if text.count('<script') != text.count('</script>'):
    raise SystemExit('Script tag count mismatch')

INDEX.write_text(text, encoding='utf-8')

if LOG.exists():
    log = LOG.read_text(encoding='utf-8')
    log = log.replace('- 状态：开发中', '- 状态：部分完成', 1)
    log = log.replace('## 7. 实际修改\n\n开发中。', '''## 7. 实际修改

- 顶部栏宽度按首页、PDF、分栏、专注和标准模式与主体同步。
- PDF 页面先尝试结构化文字层；不足时回退到 PDF.js 原始文字层；两者均不足才调用 OCR。
- 旧缓存按页校验，空白或无效页面会重新处理，不再因为 `completedPages` 跳过整本文件。
- 单页 OCR 失败只记录错误并继续后续页面。
- 缓存记录增加 `processed`、`extractionMethod`、`error` 和诊断统计。
- 整体失败时删除无效 `pdf-tasks` 缓存，并显示可读页、OCR成功/失败、空页和页面错误数量。''')
    log = log.replace('## 8. 测试\n\n待执行。', '''## 8. 测试

- 源码锚点替换：通过
- 关键修复标记检查：通过
- HTML script 标签数量检查：通过
- `git diff --check`：由一次性工作流执行
- Babel JSX 解析：由一次性工作流执行
- 真实 920 页 PDF：等待用户本地复测''')
    log = log.replace('## 9. 未完成项\n\n开发中。', '''## 9. 未完成项

- 用户本地拉取后使用原 920 页 Economist PDF 复测。
- 根据真实诊断结果进一步调整页文本阈值或 OCR 降级策略。
- 未合并到 `main`。''')
    LOG.write_text(log, encoding='utf-8')

for disposable in (WORKFLOW, SELF):
    try:
        disposable.unlink()
    except FileNotFoundError:
        pass
