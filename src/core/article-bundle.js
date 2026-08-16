import { normalizeQuizQuestions } from '../services/ai.js';

const ARTICLE_BUNDLE_SCHEMA_VERSION = 2;

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

const quizToMarkdown = (quizData, heading = '练习题') => {
    const questions = normalizeQuizQuestions(quizData);
    if (!questions.length) return '';
    return questions.map((quiz, index) => {
        const options = Array.isArray(quiz.options) ? quiz.options.map(option => `- ${option.id || ''}. ${option.textEn || ''}${option.textZh ? ` / ${option.textZh}` : ''}`).join('\n') : '';
        return [
            `### ${heading}${questions.length > 1 ? ` ${index + 1}` : ''}`,
            quiz.questionEn || '',
            quiz.questionZh || '',
            options,
            quiz.correctAnswerId ? `**答案：${quiz.correctAnswerId}**` : '',
            quiz.analysis ? `**解析：** ${quiz.analysis}` : ''
        ].filter(Boolean).join('\n\n');
    }).join('\n\n');
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
    const payloadData = {
        ...bundle,
        schemaVersion: ARTICLE_BUNDLE_SCHEMA_VERSION,
        ...(options.portablePreferences ? { portablePreferences: options.portablePreferences } : {})
    };
    const payload = encodeUtf8Base64(JSON.stringify(payloadData));
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

export {
  ARTICLE_BUNDLE_SCHEMA_VERSION,
  getArticleBundleKey,
  inferArticleTitleFromText,
  safeDownloadFileName,
  downloadTextFile,
  articleBundleToMarkdown,
  parseYangReaderMarkdown,
  stripYangReaderDataBlocks
};
