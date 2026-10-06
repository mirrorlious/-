import {
  CURRENT_GEMINI_TEXT_MODEL,
  CURRENT_GEMINI_TTS_MODEL,
  normalizeApiConfig
} from './api-config.js';

const DEFAULT_API_CONFIG = {
    apiType: 'gemini', key: '', model: CURRENT_GEMINI_TEXT_MODEL,
    baseUrl: 'https://generativelanguage.googleapis.com', apiVersion: 'v1beta',
    rememberKey: false,
    taskRoutes: {
        analysis: { model: CURRENT_GEMINI_TEXT_MODEL },
        ocr: { model: CURRENT_GEMINI_TEXT_MODEL },
        tts: { model: CURRENT_GEMINI_TTS_MODEL }
    }
};

const DEFAULT_TYPOGRAPHY_CONFIG = {
    preset: 'editorial',
    fontFamily: 'Georgia, "Times New Roman", serif',
    readingFontFamily: 'Georgia, "Times New Roman", serif',
    chineseFontFamily: '"Noto Serif SC", STSong, serif',
    fontSize: 20,
    lineHeight: 1.72,
    paragraphSpacing: 1.05,
    measure: 66,
    paddingX: 6,
    theme: 'light',
    typographyMigrationVersion: 1
};

const TYPOGRAPHY_PRESETS = {
    editorial: { readingFontFamily: 'Georgia, "Times New Roman", serif', chineseFontFamily: '"Noto Serif SC", STSong, serif', fontSize: 20, lineHeight: 1.72, paragraphSpacing: 1.05, measure: 66 },
    modern: { readingFontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', chineseFontFamily: 'system-ui, "Microsoft YaHei", sans-serif', fontSize: 18, lineHeight: 1.65, paragraphSpacing: 0.9, measure: 70 },
    classic: { readingFontFamily: '"Times New Roman", Times, serif', chineseFontFamily: 'STSong, SimSun, serif', fontSize: 21, lineHeight: 1.85, paragraphSpacing: 1.2, measure: 62 },
    custom: {}
};

const LOCAL_STORAGE_KEY = 'yang-reader-state-v1';

const API_KEY_SESSION_STORAGE_KEY = 'yang-reader-api-key-v1';

const API_KEY_LOCAL_STORAGE_KEY = 'yang-reader-api-key-v1';

const READER_DB_NAME = 'yang-reader-local-v1';

const READER_DB_VERSION = 3;

const CACHE_PROMPT_VERSION = '2026-07-26-v1';

let readerDbPromise = null;

const openReaderDb = () => {
    if (readerDbPromise) return readerDbPromise;
    readerDbPromise = new Promise(resolve => {
        if (!window.indexedDB) { resolve(null); return; }
        let request;
        try { request = window.indexedDB.open(READER_DB_NAME, READER_DB_VERSION); }
        catch { resolve(null); return; }
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const name of ['ai-cache', 'tts-cache', 'pdf-tasks', 'book-imports', 'book-articles', 'article-bundles', 'batch-analysis-jobs']) {
                if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); readerDbPromise = null; };
            db.onclose = () => { readerDbPromise = null; };
            resolve(db);
        };
        request.onerror = () => resolve(null);
        request.onblocked = () => console.warn('本地数据库升级被其他页面阻塞，请关闭旧页面后重试');
    }).then(db => {
        if (!db) readerDbPromise = null;
        return db;
    });
    return readerDbPromise;
};

const runReaderStore = async (storeName, mode, operation, fallback) => {
    const db = await openReaderDb();
    if (!db || !db.objectStoreNames.contains(storeName)) return fallback;
    return new Promise(resolve => {
        let transaction;
        let result = fallback;
        try {
            transaction = db.transaction(storeName, mode);
            transaction.oncomplete = () => resolve(result);
            transaction.onabort = () => resolve(fallback);
            transaction.onerror = () => resolve(fallback);
            const request = operation(transaction.objectStore(storeName));
            request.onsuccess = () => { result = mode === 'readwrite' ? true : request.result ?? fallback; };
        } catch {
            try { transaction?.abort(); } catch { /* Transaction may already be inactive. */ }
            resolve(fallback);
        }
    });
};

const readReaderStore = (storeName, key) => runReaderStore(storeName, 'readonly', store => store.get(key), null);
const writeReaderStore = (storeName, value) => runReaderStore(storeName, 'readwrite', store => store.put(value), false);
const deleteReaderStore = (storeName, key) => runReaderStore(storeName, 'readwrite', store => store.delete(key), false);
const readAllReaderStore = (storeName) => runReaderStore(storeName, 'readonly', store => store.getAll(), []);

const hashBytes = async (bytes) => {
    if (!window.crypto?.subtle) {
        throw new Error('内容缓存需要安全浏览器环境，请使用 HTTPS 或 localhost 打开阅读器');
    }
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const hashText = (value) => hashBytes(new TextEncoder().encode(value));

const buildCacheKey = async (kind, input, config = {}, options = {}) => {
    const identity = JSON.stringify({ kind, input, model: config.model || '', apiType: config.apiType || '', baseUrl: config.baseUrl || '', apiVersion: config.apiVersion || 'v1beta', promptVersion: CACHE_PROMPT_VERSION, options });
    return `${kind}:${await hashText(identity)}`;
};

const getStoredApiKey = (legacyKey = '') => {
    try {
        const sessionKey = window.sessionStorage.getItem(API_KEY_SESSION_STORAGE_KEY);
        if (sessionKey) return sessionKey;
        const rememberedKey = window.localStorage.getItem(API_KEY_LOCAL_STORAGE_KEY);
        if (rememberedKey) return rememberedKey;
        if (legacyKey) {
            window.sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, legacyKey);
            try {
                const state = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || '{}') || {};
                if (state.apiConfig?.key) {
                    const { key, ...safeApiConfig } = state.apiConfig;
                    state.apiConfig = safeApiConfig;
                    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
                }
            } catch (error) { console.warn('Legacy API Key cleanup failed'); }
            return legacyKey;
        }
    } catch (error) { console.warn('API Key restore failed'); }
    return '';
};

const sanitizeApiConfig = (config = {}) => {
    const { key, ...safeConfig } = config;
    return { ...safeConfig, key: '' };
};

const persistApiKey = (config = {}) => {
    try {
        const key = String(config.key || '').trim();
        if (key) window.sessionStorage.setItem(API_KEY_SESSION_STORAGE_KEY, key);
        else window.sessionStorage.removeItem(API_KEY_SESSION_STORAGE_KEY);
        if (config.rememberKey && key) window.localStorage.setItem(API_KEY_LOCAL_STORAGE_KEY, key);
        else window.localStorage.removeItem(API_KEY_LOCAL_STORAGE_KEY);
    } catch (error) { console.warn('API Key save failed'); }
};

const resolveTaskApiConfig = (config = {}, task = 'analysis') => {
    const route = config.taskRoutes?.[task] || {};
    return normalizeApiConfig({ ...config, ...route, key: config.key || getStoredApiKey() });
};

export {
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
  buildCacheKey,
  getStoredApiKey,
  sanitizeApiConfig,
  persistApiKey,
  resolveTaskApiConfig
};
