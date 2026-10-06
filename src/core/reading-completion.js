import { getArticleBundleKey } from './article-bundle.js';
import { readReaderStore, writeReaderStore } from './persistence.js';

export const formatReadingCompletionDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
};

export const updateReadingCompletion = async (record, saveHistory) => {
    const completedAt = record.completedAt ? null : Date.now();
    await saveHistory({ ...record, completedAt });
    const bundleKey = record.bundleKey || getArticleBundleKey(record.id);
    const bundle = await readReaderStore('article-bundles', bundleKey);
    if (bundle) {
        const saved = await writeReaderStore('article-bundles', {
            ...bundle,
            metadata: { ...bundle.metadata, completedAt, updatedAt: Date.now() }
        });
        if (!saved) window.showToast?.('阅读状态已更新，但本地备份保存失败，请重新导出备份', 'warning');
    }
    return completedAt;
};
