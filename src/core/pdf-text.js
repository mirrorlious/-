const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const median = (values) => {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const cleanPdfText = (text) => text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?%)\]}])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/([A-Za-z])([’'])\s+([A-Za-z]{1,2})\b/g, "$1$2$3")
    .trim();

const pdfItemsToLines = (items, pageWidth) => {
    const lines = [];
    let currentLine = null;

    const flushLine = () => {
        if (currentLine?.text?.trim()) {
            const text = cleanPdfText(currentLine.text);
            if (text) lines.push({ ...currentLine, text, width: Math.max(0, currentLine.right - currentLine.x) });
        }
        currentLine = null;
    };

    items.forEach(item => {
        const rawText = typeof item.str === "string" ? item.str.trim() : "";
        const x = Number(item.transform?.[4]) || 0;
        const y = Number(item.transform?.[5]) || 0;
        const fontSize = Math.max(1, Math.abs(Number(item.transform?.[3])) || Number(item.height) || 10);
        const itemWidth = Math.max(0, Number(item.width) || 0);

        if (currentLine) {
            const baselineChanged = Math.abs(y - currentLine.y) > Math.max(2, Math.min(fontSize, currentLine.fontSize) * 0.45);
            const separatedColumn = !baselineChanged && x - currentLine.right > Math.max(18, pageWidth * 0.035);
            if (baselineChanged || separatedColumn) flushLine();
        }

        if (rawText) {
            if (!currentLine) {
                currentLine = { text: "", x, y, right: x, fontSize };
            }
            const needsSpace = currentLine.text &&
                !/[\s-]$/.test(currentLine.text) &&
                !/^[,.;:!?%)\]}]/.test(rawText);
            currentLine.text += `${needsSpace ? " " : ""}${rawText}`;
            currentLine.x = Math.min(currentLine.x, x);
            currentLine.right = Math.max(currentLine.right, x + itemWidth);
            currentLine.fontSize = Math.max(currentLine.fontSize, fontSize);
        }

        if (item.hasEOL) flushLine();
    });
    flushLine();
    return lines;
};

const joinPdfLines = (lines) => cleanPdfText(lines.reduce((text, line) => {
    if (!text) return line.text;
    if (/[A-Za-z]-$/.test(text) && /^[a-z]/.test(line.text)) {
        return `${text.slice(0, -1)}${line.text}`;
    }
    return `${text} ${line.text}`;
}, ""));

const pdfLinesToParagraphs = (lines, pageWidth) => {
    if (lines.length === 0) return [];
    const bodyLines = lines.filter(line => line.text.split(/\s+/).length >= 5);
    const typicalFont = median((bodyLines.length ? bodyLines : lines).map(line => line.fontSize)) || 10;
    const typicalWidth = median((bodyLines.length ? bodyLines : lines).map(line => line.width)) || pageWidth * 0.28;
    const paragraphs = [];
    let current = [];

    const flushParagraph = () => {
        const paragraph = joinPdfLines(current);
        if (paragraph) paragraphs.push(paragraph);
        current = [];
    };

    lines.forEach((line, index) => {
        const previous = lines[index - 1];
        const next = lines[index + 1];
        const wordCount = line.text.split(/\s+/).filter(Boolean).length;
        const isHeading = line.fontSize > typicalFont * 1.18 ||
            (wordCount <= 12 && line.fontSize > typicalFont * 1.08 && line.width < typicalWidth * 0.82 && !/[.!?;:]\s*[”"')\]]?$/.test(line.text));
        const previousIsHeading = previous && (previous.fontSize > typicalFont * 1.2);
        const columnReset = previous && line.y > previous.y + typicalFont * 1.35;
        const sideBySideColumn = previous && Math.abs(line.y - previous.y) < typicalFont * 0.8 && Math.abs(line.x - previous.x) > pageWidth * 0.16;
        const verticalGap = previous && previous.y > line.y && previous.y - line.y > typicalFont * 1.65;
        const startsIndented = next && line.y > next.y && Math.abs(line.x - next.x) < pageWidth * 0.08 && line.x - next.x > typicalFont * 1.2;
        const previousEndsParagraph = previous && previous.width < typicalWidth * 0.76 && /[.!?][”"')\]]?$/.test(previous.text);
        const startsListItem = /^(?:[•▪●]|\d{1,2}[.)]|[A-Z][.)])\s+/.test(line.text);
        const startsNewParagraph = current.length > 0 && (
            isHeading || previousIsHeading || columnReset || sideBySideColumn || verticalGap || startsIndented || previousEndsParagraph || startsListItem
        );

        if (startsNewParagraph) flushParagraph();
        current.push(line);
        if (isHeading) flushParagraph();
    });
    flushParagraph();
    return paragraphs;
};

const getModelSafeText = (text, maxChars, actionLabel) => {
    const normalized = text.trim();
    if (normalized.length <= maxChars) return normalized;
    const candidates = [
        normalized.lastIndexOf(". ", maxChars),
        normalized.lastIndexOf("? ", maxChars),
        normalized.lastIndexOf("! ", maxChars)
    ];
    const sentenceCut = Math.max(...candidates);
    const cutAt = sentenceCut > maxChars * 0.6 ? sentenceCut + 1 : normalized.lastIndexOf(" ", maxChars);
    window.showToast(`${actionLabel}仅使用当前段落前 ${Math.round(maxChars / 1000)}k 字符，避免请求过长`, "warning");
    return normalized.slice(0, Math.max(1, cutAt)).trim();
};

const splitTextIntoChunks = (text, maxChars = 12000) => {
    const normalized = String(text || '').trim();
    if (!normalized) return [];
    const chunks = [];
    let remaining = normalized;
    while (remaining.length > maxChars) {
        const boundary = Math.max(remaining.lastIndexOf('\n\n', maxChars), remaining.lastIndexOf('. ', maxChars));
        const cutAt = boundary > maxChars * 0.55 ? boundary + (remaining[boundary] === '.' ? 1 : 0) : remaining.lastIndexOf(' ', maxChars);
        const safeCut = cutAt > 0 ? cutAt : maxChars;
        chunks.push(remaining.slice(0, safeCut).trim());
        remaining = remaining.slice(safeCut).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
};

const normalizeBookText = (text) => String(text || '')
    .replace(/\u00ad/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const isLikelyContentsPage = (text) => {
    const normalized = normalizeBookText(text);
    const lines = normalized.split('\n').filter(Boolean);
    const dottedOrNumbered = lines.filter(line => /\.{3,}\s*\d+$/.test(line) || /.+\s+\d{1,4}$/.test(line)).length;
    return /\b(table of contents|contents)\b/i.test(normalized) || /目录|目\s*录/.test(normalized) || (lines.length >= 6 && dottedOrNumbered / lines.length > 0.45);
};

const isLikelyCoverOrNoisePage = (text) => {
    const normalized = normalizeBookText(text);
    const words = normalized.match(/[A-Za-z\u4e00-\u9fff]+/g) || [];
    const letters = (normalized.match(/[A-Za-z\u4e00-\u9fff]/g) || []).length;
    const digits = (normalized.match(/\d/g) || []).length;
    return words.length < 18 || letters < 60 || (digits > letters * 0.75 && words.length < 80);
};

const getHeadingCandidate = (text) => {
    const lines = normalizeBookText(text).split(/\n+/).map(line => line.trim()).filter(Boolean);
    for (const line of lines.slice(0, 8)) {
        const words = line.split(/\s+/).filter(Boolean);
        if (words.length < 2 || words.length > 18 || line.length > 150) continue;
        if (/[.!?;:]$/.test(line)) continue;
        const alphaWords = words.filter(word => /[A-Za-z]/.test(word));
        const titleCase = alphaWords.filter(word => /^[A-Z][A-Za-z'’-]*$/.test(word)).length;
        if (/^(chapter|part|section|article)\b/i.test(line) || /^(第[一二三四五六七八九十百\d]+[章节篇部])/.test(line) || (alphaWords.length >= 2 && titleCase / alphaWords.length >= 0.55)) return line;
    }
    return '';
};

const segmentBookPages = (pages = []) => {
    const ignored = [];
    const useful = [];
    pages.forEach(page => {
        const text = normalizeBookText(page.text);
        if (isLikelyContentsPage(text)) ignored.push({ ...page, reason: '目录页' });
        else if (isLikelyCoverOrNoisePage(text)) ignored.push({ ...page, reason: '封面、插图或低信息页' });
        else useful.push({ ...page, text, heading: getHeadingCandidate(text) });
    });

    const articles = [];
    let current = null;
    const flush = () => {
        if (!current) return;
        const text = normalizeBookText(current.pages.map(page => page.text).join('\n\n'));
        const wordCount = (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|\p{Script=Han}/gu) || []).length;
        if (wordCount >= 80) {
            articles.push({
                id: `article-${articles.length + 1}`,
                title: current.title || `未命名文章 ${articles.length + 1}`,
                pageStart: current.pages[0].pageNumber,
                pageEnd: current.pages[current.pages.length - 1].pageNumber,
                text,
                wordCount,
                selected: true
            });
        }
        current = null;
    };

    useful.forEach(page => {
        const currentWords = current ? current.pages.reduce((sum, item) => sum + (item.text.match(/\S+/g) || []).length, 0) : 0;
        const startsNew = Boolean(page.heading) && current && currentWords >= 220;
        if (startsNew) flush();
        if (!current) current = { title: page.heading || '', pages: [] };
        if (!current.title && page.heading) current.title = page.heading;
        current.pages.push(page);
    });
    flush();

    if (articles.length === 1 && articles[0].wordCount > 4500) {
        const source = articles[0];
        const blocks = source.text.split(/\n{2,}/);
        const splitArticles = [];
        let buffer = [];
        let title = source.title;
        const pushBuffer = () => {
            const body = normalizeBookText(buffer.join('\n\n'));
            const count = (body.match(/[A-Za-z]+(?:['’-][A-Za-z]+)?|\p{Script=Han}/gu) || []).length;
            if (count >= 180) splitArticles.push({ title, text: body, wordCount: count });
            buffer = [];
        };
        blocks.forEach(block => {
            const heading = getHeadingCandidate(block);
            const currentCount = (buffer.join(' ').match(/\S+/g) || []).length;
            if (heading && currentCount >= 220) {
                pushBuffer();
                title = heading;
            }
            buffer.push(block);
        });
        pushBuffer();
        if (splitArticles.length > 1) {
            return {
                ignored,
                articles: splitArticles.map((item, index) => ({
                    id: `article-${index + 1}`,
                    title: item.title || `未命名文章 ${index + 1}`,
                    pageStart: source.pageStart,
                    pageEnd: source.pageEnd,
                    text: item.text,
                    wordCount: item.wordCount,
                    selected: true
                }))
            };
        }
    }
    return { ignored, articles };
};

export {
  formatFileSize,
  cleanPdfText,
  pdfItemsToLines,
  pdfLinesToParagraphs,
  getModelSafeText,
  splitTextIntoChunks,
  normalizeBookText,
  segmentBookPages
};
