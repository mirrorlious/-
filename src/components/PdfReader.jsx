import React, { useEffect, useMemo, useRef, useState } from 'react';

const waitForPdfJs = () => {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("PDF 组件加载超时")), 15000);
        window.addEventListener('pdfjs-ready', () => {
            clearTimeout(timeout);
            resolve(window.pdfjsLib);
        }, { once: true });
    });
};

const PdfReader = ({ file, onClose, onExtract, isExtractingText, extractionProgress }) => {
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const renderTaskRef = useRef(null);
    const [pdfDocument, setPdfDocument] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [scale, setScale] = useState(1.25);
    const [fitWidth, setFitWidth] = useState(true);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRendering, setIsRendering] = useState(false);
    const [error, setError] = useState("");
    const fileUrl = useMemo(() => URL.createObjectURL(file), [file]);

    useEffect(() => () => URL.revokeObjectURL(fileUrl), [fileUrl]);

    useEffect(() => {
        const element = viewerRef.current;
        if (!element || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(entries => {
            const width = entries[0]?.contentRect?.width || 0;
            if (width) setContainerWidth(width);
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let isCancelled = false;
        let loadingTask = null;

        const loadPdf = async () => {
            setIsLoading(true);
            setError("");
            try {
                const pdfjsLib = await waitForPdfJs();
                const data = new Uint8Array(await file.arrayBuffer());
                loadingTask = pdfjsLib.getDocument({ data });
                const documentProxy = await loadingTask.promise;
                if (isCancelled) {
                    await documentProxy.destroy();
                    return;
                }
                setPdfDocument(documentProxy);
                setPageCount(documentProxy.numPages);
                setPageNumber(1);
            } catch (loadError) {
                if (!isCancelled) setError(loadError.message || "PDF 打开失败");
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };

        loadPdf();
        return () => {
            isCancelled = true;
            if (renderTaskRef.current) renderTaskRef.current.cancel();
            if (loadingTask) loadingTask.destroy();
        };
    }, [file]);

    useEffect(() => {
        if (!pdfDocument || !canvasRef.current || !containerWidth) return;
        let isCancelled = false;

        const renderPage = async () => {
            setIsRendering(true);
            try {
                if (renderTaskRef.current) renderTaskRef.current.cancel();
                const page = await pdfDocument.getPage(pageNumber);
                const baseViewport = page.getViewport({ scale: 1 });
                const renderScale = fitWidth ? Math.max(0.35, Math.min(2.5, (containerWidth - 32) / baseViewport.width)) : scale;
                const viewport = page.getViewport({ scale: renderScale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d', { alpha: false });
                const outputScale = Math.min(window.devicePixelRatio || 1, 2);
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                const transform = outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0];
                const renderTask = page.render({ canvasContext: context, viewport, transform });
                renderTaskRef.current = renderTask;
                await renderTask.promise;
            } catch (renderError) {
                if (renderError?.name !== 'RenderingCancelledException' && !isCancelled) setError(renderError.message || "页面渲染失败");
            } finally {
                if (!isCancelled) setIsRendering(false);
            }
        };

        renderPage();
        return () => {
            isCancelled = true;
            if (renderTaskRef.current) renderTaskRef.current.cancel();
        };
    }, [pdfDocument, pageNumber, scale, fitWidth, containerWidth]);

    const goToPage = (nextPage) => {
        const safePage = Math.min(pageCount || 1, Math.max(1, Number(nextPage) || 1));
        setPageNumber(safePage);
        if (viewerRef.current) viewerRef.current.scrollTop = 0;
    };

    const changeScale = (delta) => {
        setFitWidth(false);
        setScale(current => Math.min(3, Math.max(0.5, Number((current + delta).toFixed(2)))));
    };

    return (
        <section className="min-h-[calc(100vh-4rem)] bg-gray-200 dark:bg-gray-950" aria-label="PDF 阅读器" aria-busy={isLoading || isRendering || isExtractingText}>
            <div className="sticky top-16 z-30 min-h-[58px] px-2 sm:px-4 py-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-2">
                <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="关闭 PDF">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div className="min-w-0 flex-1 sm:flex-none sm:w-56">
                    <div className="truncate text-[13px] font-semibold text-gray-800 dark:text-gray-100" title={file.name}>{file.name}</div>
                    <div className="text-[11px] text-gray-400">PDF 原样阅读 · 仅本地打开</div>
                </div>
                <div className="order-3 sm:order-none w-full sm:w-auto flex items-center justify-center gap-1">
                    <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} className="w-10 h-10 grid place-items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" aria-label="上一页"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg></button>
                    <label className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                        <input type="number" min="1" max={pageCount || 1} value={pageNumber} onChange={e => goToPage(e.target.value)} className="w-14 h-9 text-center rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none" aria-label="当前页码" />
                        <span>/ {pageCount || '-'}</span>
                    </label>
                    <button onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= pageCount} className="w-10 h-10 grid place-items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30" aria-label="下一页"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg></button>
                    <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></span>
                    <button onClick={() => changeScale(-0.15)} className="w-10 h-10 grid place-items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="缩小"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 12h12"></path></svg></button>
                    <button onClick={() => setFitWidth(true)} className={`h-10 px-3 rounded-sm text-[12px] font-medium ${fitWidth ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>适宽</button>
                    <button onClick={() => changeScale(0.15)} className="w-10 h-10 grid place-items-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="放大"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v12m6-6H6"></path></svg></button>
                </div>
                <div className="ml-auto flex items-center gap-1">
                    <button onClick={onExtract} disabled={isExtractingText} className="hidden md:inline-flex h-10 px-3 items-center rounded-md text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50" title="在浏览器本地逐页提取文字">
                        {isExtractingText ? `本地提取 ${extractionProgress.current}/${extractionProgress.total || '-'}` : "转为精读文本"}
                    </button>
                    <a href={fileUrl} download={file.name} className="w-10 h-10 grid place-items-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="下载 PDF" title="下载 PDF"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"></path></svg></a>
                </div>
            </div>
            <div ref={viewerRef} className="relative min-h-[calc(100vh-7.65rem)] overflow-auto px-4 py-6 sm:p-8">
                {(isLoading || isRendering) && <div role="status" className="fixed right-4 bottom-4 z-20 px-3 py-2 rounded-sm bg-gray-900 text-white text-[12px] shadow-lg">{isLoading ? "正在打开 PDF..." : "正在渲染页面..."}</div>}
                {error ? (
                    <div role="alert" className="max-w-lg mx-auto mt-16 p-5 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-lg text-center"><div className="font-semibold text-red-600 dark:text-red-400">PDF 无法打开</div><div className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">{error}</div></div>
                ) : (
                    <canvas ref={canvasRef} role="img" className="block mx-auto bg-white shadow-lg" aria-label={`PDF 第 ${pageNumber} 页`}></canvas>
                )}
            </div>
        </section>
    );
};

export {
  waitForPdfJs,
  PdfReader
};
